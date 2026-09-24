import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Building2,
  ReceiptText,
  Mail,
  MessageCircle,
  X,
} from "lucide-react";

import { supabase } from "./supabase";
import "./POS.css";

function POS({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [branchStock, setBranchStock] = useState({});
  const [cart, setCart] = useState([]);

  const [invoiceType, setInvoiceType] = useState("VAT");
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [customerId, setCustomerId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [cashiers, setCashiers] = useState([]);
  const [search, setSearch] = useState("");

  const [paymentMode, setPaymentMode] = useState("FULL");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");

  const [customerOutstanding, setCustomerOutstanding] = useState(0);
  const [creditLoading, setCreditLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [shareWhatsAppNumber, setShareWhatsAppNumber] = useState("");

  useEffect(() => {
    loadPOSData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setCashierId("");
    setCart([]);
    setPaymentMode("FULL");
    setAmountPaid("");
    setSearch("");
  }, [activeBranchId, activeBranch?.id]);

  useEffect(() => {
    if (branchId) {
      loadBranchStock(branchId);
    } else {
      setBranchStock({});
    }
  }, [branchId]);

  useEffect(() => {
    if (customerId) {
      loadCustomerCredit(customerId);
    } else {
      setCustomerOutstanding(0);
      setCreditLoading(false);
    }
  }, [customerId]);

  async function loadCustomerCredit(selectedCustomerId) {
    if (!selectedCustomerId) {
      setCustomerOutstanding(0);
      return;
    }

    try {
      setCreditLoading(true);

      const { data, error } = await supabase.rpc(
        "get_customer_outstanding",
        {
          p_customer_id: selectedCustomerId,
        }
      );

      if (error) {
        throw error;
      }

      setCustomerOutstanding(Number(data || 0));
    } catch (error) {
      console.error("Customer credit error:", error);
      setCustomerOutstanding(0);
    } finally {
      setCreditLoading(false);
    }
  }

  async function loadBranchStock(selectedBranchId) {
    if (!selectedBranchId) {
      setBranchStock({});
      return;
    }

    const { data, error } = await supabase
      .from("branch_stock")
      .select("item_id, quantity, reorder_level")
      .eq("branch_id", selectedBranchId);

    if (error) {
      console.error("Branch stock error:", error);
      alert(error.message);
      return;
    }

    const stockMap = {};

    (data || []).forEach((row) => {
      stockMap[row.item_id] = {
        quantity: Number(row.quantity || 0),
        reorder_level: Number(row.reorder_level || 0),
      };
    });

    setBranchStock(stockMap);
  }

  async function loadPOSData() {
    setLoading(true);

    const [
      customerResult,
      itemResult,
      branchResult,
      cashierResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true }),

      supabase
        .from("items")
        .select("*")
        .order("name", { ascending: true }),

      supabase
        .from("branches")
        .select("*")
        .eq("status", "ACTIVE")
        .order("branch_name", { ascending: true }),

      supabase
        .from("cashiers")
        .select("id, cashier_code, name, phone, email, branch_id, status")
        .eq("status", "ACTIVE")
        .order("name", { ascending: true }),
    ]);

    if (customerResult.error) {
      console.error(customerResult.error);
      alert(customerResult.error.message);
    } else {
      setCustomers(customerResult.data || []);
    }

    if (itemResult.error) {
      console.error(itemResult.error);
      alert(itemResult.error.message);
    } else {
      setItems(itemResult.data || []);
    }

    if (branchResult.error) {
      console.error(branchResult.error);
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      const activeBranches =
        appBranches?.length ? appBranches : branchResult.data || [];

      setBranches(activeBranches);

      const currentGlobalBranchId =
        activeBranchId || activeBranch?.id || "";

      if (currentGlobalBranchId) {
        setBranchId(currentGlobalBranchId);
      }
    }

    if (cashierResult.error) {
      console.error(cashierResult.error);
      alert(cashierResult.error.message);
      setCashiers([]);
    } else {
      setCashiers(cashierResult.data || []);
    }

    setLoading(false);
  }

  function getBranchStock(itemId) {
    return Number(
      branchStock[itemId]?.quantity || 0
    );
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  );

  const customerCreditLimit = Number(
    selectedCustomer?.credit_limit || 0
  );

  const customerAvailableCredit = Math.max(
    customerCreditLimit - customerOutstanding,
    0
  );

  const filteredCustomers = customers.filter((customer) =>
    invoiceType === "VAT"
      ? customer.customer_type === "VAT"
      : true
  );

  const filteredCashiers = cashiers.filter(
    (cashier) => !branchId || !cashier.branch_id || cashier.branch_id === branchId
  );

  const selectedCashier = cashiers.find(
    (cashier) => cashier.id === cashierId
  );

  // POS must show only products that belong to the selected branch.
  // branch_stock is the source of truth for which item record belongs to this branch.
  // This prevents old/duplicate company item records (same SKU) from appearing with Stock 0.
  const filteredItems = items.filter((item) => {
    const text = search.toLowerCase();

    const belongsToSelectedBranch =
      !!branchId && Object.prototype.hasOwnProperty.call(branchStock, item.id);

    if (!belongsToSelectedBranch) return false;

    return (
      (item.name || "").toLowerCase().includes(text) ||
      (item.sku || "").toLowerCase().includes(text) ||
      (item.barcode || "").toLowerCase().includes(text)
    );
  });

  function addToCart(item) {
    const availableStock = getBranchStock(item.id);

    if (availableStock <= 0) {
      alert("This item is out of stock.");
      return;
    }

    const existing = cart.find(
      (cartItem) => cartItem.id === item.id
    );

    if (existing) {
      if (
        existing.quantity >=
        availableStock
      ) {
        alert("Insufficient stock.");
        return;
      }

      setCart(
        cart.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...item,
          quantity: 1,
          discount: 0,
          price_type: "RETAIL",
          manual_price: "",
        },
      ]);
    }
  }

  function increaseQty(id) {
    const item = cart.find(
      (cartItem) => cartItem.id === id
    );

    if (!item) return;

    const availableStock =
      getBranchStock(item.id);

    if (
      item.quantity >=
      availableStock
    ) {
      alert("Insufficient stock.");
      return;
    }

    setCart(
      cart.map((cartItem) =>
        cartItem.id === id
          ? {
              ...cartItem,
              quantity: cartItem.quantity + 1,
            }
          : cartItem
      )
    );
  }

  function decreaseQty(id) {
    setCart(
      cart
        .map((cartItem) =>
          cartItem.id === id
            ? {
                ...cartItem,
                quantity: cartItem.quantity - 1,
              }
            : cartItem
        )
        .filter((cartItem) => cartItem.quantity > 0)
    );
  }

  function updateQty(id, value) {
    const item = cart.find((cartItem) => cartItem.id === id);
    if (!item) return;

    if (value === "") {
      setCart(
        cart.map((cartItem) =>
          cartItem.id === id
            ? { ...cartItem, quantity: "" }
            : cartItem
        )
      );
      return;
    }

    const requestedQty = Math.floor(Number(value));
    if (!Number.isFinite(requestedQty)) return;

    const availableStock = getBranchStock(item.id);

    if (requestedQty > availableStock) {
      alert(`Only ${availableStock} units are available in this branch.`);
      setCart(
        cart.map((cartItem) =>
          cartItem.id === id
            ? { ...cartItem, quantity: availableStock }
            : cartItem
        )
      );
      return;
    }

    setCart(
      cart.map((cartItem) =>
        cartItem.id === id
          ? {
              ...cartItem,
              quantity: Math.max(requestedQty, 1),
            }
          : cartItem
      )
    );
  }

  function normalizeQty(id) {
    setCart(
      cart.map((cartItem) =>
        cartItem.id === id &&
        (!cartItem.quantity || Number(cartItem.quantity) < 1)
          ? { ...cartItem, quantity: 1 }
          : cartItem
      )
    );
  }

  function removeItem(id) {
    setCart(
      cart.filter((item) => item.id !== id)
    );
  }

  function updateDiscount(id, value) {
    const discount = Number(value || 0);

    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              discount,
            }
          : item
      )
    );
  }

  function updateItemPriceType(id, nextPriceType) {
    setCart(
      cart.map((item) =>
        item.id === id
          ? { ...item, price_type: nextPriceType }
          : item
      )
    );
  }

  function updateManualPrice(id, value) {
    setCart(
      cart.map((item) =>
        item.id === id
          ? { ...item, manual_price: value }
          : item
      )
    );
  }

  function getItemUnitPrice(item) {
    if (item.price_type === "MANUAL") {
      return Number(item.manual_price || 0);
    }

    return item.price_type === "WHOLESALE"
      ? Number(item.wholesale_price || 0)
      : Number(item.selling_price || 0);
  }

  function getLineCalculation(item) {
    const qty = Number(item.quantity || 0);
    const unitPrice = getItemUnitPrice(item);

    const gross = qty * unitPrice;

    const discount = Math.min(
      Math.max(Number(item.discount || 0), 0),
      gross
    );

    // Retail / Wholesale / Manual prices are VAT-INCLUSIVE.
    // Example: Rs. 590 at 18% VAT = Rs. 500 before VAT + Rs. 90 VAT.
    const netBeforeTax = gross - discount;

    const isTaxable =
      invoiceType === "VAT" &&
      item.vat_type === "VAT" &&
      Number(item.vat_rate || 0) > 0;

    const vatRate = isTaxable
      ? Number(item.vat_rate || 0)
      : 0;

    const taxableAmount = isTaxable
      ? netBeforeTax / (1 + vatRate / 100)
      : 0;

    const vatAmount = isTaxable
      ? netBeforeTax - taxableAmount
      : 0;

    return {
      gross,
      discount,
      netBeforeTax,
      taxableAmount,
      vatAmount,
      // VAT is already included in the selected selling price.
      lineTotal: netBeforeTax,
    };
  }

  const totals = useMemo(() => {
    return cart.reduce(
      (sum, item) => {
        const line = getLineCalculation(item);

        sum.subtotal += line.gross;
        sum.discount += line.discount;
        sum.taxable += line.taxableAmount;
        sum.vat += line.vatAmount;
        sum.total += line.lineTotal;

        return sum;
      },
      {
        subtotal: 0,
        discount: 0,
        taxable: 0,
        vat: 0,
        total: 0,
      }
    );
  }, [cart, invoiceType]);

  const paid = Math.max(Number(amountPaid || 0), 0);
  const appliedPaid = Math.min(paid, totals.total);
  const dueAmount = Math.max(totals.total - appliedPaid, 0);
  const changeAmount = Math.max(paid - totals.total, 0);

  const paymentStatus =
    dueAmount <= 0
      ? "PAID"
      : appliedPaid > 0
      ? "PARTIAL"
      : "UNPAID";

  useEffect(() => {
    if (paymentMode === "FULL") {
      setAmountPaid(
        totals.total > 0
          ? totals.total.toFixed(2)
          : ""
      );
    }

    if (paymentMode === "CREDIT") {
      setAmountPaid("0");
    }
  }, [paymentMode, totals.total]);

  function normalizeWhatsAppPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    if (!digits) return "";

    // Sri Lanka local mobile format: 07XXXXXXXX -> 947XXXXXXXX
    if (digits.startsWith("0") && digits.length === 10) {
      return `94${digits.slice(1)}`;
    }

    return digits;
  }

  function buildShareMessage(sale) {
    return [
      `Thank you for your purchase${sale.customerName ? `, ${sale.customerName}` : ""}.`,
      "",
      `Invoice: ${sale.invoiceNumber}`,
      `Total: Rs. ${Number(sale.total || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      `Paid: Rs. ${Number(sale.paidAmount || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      `Due: Rs. ${Number(sale.dueAmount || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      "",
      "Thank you for your business.",
    ].join("\n");
  }

  function sendLastSaleWhatsApp() {
    if (!lastSale) return;

    const phone = normalizeWhatsAppPhone(
      shareWhatsAppNumber || lastSale.customerPhone
    );

    if (!phone) {
      alert("Enter the customer's WhatsApp number.");
      return;
    }

    if (!lastSale.invoiceLink) {
      alert("Invoice link is not ready. Please try again.");
      return;
    }

    const message = [
      "Thank you for your purchase.",
      "",
      `Invoice: ${lastSale.invoiceNumber}`,
      `Total: Rs. ${Number(lastSale.total || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      "",
      `View invoice: ${lastSale.invoiceLink}`,
      "",
      "Thank you for your business.",
    ].join("\\n");

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function sendLastSaleEmail() {
    if (!lastSale) return;

    const email = String(lastSale.customerEmail || "").trim();

    if (!email) {
      alert("This customer does not have an email address.");
      return;
    }

    const subject = `Invoice ${lastSale.invoiceNumber}`;
    const body = buildShareMessage(lastSale);

    window.location.href =
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  async function completeSale() {
    if (processing) return;

    if (cart.length === 0) {
      alert("Add at least one item.");
      return;
    }

    if (!branchId) {
      alert("Select a branch.");
      return;
    }

    if (!cashierId || !selectedCashier) {
      alert("Select a cashier.");
      return;
    }

    const itemWithInvalidManualPrice = cart.find(
      (item) =>
        item.price_type === "MANUAL" &&
        Number(item.manual_price || 0) <= 0
    );

    if (itemWithInvalidManualPrice) {
      alert(
        `Enter a manual price greater than Rs. 0 for ${itemWithInvalidManualPrice.name}.`
      );
      return;
    }

    const itemWithoutWholesalePrice = cart.find(
      (item) =>
        item.price_type === "WHOLESALE" &&
        Number(item.wholesale_price || 0) <= 0
    );

    if (itemWithoutWholesalePrice) {
      alert(
        `Wholesale price is not configured for ${itemWithoutWholesalePrice.name}.`
      );
      return;
    }

    if (
      invoiceType === "VAT" &&
      !selectedCustomer
    ) {
      alert("Select a VAT customer.");
      return;
    }

    if (
      invoiceType === "VAT" &&
      selectedCustomer?.customer_type !== "VAT"
    ) {
      alert(
        "VAT invoice requires a VAT customer."
      );
      return;
    }

    if (
      paymentMode !== "FULL" &&
      !selectedCustomer
    ) {
      alert(
        "Partial or credit sales require a customer."
      );
      return;
    }

    if (
      paymentMode === "FULL" &&
      paid < totals.total
    ) {
      alert(
        "Full payment must cover the invoice total."
      );
      return;
    }

    if (
      paymentMode === "PARTIAL" &&
      (paid <= 0 || paid >= totals.total)
    ) {
      alert(
        "For a partial payment, enter an amount greater than 0 and less than the invoice total."
      );
      return;
    }

    if (
      paymentMode === "CREDIT" &&
      paid !== 0
    ) {
      alert(
        "Credit / unpaid sale must start with Rs. 0.00 paid."
      );
      return;
    }

    try {
      setProcessing(true);

      /*
        Only send the minimum data required.
        Selling prices, VAT, totals, stock and
        invoice number are controlled by PostgreSQL.
      */
      const rpcItems = cart.map((item) => ({
        item_id: item.id,
        quantity: Number(item.quantity || 0),
        discount: Number(item.discount || 0),
        price_type: item.price_type || "RETAIL",
        manual_price:
          item.price_type === "MANUAL"
            ? Number(item.manual_price || 0)
            : null,
      }));

      const { data, error } =
        await supabase.rpc(
          "create_pos_invoice_credit",
          {
            p_invoice_type: invoiceType,

            p_customer_id:
              selectedCustomer?.id ||
              null,

            p_branch_id:
              branchId,

            p_payment_method:
              paymentMethod,

            p_amount_paid:
              Number(paid || 0),

            p_items: rpcItems,
          }
        );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data) && data.length > 0
          ? data[0]
          : null;

      console.log(
        "Created POS invoice:",
        result
      );

      if (result?.invoice_number) {
        const { error: cashierAssignError } = await supabase.rpc(
          "assign_invoice_master_cashier",
          {
            p_invoice_number: result.invoice_number,
            p_cashier_id: cashierId,
          }
        );

        if (cashierAssignError) throw cashierAssignError;
      }

      let shareToken = null;

      if (result?.invoice_number) {
        const { data: shareRow, error: shareError } = await supabase
          .from("invoices")
          .select("public_share_token")
          .eq("invoice_number", result.invoice_number)
          .maybeSingle();

        if (shareError) {
          console.error("Invoice share link error:", shareError);
        } else {
          shareToken = shareRow?.public_share_token || null;
        }
      }

      const completedSale = {
        invoiceNumber: result?.invoice_number || "Invoice",
        customerName: selectedCustomer?.name || "Walk-in Customer",
        cashierName: selectedCashier?.name || selectedCashier?.cashier_code || "Cashier",
        customerPhone: selectedCustomer?.phone || "",
        customerEmail: selectedCustomer?.email || "",
        invoiceLink: shareToken
          ? `${window.location.origin}/invoice/${shareToken}`
          : "",
        total: Number(result?.total ?? totals.total ?? 0),
        paidAmount: Number(result?.paid_amount ?? appliedPaid ?? 0),
        dueAmount: Number(result?.due_amount ?? dueAmount ?? 0),
      };

      setLastSale(completedSale);
      setShareWhatsAppNumber(selectedCustomer?.phone || "");

      setCart([]);
      setCustomerId("");
      setPaymentMode("FULL");
      setAmountPaid("");
      setPaymentMethod("CASH");
      setSearch("");

      await loadPOSData();
      await loadBranchStock(branchId);
    } catch (error) {
      console.error(
        "Complete sale error:",
        error
      );

      alert(
        error.message ||
          "Unable to complete sale."
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="pos-page">
        <p>Loading POS...</p>
      </div>
    );
  }

  return (
    <div className="pos-page">
      <div className="pos-header">
        <div>
          <h2>Point of Sale</h2>
          <p>
            Create VAT and non-VAT sales invoices.
          </p>
        </div>

        <div className="invoice-toggle">
          <button
            className={
              invoiceType === "VAT"
                ? "active"
                : ""
            }
            onClick={() => {
              setInvoiceType("VAT");
              setCustomerId("");
            }}
          >
            VAT Invoice
          </button>

          <button
            className={
              invoiceType === "NON_VAT"
                ? "active"
                : ""
            }
            onClick={() => {
              setInvoiceType("NON_VAT");
              setCustomerId("");
            }}
          >
            Non-VAT Invoice
          </button>
        </div>

      </div>

      <div className="pos-grid">
        <div className="products-panel">
          <div className="customer-select">
            <label>Branch</label>

            <select
              value={branchId}
              onChange={(e) => {
                const nextBranchId = e.target.value;

                if (!nextBranchId || nextBranchId === branchId) {
                  return;
                }

                if (cart.length > 0) {
                  const confirmed = window.confirm(
                    "Switching branch will clear the current cart after the destination branch password is accepted. Continue?"
                  );

                  if (!confirmed) {
                    return;
                  }
                }

                requestBranchSwitch?.(nextBranchId);
              }}
            >
              {branches.map((branch) => (
                <option
                  key={branch.id}
                  value={branch.id}
                >
                  {branch.branch_code} - {branch.branch_name}
                </option>
              ))}
            </select>
          </div>

          <div className="customer-select">
            <label>Cashier</label>
            <select value={cashierId} onChange={(e) => setCashierId(e.target.value)}>
              <option value="">Select Cashier</option>
              {filteredCashiers.map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.name || cashier.cashier_code || "Unnamed Cashier"}
                </option>
              ))}
            </select>
          </div>

          <div className="customer-select">
            <label>Customer</label>

            <select
              value={customerId}
              onChange={(e) =>
                setCustomerId(e.target.value)
              }
            >
              <option value="">
                {invoiceType === "VAT"
                  ? "Select VAT Customer"
                  : "Walk-in / Select Customer"}
              </option>

              {filteredCustomers.map(
                (customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                    {customer.vat_number
                      ? ` - ${customer.vat_number}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>

          {selectedCustomer && (
            <div
              style={{
                marginTop: "10px",
                padding: "12px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",
                  gap: "10px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <span style={{ color: "#64748b" }}>
                    Credit Limit
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "3px",
                    }}
                  >
                    Rs.{" "}
                    {customerCreditLimit.toLocaleString(
                      "en-LK",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>
                    Outstanding
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "3px",
                    }}
                  >
                    {creditLoading
                      ? "Loading..."
                      : `Rs. ${customerOutstanding.toLocaleString(
                          "en-LK",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}`}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748b" }}>
                    Available Credit
                  </span>
                  <strong
                    style={{
                      display: "block",
                      marginTop: "3px",
                      color:
                        customerAvailableCredit > 0
                          ? "#166534"
                          : "#b91c1c",
                    }}
                  >
                    Rs.{" "}
                    {customerAvailableCredit.toLocaleString(
                      "en-LK",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>
              </div>

              {customerCreditLimit <= 0 && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#b91c1c",
                  }}
                >
                  Credit sales are not allowed for this customer.
                </div>
              )}
            </div>
          )}

          {branchId && (
            <div className="branch-stock-note">
              Stock shown below is for{" "}
              <strong>
                {
                  branches.find(
                    (branch) =>
                      branch.id === branchId
                  )?.branch_name
                }
              </strong>
              .
            </div>
          )}

          <div className="product-search">
            <Search size={19} />

            <input
              autoFocus
              type="text"
              placeholder="Search product, SKU or scan barcode..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <div className="product-grid">
            {filteredItems.length === 0 ? (
              <div className="no-product">
                No products found.
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  className="product-card"
                  onClick={() =>
                    addToCart(item)
                  }
                >
                  <div>
                    <strong>{item.name}</strong>

                    <span>
                      {item.sku} · Branch Stock{" "}
                      {getBranchStock(item.id)}
                    </span>
                  </div>

                  <div className="product-price">
                    <div>
                      Retail Rs.{" "}
                      {Number(item.selling_price || 0).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <div style={{ fontSize: "12px", marginTop: "2px" }}>
                      Wholesale Rs.{" "}
                      {Number(item.wholesale_price || 0).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                  </div>

                  {item.vat_type === "VAT" && (
                    <small>
                      VAT {item.vat_rate}%
                    </small>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="cart-panel">
          <div className="cart-title">
            <div>
              <ShoppingCart size={20} />
              <h3>Current Sale</h3>
            </div>

            <span>{cart.length} items</span>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingCart size={45} />
                <strong>Cart is empty</strong>
                <span>
                  Select an item to begin the sale.
                </span>
              </div>
            ) : (
              cart.map((item) => {
                const line =
                  getLineCalculation(item);

                return (
                  <div
                    className="cart-item"
                    key={item.id}
                  >
                    <div className="cart-item-top">
                      <div>
                        <strong>
                          {item.name}
                        </strong>

                        <span>
                          Rs.{" "}
                          {getItemUnitPrice(item).toLocaleString(
                            "en-LK",
                            {
                              minimumFractionDigits: 2,
                            }
                          )}
                        </span>

                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            marginTop: "8px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => updateItemPriceType(item.id, "RETAIL")}
                            style={{
                              border:
                                item.price_type !== "WHOLESALE"
                                  ? "1px solid #0f172a"
                                  : "1px solid #cbd5e1",
                              background:
                                item.price_type !== "WHOLESALE"
                                  ? "#0f172a"
                                  : "#ffffff",
                              color:
                                item.price_type !== "WHOLESALE"
                                  ? "#ffffff"
                                  : "#334155",
                              borderRadius: "7px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Retail
                          </button>

                          <button
                            type="button"
                            disabled={Number(item.wholesale_price || 0) <= 0}
                            onClick={() => updateItemPriceType(item.id, "WHOLESALE")}
                            title={
                              Number(item.wholesale_price || 0) <= 0
                                ? "Wholesale price is not configured"
                                : "Use wholesale price"
                            }
                            style={{
                              border:
                                item.price_type === "WHOLESALE"
                                  ? "1px solid #0f172a"
                                  : "1px solid #cbd5e1",
                              background:
                                item.price_type === "WHOLESALE"
                                  ? "#0f172a"
                                  : "#ffffff",
                              color:
                                item.price_type === "WHOLESALE"
                                  ? "#ffffff"
                                  : "#334155",
                              opacity:
                                Number(item.wholesale_price || 0) <= 0 ? 0.45 : 1,
                              borderRadius: "7px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor:
                                Number(item.wholesale_price || 0) <= 0
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            Wholesale
                          </button>

                          <button
                            type="button"
                            onClick={() => updateItemPriceType(item.id, "MANUAL")}
                            style={{
                              border:
                                item.price_type === "MANUAL"
                                  ? "1px solid #0f172a"
                                  : "1px solid #cbd5e1",
                              background:
                                item.price_type === "MANUAL"
                                  ? "#0f172a"
                                  : "#ffffff",
                              color:
                                item.price_type === "MANUAL"
                                  ? "#ffffff"
                                  : "#334155",
                              borderRadius: "7px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Manual
                          </button>
                        </div>

                        {item.price_type === "MANUAL" && (
                          <div style={{ marginTop: "8px" }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "11px",
                                fontWeight: 800,
                                color: "#475569",
                                marginBottom: "4px",
                              }}
                            >
                              Manual Unit Price
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.manual_price ?? ""}
                              placeholder="Enter price"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                updateManualPrice(item.id, e.target.value)
                              }
                              style={{
                                width: "135px",
                                boxSizing: "border-box",
                                border: "1px solid #cbd5e1",
                                borderRadius: "7px",
                                padding: "7px 8px",
                                font: "inherit",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        className="remove-btn"
                        onClick={() =>
                          removeItem(item.id)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="cart-item-bottom">
                      <div className="quantity-control">
                        <button
                          onClick={() =>
                            decreaseQty(item.id)
                          }
                        >
                          <Minus size={15} />
                        </button>

                        <input
                          className="quantity-input"
                          type="number"
                          min="1"
                          max={getBranchStock(item.id)}
                          step="1"
                          value={item.quantity}
                          title={`Available stock: ${getBranchStock(item.id)}`}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            updateQty(item.id, e.target.value)
                          }
                          onBlur={() => normalizeQty(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                        />

                        <button
                          onClick={() =>
                            increaseQty(item.id)
                          }
                        >
                          <Plus size={15} />
                        </button>
                      </div>

                      <div className="discount-field">
                        <label>
                          Discount
                        </label>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) =>
                            updateDiscount(
                              item.id,
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <strong className="line-total">
                        Rs.{" "}
                        {line.lineTotal.toLocaleString(
                          "en-LK",
                          {
                            minimumFractionDigits: 2,
                          }
                        )}
                      </strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="totals-box">
            <div>
              <span>Subtotal</span>
              <strong>
                Rs.{" "}
                {totals.subtotal.toLocaleString(
                  "en-LK",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                - Rs.{" "}
                {totals.discount.toLocaleString(
                  "en-LK",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </strong>
            </div>

            {invoiceType === "VAT" && (
              <>
                <div>
                  <span>
                    Taxable Amount
                  </span>

                  <strong>
                    Rs.{" "}
                    {totals.taxable.toLocaleString(
                      "en-LK",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>

                <div>
                  <span>VAT</span>

                  <strong>
                    Rs.{" "}
                    {totals.vat.toLocaleString(
                      "en-LK",
                      {
                        minimumFractionDigits: 2,
                      }
                    )}
                  </strong>
                </div>
              </>
            )}

            <div className="grand-total">
              <span>Total</span>

              <strong>
                Rs.{" "}
                {totals.total.toLocaleString(
                  "en-LK",
                  {
                    minimumFractionDigits: 2,
                  }
                )}
              </strong>
            </div>
          </div>

          <div className="payment-box">
            <label>Payment Type</label>

            <div className="payment-methods">
              <button
                className={
                  paymentMode === "FULL"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setPaymentMode("FULL");
                  setAmountPaid(
                    totals.total > 0
                      ? totals.total.toFixed(2)
                      : ""
                  );
                }}
              >
                Full Payment
              </button>

              <button
                className={
                  paymentMode === "PARTIAL"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setPaymentMode("PARTIAL");
                  setAmountPaid("");
                }}
              >
                Partial Payment
              </button>

              <button
                className={
                  paymentMode === "CREDIT"
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setPaymentMode("CREDIT");
                  setAmountPaid("0");
                }}
              >
                Credit / Unpaid
              </button>
            </div>

            {paymentMode !== "CREDIT" && (
              <>
                <label>Payment Method</label>

                <div className="payment-methods">
                  <button
                    className={
                      paymentMethod === "CASH"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setPaymentMethod("CASH")
                    }
                  >
                    <Banknote size={18} />
                    Cash
                  </button>

                  <button
                    className={
                      paymentMethod === "CARD"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setPaymentMethod("CARD")
                    }
                  >
                    <CreditCard size={18} />
                    Card
                  </button>

                  <button
                    className={
                      paymentMethod === "BANK"
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setPaymentMethod("BANK")
                    }
                  >
                    <Building2 size={18} />
                    Bank
                  </button>
                </div>
              </>
            )}

            <div className="paid-grid">
              <div>
                <label>
                  {paymentMode === "CREDIT"
                    ? "Amount Paid"
                    : "Amount Received"}
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  disabled={paymentMode === "CREDIT"}
                  onChange={(e) =>
                    setAmountPaid(
                      e.target.value
                    )
                  }
                />
              </div>

              <div>
                <label>
                  {changeAmount > 0
                    ? "Change"
                    : "Amount Due"}
                </label>

                <div className="balance-field">
                  Rs.{" "}
                  {(
                    changeAmount > 0
                      ? changeAmount
                      : dueAmount
                  ).toLocaleString(
                    "en-LK",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </div>
              </div>
            </div>

            <div
              className="balance-field"
              style={{
                marginTop: "10px",
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span>Payment Status</span>
              <strong>{paymentStatus}</strong>
            </div>

            {dueAmount > 0 && !selectedCustomer && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  color: "#9a3412",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Select a customer to complete a partial or credit sale.
              </div>
            )}

            <button
              className="complete-sale-btn"
              onClick={completeSale}
              disabled={processing}
            >
              <ReceiptText size={20} />

              {processing
                ? "Processing..."
                : paymentMode === "CREDIT"
                ? "Complete Credit Sale"
                : paymentMode === "PARTIAL"
                ? "Complete Partial Sale"
                : "Complete Sale"}
            </button>
          </div>
        </div>
      </div>

      {lastSale && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.62)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(460px, 100%)",
              background: "#fff",
              borderRadius: "16px",
              boxShadow: "0 24px 70px rgba(15,23,42,.28)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "14px",
                padding: "18px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "18px" }}>
                  Invoice completed
                </strong>
                <span style={{ color: "#64748b", fontSize: "13px" }}>
                  {lastSale.invoiceNumber}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const invoiceUrl = lastSale.invoiceLink;

                  setLastSale(null);
                  setShareWhatsAppNumber("");

                  if (invoiceUrl) {
                    window.open(
                      `${invoiceUrl}?print=1`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  } else {
                    alert("Invoice print page is not available.");
                  }
                }}
                style={{
                  border: 0,
                  background: "#f1f5f9",
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <div
                style={{
                  padding: "14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: "4px" }}>
                  {lastSale.customerName}
                </div>
                <div style={{ color: "#64748b", fontSize: "13px" }}>
                  Total: Rs.{" "}
                  {Number(lastSale.total || 0).toLocaleString("en-LK", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  Customer WhatsApp number
                </label>

                <input
                  type="tel"
                  value={shareWhatsAppNumber}
                  onChange={(e) => setShareWhatsAppNumber(e.target.value)}
                  placeholder="Example: 0761234567"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendLastSaleWhatsApp();
                    }
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "11px 12px",
                    font: "inherit",
                    outline: "none",
                  }}
                />
              </div>

              {lastSale.invoiceLink ? (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "9px 11px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#64748b",
                    wordBreak: "break-all",
                  }}
                >
                  Invoice link: {lastSale.invoiceLink}
                </div>
              ) : (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "9px 11px",
                    background: "#fff7ed",
                    color: "#9a3412",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                >
                  Invoice link could not be created.
                </div>
              )}

              <button
                type="button"
                onClick={sendLastSaleWhatsApp}
                disabled={!shareWhatsAppNumber.trim() || !lastSale.invoiceLink}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: "10px",
                  padding: "12px 14px",
                  background:
                    shareWhatsAppNumber.trim() && lastSale.invoiceLink
                      ? "#166534"
                      : "#cbd5e1",
                  color: "#fff",
                  fontWeight: 800,
                  cursor:
                    shareWhatsAppNumber.trim() && lastSale.invoiceLink
                      ? "pointer"
                      : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <MessageCircle size={18} />
                Send Invoice by WhatsApp
              </button>

              {lastSale.customerEmail && (
                <button
                  type="button"
                  onClick={sendLastSaleEmail}
                  style={{
                    width: "100%",
                    marginTop: "9px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "11px 14px",
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <Mail size={18} />
                  Email
                </button>
              )}

              <p
                style={{
                  margin: "13px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                No customer record is required. Enter any WhatsApp number and
                the invoice link will be prepared in WhatsApp automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;