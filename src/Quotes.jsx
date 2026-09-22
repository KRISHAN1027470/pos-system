import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  Printer,
  X,
  Eye,
  MessageCircle,
  Pencil,
} from "lucide-react";

import { supabase } from "./supabase";
import "./Quotes.css";

function Quotes({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [branchStock, setBranchStock] = useState({});
  const [quotes, setQuotes] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [settings, setSettings] = useState({});
  const [documentPrintSettings, setDocumentPrintSettings] = useState({});

  const [quoteType, setQuoteType] = useState("VAT");
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [customerId, setCustomerId] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [search, setSearch] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [lastCreatedQuote, setLastCreatedQuote] = useState(null);
  const [shareWhatsAppNumber, setShareWhatsAppNumber] = useState("");
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [editingQuoteNumber, setEditingQuoteNumber] = useState("");

  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedQuoteItems, setSelectedQuoteItems] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusProcessing, setStatusProcessing] = useState(false);
  const [convertPaymentMode, setConvertPaymentMode] = useState("FULL");
  const [convertPaymentMethod, setConvertPaymentMethod] = useState("CASH");
  const [convertAmountPaid, setConvertAmountPaid] = useState("");

  const [customerOutstanding, setCustomerOutstanding] = useState(0);
  const [conversionOutstanding, setConversionOutstanding] = useState(0);
  const [creditLoading, setCreditLoading] = useState(false);


  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setCashierId("");
    setCart([]);
    setEditingQuoteId(null);
    setEditingQuoteNumber("");
    setCustomerId("");
    setValidUntil("");
    setNotes("");
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
      loadCustomerCredit(customerId, false);
    } else {
      setCustomerOutstanding(0);
    }
  }, [customerId]);

  async function loadCustomerCredit(customerIdValue, forConversion = false) {
    if (!customerIdValue) {
      if (forConversion) {
        setConversionOutstanding(0);
      } else {
        setCustomerOutstanding(0);
      }
      return;
    }

    try {
      setCreditLoading(true);

      const { data, error } = await supabase.rpc(
        "get_customer_outstanding",
        {
          p_customer_id: customerIdValue,
        }
      );

      if (error) {
        throw error;
      }

      if (forConversion) {
        setConversionOutstanding(Number(data || 0));
      } else {
        setCustomerOutstanding(Number(data || 0));
      }
    } catch (error) {
      console.error("Customer credit error:", error);

      if (forConversion) {
        setConversionOutstanding(0);
      } else {
        setCustomerOutstanding(0);
      }
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

  async function loadData() {
    setLoading(true);

    const [
      customerResult,
      itemResult,
      quoteResult,
      branchResult,
      cashierResult,
      settingsResult,
      documentSettingsResult,
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
        .from("quotes")
        .select("*")
        .order("quote_date", { ascending: false }),

      supabase
        .from("branches")
        .select("*")
        .eq("status", "ACTIVE")
        .order("branch_name", { ascending: true }),

      supabase
        .from("cashiers")
        .select("id, cashier_code, name, branch_id, status")
        .eq("status", "ACTIVE")
        .order("name", { ascending: true }),

      supabase
        .from("app_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("document_print_settings")
        .select("*"),
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

    if (quoteResult.error) {
      console.error(quoteResult.error);
      alert(quoteResult.error.message);
    } else {
      setQuotes(quoteResult.data || []);
    }

    if (cashierResult.error) {
      console.error(cashierResult.error);
      alert(cashierResult.error.message);
    } else {
      setCashiers(cashierResult.data || []);
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

    if (settingsResult?.error) {
      console.error(settingsResult.error);
    } else {
      setSettings(settingsResult?.data || {});
    }

    if (documentSettingsResult?.error) {
      console.error("Document print settings load error:", documentSettingsResult.error);
      setDocumentPrintSettings({});
    } else {
      const map = {};
      (documentSettingsResult?.data || []).forEach((row) => {
        map[row.document_type] = row;
      });
      setDocumentPrintSettings(map);
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

  const conversionCustomer = customers.find(
    (customer) =>
      customer.id === selectedQuote?.customer_id
  );

  const conversionCreditLimit = Number(
    conversionCustomer?.credit_limit || 0
  );

  const conversionAvailableCredit = Math.max(
    conversionCreditLimit - conversionOutstanding,
    0
  );

  const filteredCustomers = customers.filter((customer) =>
    quoteType === "VAT"
      ? customer.customer_type === "VAT"
      : true
  );

  const branchCashiers = cashiers.filter(
    (cashier) => cashier.branch_id === branchId
  );

  function getCashierName(id) {
    return cashiers.find((cashier) => cashier.id === id)?.name || "-";
  }

  function getQuoteBranch(quote) {
    if (!quote?.branch_id) return null;
    return branches.find((branch) => branch.id === quote.branch_id) || null;
  }

  function getQuoteBranchName(quote) {
    const branch = getQuoteBranch(quote);
    return branch?.branch_name || "LE ELECTRICS";
  }

  const filteredItems = items.filter((item) => {
    const text = search.toLowerCase();

    return (
      (item.name || "").toLowerCase().includes(text) ||
      (item.sku || "").toLowerCase().includes(text) ||
      (item.barcode || "").toLowerCase().includes(text)
    );
  });

  const filteredQuotes = quotes.filter((quote) => {
    const text = quoteSearch.toLowerCase();

    return (
      (quote.quote_number || "").toLowerCase().includes(text) ||
      (quote.customer_name || "").toLowerCase().includes(text) ||
      (quote.status || "").toLowerCase().includes(text)
    );
  });

  function addToCart(item) {
    const existing = cart.find(
      (cartItem) => cartItem.id === item.id
    );

    if (existing) {
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
    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQty(id) {
    setCart(
      cart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function updateQty(id, value) {
    if (value === "") {
      setCart(
        cart.map((item) =>
          item.id === id ? { ...item, quantity: "" } : item
        )
      );
      return;
    }

    const requestedQty = Math.floor(Number(value));

    if (!Number.isFinite(requestedQty)) return;

    setCart(
      cart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(requestedQty, 1),
            }
          : item
      )
    );
  }

  function normalizeQty(id) {
    setCart(
      cart.map((item) =>
        item.id === id &&
        (!item.quantity || Number(item.quantity) < 1)
          ? { ...item, quantity: 1 }
          : item
      )
    );
  }

  function removeItem(id) {
    setCart(cart.filter((item) => item.id !== id));
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

    const netBeforeTax = gross - discount;

    const isTaxable =
      quoteType === "VAT" &&
      item.vat_type === "VAT";

    // Retail / Wholesale / Manual prices are VAT-INCLUSIVE.
    // Example: Rs. 590 at 18% VAT = Rs. 500 before VAT + Rs. 90 VAT.
    const vatRate = isTaxable
      ? Number(item.vat_rate || 0)
      : 0;

    const taxableAmount =
      isTaxable && vatRate > 0
        ? netBeforeTax / (1 + vatRate / 100)
        : 0;

    const vatAmount =
      isTaxable && vatRate > 0
        ? netBeforeTax - taxableAmount
        : 0;

    return {
      gross,
      discount,
      taxableAmount,
      vatAmount,
      // VAT is already included in the selected quotation price.
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
  }, [cart, quoteType]);

  function normalizeWhatsAppPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";

    if (digits.startsWith("0") && digits.length === 10) {
      return `94${digits.slice(1)}`;
    }

    return digits;
  }

  function sendQuoteWhatsApp() {
    if (!lastCreatedQuote) return;

    const phone = normalizeWhatsAppPhone(shareWhatsAppNumber);

    if (!phone) {
      alert("Enter the customer's WhatsApp number.");
      return;
    }

    if (!lastCreatedQuote.quoteLink) {
      alert("Quotation link is not ready.");
      return;
    }

    const message = [
      "Thank you for your enquiry.",
      "",
      `Quotation: ${lastCreatedQuote.quoteNumber}`,
      `Total: Rs. ${Number(lastCreatedQuote.total || 0).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      "",
      `View quotation: ${lastCreatedQuote.quoteLink}`,
      "",
      "Thank you for your business.",
    ].join("\\n");

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }


  async function startEditQuote() {
    if (!selectedQuote) return;

    if (selectedQuote.status !== "DRAFT") {
      alert("Only DRAFT quotations can be edited.");
      return;
    }

    if (detailsLoading) return;

    const quote = selectedQuote;
    const quoteItems = selectedQuoteItems || [];

    if (quote.branch_id && quote.branch_id !== (activeBranchId || activeBranch?.id)) {
      alert("Switch to this quotation's branch and unlock it before editing.");
      requestBranchSwitch?.(quote.branch_id);
      return;
    }

    const editCart = quoteItems.map((line) => {
      const masterItem = items.find((row) => row.id === line.item_id);

      return {
        ...(masterItem || {}),
        id: line.item_id,
        name: line.item_name || masterItem?.name || "Item",
        sku: line.sku || masterItem?.sku || "",
        selling_price: Number(masterItem?.selling_price ?? line.unit_price ?? 0),
        wholesale_price: Number(
          masterItem?.wholesale_price ??
            (line.price_type === "WHOLESALE" ? line.unit_price : 0)
        ),
        price_type: line.price_type || "RETAIL",
        manual_price:
          line.price_type === "MANUAL"
            ? String(Number(line.unit_price || 0))
            : "",
        vat_type:
          Number(line.vat_rate || 0) > 0
            ? "VAT"
            : masterItem?.vat_type || "NON_VAT",
        vat_rate: Number(line.vat_rate ?? masterItem?.vat_rate ?? 0),
        quantity: Number(line.quantity || 1),
        discount: Number(line.discount || 0),
      };
    });

    setEditingQuoteId(quote.id);
    setEditingQuoteNumber(quote.quote_number || "");
    setQuoteType(quote.quote_type || "NON_VAT");
    setBranchId(activeBranchId || activeBranch?.id || quote.branch_id || "");
    setCustomerId(quote.customer_id || "");
    setCashierId(quote.cashier_id || "");
    setValidUntil(
      quote.valid_until
        ? String(quote.valid_until).slice(0, 10)
        : ""
    );
    setNotes(quote.notes || "");
    setCart(editCart);
    setSearch("");

    closeQuote();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEditQuote() {
    setEditingQuoteId(null);
    setEditingQuoteNumber("");
    setCart([]);
    setCustomerId("");
    setCashierId("");
    setValidUntil("");
    setNotes("");
    setSearch("");
  }

  async function saveEditedQuote() {
    if (!editingQuoteId || processing) return;

    if (cart.length === 0) {
      alert("Add at least one item.");
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

    if (!branchId) {
      alert("Select a branch.");
      return;
    }

    if (quoteType === "VAT" && !selectedCustomer) {
      alert("Select a VAT customer.");
      return;
    }

    if (
      quoteType === "VAT" &&
      selectedCustomer?.customer_type !== "VAT"
    ) {
      alert("VAT quotation requires a VAT customer.");
      return;
    }

    if (!cashierId) {
      alert("Select a cashier.");
      return;
    }

    const selectedCashier = cashiers.find(
      (cashier) => cashier.id === cashierId
    );

    if (
      !selectedCashier ||
      selectedCashier.branch_id !== branchId
    ) {
      alert("Select an active cashier for the selected branch.");
      return;
    }

    const confirmed = window.confirm(
      `Save changes to ${editingQuoteNumber || "this quotation"}?`
    );

    if (!confirmed) return;

    try {
      setProcessing(true);

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

      const { error } = await supabase.rpc(
        "update_quote_draft",
        {
          p_quote_id: editingQuoteId,
          p_quote_type: quoteType,
          p_customer_id: selectedCustomer?.id || null,
          p_branch_id: branchId,
          p_cashier_id: cashierId,
          p_valid_until: validUntil || null,
          p_notes: notes.trim() || null,
          p_items: rpcItems,
        }
      );

      if (error) throw error;

      alert(
        `${editingQuoteNumber || "Quotation"} updated successfully.`
      );

      setEditingQuoteId(null);
      setEditingQuoteNumber("");
      setCart([]);
      setCustomerId("");
      setCashierId("");
      setSearch("");
      setValidUntil("");
      setNotes("");

      await loadData();
      await loadBranchStock(branchId);
    } catch (error) {
      console.error("Update quotation error:", error);
      alert(
        error.message ||
          "Unable to update quotation."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function createQuote() {
    if (processing) return;

    if (cart.length === 0) {
      alert("Add at least one item.");
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

    if (!branchId) {
      alert("Select a branch.");
      return;
    }

    if (
      quoteType === "VAT" &&
      !selectedCustomer
    ) {
      alert("Select a VAT customer.");
      return;
    }

    if (
      quoteType === "VAT" &&
      selectedCustomer?.customer_type !== "VAT"
    ) {
      alert("VAT quotation requires a VAT customer.");
      return;
    }

    if (!cashierId) {
      alert("Select a cashier.");
      return;
    }

    const selectedCashier = cashiers.find(
      (cashier) => cashier.id === cashierId
    );

    if (!selectedCashier || selectedCashier.branch_id !== branchId) {
      alert("Select an active cashier for the selected branch.");
      return;
    }

    try {
      setProcessing(true);

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

      const { data, error } = await supabase.rpc(
        "create_quote",
        {
          p_quote_type: quoteType,
          p_customer_id:
            selectedCustomer?.id || null,
          p_branch_id:
            branchId,
          p_valid_until:
            validUntil || null,
          p_notes:
            notes.trim() || null,
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

      let shareToken = null;
      let createdQuote = null;

      if (result?.quote_number) {
        const { data: shareRow, error: shareError } = await supabase
          .from("quotes")
          .select("id, quote_number, total, public_share_token, cashier_id")
          .eq("quote_number", result.quote_number)
          .maybeSingle();

        if (shareError) {
          console.error("Quotation share link error:", shareError);
        } else {
          createdQuote = shareRow;
          shareToken = shareRow?.public_share_token || null;
        }
      }

      if (createdQuote?.id) {
        const { error: cashierAssignError } = await supabase.rpc(
          "assign_quote_cashier",
          {
            p_quote_id: createdQuote.id,
            p_cashier_id: cashierId,
          }
        );

        if (cashierAssignError) {
          throw cashierAssignError;
        }
      }

      setLastCreatedQuote({
        quoteNumber: result?.quote_number || createdQuote?.quote_number || "Quotation",
        total: Number(createdQuote?.total ?? totals.total ?? 0),
        quoteLink: shareToken
          ? `${window.location.origin}/quote/${shareToken}`
          : "",
      });
      setShareWhatsAppNumber(selectedCustomer?.phone || "");

      alert(
        result?.quote_number
          ? `Quotation created successfully.\n${result.quote_number}`
          : "Quotation created successfully."
      );

      setCart([]);
      setCustomerId("");
      setCashierId("");
      setSearch("");
      setValidUntil("");
      setNotes("");

      await loadData();
    } catch (error) {
      console.error("Create quote error:", error);

      alert(
        error.message ||
          "Unable to create quotation."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function viewQuote(quote) {
    setSelectedQuote(quote);

    const quoteDocumentType =
      String(quote?.quote_type || "").toUpperCase() === "VAT"
        ? "TAX_QUOTATION"
        : "NON_VAT_QUOTATION";

    const { data: freshPrintSetting, error: freshPrintSettingError } =
      await supabase
        .from("document_print_settings")
        .select("*")
        .eq("document_type", quoteDocumentType)
        .maybeSingle();

    if (freshPrintSettingError) {
      console.error("Quotation document settings refresh error:", freshPrintSettingError);
    } else if (freshPrintSetting) {
      setDocumentPrintSettings((current) => ({
        ...current,
        [quoteDocumentType]: freshPrintSetting,
      }));
    }

    setConvertPaymentMode("FULL");
    setConvertPaymentMethod("CASH");
    setConvertAmountPaid(String(Number(quote.total || 0)));
    setDetailsLoading(true);

    if (quote.customer_id) {
      loadCustomerCredit(quote.customer_id, true);
    } else {
      setConversionOutstanding(0);
    }

    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      alert(error.message);
      setSelectedQuoteItems([]);
    } else {
      setSelectedQuoteItems(data || []);
    }

    setDetailsLoading(false);
  }

  function closeQuote() {
    setSelectedQuote(null);
    setSelectedQuoteItems([]);
    setConvertPaymentMode("FULL");
    setConvertPaymentMethod("CASH");
    setConvertAmountPaid("");
  }

  async function updateQuoteStatus(newStatus) {
    if (!selectedQuote || statusProcessing) return;

    if (selectedQuote.status === "CONVERTED") {
      alert("Converted quotations cannot be changed.");
      return;
    }

    try {
      setStatusProcessing(true);

      const { error } = await supabase.rpc(
        "update_quote_status",
        {
          p_quote_id: selectedQuote.id,
          p_status: newStatus,
        }
      );

      if (error) {
        throw error;
      }

      setSelectedQuote((current) => ({
        ...current,
        status: newStatus,
      }));

      await loadData();

      alert(`Quotation status changed to ${newStatus}.`);
    } catch (error) {
      console.error("Update quotation status error:", error);

      alert(
        error.message ||
          "Unable to update quotation status."
      );
    } finally {
      setStatusProcessing(false);
    }
  }

  async function printConvertedInvoice(invoiceNumber) {
    if (!invoiceNumber) {
      alert("Invoice created, but the invoice number was not returned for printing.");
      return;
    }

    const [invoiceResult, settingsResult] = await Promise.all([
      supabase.from("invoices").select("*").eq("invoice_number", invoiceNumber).maybeSingle(),
      supabase.from("app_settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (invoiceResult.error) throw invoiceResult.error;
    const invoice = invoiceResult.data;
    if (!invoice) throw new Error(`Invoice ${invoiceNumber} was created but could not be loaded for printing.`);

    const { data: invoiceLines, error: linesError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("id", { ascending: true });
    if (linesError) throw linesError;

    const branch = branches.find((row) => row.id === invoice.branch_id);
    const appSettings = settingsResult.data || {};
    const invoiceDocumentType =
      String(invoice.invoice_type || "").toUpperCase() === "VAT"
        ? "TAX_INVOICE"
        : "NON_VAT_INVOICE";

    const { data: invoiceDocumentSettings, error: invoiceDocumentSettingsError } =
      await supabase
        .from("document_print_settings")
        .select("*")
        .eq("document_type", invoiceDocumentType)
        .maybeSingle();

    if (invoiceDocumentSettingsError) {
      console.error("Invoice document settings load error:", invoiceDocumentSettingsError);
    }

    const settings = {
      ...appSettings,
      ...(invoiceDocumentSettings || {}),
    };
    const currency = settings.currency_symbol || appSettings.currency_symbol || "Rs.";

    const escapeHtml = (value) => String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const money = (value) => Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const date = (value) => value ? new Date(value).toLocaleString("en-LK") : "-";

    const branchLabel = branch
      ? `${branch.branch_code || ""}${branch.branch_code ? " - " : ""}${branch.branch_name || ""}`
      : "-";
    const businessName = branch?.branch_name || settings.company_name || "LE ELECTRICS";
    const customerName = invoice.customer_name || selectedQuote?.customer_name || "Walk-in Customer";
    const invoiceCashier = cashiers.find((row) => row.id === invoice.cashier_id);
    const cashierName = invoiceCashier?.name || invoiceCashier?.cashier_code || getCashierName(selectedQuote?.cashier_id) || "-";
    const paymentMethod = invoice.payment_method || (Number(invoice.due_amount || 0) > 0 ? "Credit" : "CASH");
    const logo = settings.logo_url
      ? `<img src="${escapeHtml(settings.logo_url)}" alt="Logo" class="logo">`
      : "";

    const businessDetails = [
      settings.receipt_show_branch_address !== false ? branch?.address : "",
      settings.receipt_show_branch_phone !== false ? branch?.phone : "",
    ].filter(Boolean).map((v) => `<div>${escapeHtml(v)}</div>`).join("");

    const rows = (invoiceLines || []).map((line) => {
      const qty = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price ?? line.selling_price ?? 0);
      const lineTotal = Number(line.line_total ?? line.total ?? qty * unitPrice);
      return `<tr>
        <td><strong>${escapeHtml(line.item_name || line.name || "Item")}</strong>${line.sku ? `<small>${escapeHtml(line.sku)}</small>` : ""}</td>
        <td class="right">${escapeHtml(qty)}</td>
        <td class="right">${escapeHtml(currency)} ${money(unitPrice)}</td>
        <td class="right bold">${escapeHtml(currency)} ${money(lineTotal)}</td>
      </tr>`;
    }).join("");

    const subtotal = Number(invoice.subtotal ?? invoice.sub_total ?? invoice.total ?? 0);
    const discount = Number(invoice.discount ?? invoice.discount_amount ?? 0);
    const vat = Number(invoice.vat_amount ?? invoice.tax_amount ?? 0);
    const total = Number(invoice.total ?? invoice.total_amount ?? selectedQuote?.total ?? 0);
    const paid = Number(invoice.paid_amount ?? 0);
    const due = Number(invoice.due_amount ?? Math.max(total - paid, 0));
    const isVat = String(invoice.invoice_type || selectedQuote?.quote_type || "").toUpperCase() === "VAT";

    const standardHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoiceNumber)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:Arial,sans-serif;font-size:12px}.sheet{width:100%;padding:14px}.topline{border-top:1px solid #dbe3ee;margin-bottom:16px}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #cbd5e1;padding-bottom:14px}.logo{max-width:90px;max-height:42px;object-fit:contain;display:block;margin-bottom:10px}.business h1{font-size:17px;margin:0 0 3px;font-weight:800}.business div{font-size:12px;line-height:1.45}.doc{text-align:right}.doc h2{font-size:18px;margin:0;font-weight:900}.doc .number{font-size:13px;font-weight:900;margin-top:3px}.doc .status{font-size:10px;font-weight:900;margin-top:5px}.info{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:12px 0 16px}.box{border:1px solid #dbe3ee;border-radius:5px;padding:7px 9px;min-height:45px}.box span{display:block;color:#94a3b8;font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:3px}.box strong{font-size:11px}table{width:100%;border-collapse:collapse}th{background:#f8fafc;border-top:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:6px;text-align:left;color:#475569;font-size:10px;text-transform:uppercase}td{border-bottom:1px solid #e2e8f0;padding:7px 6px;vertical-align:top;font-size:11px}td small{display:block;color:#64748b;font-size:9px;margin-top:1px}.right{text-align:right}.bold{font-weight:800}.summary{width:42%;min-width:240px;margin:12px 0 0 auto}.summary-row{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #e2e8f0;padding:5px 0}.summary-row span{color:#64748b}.summary-row strong{white-space:nowrap}.footer{border-top:1px solid #dbe3ee;margin-top:16px;padding-top:10px;text-align:center;color:#94a3b8;font-size:9px}@media print{html,body{width:100%;margin:0!important;padding:0!important}.sheet{padding:0}.topline{margin-bottom:14px}}
</style></head><body><div class="sheet"><div class="topline"></div>
<div class="header"><div class="business">${logo}<h1>${escapeHtml(businessName)}</h1>${businessDetails}</div><div class="doc"><h2>${isVat ? "VAT INVOICE" : "INVOICE"}</h2><div class="number">${escapeHtml(invoiceNumber)}</div><div class="status">${escapeHtml(invoice.status || "COMPLETED")}</div></div></div>
<div class="info"><div class="box"><span>Date</span><strong>${escapeHtml(date(invoice.invoice_date || invoice.created_at))}</strong></div><div class="box"><span>Branch</span><strong>${escapeHtml(branchLabel)}</strong></div><div class="box"><span>Customer</span><strong>${escapeHtml(customerName)}</strong></div><div class="box"><span>Cashier</span><strong>${escapeHtml(cashierName)}</strong></div><div class="box"><span>Payment</span><strong>${escapeHtml(paymentMethod)}</strong></div></div>
<table><thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="summary"><div class="summary-row"><span>Subtotal</span><strong>${escapeHtml(currency)} ${money(subtotal)}</strong></div>${discount > 0 ? `<div class="summary-row"><span>Discount</span><strong>${escapeHtml(currency)} ${money(discount)}</strong></div>` : ""}${isVat ? `<div class="summary-row"><span>VAT</span><strong>${escapeHtml(currency)} ${money(vat)}</strong></div>` : ""}<div class="summary-row"><span>Invoice Total</span><strong>${escapeHtml(currency)} ${money(total)}</strong></div><div class="summary-row"><span>Paid</span><strong>${escapeHtml(currency)} ${money(paid)}</strong></div><div class="summary-row"><span>Due</span><strong>${escapeHtml(currency)} ${money(due)}</strong></div></div>
${settings.show_footer !== false && String(settings.footer_text || "").trim() ? `<div class="footer" style="font-size:${Number(settings.footer_font_size || 9)}px;white-space:pre-wrap">${escapeHtml(settings.footer_text)}</div>` : ""}</div></body></html>`;

    const html = isVat
      ? buildTaxInvoiceHtml({ invoice, invoiceLines, branch, settings, cashierName, customerName, paymentMethod, currency, money, escapeHtml })
      : standardHtml;

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.width = "800px";
    frame.style.height = "1100px";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { frame.remove(); throw new Error("Unable to prepare invoice print preview."); }
    doc.open(); doc.write(html); doc.close();

    await new Promise((resolve) => setTimeout(resolve, settings.logo_url ? 700 : 250));
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2500);
  }

  async function convertQuoteToInvoice() {
    if (!selectedQuote || statusProcessing) return;

    if (
      selectedQuote.branch_id &&
      selectedQuote.branch_id !== (activeBranchId || activeBranch?.id)
    ) {
      alert("Switch to this quotation's branch and unlock it before converting it to an invoice.");
      requestBranchSwitch?.(selectedQuote.branch_id);
      return;
    }

    if (selectedQuote.status !== "ACCEPTED") {
      alert("Only ACCEPTED quotations can be converted.");
      return;
    }

    const amountPaid = Math.max(
      Number(convertAmountPaid || 0),
      0
    );

    const quoteTotal = Number(
      selectedQuote.total || 0
    );

    if (
      convertPaymentMode !== "FULL" &&
      !selectedQuote.customer_id
    ) {
      alert(
        "Partial or credit quotation conversion requires a customer."
      );
      return;
    }

    if (
      convertPaymentMode === "FULL" &&
      amountPaid < quoteTotal
    ) {
      alert(
        "Full payment must cover the quotation total."
      );
      return;
    }

    if (
      convertPaymentMode === "PARTIAL" &&
      (amountPaid <= 0 || amountPaid >= quoteTotal)
    ) {
      alert(
        "For a partial payment, enter an amount greater than 0 and less than the quotation total."
      );
      return;
    }

    if (
      convertPaymentMode === "CREDIT" &&
      amountPaid !== 0
    ) {
      alert(
        "Credit / unpaid conversion must start with Rs. 0.00 paid."
      );
      return;
    }

    const confirmed = window.confirm(
      `Convert ${selectedQuote.quote_number} to an invoice?

Stock will be checked and reduced after conversion.`
    );

    if (!confirmed) return;

    try {
      setStatusProcessing(true);

      const { data, error } = await supabase.rpc(
        "convert_quote_to_invoice_credit",
        {
          p_quote_id: selectedQuote.id,
          p_payment_method: convertPaymentMethod,
          p_amount_paid: amountPaid,
        }
      );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data) && data.length > 0
          ? data[0]
          : null;

      const paidAmount = Number(
        result?.paid_amount ?? Math.min(amountPaid, quoteTotal)
      );

      const dueAmount = Number(
        result?.due_amount ??
          Math.max(quoteTotal - paidAmount, 0)
      );

      const paymentStatus =
        result?.payment_status ||
        (dueAmount <= 0
          ? "PAID"
          : paidAmount > 0
          ? "PARTIAL"
          : "UNPAID");

      if (result?.invoice_number) {
        if (selectedQuote.cashier_id) {
          const { error: cashierAssignError } = await supabase.rpc(
            "assign_invoice_master_cashier",
            {
              p_invoice_number: result.invoice_number,
              p_cashier_id: selectedQuote.cashier_id,
            }
          );

          if (cashierAssignError) throw cashierAssignError;
        }

        await printConvertedInvoice(result.invoice_number);
      } else {
        alert("Quotation converted successfully, but the invoice number was not returned for automatic printing.");
      }

      closeQuote();
      await loadData();
      await loadBranchStock(branchId);
    } catch (error) {
      console.error(
        "Convert quotation error:",
        error
      );

      alert(
        error.message ||
          "Unable to convert quotation."
      );
    } finally {
      setStatusProcessing(false);
    }
  }

  function printQuote() {
    // Keep the existing Non-VAT quotation print behavior unchanged.
    if (selectedQuote?.quote_type !== "VAT") {
      window.print();
      return;
    }

    const sheet = document.querySelector(".tax-quote-doc");
    if (!sheet) {
      alert("Tax quotation preview is not ready.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1000");
    if (!printWindow) {
      alert("Please allow pop-ups to print the Tax Quotation.");
      return;
    }

    const printCss = `
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin:0; padding:0; width:100%; background:#fff; color:#000; font-family:Arial,sans-serif; }
      .tax-quote-doc { display:block !important; width:100% !important; max-width:none !important; margin:0 !important; padding:0 !important; font-size:15px !important; overflow:visible !important; }
      .tax-q-logo { text-align:right; height:52px; padding-right:8px; }
      .tax-q-logo img { max-width:120px; max-height:50px; object-fit:contain; }
      .tax-q-logo span { font-size:12px; font-weight:900; letter-spacing:4px; }
      .tax-q-title { width:150px; margin:0 auto 12px; border:2px solid #222; text-align:center; font-size:21px; font-weight:800; padding:10px 6px; }
      .tax-q-grid { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid #222; border-left:1px solid #222; font-size:15px; }
      .tax-q-grid>div { border-right:1px solid #222; border-bottom:1px solid #222; padding:9px 11px; min-height:36px; font-size:15px; }
      .tax-q-grid .party { min-height:135px; line-height:1.9; padding-top:9px; font-size:15px; }
      .tax-q-grid p { margin:5px 0; }
      .tax-q-table { width:100%; border-collapse:collapse; margin-top:12px; font-size:15px; page-break-inside:auto; }
      .tax-q-table th,.tax-q-table td { border:1px solid #222; padding:8px 6px; font-size:15px; }
      .tax-q-table th { text-align:center; background:#f3f3f3; font-weight:800; }
      .tax-q-table th:nth-child(1){width:12%}.tax-q-table th:nth-child(2){width:44%}.tax-q-table th:nth-child(3){width:12%}.tax-q-table th:nth-child(4){width:14%}.tax-q-table th:nth-child(5){width:18%}
      .tax-q-table small { display:block; font-size:13px; margin-top:2px; }
      .tax-q-table .c{text-align:center}.tax-q-table .r{text-align:right}.tax-q-table .sum td:first-child{text-align:right;font-weight:700}.tax-q-table .total td{font-weight:900}
      .tax-q-table tr { page-break-inside:avoid; page-break-after:auto; }
    `;

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tax Quotation</title><style>${printCss}</style></head><body>${sheet.outerHTML}</body></html>`);
    printWindow.document.close();

    const waitForImages = async () => {
      const images = Array.from(printWindow.document.images);
      await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
    };

    setTimeout(async () => {
      await waitForImages();
      printWindow.focus();
      printWindow.print();
    }, 350);
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString(
      "en-LK",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(value) {
    if (!value) return "-";

    return new Date(value).toLocaleDateString(
      "en-LK"
    );
  }

  if (loading) {
    return (
      <div className="quotes-page">
        <p>Loading quotations...</p>
      </div>
    );
  }

  return (
    <div className="quotes-page">
      <div className="quotes-header">
        <div>
          <h2>Quotes</h2>
          <p>
            Create and manage VAT and non-VAT quotations.
          </p>
        </div>

        <div className="quote-type-toggle">
          <button
            className={
              quoteType === "VAT"
                ? "active"
                : ""
            }
            disabled={Boolean(editingQuoteId)}
            onClick={() => {
              setQuoteType("VAT");
              setCustomerId("");
            }}
          >
            VAT Quote
          </button>

          <button
            className={
              quoteType === "NON_VAT"
                ? "active"
                : ""
            }
            disabled={Boolean(editingQuoteId)}
            onClick={() => {
              setQuoteType("NON_VAT");
              setCustomerId("");
            }}
          >
            Non-VAT Quote
          </button>
        </div>
      </div>

      {editingQuoteId && (
        <div
          style={{
            marginBottom: "16px",
            padding: "13px 16px",
            border: "1px solid #f59e0b",
            borderRadius: "10px",
            background: "#fffbeb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div>
            <strong>Editing {editingQuoteNumber}</strong>
            <div style={{ color: "#92400e", fontSize: "12px", marginTop: "3px" }}>
              Update the customer, cashier, date, notes, items, quantities or discounts, then save.
            </div>
          </div>
          <button
            type="button"
            onClick={cancelEditQuote}
            disabled={processing}
            style={{
              border: "1px solid #d97706",
              background: "#fff",
              borderRadius: "8px",
              padding: "8px 12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel Edit
          </button>
        </div>
      )}

      <div className="quotes-layout">
        <div className="quote-builder-card">
          <div className="quote-form-grid">
            <div>
              <label>Customer</label>

              <select
                value={customerId}
                onChange={(e) =>
                  setCustomerId(e.target.value)
                }
              >
                <option value="">
                  {quoteType === "VAT"
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

              {selectedCustomer && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "9px",
                    background: "#f8fafc",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3, minmax(0, 1fr))",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span style={{ color: "#64748b" }}>
                        Credit Limit
                      </span>
                      <strong style={{ display: "block" }}>
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
                      <strong style={{ display: "block" }}>
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
                        Available
                      </span>
                      <strong
                        style={{
                          display: "block",
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
                </div>
              )}
            </div>
          <div className="quote-field">
            <label>Branch</label>

            <select
              value={branchId}
              disabled={Boolean(editingQuoteId)}
              onChange={(e) => {
                const nextBranchId = e.target.value;

                if (!nextBranchId || nextBranchId === branchId) {
                  return;
                }

                if (cart.length > 0) {
                  const confirmed = window.confirm(
                    "Switching branch will clear the current quotation items after the destination branch password is accepted. Continue?"
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


            <div className="quote-field">
              <label>Cashier</label>

              <select
                value={cashierId}
                onChange={(e) => setCashierId(e.target.value)}
                disabled={!branchId}
              >
                <option value="">
                  {branchId ? "Select Cashier" : "Select Branch First"}
                </option>

                {branchCashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.cashier_code
                      ? `${cashier.cashier_code} - ${cashier.name}`
                      : cashier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Valid Until</label>

              <input
                type="date"
                value={validUntil}
                onChange={(e) =>
                  setValidUntil(e.target.value)
                }
              />
            </div>
          </div>

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

          <div className="quote-product-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search item, SKU or barcode..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <div className="quote-product-grid">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                className="quote-product-card"
                onClick={() => addToCart(item)}
              >
                <strong>{item.name}</strong>

                <span>
                  {item.sku || "No SKU"}
                </span>

                <b>
                  Retail Rs. {formatMoney(item.selling_price)}
                </b>

                <small>
                  Wholesale Rs. {formatMoney(item.wholesale_price)}
                </small>

                {item.vat_type === "VAT" && (
                  <small>
                    VAT {item.vat_rate}%
                  </small>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="quote-cart-card">
          <div className="quote-cart-title">
            <FileText size={20} />
            <h3>Quotation Items</h3>
          </div>

          <div className="quote-cart-items">
            {cart.length === 0 ? (
              <div className="quote-empty">
                No items added yet.
              </div>
            ) : (
              cart.map((item) => {
                const line =
                  getLineCalculation(item);

                return (
                  <div
                    className="quote-cart-item"
                    key={item.id}
                  >
                    <div className="quote-cart-item-top">
                      <div>
                        <strong>
                          {item.name}
                        </strong>
                        <span>
                          Rs.{" "}
                          {formatMoney(
                            getItemUnitPrice(item)
                          )}
                        </span>

                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            marginTop: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              updateItemPriceType(item.id, "RETAIL")
                            }
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
                            onClick={() =>
                              updateItemPriceType(item.id, "WHOLESALE")
                            }
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
                            onClick={() =>
                              updateItemPriceType(item.id, "MANUAL")
                            }
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
                              value={item.manual_price}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                updateManualPrice(item.id, e.target.value)
                              }
                              placeholder="Enter price"
                              style={{
                                width: "145px",
                                height: "36px",
                                boxSizing: "border-box",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                padding: "0 9px",
                                fontWeight: 800,
                                outline: "none",
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        className="quote-remove-btn"
                        onClick={() =>
                          removeItem(item.id)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="quote-cart-controls">
                      <div className="quote-qty">
                        <button
                          onClick={() =>
                            decreaseQty(item.id)
                          }
                        >
                          <Minus size={14} />
                        </button>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
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
                          style={{
                            width: "58px",
                            height: "38px",
                            boxSizing: "border-box",
                            textAlign: "center",
                            border: "1px solid #cbd5e1",
                            borderRadius: "9px",
                            fontWeight: 800,
                            fontSize: "15px",
                            outline: "none",
                          }}
                        />

                        <button
                          onClick={() =>
                            increaseQty(item.id)
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div>
                        <label>Discount</label>
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

                      <strong>
                        Rs.{" "}
                        {formatMoney(
                          line.lineTotal
                        )}
                      </strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="quote-summary">
            <div>
              <span>Subtotal</span>
              <strong>
                Rs. {formatMoney(
                  totals.subtotal
                )}
              </strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                Rs. {formatMoney(
                  totals.discount
                )}
              </strong>
            </div>

            {quoteType === "VAT" && (
              <>
                <div>
                  <span>Taxable Amount</span>
                  <strong>
                    Rs. {formatMoney(
                      totals.taxable
                    )}
                  </strong>
                </div>

                <div>
                  <span>VAT</span>
                  <strong>
                    Rs. {formatMoney(
                      totals.vat
                    )}
                  </strong>
                </div>
              </>
            )}

            <div className="quote-grand-total">
              <span>Total</span>
              <strong>
                Rs. {formatMoney(
                  totals.total
                )}
              </strong>
            </div>
          </div>

          <div className="quote-notes">
            <label>Notes</label>
            <textarea
              rows="3"
              placeholder="Quotation notes..."
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
            />
          </div>

          <button
            className="create-quote-btn"
            onClick={editingQuoteId ? saveEditedQuote : createQuote}
            disabled={processing}
          >
            <Plus size={18} />

            {processing
              ? editingQuoteId
                ? "Saving..."
                : "Creating..."
              : editingQuoteId
              ? "Save Changes"
              : "Create Quotation"}
          </button>
        </div>
      </div>

      <div className="quotes-list-card">
        <div className="quotes-list-header">
          <div>
            <h3>Quotation History</h3>
            <span>
              {quotes.length} quotations
            </span>
          </div>

          <div className="quote-history-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search quotation..."
              value={quoteSearch}
              onChange={(e) =>
                setQuoteSearch(e.target.value)
              }
            />
          </div>
        </div>

        <div className="quote-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Quote No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th>Type</th>
                <th>Valid Until</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>
                        {quote.quote_number}
                      </strong>
                    </td>

                    <td>
                      {formatDate(
                        quote.quote_date
                      )}
                    </td>

                    <td>
                      {quote.customer_name ||
                        "Walk-in Customer"}
                    </td>

                    <td>
                      {getCashierName(quote.cashier_id)}
                    </td>

                    <td>
                      {quote.quote_type === "VAT"
                        ? "VAT"
                        : "Non-VAT"}
                    </td>

                    <td>
                      {formatDate(
                        quote.valid_until
                      )}
                    </td>

                    <td>
                      <strong>
                        Rs.{" "}
                        {formatMoney(
                          quote.total
                        )}
                      </strong>
                    </td>

                    <td>
                      <span className="quote-status">
                        {quote.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="quote-view-btn"
                        onClick={() =>
                          viewQuote(quote)
                        }
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lastCreatedQuote && (
        <div
          className="quote-modal-overlay"
          style={{ zIndex: 2100 }}
        >
          <div
            style={{
              width: "min(460px, calc(100% - 32px))",
              background: "#fff",
              borderRadius: "16px",
              boxShadow: "0 24px 70px rgba(15,23,42,.28)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px",
                padding: "18px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "18px" }}>
                  Quotation created
                </strong>
                <span style={{ color: "#64748b", fontSize: "13px" }}>
                  {lastCreatedQuote.quoteNumber}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLastCreatedQuote(null);
                  setShareWhatsAppNumber("");
                }}
                style={{
                  border: 0,
                  background: "#f1f5f9",
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              <div
                style={{
                  padding: "13px",
                  marginBottom: "14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                }}
              >
                <strong>{lastCreatedQuote.quoteNumber}</strong>
                <div style={{ marginTop: "4px", color: "#64748b", fontSize: "13px" }}>
                  Total: Rs. {formatMoney(lastCreatedQuote.total)}
                </div>
              </div>

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
                  if (e.key === "Enter") sendQuoteWhatsApp();
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "11px 12px",
                  font: "inherit",
                  marginBottom: "12px",
                }}
              />

              {lastCreatedQuote.quoteLink ? (
                <div
                  style={{
                    marginBottom: "14px",
                    padding: "9px 11px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    color: "#64748b",
                    fontSize: "11px",
                    wordBreak: "break-all",
                  }}
                >
                  Quotation link: {lastCreatedQuote.quoteLink}
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
                  Quotation link could not be created.
                </div>
              )}

              <button
                type="button"
                onClick={sendQuoteWhatsApp}
                disabled={
                  !shareWhatsAppNumber.trim() ||
                  !lastCreatedQuote.quoteLink
                }
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: "10px",
                  padding: "12px 14px",
                  background:
                    shareWhatsAppNumber.trim() && lastCreatedQuote.quoteLink
                      ? "#166534"
                      : "#cbd5e1",
                  color: "#fff",
                  fontWeight: 800,
                  cursor:
                    shareWhatsAppNumber.trim() && lastCreatedQuote.quoteLink
                      ? "pointer"
                      : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <MessageCircle size={18} />
                Send Quotation by WhatsApp
              </button>

              <p
                style={{
                  margin: "13px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                No saved customer is required for a non-VAT quotation.
                Enter the WhatsApp number and send the secure quotation link.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedQuote && (
        <div className="quote-modal-overlay">
          <div className="quote-modal">
            <div className="quote-modal-toolbar no-print">
              <div>
                <h3>
                  {selectedQuote.quote_number}
                </h3>
                <span className="quote-status">
                  {selectedQuote.status}
                </span>
              </div>

              <div>
                {selectedQuote.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={startEditQuote}
                    disabled={detailsLoading || statusProcessing}
                  >
                    <Pencil size={17} />
                    Edit
                  </button>
                )}

                <button onClick={printQuote}>
                  <Printer size={17} />
                  Print
                </button>

                <button
                  onClick={closeQuote}
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="quote-management-panel no-print">
              <div className="quote-status-controls">
                <strong>Quotation Status</strong>

                <div>
                  {["DRAFT", "SENT", "ACCEPTED", "REJECTED"].map(
                    (status) => (
                      <button
                        key={status}
                        className={
                          selectedQuote.status === status
                            ? "active"
                            : ""
                        }
                        disabled={
                          statusProcessing ||
                          selectedQuote.status === "CONVERTED"
                        }
                        onClick={() =>
                          updateQuoteStatus(status)
                        }
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              {selectedQuote.status === "ACCEPTED" && (
                <div className="quote-convert-box">
                  <div>
                    <strong>Convert to Invoice</strong>
                    <span>
                      Choose full, partial, or credit payment. Stock will be checked and reduced when the invoice is created.
                    </span>
                  </div>

                  {selectedQuote.customer_id && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "9px",
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
                          <strong style={{ display: "block" }}>
                            Rs.{" "}
                            {conversionCreditLimit.toLocaleString(
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
                          <strong style={{ display: "block" }}>
                            {creditLoading
                              ? "Loading..."
                              : `Rs. ${conversionOutstanding.toLocaleString(
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
                              color:
                                conversionAvailableCredit > 0
                                  ? "#166534"
                                  : "#b91c1c",
                            }}
                          >
                            Rs.{" "}
                            {conversionAvailableCredit.toLocaleString(
                              "en-LK",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="quote-convert-payment-types">
                    <button
                      type="button"
                      className={
                        convertPaymentMode === "FULL"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setConvertPaymentMode("FULL");
                        setConvertAmountPaid(
                          String(
                            Number(
                              selectedQuote.total || 0
                            )
                          )
                        );
                      }}
                    >
                      Full Payment
                    </button>

                    <button
                      type="button"
                      className={
                        convertPaymentMode === "PARTIAL"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setConvertPaymentMode("PARTIAL");
                        setConvertAmountPaid("");
                      }}
                    >
                      Partial Payment
                    </button>

                    <button
                      type="button"
                      className={
                        convertPaymentMode === "CREDIT"
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setConvertPaymentMode("CREDIT");
                        setConvertAmountPaid("0");
                      }}
                    >
                      Credit / Unpaid
                    </button>
                  </div>

                  <div className="quote-convert-fields">
                    {convertPaymentMode !== "CREDIT" && (
                      <div>
                        <label>Payment Method</label>

                        <select
                          value={convertPaymentMethod}
                          onChange={(e) =>
                            setConvertPaymentMethod(
                              e.target.value
                            )
                          }
                        >
                          <option value="CASH">
                            Cash
                          </option>
                          <option value="CARD">
                            Card
                          </option>
                          <option value="BANK">
                            Bank
                          </option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label>
                        {convertPaymentMode === "CREDIT"
                          ? "Amount Paid"
                          : "Amount Received"}
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={
                          convertPaymentMode === "CREDIT"
                        }
                        value={convertAmountPaid}
                        onChange={(e) =>
                          setConvertAmountPaid(
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="quote-convert-status">
                      <label>Payment Status</label>
                      <strong>
                        {(() => {
                          const total = Number(
                            selectedQuote.total || 0
                          );

                          const paid = Math.min(
                            Math.max(
                              Number(
                                convertAmountPaid || 0
                              ),
                              0
                            ),
                            total
                          );

                          const due = Math.max(
                            total - paid,
                            0
                          );

                          if (due <= 0) return "PAID";
                          if (paid > 0) return "PARTIAL";
                          return "UNPAID";
                        })()}
                      </strong>

                      <span>
                        Due: Rs.{" "}
                        {Math.max(
                          Number(
                            selectedQuote.total || 0
                          ) -
                            Math.min(
                              Math.max(
                                Number(
                                  convertAmountPaid || 0
                                ),
                                0
                              ),
                              Number(
                                selectedQuote.total || 0
                              )
                            ),
                          0
                        ).toLocaleString("en-LK", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    <button
                      className="convert-quote-btn"
                      disabled={statusProcessing}
                      onClick={convertQuoteToInvoice}
                    >
                      {statusProcessing
                        ? "Processing..."
                        : convertPaymentMode === "CREDIT"
                        ? "Convert as Credit Invoice"
                        : convertPaymentMode === "PARTIAL"
                        ? "Convert with Partial Payment"
                        : "Convert to Invoice"}
                    </button>
                  </div>

                  {convertPaymentMode !== "FULL" &&
                    !selectedQuote.customer_id && (
                      <div className="quote-credit-warning">
                        Select a customer on the quotation before using partial or credit conversion.
                      </div>
                    )}
                </div>
              )}

              {selectedQuote.status === "CONVERTED" && (
                <div className="quote-converted-message">
                  This quotation has already been converted to an invoice.
                </div>
              )}
            </div>

            <div className="print-quote">
              {selectedQuote.quote_type === "VAT" ? (
                <TaxQuotationLayout
                  quote={selectedQuote}
                  quoteItems={selectedQuoteItems}
                  branch={getQuoteBranch(selectedQuote)}
                  customer={customers.find((row) => row.id === selectedQuote.customer_id)}
                  cashierName={getCashierName(selectedQuote.cashier_id)}
                  formatMoney={formatMoney}
                  formatDate={formatDate}
                  detailsLoading={detailsLoading}
                  settings={{
                    ...settings,
                    ...(documentPrintSettings.TAX_QUOTATION || {}),
                  }}
                />
              ) : (
                <>
              <div className="quote-print-header">
                <div>
                  <h1>{getQuoteBranchName(selectedQuote)}</h1>
                  <p>Sales Quotation</p>
                </div>

                <div>
                  <h2>
                    {selectedQuote.quote_type ===
                    "VAT"
                      ? "VAT QUOTATION"
                      : "QUOTATION"}
                  </h2>

                  <strong>
                    {selectedQuote.quote_number}
                  </strong>
                </div>
              </div>

              <div className="quote-print-info">
                <div>
                  <span>Quote Date</span>
                  <strong>
                    {formatDate(
                      selectedQuote.quote_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Valid Until</span>
                  <strong>
                    {formatDate(
                      selectedQuote.valid_until
                    )}
                  </strong>
                </div>

                <div>
                  <span>Customer</span>
                  <strong>
                    {selectedQuote.customer_name ||
                      "Walk-in Customer"}
                  </strong>
                </div>

                <div>
                  <span>Cashier</span>
                  <strong>
                    {getCashierName(selectedQuote.cashier_id)}
                  </strong>
                </div>

                {selectedQuote.quote_type ===
                  "VAT" && (
                  <div>
                    <span>
                      Customer VAT No.
                    </span>

                    <strong>
                      {selectedQuote.customer_vat_number ||
                        "-"}
                    </strong>
                  </div>
                )}
              </div>

              {detailsLoading ? (
                <p>
                  Loading quotation items...
                </p>
              ) : (
                <table className="quote-print-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Discount</th>

                      {selectedQuote.quote_type ===
                        "VAT" && (
                        <>
                          <th>VAT %</th>
                          <th>VAT</th>
                        </>
                      )}

                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedQuoteItems.map(
                      (item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>
                            {item.item_name}
                          </td>
                          <td>
                            {item.sku || "-"}
                          </td>
                          <td>
                            {item.quantity}
                          </td>
                          <td>
                            Rs.{" "}
                            {formatMoney(
                              item.unit_price
                            )}
                          </td>
                          <td>
                            Rs.{" "}
                            {formatMoney(
                              item.discount
                            )}
                          </td>

                          {selectedQuote.quote_type ===
                            "VAT" && (
                            <>
                              <td>
                                {item.vat_rate}%
                              </td>
                              <td>
                                Rs.{" "}
                                {formatMoney(
                                  item.vat_amount
                                )}
                              </td>
                            </>
                          )}

                          <td>
                            <strong>
                              Rs.{" "}
                              {formatMoney(
                                item.line_total
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}

              <div className="quote-print-summary">
                <div>
                  <span>Subtotal</span>
                  <strong>
                    Rs.{" "}
                    {formatMoney(
                      selectedQuote.subtotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>Discount</span>
                  <strong>
                    Rs.{" "}
                    {formatMoney(
                      selectedQuote.discount
                    )}
                  </strong>
                </div>

                <div>
                  <span>Cashier</span>
                  <strong>
                    {getCashierName(selectedQuote.cashier_id)}
                  </strong>
                </div>

                {selectedQuote.quote_type ===
                  "VAT" && (
                  <>
                    <div>
                      <span>
                        Taxable Amount
                      </span>
                      <strong>
                        Rs.{" "}
                        {formatMoney(
                          selectedQuote.taxable_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>VAT</span>
                      <strong>
                        Rs.{" "}
                        {formatMoney(
                          selectedQuote.vat_amount
                        )}
                      </strong>
                    </div>
                  </>
                )}

                <div className="quote-print-total">
                  <span>Total</span>
                  <strong>
                    Rs.{" "}
                    {formatMoney(
                      selectedQuote.total
                    )}
                  </strong>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="quote-print-notes">
                  <strong>Notes</strong>
                  <p>{selectedQuote.notes}</p>
                </div>
              )}

              {documentPrintSettings.NON_VAT_QUOTATION?.show_footer !== false &&
                String(documentPrintSettings.NON_VAT_QUOTATION?.footer_text || "").trim() && (
                  <div
                    className="quote-dynamic-footer"
                    style={{
                      marginTop: "18px",
                      paddingTop: "10px",
                      borderTop: "1px solid #cbd5e1",
                      textAlign: "center",
                      whiteSpace: "pre-wrap",
                      fontSize: `${Number(
                        documentPrintSettings.NON_VAT_QUOTATION?.footer_font_size || 9
                      )}px`,
                    }}
                  >
                    {documentPrintSettings.NON_VAT_QUOTATION.footer_text}
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function TaxQuotationLayout({ quote, quoteItems, branch, customer, cashierName, formatMoney, formatDate, detailsLoading, settings }) {
  const supplierTin = "103441161";
  const supplierName = branch?.branch_name || "Lanka Electrics";
  const supplierAddress = branch?.address || "No: 120, First Cross Street, Colombo - 11";
  const supplierPhone = branch?.phone || "077 305 6626 / 011 243 0137";
  const purchaserTin = quote.customer_vat_number || customer?.vat_number || customer?.tin || "-";
  const purchaserName = quote.customer_name || customer?.name || "Walk-in Customer";
  const purchaserAddress = customer?.address || customer?.billing_address || "-";
  const purchaserPhone = customer?.phone || "-";
  const vatRate = quoteItems.find((x) => Number(x.vat_rate || 0) > 0)?.vat_rate || 18;
  const total = Number(quote.total || 0);
  const vat = Number(quote.vat_amount || 0);
  const supply = Number(quote.taxable_amount ?? (total - vat));

  return <div className="tax-quote-doc">
    <div className="tax-q-logo">
      {settings?.show_logo !== false && settings?.logo_url ? (
        <img src={settings.logo_url} alt="Logo" />
      ) : null}
    </div>
    <div className="tax-q-title">Tax Quotation</div>
    <div className="tax-q-grid">
      <div><b>Date of Quotation:</b> {formatDate(quote.quote_date)}</div><div><b>Tax Quotation No.:</b> {quote.quote_number}</div>
      <div className="party"><p><b>Supplier's TIN:</b> {supplierTin}</p><p><b>Supplier's Name:</b> {supplierName}</p><p><b>Address:</b> {supplierAddress}</p><p><b>Telephone No:</b> {supplierPhone}</p></div>
      <div className="party"><p><b>Purchaser's TIN:</b> {purchaserTin}</p><p><b>Purchaser's Name:</b> {purchaserName}</p><p><b>Address:</b> {purchaserAddress}</p><p><b>Telephone No:</b> {purchaserPhone}</p></div>
      <div><b>Valid Until:</b> {formatDate(quote.valid_until)}</div><div><b>Place of Supply:</b> {branch?.branch_name || "-"}</div>
    </div>

    {settings?.show_cashier !== false && (
      <div
        style={{
          marginTop: "10px",
          border: "1px solid #222",
          padding: "9px 11px",
          fontSize: `${Number(settings?.header_font_size || 15)}px`,
        }}
      >
        <b>Cashier:</b> {cashierName || "-"}
      </div>
    )}
    {detailsLoading ? <p>Loading quotation items...</p> : <table className="tax-q-table"><thead><tr><th>Reference</th><th>Description of Goods or Services</th><th>Quantity</th><th>Unit Price</th><th>Amount<br/>Excluding VAT<br/>(Rs.)</th></tr></thead><tbody>
      {quoteItems.map((item,index)=>{const qty=Number(item.quantity||0),unit=Number(item.unit_price||0),discount=Number(item.discount||0),excluding=Math.max(qty*unit-discount,0);return <tr key={item.id||index}><td>{String(index+1).padStart(2,"0")}</td><td>{item.item_name}{item.sku?<small>{item.sku}</small>:null}</td><td className="c">{qty}</td><td className="r">Rs. {formatMoney(unit)}</td><td className="r">Rs. {formatMoney(excluding)}</td></tr>})}
      <tr className="sum"><td colSpan="4">Total Value of Supply:</td><td className="r">Rs. {formatMoney(supply)}</td></tr>
      <tr className="sum"><td colSpan="4">VAT Amount (Total Value of Supply @ {vatRate}%):</td><td className="r">Rs. {formatMoney(vat)}</td></tr>
      <tr className="sum total"><td colSpan="4">Total Amount including VAT:</td><td className="r">Rs. {formatMoney(total)}</td></tr>
    </tbody></table>}
    {/* Footer comes only from document_print_settings for TAX_QUOTATION. */}
    {settings?.show_footer !== false && String(settings?.footer_text || "").trim() && (
      <div
        className="tax-q-footer"
        style={{
          marginTop: "18px",
          paddingTop: "10px",
          borderTop: "1px solid #222",
          textAlign: "center",
          whiteSpace: "pre-wrap",
          fontSize: `${Number(settings?.footer_font_size || 9)}px`,
        }}
      >
        {settings.footer_text}
      </div>
    )}
    <style>{`.tax-quote-doc{font-family:Arial,sans-serif;color:#000;padding:8px 4px;font-size:15px}.tax-q-logo{text-align:right;height:52px;padding-right:8px}.tax-q-logo img{max-width:120px;max-height:50px;object-fit:contain}.tax-q-logo span{font-size:15px;font-weight:900;letter-spacing:4px;padding:1px 3px}.tax-q-title{width:150px;margin:-2px auto 12px;border:2px solid #222;text-align:center;font-size:21px;font-weight:800;padding:10px 6px}.tax-q-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #222;border-left:1px solid #222;font-size:15px}.tax-q-grid>div{border-right:1px solid #222;border-bottom:1px solid #222;padding:9px 11px;min-height:36px;font-size:15px}.tax-q-grid .party{min-height:135px;line-height:1.9;padding-top:9px;font-size:15px}.tax-q-grid p{margin:5px 0}.tax-q-grid .wide{grid-column:1/-1;min-height:38px}.tax-q-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:15px}.tax-q-table th,.tax-q-table td{border:1px solid #222;padding:8px 6px;font-size:15px}.tax-q-table th{text-align:center;background:#f3f3f3}.tax-q-table th:nth-child(2){width:44%}.tax-q-table small{display:block;font-size:13px}.tax-q-table .c{text-align:center}.tax-q-table .r{text-align:right}.tax-q-table .sum td:first-child{text-align:right;font-weight:700}.tax-q-table .total td{font-weight:900}@media print{.tax-quote-doc{padding:0;font-size:15px}.tax-q-title{margin-top:-2px}}`}</style>
  </div>;
}

function numberToWordsTax(value){
  const n=Math.round(Number(value||0)); if(n===0)return "Zero";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const u=(x)=>{let a=[];if(x>=100){a.push(ones[Math.floor(x/100)]+" Hundred");x%=100;}if(x>=20){a.push(tens[Math.floor(x/10)]);if(x%10)a.push(ones[x%10]);}else if(x>0)a.push(ones[x]);return a.join(" ");};let x=n,p=[];for(const [v,name] of [[10000000,"Crore"],[100000,"Lakh"],[1000,"Thousand"]]){if(x>=v){p.push(u(Math.floor(x/v))+" "+name);x%=v;}}if(x)p.push(u(x));return p.join(" ");
}

function buildTaxInvoiceHtml({ invoice, invoiceLines, branch, settings, cashierName, customerName, paymentMethod, currency, money, escapeHtml }) {
  const total=Number(invoice.total||0),vat=Number(invoice.vat_amount||0),supply=Number(invoice.taxable_amount ?? (total-vat));
  const vatRate=(invoiceLines||[]).find(x=>Number(x.vat_rate||0)>0)?.vat_rate||18;
  const supplierTin=settings?.tin||settings?.tin_number||settings?.vat_number||"103441161";
  const supplierName = branch?.branch_name || settings?.company_name || "Lanka Electrics";
  const supplierAddress=settings?.company_address||branch?.address||"No: 120, First Cross Street, Colombo - 11";
  const supplierPhone=settings?.company_phone||branch?.phone||"077 305 6626 / 011 243 0137";
  const purchaserTin=invoice.customer_vat_number||invoice.customer_tin||"-", purchaserAddress=invoice.customer_address||"-", purchaserPhone=invoice.customer_phone||"-";
  const rows=(invoiceLines||[]).map((line,i)=>{const q=Number(line.quantity||0),u=Number(line.unit_price||0),d=Number(line.discount||0),ex=Math.max(q*u-d,0);return `<tr><td>${String(i+1).padStart(2,"0")}</td><td>${escapeHtml(line.item_name||"Item")}${line.sku?`<small>${escapeHtml(line.sku)}</small>`:""}</td><td class="c">${q}</td><td class="r">${escapeHtml(currency)} ${money(u)}</td><td class="r">${escapeHtml(currency)} ${money(ex)}</td></tr>`}).join("");
  const dt=new Date(invoice.invoice_date||invoice.created_at).toLocaleDateString("en-GB");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoice_number)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:15px}.sheet{width:210mm;padding:10mm 7mm;position:relative}.logo{text-align:right;height:46px;padding-right:8px}.logo img{max-width:95px;max-height:44px;object-fit:contain}.mark{font-weight:900;letter-spacing:4px;padding:1px 3px;font-size:12px}.title{width:145px;margin:0 auto 12px;border:2px solid #222;text-align:center;font-size:21px;font-weight:800;padding:10px 6px}.grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #222;border-left:1px solid #222;font-size:15px}.grid>div{border-right:1px solid #222;border-bottom:1px solid #222;padding:9px 11px;min-height:36px;font-size:15px}.party{min-height:135px;line-height:1.8;padding-top:9px}.wide{grid-column:1/-1;min-height:38px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:15px}th,td{border:1px solid #222;padding:8px 6px;font-size:15px}th{text-align:center;background:#f3f3f3}th:nth-child(2){width:44%}small{display:block;font-size:13px}.c{text-align:center}.r{text-align:right}.sum td:first-child{text-align:right;font-weight:700}.total td{font-weight:900}@media print{@page{size:A4;margin:0}.sheet{padding:10mm 7mm}}</style></head><body><div class="sheet"><div class="logo">${settings?.show_logo !== false && settings?.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="Logo">` : ""}</div><div class="title">Tax Invoice</div><div class="grid"><div><b>Date of Invoice:</b> ${dt}</div><div><b>Tax Invoice No.:</b> ${escapeHtml(invoice.invoice_number)}</div><div class="party"><div><b>Supplier's TIN:</b> ${escapeHtml(supplierTin)}</div><div><b>Supplier's Name:</b> ${escapeHtml(supplierName)}</div><div><b>Address:</b> ${escapeHtml(supplierAddress)}</div><div><b>Telephone No:</b> ${escapeHtml(supplierPhone)}</div></div><div class="party"><div><b>Purchaser's TIN:</b> ${escapeHtml(purchaserTin)}</div><div><b>Purchaser's Name:</b> ${escapeHtml(customerName)}</div><div><b>Address:</b> ${escapeHtml(purchaserAddress)}</div><div><b>Telephone No:</b> ${escapeHtml(purchaserPhone)}</div></div><div><b>Date of Delivery:</b> ${dt}</div><div><b>Place of Supply:</b> ${escapeHtml(branch?.branch_name||branch?.address||"-")}</div></div><table><thead><tr><th>Reference</th><th>Description of Goods or Services</th><th>Quantity</th><th>Unit Price</th><th>Amount<br>Excluding VAT<br>(${escapeHtml(currency)})</th></tr></thead><tbody>${rows}<tr class="sum"><td colspan="4">Total Value of Supply:</td><td class="r">${escapeHtml(currency)} ${money(supply)}</td></tr><tr class="sum"><td colspan="4">VAT Amount (Total Value of Supply @ ${vatRate}%):</td><td class="r">${escapeHtml(currency)} ${money(vat)}</td></tr><tr class="sum total"><td colspan="4">Total Amount including VAT:</td><td class="r">${escapeHtml(currency)} ${money(total)}</td></tr></tbody></table>${settings?.show_footer !== false && String(settings?.footer_text || "").trim() ? `<div style="margin-top:18px;padding-top:10px;border-top:1px solid #222;text-align:center;white-space:pre-wrap;font-size:${Number(settings?.footer_font_size || 9)}px">${escapeHtml(settings.footer_text)}</div>` : ""}</div></body></html>`;
}

export default Quotes;
