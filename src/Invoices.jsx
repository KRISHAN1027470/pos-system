import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Eye,
  Printer,
  X,
  Ban,
  ReceiptText,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import { supabase } from "./supabase";
import "./Invoices.css";

function Invoices({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [settings, setSettings] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [invoiceNoFilter, setInvoiceNoFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState(activeBranchId || activeBranch?.id || "");
  const [cashierFilter, setCashierFilter] = useState("ALL");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnQty, setReturnQty] = useState({});
  const [returnedQty, setReturnedQty] = useState({});
  const [returnReason, setReturnReason] = useState("");
  const [returnProcessing, setReturnProcessing] = useState(false);
  const [invoiceReturnTotals, setInvoiceReturnTotals] = useState({});
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [creditNoteLoading, setCreditNoteLoading] = useState(false);
  const [combinedCreditOpen, setCombinedCreditOpen] = useState(false);
  const [combinedCreditItems, setCombinedCreditItems] = useState([]);
  const [combinedCreditLoading, setCombinedCreditLoading] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";
    if (nextBranchId && nextBranchId !== branchFilter) {
      setBranchFilter(nextBranchId);
      closeInvoice();
    }
  }, [activeBranchId, activeBranch?.id]);

  async function loadBaseData() {
    setLoading(true);

    const [invoiceResult, branchResult, settingsResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false }),

      supabase
        .from("branches")
        .select("*")
        .order("branch_name", { ascending: true }),

      supabase
        .from("app_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (invoiceResult.error) {
      console.error("Load invoices error:", invoiceResult.error);
      alert(invoiceResult.error.message);
      setInvoices([]);
    } else {
      setInvoices(invoiceResult.data || []);
    }

    if (branchResult.error) {
      console.error("Load branches error:", branchResult.error);
      setBranches(appBranches || []);
    } else {
      setBranches(appBranches?.length ? appBranches : branchResult.data || []);
    }

    if (settingsResult.error) {
      console.error("Load settings error:", settingsResult.error);
      setSettings(null);
    } else {
      setSettings(settingsResult.data || null);
    }

    // Load return/credit totals for the invoice list.
    const { data: returnRows, error: returnError } = await supabase
      .from("invoice_returns")
      .select("id, invoice_id, return_number, return_amount, reason, processed_at")
      .order("processed_at", { ascending: false });

    if (returnError) {
      console.error("Load invoice returns error:", returnError);
      setInvoiceReturnTotals({});
    } else {
      const totals = {};
      (returnRows || []).forEach((row) => {
        if (!totals[row.invoice_id]) {
          totals[row.invoice_id] = {
            amount: 0,
            returns: [],
          };
        }
        totals[row.invoice_id].amount += Number(row.return_amount || 0);
        totals[row.invoice_id].returns.push(row);
      });
      setInvoiceReturnTotals(totals);
    }

    setLoading(false);
  }

  async function viewInvoice(invoice) {
    setSelectedInvoice(invoice);
    setDetailsLoading(true);
    setInvoiceItems([]);
    setPayments([]);

    const [itemResult, paymentResult] = await Promise.all([
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("id", { ascending: true }),

      supabase
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("payment_date", { ascending: true }),
    ]);

    if (itemResult.error) {
      console.error("Load invoice items error:", itemResult.error);
      alert(itemResult.error.message);
    } else {
      setInvoiceItems(itemResult.data || []);
    }

    if (paymentResult.error) {
      console.error("Load payment history error:", paymentResult.error);
    } else {
      setPayments(paymentResult.data || []);
    }

    setDetailsLoading(false);
  }

  function closeInvoice() {
    setSelectedInvoice(null);
    setInvoiceItems([]);
    setPayments([]);
  }

  const branchMap = useMemo(() => {
    const map = {};
    branches.forEach((branch) => {
      map[branch.id] = branch;
    });
    return map;
  }, [branches]);

  const cashierOptions = useMemo(() => {
    return [...new Set(
      invoices
        .map((invoice) => invoice.cashier_name)
        .filter(Boolean)
        .map((name) => String(name).trim())
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    const invoiceNoTerm = invoiceNoFilter.trim().toLowerCase();
    const customerTerm = customerFilter.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const currentPaymentStatus =
        invoice.payment_status ||
        (Number(invoice.due_amount || 0) <= 0
          ? "PAID"
          : Number(invoice.paid_amount || 0) > 0
          ? "PARTIAL"
          : "UNPAID");

      const matchesSearch =
        !term ||
        [
          invoice.invoice_number,
          invoice.customer_name,
          invoice.customer_vat_number,
          invoice.payment_method,
          currentPaymentStatus,
          invoice.cashier_name,
          branchMap[invoice.branch_id]?.branch_name,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(term)
          );

      const matchesInvoiceNo =
        !invoiceNoTerm ||
        String(invoice.invoice_number || "")
          .toLowerCase()
          .includes(invoiceNoTerm);

      const matchesCustomer =
        !customerTerm ||
        String(invoice.customer_name || "Walk-in Customer")
          .toLowerCase()
          .includes(customerTerm);

      const matchesBranch =
        Boolean(branchFilter) && invoice.branch_id === branchFilter;

      const matchesCashier =
        cashierFilter === "ALL" ||
        String(invoice.cashier_name || "") === cashierFilter;

      const matchesType =
        filter === "ALL" ||
        invoice.invoice_type === filter;

      const matchesPayment =
        paymentFilter === "ALL" ||
        currentPaymentStatus === paymentFilter;

      const matchesInvoiceStatus =
        invoiceStatusFilter === "ALL" ||
        invoice.status === invoiceStatusFilter;

      let matchesDate = true;
      if (invoice.invoice_date) {
        const invoiceDate = new Date(invoice.invoice_date);
        invoiceDate.setHours(0, 0, 0, 0);

        if (dateFromFilter) {
          const fromDate = new Date(`${dateFromFilter}T00:00:00`);
          if (invoiceDate < fromDate) matchesDate = false;
        }

        if (dateToFilter) {
          const toDate = new Date(`${dateToFilter}T00:00:00`);
          if (invoiceDate > toDate) matchesDate = false;
        }
      } else if (dateFromFilter || dateToFilter) {
        matchesDate = false;
      }

      return (
        matchesSearch &&
        matchesInvoiceNo &&
        matchesCustomer &&
        matchesBranch &&
        matchesCashier &&
        matchesType &&
        matchesPayment &&
        matchesInvoiceStatus &&
        matchesDate
      );
    });
  }, [
    invoices,
    search,
    invoiceNoFilter,
    customerFilter,
    branchFilter,
    cashierFilter,
    filter,
    paymentFilter,
    invoiceStatusFilter,
    dateFromFilter,
    dateToFilter,
    branchMap,
  ]);

  function clearInvoiceFilters() {
    setSearch("");
    setInvoiceNoFilter("");
    setDateFromFilter("");
    setDateToFilter("");
    setCustomerFilter("");
    setBranchFilter(activeBranchId || activeBranch?.id || "");
    setCashierFilter("ALL");
    setFilter("ALL");
    setPaymentFilter("ALL");
    setInvoiceStatusFilter("ALL");
  }

  const completedInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "COMPLETED" &&
      Boolean(branchFilter) &&
      invoice.branch_id === branchFilter
  );

  const totalSales = completedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total || 0),
    0
  );

  const totalPaid = completedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.paid_amount || 0),
    0
  );

  const totalDue = completedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.due_amount || 0),
    0
  );

  const vatCollected = completedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.vat_amount || 0),
    0
  );

  async function openReturnItems() {
    if (!selectedInvoice || selectedInvoice.status !== "COMPLETED") return;

    try {
      const itemIds = invoiceItems.map((item) => item.id);
      let totals = {};

      if (itemIds.length > 0) {
        const { data: returnRows, error } = await supabase
          .from("invoice_return_items")
          .select("invoice_item_id, quantity")
          .in("invoice_item_id", itemIds);

        if (error) throw error;

        totals = (returnRows || []).reduce((acc, row) => {
          acc[row.invoice_item_id] =
            Number(acc[row.invoice_item_id] || 0) + Number(row.quantity || 0);
          return acc;
        }, {});
      }

      setReturnedQty(totals);
      setReturnQty({});
      setReturnReason("");
      setReturnDialogOpen(true);
    } catch (error) {
      console.error("Load return quantities error:", error);
      alert(error.message || "Unable to load return information.");
    }
  }

  function availableReturnQty(item) {
    return Math.max(
      0,
      Number(item.quantity || 0) - Number(returnedQty[item.id] || 0)
    );
  }

  function selectedReturnAmount() {
    return invoiceItems.reduce((sum, item) => {
      const qty = Number(returnQty[item.id] || 0);
      if (qty <= 0 || Number(item.quantity || 0) <= 0) return sum;

      const unitReturn =
        Number(item.line_total || 0) / Number(item.quantity || 1);

      return sum + unitReturn * qty;
    }, 0);
  }

  async function confirmItemReturn() {
    const selected = invoiceItems
      .map((item) => ({
        item,
        qty: Number(returnQty[item.id] || 0),
      }))
      .filter(({ qty }) => qty > 0);

    if (selected.length === 0) {
      alert("Enter a return quantity for at least one item.");
      return;
    }

    for (const { item, qty } of selected) {
      const available = availableReturnQty(item);

      if (qty > available) {
        alert(
          `${item.item_name}: maximum return quantity is ${available}.`
        );
        return;
      }
    }

    const confirmed = window.confirm(
      `Process return for ${selected.length} item(s)?\n\nReturn value: ${currency} ${formatMoney(
        selectedReturnAmount()
      )}\n\nReturned stock will be added back to the invoice branch.`
    );

    if (!confirmed) return;

    setReturnProcessing(true);

    try {
      const returnItems = selected.map(({ item, qty }) => ({
        invoice_item_id: item.id,
        quantity: qty,
      }));

      const { data, error } = await supabase.rpc("return_invoice_items", {
        p_invoice_id: selectedInvoice.id,
        p_items: returnItems,
        p_reason: returnReason.trim() || null,
      });

      if (error) throw error;

      alert(
        `Return completed successfully.${
          data?.return_number ? `\nReturn No: ${data.return_number}` : ""
        }\nReturn value: ${currency} ${formatMoney(
          data?.return_amount ?? selectedReturnAmount()
        )}`
      );

      setReturnDialogOpen(false);
      setReturnQty({});
      setReturnReason("");

      await viewInvoice(selectedInvoice);
      await loadBaseData();
    } catch (error) {
      console.error("Return item error:", error);
      alert(error.message || "Unable to process item return.");
    } finally {
      setReturnProcessing(false);
    }
  }

  async function cancelInvoice(invoice) {
    if (invoice.status === "CANCELLED") {
      alert("Invoice is already cancelled.");
      return;
    }

    const confirmed = window.confirm(
      `Cancel invoice ${invoice.invoice_number}?\n\nStock will be restored.`
    );

    if (!confirmed) return;

    try {
      const { data, error } = await supabase.rpc(
        "cancel_pos_invoice",
        {
          p_invoice_id: invoice.id,
        }
      );

      if (error) throw error;

      console.log("Invoice cancellation result:", data);
      alert("Invoice cancelled successfully.");

      closeInvoice();
      await loadBaseData();
    } catch (error) {
      console.error("Cancel invoice error:", error);
      alert(error.message || "Unable to cancel invoice.");
    }
  }

  function returnedAmount(invoice) {
    return Number(invoiceReturnTotals[invoice?.id]?.amount || 0);
  }

  function netInvoiceAmount(invoice) {
    return Math.max(0, Number(invoice?.total || 0) - returnedAmount(invoice));
  }

  function returnStatus(invoice) {
    const returned = returnedAmount(invoice);
    const total = Number(invoice?.total || 0);

    if (returned <= 0) return null;
    if (total > 0 && returned >= total) return "RETURNED";
    return "PARTIALLY RETURNED";
  }

  async function openCreditNote(returnRow) {
    setCreditNoteLoading(true);

    try {
      const { data: rows, error } = await supabase
        .from("invoice_return_items")
        .select("*")
        .eq("return_id", returnRow.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setSelectedReturn(returnRow);
      setSelectedReturnItems(rows || []);
    } catch (error) {
      console.error("Load credit note error:", error);
      alert(error.message || "Unable to load credit note.");
    } finally {
      setCreditNoteLoading(false);
    }
  }

  async function openCombinedCreditNote() {
    if (!selectedInvoice) return;

    const returns = invoiceReturnTotals[selectedInvoice.id]?.returns || [];
    if (returns.length === 0) {
      alert("No returns found for this invoice.");
      return;
    }

    setCombinedCreditLoading(true);

    try {
      const returnIds = returns.map((row) => row.id);

      const { data: rows, error } = await supabase
        .from("invoice_return_items")
        .select("*")
        .in("return_id", returnIds)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Combine multiple return records for the same invoice item into one line.
      const grouped = {};

      (rows || []).forEach((row) => {
        const key = row.invoice_item_id;

        if (!grouped[key]) {
          grouped[key] = {
            ...row,
            quantity: 0,
            return_amount: 0,
            return_numbers: [],
          };
        }

        grouped[key].quantity += Number(row.quantity || 0);
        grouped[key].return_amount += Number(row.return_amount || 0);

        const returnHeader = returns.find((r) => r.id === row.return_id);
        if (
          returnHeader?.return_number &&
          !grouped[key].return_numbers.includes(returnHeader.return_number)
        ) {
          grouped[key].return_numbers.push(returnHeader.return_number);
        }
      });

      setCombinedCreditItems(Object.values(grouped));
      setCombinedCreditOpen(true);
    } catch (error) {
      console.error("Load combined credit note error:", error);
      alert(error.message || "Unable to load combined credit note.");
    } finally {
      setCombinedCreditLoading(false);
    }
  }

  function closeCombinedCreditNote() {
    setCombinedCreditOpen(false);
    setCombinedCreditItems([]);
  }

  function printCombinedCreditNote() {
    if (!selectedInvoice || combinedCreditItems.length === 0) {
      alert("Credit note is not ready to print.");
      return;
    }

    const returns = invoiceReturnTotals[selectedInvoice.id]?.returns || [];
    const returnRefs = returns
      .map((row) => row.return_number)
      .slice()
      .reverse()
      .join(" / ");

    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const itemRows = combinedCreditItems
      .map((item, index) => {
        const originalItem = invoiceItems.find(
          (x) => x.id === item.invoice_item_id
        );

        return `
          <tr>
            <td class="center">${index + 1}</td>
            <td>
              <div class="item-name">${escapeHtml(originalItem?.item_name || "Item")}</div>
              <div class="sku">${escapeHtml(originalItem?.sku || "")}</div>
            </td>
            <td class="center">${escapeHtml(item.quantity)}</td>
            <td class="right">${escapeHtml(currency)} ${formatMoney(item.unit_price)}</td>
            <td class="right amount">${escapeHtml(currency)} ${formatMoney(item.return_amount)}</td>
          </tr>
        `;
      })
      .join("");

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      alert("Please allow pop-ups to print the credit note.");
      return;
    }

    const branchName = selectedBranch?.branch_name || companyName || "";
    const customerName = selectedInvoice.customer_name || "Walk-in Customer";

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Credit Note - ${escapeHtml(selectedInvoice.invoice_number)}</title>
          <style>
            * { box-sizing: border-box; }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
            }
            .page {
              width: 100%;
              padding: 20px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 30px;
              padding-bottom: 14px;
              border-bottom: 2px solid #111827;
            }
            .business h1 {
              margin: 0 0 7px;
              font-size: 25px;
              line-height: 1.1;
            }
            .business p {
              margin: 4px 0;
              font-size: 13px;
            }
            .title {
              text-align: right;
            }
            .title h2 {
              margin: 0 0 8px;
              font-size: 23px;
              letter-spacing: .4px;
            }
            .title strong {
              font-size: 14px;
            }
            .info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin: 16px 0;
            }
            .info-box {
              border: 1px solid #d7dee8;
              border-radius: 7px;
              padding: 9px 11px;
            }
            .label {
              display: block;
              margin-bottom: 4px;
              color: #64748b;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
            }
            .value {
              font-size: 13px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 12px;
            }
            th {
              padding: 9px 7px;
              border-top: 1px solid #cbd5e1;
              border-bottom: 1px solid #cbd5e1;
              background: #f8fafc;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
            }
            td {
              padding: 11px 7px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
              font-size: 12px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .item-name { font-weight: 700; }
            .sku {
              margin-top: 3px;
              color: #64748b;
              font-size: 10px;
            }
            .amount { font-weight: 700; }
            .total {
              width: 46%;
              margin: 18px 0 0 auto;
              padding: 11px 0;
              display: flex;
              justify-content: space-between;
              border-top: 2px solid #111827;
              border-bottom: 2px solid #111827;
              font-size: 16px;
              font-weight: 800;
            }
            .refs {
              margin-top: 18px;
              padding: 9px 11px;
              border: 1px solid #d7dee8;
              border-radius: 7px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              text-align: center;
              color: #64748b;
              font-size: 10px;
            }
            @media print {
              html, body { width: 100%; }
              .page { padding: 0; }
              thead { display: table-header-group; }
              tr { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="page">
            <section class="header">
              <div class="business">
                <h1>${escapeHtml(branchName)}</h1>
                ${invoiceAddress ? `<p>${escapeHtml(invoiceAddress)}</p>` : ""}
                ${
                  invoicePhone || invoiceEmail
                    ? `<p>${escapeHtml([invoicePhone, invoiceEmail].filter(Boolean).join(" • "))}</p>`
                    : ""
                }
                ${invoiceVat ? `<p><strong>VAT No:</strong> ${escapeHtml(invoiceVat)}</p>` : ""}
              </div>
              <div class="title">
                <h2>CREDIT NOTE</h2>
                <strong>${escapeHtml(returnRefs)}</strong>
              </div>
            </section>

            <section class="info">
              <div class="info-box">
                <span class="label">Original Invoice</span>
                <span class="value">${escapeHtml(selectedInvoice.invoice_number)}</span>
              </div>
              <div class="info-box">
                <span class="label">Invoice Date</span>
                <span class="value">${escapeHtml(formatDate(selectedInvoice.invoice_date))}</span>
              </div>
              <div class="info-box">
                <span class="label">Customer</span>
                <span class="value">${escapeHtml(customerName)}</span>
              </div>
              <div class="info-box">
                <span class="label">Branch</span>
                <span class="value">${escapeHtml(branchName)}</span>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th style="width:6%">#</th>
                  <th>Item</th>
                  <th style="width:13%;text-align:center">Qty Returned</th>
                  <th style="width:17%;text-align:right">Unit Price</th>
                  <th style="width:18%;text-align:right">Credit Amount</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>

            <div class="total">
              <span>TOTAL CREDIT</span>
              <span>${escapeHtml(currency)} ${formatMoney(returnedAmount(selectedInvoice))}</span>
            </div>

            <div class="refs">
              <span class="label">Related Return References</span>
              <span class="value">${escapeHtml(returnRefs)}</span>
            </div>

            <div class="footer">
              Combined credit note for returns relating to original invoice
              ${escapeHtml(selectedInvoice.invoice_number)}.
            </div>
          </main>

          <script>
            window.addEventListener("load", function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 250);
            });

            window.addEventListener("afterprint", function () {
              window.close();
            });
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function closeCreditNote() {
    setSelectedReturn(null);
    setSelectedReturnItems([]);
  }

  function printCreditNote() {
    document.body.classList.add("printing-credit-note");
    window.print();
    setTimeout(() => {
      document.body.classList.remove("printing-credit-note");
    }, 500);
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-LK");
  }

  function paymentStatus(invoice) {
    if (!invoice) return "PAID";

    return (
      invoice.payment_status ||
      (Number(invoice.due_amount || 0) <= 0
        ? "PAID"
        : Number(invoice.paid_amount || 0) > 0
        ? "PARTIAL"
        : "UNPAID")
    );
  }

  function printInvoice() {
    window.print();
  }

  const companyLogo = settings?.logo_url || "";

  const companyName = settings?.company_name || "LE ELECTRICS";
  const companyVat = settings?.company_vat_number || "";
  const currency = settings?.currency_symbol || "Rs.";
  const receiptFooter =
    settings?.receipt_footer || "Thank you for your business.";

  const selectedBranch = selectedInvoice
    ? branchMap[selectedInvoice.branch_id]
    : null;

  // Use the invoice's branch details on the printed invoice.
  const invoiceAddress =
    selectedBranch?.address || settings?.company_address || "";
  const invoicePhone =
    selectedBranch?.phone || settings?.company_phone || "";
  const invoiceEmail =
    selectedBranch?.email || settings?.company_email || "";
  const invoiceVat =
    selectedBranch?.vat_number || companyVat || "";

  return (
    <div className="invoices-page">
      <div className="invoices-heading">
        <div>
          <h2>Invoices</h2>
          <p>
            View VAT, non-VAT, paid, partial and credit invoices.
          </p>
        </div>

        <button
          className="invoice-refresh-btn"
          onClick={loadBaseData}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="invoice-stat-grid">
        <div className="invoice-stat">
          <span>Total Invoices</span>
          <strong>{completedInvoices.length}</strong>
        </div>

        <div className="invoice-stat">
          <span>Total Sales</span>
          <strong>{currency} {formatMoney(totalSales)}</strong>
        </div>

        <div className="invoice-stat">
          <span>Paid To Date</span>
          <strong>{currency} {formatMoney(totalPaid)}</strong>
        </div>

        <div className="invoice-stat">
          <span>Outstanding</span>
          <strong>{currency} {formatMoney(totalDue)}</strong>
        </div>

        <div className="invoice-stat">
          <span>VAT Amount</span>
          <strong>{currency} {formatMoney(vatCollected)}</strong>
        </div>
      </div>

      <div className="invoices-card">
        <div className="invoice-toolbar">
          <div className="invoice-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search invoice, customer, branch, cashier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="invoice-filter-groups">
            <div className="invoice-filters">
              <button
                className={filter === "ALL" ? "active" : ""}
                onClick={() => setFilter("ALL")}
              >
                All
              </button>

              <button
                className={filter === "VAT" ? "active" : ""}
                onClick={() => setFilter("VAT")}
              >
                VAT
              </button>

              <button
                className={filter === "NON_VAT" ? "active" : ""}
                onClick={() => setFilter("NON_VAT")}
              >
                Non-VAT
              </button>
            </div>

            <div className="invoice-filters payment-filters">
              {["ALL", "PAID", "PARTIAL", "UNPAID"].map((status) => (
                <button
                  key={status}
                  className={paymentFilter === status ? "active" : ""}
                  onClick={() => setPaymentFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="invoice-advanced-filters"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
            gap: "12px",
            padding: "16px",
            margin: "0 18px 18px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Invoice No.
            <input
              type="text"
              placeholder="INV-000001"
              value={invoiceNoFilter}
              onChange={(e) => setInvoiceNoFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            From Date
            <input
              type="date"
              value={dateFromFilter}
              onChange={(e) => setDateFromFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            To Date
            <input
              type="date"
              value={dateToFilter}
              onChange={(e) => setDateToFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Customer
            <input
              type="text"
              placeholder="Customer name"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Branch
            <select
              value={branchFilter}
              onChange={(e) => {
                const nextBranchId = e.target.value;
                if (nextBranchId && nextBranchId !== branchFilter) {
                  requestBranchSwitch?.(nextBranchId);
                }
              }}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Cashier
            <select
              value={cashierFilter}
              onChange={(e) => setCashierFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
            >
              <option value="ALL">All Cashiers</option>
              {cashierOptions.map((cashier) => (
                <option key={cashier} value={cashier}>
                  {cashier}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Type
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
            >
              <option value="ALL">All Types</option>
              <option value="VAT">VAT</option>
              <option value="NON_VAT">Non-VAT</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Payment Status
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
            >
              <option value="ALL">All Payments</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            Invoice Status
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              style={{ minHeight: "40px", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          <button
            type="button"
            onClick={clearInvoiceFilters}
            style={{
              minHeight: "40px",
              padding: "8px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear Filters
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Branch</th>
                <th>Cashier</th>
                <th>Type</th>
                <th>Original Total</th>
                <th>Returned</th>
                <th>Net Amount</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Payment Status</th>
                <th>Invoice Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="14">Loading invoices...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="14">
                    <div className="no-invoices">
                      <ReceiptText size={42} />
                      <strong>No invoices found</strong>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoice_number}</strong>
                    </td>

                    <td>{formatDate(invoice.invoice_date)}</td>

                    <td>
                      {invoice.customer_name || "Walk-in Customer"}
                    </td>

                    <td>
                      {branchMap[invoice.branch_id]?.branch_name || "-"}
                    </td>

                    <td>
                      <strong>{invoice.cashier_name || "-"}</strong>
                    </td>

                    <td>
                      <span
                        className={`invoice-type-badge ${
                          invoice.invoice_type === "VAT"
                            ? "vat"
                            : "non-vat"
                        }`}
                      >
                        {invoice.invoice_type === "VAT"
                          ? "VAT"
                          : "Non-VAT"}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {currency} {formatMoney(invoice.total)}
                      </strong>
                    </td>

                    <td>
                      <strong className={returnedAmount(invoice) > 0 ? "invoice-returned-amount" : ""}>
                        {currency} {formatMoney(returnedAmount(invoice))}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {currency} {formatMoney(netInvoiceAmount(invoice))}
                      </strong>
                    </td>

                    <td>
                      {currency} {formatMoney(invoice.paid_amount)}
                    </td>

                    <td>
                      <strong
                        className={
                          Number(invoice.due_amount || 0) > 0
                            ? "invoice-due-amount"
                            : ""
                        }
                      >
                        {currency} {formatMoney(invoice.due_amount)}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`payment-status-badge ${paymentStatus(
                          invoice
                        ).toLowerCase()}`}
                      >
                        {paymentStatus(invoice)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`invoice-status ${
                          invoice.status === "CANCELLED"
                            ? "cancelled"
                            : "completed"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="invoice-action-btn"
                        onClick={() => viewInvoice(invoice)}
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

      {selectedInvoice && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal">
            <div className="invoice-modal-top no-print">
              <div>
                <h3>{selectedInvoice.invoice_number}</h3>
                <div className="invoice-modal-statuses">
                  <span
                    className={`payment-status-badge ${paymentStatus(
                      selectedInvoice
                    ).toLowerCase()}`}
                  >
                    {paymentStatus(selectedInvoice)}
                  </span>

                  <span
                    className={`invoice-status ${
                      selectedInvoice.status === "CANCELLED"
                        ? "cancelled"
                        : "completed"
                    }`}
                  >
                    {selectedInvoice.status}
                  </span>

                  {returnStatus(selectedInvoice) && (
                    <span className="invoice-return-status">
                      {returnStatus(selectedInvoice)}
                    </span>
                  )}
                </div>
              </div>

              <div className="invoice-modal-actions">
                <button onClick={printInvoice}>
                  <Printer size={17} />
                  Print
                </button>

                {selectedInvoice.status === "COMPLETED" && (
                  <button
                    className="return-items-btn"
                    onClick={openReturnItems}
                  >
                    <RotateCcw size={17} />
                    Return Items
                  </button>
                )}

                {selectedInvoice.status !== "CANCELLED" && (
                  <button
                    className="cancel-invoice-btn"
                    onClick={() => cancelInvoice(selectedInvoice)}
                  >
                    <Ban size={17} />
                    Cancel Invoice
                  </button>
                )}

                <button
                  className="close-invoice-btn"
                  onClick={closeInvoice}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="print-invoice" id="print-invoice">
              <div className="print-header">
                <div className="company-print-details">
                  {selectedBranch?.branch_name && (
                    <h1>{selectedBranch.branch_name}</h1>
                  )}

                  {invoiceAddress && <p>{invoiceAddress}</p>}

                  {(invoicePhone || invoiceEmail) && (
                    <p>
                      {[invoicePhone, invoiceEmail]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}

                  {invoiceVat && (
                    <p>
                      <strong>VAT No:</strong> {invoiceVat}
                    </p>
                  )}
                </div>

                <div className="invoice-document-title">
                  <h2>
                    {selectedInvoice.invoice_type === "VAT"
                      ? "VAT INVOICE"
                      : "INVOICE"}
                  </h2>

                  <strong>{selectedInvoice.invoice_number}</strong>

                  <span
                    className={`print-payment-status ${paymentStatus(
                      selectedInvoice
                    ).toLowerCase()}`}
                  >
                    {paymentStatus(selectedInvoice)}
                  </span>
                </div>
              </div>

              <div className="invoice-information">
                <div>
                  <span>Invoice Date</span>
                  <strong>
                    {formatDate(selectedInvoice.invoice_date)}
                  </strong>
                </div>

                <div>
                  <span>Branch</span>
                  <strong>
                    {selectedBranch
                      ? `${selectedBranch.branch_code} - ${selectedBranch.branch_name}`
                      : "-"}
                  </strong>
                </div>

                <div>
                  <span>Customer</span>
                  <strong>
                    {selectedInvoice.customer_name ||
                      "Walk-in Customer"}
                  </strong>
                </div>

                <div>
                  <span>Cashier</span>
                  <strong>
                    {selectedInvoice.cashier_name || "-"}
                  </strong>
                </div>

                {selectedInvoice.invoice_type === "VAT" && (
                  <div>
                    <span>Customer VAT No.</span>
                    <strong>
                      {selectedInvoice.customer_vat_number || "-"}
                    </strong>
                  </div>
                )}

                <div>
                  <span>Original Payment Method</span>
                  <strong>
                    {selectedInvoice.payment_method || "Credit / Unpaid"}
                  </strong>
                </div>

                <div>
                  <span>Payment Status</span>
                  <strong>{paymentStatus(selectedInvoice)}</strong>
                </div>
              </div>

              {detailsLoading ? (
                <p>Loading invoice items...</p>
              ) : (
                <table className="invoice-items-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Discount</th>

                      {selectedInvoice.invoice_type === "VAT" && (
                        <>
                          <th>VAT %</th>
                          <th>VAT</th>
                        </>
                      )}

                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoiceItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.item_name}</td>
                        <td>{item.sku || "-"}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {currency} {formatMoney(item.unit_price)}
                        </td>
                        <td>
                          {currency} {formatMoney(item.discount)}
                        </td>

                        {selectedInvoice.invoice_type === "VAT" && (
                          <>
                            <td>{item.vat_rate}%</td>
                            <td>
                              {currency} {formatMoney(item.vat_amount)}
                            </td>
                          </>
                        )}

                        <td>
                          <strong>
                            {currency} {formatMoney(item.line_total)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {returnedAmount(selectedInvoice) > 0 && (
                <div className="invoice-return-summary-box">
                  <div>
                    <span>Original Invoice Total</span>
                    <strong>{currency} {formatMoney(selectedInvoice.total)}</strong>
                  </div>
                  <div>
                    <span>Returned / Credit</span>
                    <strong className="invoice-returned-amount">
                      - {currency} {formatMoney(returnedAmount(selectedInvoice))}
                    </strong>
                  </div>
                  <div>
                    <span>Net Sales Value</span>
                    <strong>{currency} {formatMoney(netInvoiceAmount(selectedInvoice))}</strong>
                  </div>
                </div>
              )}

              {(invoiceReturnTotals[selectedInvoice.id]?.returns || []).length > 0 && (
                <div className="invoice-credit-notes no-print">
                  <div className="invoice-credit-notes-heading">
                    <h4>Credit / Return Notes</h4>
                    <button
                      type="button"
                      className="combined-credit-btn"
                      onClick={openCombinedCreditNote}
                      disabled={combinedCreditLoading}
                    >
                      <Printer size={16} />
                      {combinedCreditLoading
                        ? "Loading..."
                        : "Print Combined Credit Note"}
                    </button>
                  </div>
                  {(invoiceReturnTotals[selectedInvoice.id]?.returns || []).map((returnRow) => (
                    <div className="invoice-credit-note-row" key={returnRow.id}>
                      <div>
                        <strong>{returnRow.return_number}</strong>
                        <span>{formatDate(returnRow.processed_at)}</span>
                      </div>
                      <strong>
                        {currency} {formatMoney(returnRow.return_amount)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => openCreditNote(returnRow)}
                        disabled={creditNoteLoading}
                      >
                        <Eye size={16} />
                        View / Print
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="invoice-bottom-grid">
                <div className="invoice-payment-history">
                  <h4>Payment History</h4>

                  {payments.length === 0 ? (
                    <p className="invoice-no-payments">
                      No payments recorded yet.
                    </p>
                  ) : (
                    <table className="payment-history-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Status</th>
                          <th>Amount</th>
                        </tr>
                      </thead>

                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{formatDate(payment.payment_date)}</td>
                            <td>{payment.payment_method}</td>
                            <td>{payment.reference_number || "-"}</td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 7px",
                                  borderRadius: "999px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  background:
                                    payment.status === "VOIDED"
                                      ? "#fee2e2"
                                      : "#dcfce7",
                                  color:
                                    payment.status === "VOIDED"
                                      ? "#991b1b"
                                      : "#166534",
                                }}
                                title={
                                  payment.status === "VOIDED"
                                    ? payment.void_reason || "Voided payment"
                                    : "Active payment"
                                }
                              >
                                {payment.status || "ACTIVE"}
                              </span>
                            </td>
                            <td
                              style={{
                                textDecoration:
                                  payment.status === "VOIDED"
                                    ? "line-through"
                                    : "none",
                                opacity:
                                  payment.status === "VOIDED" ? 0.6 : 1,
                              }}
                            >
                              {currency} {formatMoney(payment.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="invoice-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {currency} {formatMoney(selectedInvoice.subtotal)}
                    </strong>
                  </div>

                  <div>
                    <span>Discount</span>
                    <strong>
                      {currency} {formatMoney(selectedInvoice.discount)}
                    </strong>
                  </div>

                  {selectedInvoice.invoice_type === "VAT" && (
                    <>
                      <div>
                        <span>Taxable Amount</span>
                        <strong>
                          {currency}{" "}
                          {formatMoney(selectedInvoice.taxable_amount)}
                        </strong>
                      </div>

                      <div>
                        <span>VAT</span>
                        <strong>
                          {currency}{" "}
                          {formatMoney(selectedInvoice.vat_amount)}
                        </strong>
                      </div>
                    </>
                  )}

                  {returnedAmount(selectedInvoice) > 0 && (
                    <>
                      <div>
                        <span>Returned / Credit</span>
                        <strong className="invoice-returned-amount">
                          - {currency} {formatMoney(returnedAmount(selectedInvoice))}
                        </strong>
                      </div>
                      <div className="invoice-net-total">
                        <span>Net Sales Value</span>
                        <strong>
                          {currency} {formatMoney(netInvoiceAmount(selectedInvoice))}
                        </strong>
                      </div>
                    </>
                  )}

                  <div className="invoice-grand-total">
                    <span>Invoice Total</span>
                    <strong>
                      {currency} {formatMoney(selectedInvoice.total)}
                    </strong>
                  </div>

                  <div className="invoice-paid-row">
                    <span>Paid Amount</span>
                    <strong>
                      {currency}{" "}
                      {formatMoney(selectedInvoice.paid_amount)}
                    </strong>
                  </div>

                  <div
                    className={
                      Number(selectedInvoice.due_amount || 0) > 0
                        ? "invoice-due-row"
                        : ""
                    }
                  >
                    <span>Amount Due</span>
                    <strong>
                      {currency}{" "}
                      {formatMoney(selectedInvoice.due_amount)}
                    </strong>
                  </div>

                  {Number(selectedInvoice.balance || 0) > 0 && (
                    <div>
                      <span>Cash Change</span>
                      <strong>
                        {currency}{" "}
                        {formatMoney(selectedInvoice.balance)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="invoice-footer-note">
                {receiptFooter}
              </div>

              {selectedInvoice.status === "CANCELLED" && (
                <div className="cancelled-watermark">
                  CANCELLED
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {returnDialogOpen && selectedInvoice && (
        <div className="invoice-return-overlay">
          <div className="invoice-return-modal">
            <div className="invoice-return-header">
              <div>
                <h3>Return Items</h3>
                <p>{selectedInvoice.invoice_number}</p>
              </div>

              <button
                type="button"
                className="invoice-return-close"
                onClick={() => !returnProcessing && setReturnDialogOpen(false)}
                disabled={returnProcessing}
              >
                <X size={20} />
              </button>
            </div>

            <div className="invoice-return-table-wrap">
              <table className="invoice-return-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Sold</th>
                    <th>Already Returned</th>
                    <th>Available</th>
                    <th>Return Qty</th>
                    <th>Return Value</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item) => {
                    const available = availableReturnQty(item);
                    const qty = Number(returnQty[item.id] || 0);
                    const unitReturn =
                      Number(item.line_total || 0) /
                      Math.max(Number(item.quantity || 1), 1);

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.item_name}</strong>
                          <span>{item.sku || "-"}</span>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{returnedQty[item.id] || 0}</td>
                        <td>
                          <strong>{available}</strong>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max={available}
                            step="1"
                            value={returnQty[item.id] ?? ""}
                            disabled={available <= 0 || returnProcessing}
                            placeholder="0"
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setReturnQty((prev) => ({
                                  ...prev,
                                  [item.id]: "",
                                }));
                                return;
                              }

                              const next = Math.max(
                                0,
                                Math.min(Number(raw), available)
                              );

                              setReturnQty((prev) => ({
                                ...prev,
                                [item.id]: next,
                              }));
                            }}
                          />
                        </td>
                        <td>
                          {currency} {formatMoney(unitReturn * qty)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="invoice-return-reason">
              <label>Return Reason</label>
              <input
                type="text"
                value={returnReason}
                disabled={returnProcessing}
                placeholder="Example: Customer returned 2 pcs"
                onChange={(e) => setReturnReason(e.target.value)}
              />
            </div>

            <div className="invoice-return-footer">
              <div>
                <span>Total Return Value</span>
                <strong>
                  {currency} {formatMoney(selectedReturnAmount())}
                </strong>
              </div>

              <div className="invoice-return-footer-actions">
                <button
                  type="button"
                  onClick={() => setReturnDialogOpen(false)}
                  disabled={returnProcessing}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="confirm-return-btn"
                  onClick={confirmItemReturn}
                  disabled={returnProcessing}
                >
                  <RotateCcw size={17} />
                  {returnProcessing ? "Processing..." : "Confirm Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {combinedCreditOpen && selectedInvoice && (
        <div className="combined-credit-overlay">
          <div className="combined-credit-modal">
            <div className="combined-credit-actions no-print">
              <button type="button" onClick={printCombinedCreditNote}>
                <Printer size={17} />
                Print Combined Credit Note
              </button>
              <button type="button" onClick={closeCombinedCreditNote}>
                <X size={20} />
              </button>
            </div>

            <div className="combined-credit-print">
              <div className="credit-note-header">
                <div>
                  <h1>{selectedBranch?.branch_name || companyName}</h1>
                  {invoiceAddress && <p>{invoiceAddress}</p>}
                  {(invoicePhone || invoiceEmail) && (
                    <p>
                      {[invoicePhone, invoiceEmail]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  )}
                  {invoiceVat && (
                    <p>
                      <strong>VAT No:</strong> {invoiceVat}
                    </p>
                  )}
                </div>

                <div>
                  <h2>CREDIT NOTE</h2>
                  <strong>
                    {(invoiceReturnTotals[selectedInvoice.id]?.returns || [])
                      .map((row) => row.return_number)
                      .slice()
                      .reverse()
                      .join(" / ")}
                  </strong>
                </div>
              </div>

              <div className="credit-note-info">
                <div>
                  <span>Original Invoice</span>
                  <strong>{selectedInvoice.invoice_number}</strong>
                </div>
                <div>
                  <span>Invoice Date</span>
                  <strong>{formatDate(selectedInvoice.invoice_date)}</strong>
                </div>
                <div>
                  <span>Customer</span>
                  <strong>
                    {selectedInvoice.customer_name || "Walk-in Customer"}
                  </strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>{selectedBranch?.branch_name || "-"}</strong>
                </div>
              </div>

              <table className="credit-note-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>SKU</th>
                    <th>Qty Returned</th>
                    <th>Unit Price</th>
                    <th>Credit Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedCreditItems.map((item, index) => {
                    const originalItem = invoiceItems.find(
                      (x) => x.id === item.invoice_item_id
                    );

                    return (
                      <tr key={item.invoice_item_id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{originalItem?.item_name || "Item"}</strong>
                          {item.return_numbers?.length > 0 && (
                            <span>
                              {item.return_numbers.join(", ")}
                            </span>
                          )}
                        </td>
                        <td>{originalItem?.sku || "-"}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {currency} {formatMoney(item.unit_price)}
                        </td>
                        <td>
                          <strong>
                            {currency} {formatMoney(item.return_amount)}
                          </strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="credit-note-total">
                <span>TOTAL CREDIT</span>
                <strong>
                  {currency} {formatMoney(returnedAmount(selectedInvoice))}
                </strong>
              </div>

              <div className="combined-return-references">
                <span>Related Return References</span>
                <strong>
                  {(invoiceReturnTotals[selectedInvoice.id]?.returns || [])
                    .map((row) => row.return_number)
                    .slice()
                    .reverse()
                    .join(", ")}
                </strong>
              </div>

              <div className="credit-note-footer">
                Combined credit note for returns relating to original invoice{" "}
                {selectedInvoice.invoice_number}.
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReturn && selectedInvoice && (
        <div className="credit-note-overlay">
          <div className="credit-note-modal">
            <div className="credit-note-actions no-print">
              <button type="button" onClick={printCreditNote}>
                <Printer size={17} />
                Print Credit Note
              </button>
              <button type="button" onClick={closeCreditNote}>
                <X size={20} />
              </button>
            </div>

            <div className="credit-note-print" id="credit-note-print">
              <div className="credit-note-header">
                <div>
                  <h1>{selectedBranch?.branch_name || companyName}</h1>
                  {invoiceAddress && <p>{invoiceAddress}</p>}
                  {(invoicePhone || invoiceEmail) && (
                    <p>{[invoicePhone, invoiceEmail].filter(Boolean).join(" • ")}</p>
                  )}
                </div>
                <div>
                  <h2>CREDIT NOTE</h2>
                  <strong>{selectedReturn.return_number}</strong>
                </div>
              </div>

              <div className="credit-note-info">
                <div>
                  <span>Original Invoice</span>
                  <strong>{selectedInvoice.invoice_number}</strong>
                </div>
                <div>
                  <span>Return Date</span>
                  <strong>{formatDate(selectedReturn.processed_at)}</strong>
                </div>
                <div>
                  <span>Customer</span>
                  <strong>{selectedInvoice.customer_name || "Walk-in Customer"}</strong>
                </div>
                <div>
                  <span>Branch</span>
                  <strong>{selectedBranch?.branch_name || "-"}</strong>
                </div>
              </div>

              <table className="credit-note-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Qty Returned</th>
                    <th>Unit Price</th>
                    <th>Credit Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReturnItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>
                          {invoiceItems.find((x) => x.id === item.invoice_item_id)?.item_name || "Item"}
                        </strong>
                        <span>
                          {invoiceItems.find((x) => x.id === item.invoice_item_id)?.sku || ""}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{currency} {formatMoney(item.unit_price)}</td>
                      <td>
                        <strong>{currency} {formatMoney(item.return_amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="credit-note-total">
                <span>TOTAL CREDIT</span>
                <strong>{currency} {formatMoney(selectedReturn.return_amount)}</strong>
              </div>

              {selectedReturn.reason && (
                <div className="credit-note-reason">
                  <span>Reason</span>
                  <strong>{selectedReturn.reason}</strong>
                </div>
              )}

              <div className="credit-note-footer">
                This credit note relates to original invoice {selectedInvoice.invoice_number}.
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .return-items-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          border-radius: 8px;
          padding: 9px 12px;
          background: #fff7ed;
          color: #c2410c;
          font-weight: 800;
          cursor: pointer;
        }

        .invoice-return-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(15, 23, 42, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .invoice-return-modal {
          width: min(980px, 96vw);
          max-height: 90vh;
          overflow: auto;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.25);
          padding: 22px;
        }

        .invoice-return-header,
        .invoice-return-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .invoice-return-header {
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .invoice-return-header h3 {
          margin: 0;
          font-size: 20px;
        }

        .invoice-return-header p {
          margin: 4px 0 0;
          color: #64748b;
        }

        .invoice-return-close {
          border: 0;
          background: transparent;
          cursor: pointer;
          padding: 6px;
        }

        .invoice-return-table-wrap {
          overflow-x: auto;
          margin-top: 18px;
        }

        .invoice-return-table {
          width: 100%;
          border-collapse: collapse;
        }

        .invoice-return-table th,
        .invoice-return-table td {
          padding: 11px 9px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }

        .invoice-return-table th {
          background: #f8fafc;
          font-size: 12px;
          color: #475569;
        }

        .invoice-return-table td > span {
          display: block;
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .invoice-return-table input {
          width: 90px;
          padding: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          font-weight: 800;
        }

        .invoice-return-reason {
          margin-top: 18px;
        }

        .invoice-return-reason label {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 800;
          color: #475569;
        }

        .invoice-return-reason input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 11px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
        }

        .invoice-return-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e2e8f0;
        }

        .invoice-return-footer > div:first-child span {
          display: block;
          color: #64748b;
          font-size: 12px;
        }

        .invoice-return-footer > div:first-child strong {
          display: block;
          margin-top: 3px;
          font-size: 20px;
        }

        .invoice-return-footer-actions {
          display: flex;
          gap: 8px;
        }

        .invoice-return-footer-actions button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 13px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          font-weight: 800;
          cursor: pointer;
        }

        .invoice-return-footer-actions .confirm-return-btn {
          border-color: #c2410c;
          background: #c2410c;
          color: #fff;
        }

        .invoice-return-footer-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 720px) {
          .invoice-return-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .invoice-return-footer-actions {
            width: 100%;
          }

          .invoice-return-footer-actions button {
            flex: 1;
            justify-content: center;
          }
        }

        .invoice-returned-amount {
          color: #c2410c;
        }

        .invoice-return-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 4px 9px;
          background: #ffedd5;
          color: #9a3412;
          font-size: 11px;
          font-weight: 900;
        }

        .invoice-return-summary-box {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .invoice-return-summary-box > div {
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 11px;
        }

        .invoice-return-summary-box span,
        .credit-note-info span,
        .credit-note-reason span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .invoice-return-summary-box strong {
          display: block;
          margin-top: 4px;
          font-size: 15px;
        }

        .invoice-credit-notes {
          margin: 18px 0;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
        }

        .invoice-credit-notes-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .invoice-credit-notes h4 {
          margin: 0;
        }

        .combined-credit-btn,
        .combined-credit-actions button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid #0f172a;
          border-radius: 8px;
          padding: 8px 11px;
          background: #0f172a;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }

        .combined-credit-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .combined-credit-overlay {
          position: fixed;
          inset: 0;
          z-index: 12000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .62);
        }

        .combined-credit-modal {
          width: min(900px, 96vw);
          max-height: 94vh;
          overflow: auto;
          border-radius: 14px;
          background: #fff;
          padding: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .25);
        }

        .combined-credit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 16px;
        }

        .combined-credit-actions button:last-child {
          border-color: #cbd5e1;
          background: #fff;
          color: #0f172a;
        }

        .combined-credit-print {
          color: #0f172a;
          background: #fff;
        }

        .combined-return-references {
          margin-top: 18px;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }

        .combined-return-references span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
        }

        .combined-return-references strong {
          display: block;
          margin-top: 4px;
        }

        .invoice-credit-note-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 14px;
          align-items: center;
          padding: 9px 0;
          border-top: 1px solid #eef2f7;
        }

        .invoice-credit-note-row span {
          display: block;
          margin-top: 2px;
          color: #64748b;
          font-size: 11px;
        }

        .invoice-credit-note-row button,
        .credit-note-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #fff;
          padding: 8px 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .credit-note-overlay {
          position: fixed;
          inset: 0;
          z-index: 11000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, .6);
        }

        .credit-note-modal {
          width: min(850px, 96vw);
          max-height: 94vh;
          overflow: auto;
          border-radius: 14px;
          background: #fff;
          padding: 22px;
          box-shadow: 0 24px 70px rgba(15, 23, 42, .25);
        }

        .credit-note-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 16px;
        }

        .credit-note-print {
          color: #0f172a;
          background: #fff;
        }

        .credit-note-header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 14px;
          border-bottom: 2px solid #0f172a;
        }

        .credit-note-header h1,
        .credit-note-header h2,
        .credit-note-header p {
          margin: 0 0 4px;
        }

        .credit-note-header > div:last-child {
          text-align: right;
        }

        .credit-note-info {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin: 15px 0;
        }

        .credit-note-info > div,
        .credit-note-reason {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 9px 10px;
        }

        .credit-note-info strong,
        .credit-note-reason strong {
          display: block;
          margin-top: 3px;
        }

        .credit-note-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }

        .credit-note-table th,
        .credit-note-table td {
          padding: 9px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
        }

        .credit-note-table th {
          background: #f8fafc;
          font-size: 11px;
          text-transform: uppercase;
        }

        .credit-note-table td span {
          display: block;
          margin-top: 2px;
          color: #64748b;
          font-size: 10px;
        }

        .credit-note-total {
          width: min(330px, 100%);
          margin: 18px 0 0 auto;
          display: flex;
          justify-content: space-between;
          border-top: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          padding: 11px 0;
          font-size: 16px;
          font-weight: 900;
        }

        .credit-note-reason {
          margin-top: 18px;
        }

        .credit-note-footer {
          margin-top: 22px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 11px;
        }

        @media print {
          .invoice-return-overlay {
            display: none !important;
          }

          body.printing-credit-note .invoices-page > * {
            display: none !important;
          }

          body.printing-credit-note .credit-note-overlay {
            display: block !important;
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body.printing-credit-note .credit-note-modal {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          body.printing-credit-note .credit-note-print {
            display: block !important;
          }

          body.printing-credit-note .no-print {
            display: none !important;
          }

          body.printing-combined-credit-note .invoices-page > * {
            display: none !important;
          }

          body.printing-combined-credit-note .combined-credit-overlay {
            display: block !important;
            position: static !important;
            inset: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body.printing-combined-credit-note .combined-credit-modal {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          body.printing-combined-credit-note .combined-credit-print {
            display: block !important;
          }

          body.printing-combined-credit-note .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Invoices;
