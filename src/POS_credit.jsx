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
} from "lucide-react";

import { supabase } from "./supabase";
import "./POS.css";

function POS() {
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [branchStock, setBranchStock] = useState({});
  const [cart, setCart] = useState([]);

  const [invoiceType, setInvoiceType] = useState("VAT");
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");

  const [paymentMode, setPaymentMode] = useState("FULL");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");

  const [customerOutstanding, setCustomerOutstanding] = useState(0);
  const [creditLoading, setCreditLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPOSData();
  }, []);

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
    } else {
      const activeBranches = branchResult.data || [];
      setBranches(activeBranches);

      if (!branchId && activeBranches.length > 0) {
        setBranchId(activeBranches[0].id);
      }
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

  const filteredItems = items.filter((item) => {
    const text = search.toLowerCase();

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

  function getLineCalculation(item) {
    const qty = Number(item.quantity || 0);
    const unitPrice = Number(item.selling_price || 0);

    const gross = qty * unitPrice;

    const discount = Math.min(
      Math.max(Number(item.discount || 0), 0),
      gross
    );

    const netBeforeTax = gross - discount;

    const isTaxable =
      invoiceType === "VAT" &&
      item.vat_type === "VAT";

    const taxableAmount = isTaxable
      ? netBeforeTax
      : 0;

    const vatAmount = isTaxable
      ? taxableAmount *
        (Number(item.vat_rate || 0) / 100)
      : 0;

    return {
      gross,
      discount,
      netBeforeTax,
      taxableAmount,
      vatAmount,
      lineTotal: netBeforeTax + vatAmount,
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

      alert(
        result?.invoice_number
          ? `Sale completed successfully.
Invoice: ${result.invoice_number}
Status: ${result.payment_status || paymentStatus}
Paid: Rs. ${Number(
              result.paid_amount ?? appliedPaid
            ).toLocaleString("en-LK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
Due: Rs. ${Number(
              result.due_amount ?? dueAmount
            ).toLocaleString("en-LK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "Sale completed successfully."
      );

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
                const nextBranchId =
                  e.target.value;

                if (
                  cart.length > 0 &&
                  nextBranchId !== branchId
                ) {
                  const confirmed =
                    window.confirm(
                      "Changing branch will clear the current cart. Continue?"
                    );

                  if (!confirmed) {
                    return;
                  }
                }

                setBranchId(nextBranchId);
                setCart([]);
                setPaymentMode("FULL");
                setAmountPaid("");
              }}
            >
              <option value="">
                Select Branch
              </option>

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
                    Rs.{" "}
                    {Number(
                      item.selling_price || 0
                    ).toLocaleString("en-LK", {
                      minimumFractionDigits: 2,
                    })}
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
                          {Number(
                            item.selling_price
                          ).toLocaleString(
                            "en-LK",
                            {
                              minimumFractionDigits: 2,
                            }
                          )}
                        </span>
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

                        <strong>
                          {item.quantity}
                        </strong>

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
    </div>
  );
}

export default POS;