import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  ReceiptText,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Reports.css";

const today = new Date().toISOString().slice(0, 10);

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export default function Reports({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [branchStock, setBranchStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [invoiceReturns, setInvoiceReturns] = useState([]);
  const [invoiceReturnItems, setInvoiceReturnItems] = useState([]);

  const [reportType, setReportType] = useState("SALES");
  const [cashierId, setCashierId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setCashierId("");
    setSearch("");
  }, [activeBranchId, activeBranch?.id]);

  useEffect(() => {
    loadReportData();
  }, [branchId, cashierId, dateFrom, dateTo]);

  async function loadMasterData() {
    const [branchResult, itemResult, cashierResult] = await Promise.all([
      supabase.from("branches").select("*").order("branch_name"),
      supabase.from("items").select("*").order("name"),
      supabase
        .from("cashiers")
        .select("id, cashier_code, name, email, branch_id, status")
        .eq("status", "ACTIVE")
        .order("name"),
    ]);

    if (branchResult.error) {
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      setBranches(
        appBranches?.length ? appBranches : branchResult.data || []
      );

      const currentGlobalBranchId =
        activeBranchId || activeBranch?.id || "";

      if (currentGlobalBranchId) {
        setBranchId(currentGlobalBranchId);
      }
    }

    if (itemResult.error) alert(itemResult.error.message);
    else setItems(itemResult.data || []);

    if (cashierResult.error) alert(cashierResult.error.message);
    else setCashiers(cashierResult.data || []);
  }

  async function loadReportData() {
    setLoading(true);

    let invoiceQuery = supabase
      .from("invoices")
      .select("*")
      .gte("invoice_date", `${dateFrom}T00:00:00`)
      .lte("invoice_date", `${dateTo}T23:59:59`)
      .order("invoice_date", { ascending: false });

    let paymentQuery = supabase
      .from("invoice_payments")
      .select("*")
      .eq("status", "ACTIVE")
      .gte("payment_date", `${dateFrom}T00:00:00`)
      .lte("payment_date", `${dateTo}T23:59:59`)
      .order("payment_date", { ascending: false });

    let movementQuery = supabase
      .from("stock_movements")
      .select("*")
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false });

    let stockQuery = supabase.from("branch_stock").select("*");

    if (!branchId) {
      setInvoices([]);
      setPayments([]);
      setInvoiceItems([]);
      setBranchStock([]);
      setMovements([]);
      setInvoiceReturns([]);
      setInvoiceReturnItems([]);
      setLoading(false);
      return;
    }

    invoiceQuery = invoiceQuery.eq("branch_id", branchId);
    paymentQuery = paymentQuery.eq("branch_id", branchId);
    movementQuery = movementQuery.eq("branch_id", branchId);
    stockQuery = stockQuery.eq("branch_id", branchId);

    if (cashierId) {
      invoiceQuery = invoiceQuery.eq("cashier_id", cashierId);
    }

    const [
      invoiceResult,
      paymentResult,
      stockResult,
      movementResult,
    ] = await Promise.all([
      invoiceQuery,
      paymentQuery,
      stockQuery,
      movementQuery,
    ]);

    if (invoiceResult.error) {
      alert(invoiceResult.error.message);
      setInvoices([]);
      setInvoiceItems([]);
    } else {
      const invoiceData = invoiceResult.data || [];
      setInvoices(invoiceData);

      const ids = invoiceData.map((row) => row.id);
      if (ids.length) {
        const itemResult = await supabase
          .from("invoice_items")
          .select("*")
          .in("invoice_id", ids);

        if (itemResult.error) {
          alert(itemResult.error.message);
          setInvoiceItems([]);
        } else {
          setInvoiceItems(itemResult.data || []);
        }

        const { data: returnData, error: returnError } = await supabase
          .from("invoice_returns")
          .select("id, invoice_id, return_number, return_amount, processed_at")
          .in("invoice_id", ids);

        if (returnError) {
          console.error("Load invoice returns error:", returnError);
          setInvoiceReturns([]);
          setInvoiceReturnItems([]);
        } else {
          const returnHeaders = returnData || [];
          setInvoiceReturns(returnHeaders);

          const returnIds = returnHeaders.map((row) => row.id);
          if (returnIds.length) {
            const { data: returnItemData, error: returnItemError } = await supabase
              .from("invoice_return_items")
              .select("return_id, invoice_item_id, item_id, quantity, return_amount")
              .in("return_id", returnIds);

            if (returnItemError) {
              console.error("Load invoice return items error:", returnItemError);
              setInvoiceReturnItems([]);
            } else {
              setInvoiceReturnItems(returnItemData || []);
            }
          } else {
            setInvoiceReturnItems([]);
          }
        }
      } else {
        setInvoiceItems([]);
        setInvoiceReturns([]);
        setInvoiceReturnItems([]);
      }
    }

    if (paymentResult.error) {
      alert(paymentResult.error.message);
      setPayments([]);
    } else {
      setPayments(paymentResult.data || []);
    }

    if (stockResult.error) alert(stockResult.error.message);
    else setBranchStock(stockResult.data || []);

    if (movementResult.error) alert(movementResult.error.message);
    else setMovements(movementResult.data || []);

    setLoading(false);
  }

  const branchMap = useMemo(() => {
    const map = {};
    branches.forEach((branch) => {
      map[branch.id] = branch;
    });
    return map;
  }, [branches]);

  const itemMap = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  const validInvoices = useMemo(
    () => invoices.filter((row) => row.status !== "CANCELLED"),
    [invoices]
  );

  const cashierMap = useMemo(() => {
    const map = {};
    cashiers.forEach((cashier) => {
      map[cashier.id] =
        cashier.name || cashier.email || cashier.cashier_code || "Unnamed Cashier";
    });
    return map;
  }, [cashiers]);

  const returnAmountByInvoice = useMemo(() => {
    const map = {};
    invoiceReturns.forEach((row) => {
      map[row.invoice_id] =
        Number(map[row.invoice_id] || 0) + Number(row.return_amount || 0);
    });
    return map;
  }, [invoiceReturns]);

  const cashierSales = useMemo(() => {
    const map = {};

    validInvoices.forEach((invoice) => {
      const id = invoice.cashier_id || invoice.cashier_user_id || "UNASSIGNED";
      const name =
        invoice.cashier_name ||
        cashierMap[id] ||
        "Unassigned";

      if (!map[id]) {
        map[id] = {
          cashier_id: id,
          cashier_name: name,
          invoices: 0,
          gross_sales: 0,
          returns: 0,
          net_sales: 0,
          paid: 0,
          due: 0,
          vat: 0,
          paid_count: 0,
          partial_count: 0,
          unpaid_count: 0,
        };
      }

      const gross = Number(invoice.total || 0);
      const returned = Number(returnAmountByInvoice[invoice.id] || 0);
      const net = Math.max(0, gross - returned);
      const status =
        invoice.payment_status ||
        (Number(invoice.due_amount || 0) <= 0
          ? "PAID"
          : Number(invoice.paid_amount || 0) > 0
          ? "PARTIAL"
          : "UNPAID");

      map[id].invoices += 1;
      map[id].gross_sales += gross;
      map[id].returns += returned;
      map[id].net_sales += net;
      map[id].paid += Math.min(Number(invoice.paid_amount || 0), net);
      map[id].due += Math.min(Number(invoice.due_amount || 0), net);
      map[id].vat += Number(invoice.vat_amount || 0);

      if (status === "PAID") map[id].paid_count += 1;
      if (status === "PARTIAL") map[id].partial_count += 1;
      if (status === "UNPAID") map[id].unpaid_count += 1;
    });

    return Object.values(map).sort((a, b) => b.net_sales - a.net_sales);
  }, [validInvoices, cashierMap, returnAmountByInvoice]);


  const cashierReportSummary = useMemo(() => {
    return cashierSales.reduce(
      (sum, row) => ({
        invoices: sum.invoices + row.invoices,
        gross: sum.gross + row.gross_sales,
        returns: sum.returns + row.returns,
        net: sum.net + row.net_sales,
        paid: sum.paid + row.paid,
        due: sum.due + row.due,
        vat: sum.vat + row.vat,
        paidCount: sum.paidCount + row.paid_count,
        partialCount: sum.partialCount + row.partial_count,
        unpaidCount: sum.unpaidCount + row.unpaid_count,
      }),
      {
        invoices: 0, gross: 0, returns: 0, net: 0,
        paid: 0, due: 0, vat: 0,
        paidCount: 0, partialCount: 0, unpaidCount: 0,
      }
    );
  }, [cashierSales]);

  const salesSummary = useMemo(() => {
    let total = 0;
    let grossTotal = 0;
    let returnedTotal = 0;
    let vatSales = 0;
    let nonVatSales = 0;
    let vatAmount = 0;
    let outstanding = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    validInvoices.forEach((invoice) => {
      const gross = Number(invoice.total || 0);
      const returned = Number(returnAmountByInvoice[invoice.id] || 0);
      const net = Math.max(0, gross - returned);

      grossTotal += gross;
      returnedTotal += returned;
      total += net;
      vatAmount += Number(invoice.vat_amount || 0);
      outstanding += Math.min(Number(invoice.due_amount || 0), net);

      if (invoice.invoice_type === "VAT") vatSales += net;
      else nonVatSales += net;

      const status =
        invoice.payment_status ||
        (Number(invoice.due_amount || 0) <= 0
          ? "PAID"
          : Number(invoice.paid_amount || 0) > 0
          ? "PARTIAL"
          : "UNPAID");

      if (status === "PAID") paidCount += 1;
      if (status === "PARTIAL") partialCount += 1;
      if (status === "UNPAID") unpaidCount += 1;
    });

    let collected = 0;
    let cash = 0;
    let card = 0;
    let bank = 0;

    payments.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      collected += amount;

      if (payment.payment_method === "CASH") cash += amount;
      if (payment.payment_method === "CARD") card += amount;
      if (payment.payment_method === "BANK") bank += amount;
    });

    return {
      total,
      grossTotal,
      returnedTotal,
      vatSales,
      nonVatSales,
      vatAmount,
      outstanding,
      collected,
      cash,
      card,
      bank,
      paidCount,
      partialCount,
      unpaidCount,
      count: validInvoices.length,
    };
  }, [validInvoices, payments, returnAmountByInvoice]);

  const branchSales = useMemo(() => {
    const map = {};

    validInvoices.forEach((invoice) => {
      const id = invoice.branch_id || "UNASSIGNED";
      if (!map[id]) {
        map[id] = {
          branch_id: id,
          branch_name: branchMap[id]?.branch_name || "Unassigned",
          invoice_count: 0,
          gross_sales: 0,
          returns: 0,
          net_sales: 0,
          collected: 0,
          outstanding: 0,
          vat: 0,
        };
      }

      const gross = Number(invoice.total || 0);
      const returned = Number(returnAmountByInvoice[invoice.id] || 0);
      const net = Math.max(0, gross - returned);

      map[id].invoice_count += 1;
      map[id].gross_sales += gross;
      map[id].returns += returned;
      map[id].net_sales += net;
      map[id].collected += Math.min(Number(invoice.paid_amount || 0), net);
      map[id].outstanding += Math.min(Number(invoice.due_amount || 0), net);
      map[id].vat += Number(invoice.vat_amount || 0);
    });

    return Object.values(map).sort((a, b) => b.net_sales - a.net_sales);
  }, [validInvoices, branchMap, returnAmountByInvoice]);

  const itemSales = useMemo(() => {
    const invoiceMap = {};
    validInvoices.forEach((invoice) => {
      invoiceMap[invoice.id] = invoice;
    });

    const returnedByInvoiceItem = {};
    invoiceReturnItems.forEach((row) => {
      const key = row.invoice_item_id;
      if (!returnedByInvoiceItem[key]) {
        returnedByInvoiceItem[key] = {
          quantity: 0,
          amount: 0,
        };
      }
      returnedByInvoiceItem[key].quantity += Number(row.quantity || 0);
      returnedByInvoiceItem[key].amount += Number(row.return_amount || 0);
    });

    const map = {};

    invoiceItems.forEach((line) => {
      // Cancelled invoices are excluded because they are not in validInvoices.
      if (!invoiceMap[line.invoice_id]) return;

      const key = line.item_id || line.sku || line.item_name;
      if (!map[key]) {
        map[key] = {
          item_id: line.item_id,
          sku: line.sku || "-",
          name: line.item_name || "-",
          sold_quantity: 0,
          returned_quantity: 0,
          net_quantity: 0,
          gross_sales: 0,
          returns: 0,
          net_sales: 0,
          vat: 0,
        };
      }

      const soldQty = Number(line.quantity || 0);
      const grossSales = Number(line.line_total || 0);
      const returned = returnedByInvoiceItem[line.id] || {
        quantity: 0,
        amount: 0,
      };

      map[key].sold_quantity += soldQty;
      map[key].returned_quantity += returned.quantity;
      map[key].net_quantity += Math.max(0, soldQty - returned.quantity);
      map[key].gross_sales += grossSales;
      map[key].returns += returned.amount;
      map[key].net_sales += Math.max(0, grossSales - returned.amount);

      // VAT is kept from valid sales lines. Return credit is shown separately.
      map[key].vat += Number(line.vat_amount || 0);
    });

    return Object.values(map).sort((a, b) => b.net_sales - a.net_sales);
  }, [invoiceItems, validInvoices, invoiceReturnItems]);

  const customerSales = useMemo(() => {
    const map = {};

    validInvoices.forEach((invoice) => {
      const key = invoice.customer_id || invoice.customer_name || "Walk-in Customer";

      if (!map[key]) {
        map[key] = {
          customer: invoice.customer_name || "Walk-in Customer",
          invoices: 0,
          total: 0,
          paid: 0,
          outstanding: 0,
        };
      }

      map[key].invoices += 1;
      map[key].total += Number(invoice.total || 0);
      map[key].paid += Number(invoice.paid_amount || 0);
      map[key].outstanding += Number(invoice.due_amount || 0);
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [validInvoices]);

  const stockRows = useMemo(() => {
    return branchStock
      .map((row) => {
        const item = itemMap[row.item_id];
        const branch = branchMap[row.branch_id];

        return {
          ...row,
          sku: item?.sku || "-",
          name: item?.name || "-",
          category: item?.category || "-",
          unit: item?.unit || "PCS",
          branch_name: branch?.branch_name || "-",
          quantity: Number(row.quantity || 0),
          reorder_level: Number(row.reorder_level || 0),
        };
      })
      .filter((row) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return [row.sku, row.name, row.category, row.branch_name].some((value) =>
          String(value).toLowerCase().includes(term)
        );
      });
  }, [branchStock, itemMap, branchMap, search]);

  const lowStockRows = useMemo(
    () =>
      stockRows.filter(
        (row) =>
          row.quantity <= 0 ||
          (row.reorder_level > 0 && row.quantity <= row.reorder_level)
      ),
    [stockRows]
  );

  const movementRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return movements
      .map((row) => ({
        ...row,
        item_name: itemMap[row.item_id]?.name || "-",
        sku: itemMap[row.item_id]?.sku || "-",
        branch_name: branchMap[row.branch_id]?.branch_name || "-",
      }))
      .filter((row) => {
        if (!term) return true;
        return [
          row.item_name,
          row.sku,
          row.branch_name,
          row.movement_type,
          row.reference_type,
          row.remarks,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [movements, itemMap, branchMap, search]);

  function exportCsv() {
    let rows = [];
    let filename = "report.csv";

    if (reportType === "SALES") {
      rows = [
        [
          "Invoice",
          "Date",
          "Branch",
          "Cashier",
          "Type",
          "Customer",
          "Payment Status",
          "Gross Total",
          "Returned / Credit",
          "Net Sales",
          "Paid To Date",
          "Outstanding",
          "VAT",
        ],
        ...validInvoices.map((row) => [
          row.invoice_number,
          new Date(row.invoice_date).toLocaleString("en-LK"),
          branchMap[row.branch_id]?.branch_name || "-",
          row.cashier_name || cashierMap[row.cashier_user_id] || "-",
          row.invoice_type,
          row.customer_name || "Walk-in Customer",
          row.payment_status || "PAID",
          Number(row.total || 0).toFixed(2),
          Number(returnAmountByInvoice[row.id] || 0).toFixed(2),
          Math.max(0, Number(row.total || 0) - Number(returnAmountByInvoice[row.id] || 0)).toFixed(2),
          Math.min(
            Number(row.paid_amount || 0),
            Math.max(0, Number(row.total || 0) - Number(returnAmountByInvoice[row.id] || 0))
          ).toFixed(2),
          Math.min(
            Number(row.due_amount || 0),
            Math.max(0, Number(row.total || 0) - Number(returnAmountByInvoice[row.id] || 0))
          ).toFixed(2),
          Number(row.vat_amount || 0).toFixed(2),
        ]),
      ];
      filename = "sales-report.csv";
    }

    if (reportType === "CASHIER_SALES") {
      rows = [
        ["Cashier", "Invoices", "Gross Sales", "Returns", "Net Sales", "Paid", "Outstanding", "VAT", "Paid Count", "Partial Count", "Unpaid Count"],
        ...cashierSales.map((row) => [
          row.cashier_name,
          row.invoices,
          row.gross_sales.toFixed(2),
          row.returns.toFixed(2),
          row.net_sales.toFixed(2),
          row.paid.toFixed(2),
          row.due.toFixed(2),
          row.vat.toFixed(2),
          row.paid_count,
          row.partial_count,
          row.unpaid_count,
        ]),
      ];
      filename = "cashier-sales-report.csv";
    }

    if (reportType === "BRANCH_SALES") {
      rows = [
        ["Branch", "Invoices", "VAT", "Sales", "Collections", "Outstanding"],
        ...branchSales.map((row) => [
          row.branch_name,
          row.invoice_count,
          row.vat.toFixed(2),
          row.total.toFixed(2),
          row.collected.toFixed(2),
          row.outstanding.toFixed(2),
        ]),
      ];
      filename = "branch-sales-report.csv";
    }

    if (reportType === "ITEM_SALES") {
      rows = [
        ["SKU", "Item", "Sold Qty", "Returned Qty", "Net Qty", "Gross Sales", "Returns / Credit", "Net Sales", "VAT"],
        ...itemSales.map((row) => [
          row.sku,
          row.name,
          row.sold_quantity,
          row.returned_quantity,
          row.net_quantity,
          row.gross_sales.toFixed(2),
          row.returns.toFixed(2),
          row.net_sales.toFixed(2),
          row.vat.toFixed(2),
        ]),
      ];
      filename = "item-sales-report.csv";
    }

    if (reportType === "CUSTOMER_SALES") {
      rows = [
        ["Customer", "Invoices", "Sales", "Paid To Date", "Outstanding"],
        ...customerSales.map((row) => [
          row.customer,
          row.invoices,
          row.total.toFixed(2),
          row.paid.toFixed(2),
          row.outstanding.toFixed(2),
        ]),
      ];
      filename = "customer-sales-report.csv";
    }

    if (reportType === "STOCK" || reportType === "LOW_STOCK") {
      const source = reportType === "LOW_STOCK" ? lowStockRows : stockRows;
      rows = [
        ["Branch", "SKU", "Item", "Category", "Unit", "Quantity", "Reorder Level"],
        ...source.map((row) => [
          row.branch_name,
          row.sku,
          row.name,
          row.category,
          row.unit,
          row.quantity,
          row.reorder_level,
        ]),
      ];
      filename = reportType === "LOW_STOCK"
        ? "low-stock-report.csv"
        : "stock-report.csv";
    }

    if (reportType === "MOVEMENTS") {
      rows = [
        [
          "Date",
          "Branch",
          "SKU",
          "Item",
          "Movement",
          "Quantity",
          "Reference",
          "Remarks",
        ],
        ...movementRows.map((row) => [
          new Date(row.created_at).toLocaleString("en-LK"),
          row.branch_name,
          row.sku,
          row.item_name,
          row.movement_type,
          row.quantity,
          row.reference_type || "-",
          row.remarks || "-",
        ]),
      ];
      filename = "stock-movement-report.csv";
    }

    if (reportType === "COLLECTIONS") {
      rows = [
        ["Date", "Branch", "Invoice ID", "Method", "Amount", "Reference", "Notes"],
        ...payments.map((row) => [
          new Date(row.payment_date).toLocaleString("en-LK"),
          branchMap[row.branch_id]?.branch_name || "-",
          row.invoice_id,
          row.payment_method,
          Number(row.amount || 0).toFixed(2),
          row.reference_number || "-",
          row.notes || "-",
        ]),
      ];
      filename = "collections-report.csv";
    }

    const content = rows
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h1>Reports</h1>
          <p>Sales, collections, outstanding balances and inventory reporting.</p>
        </div>

        <div className="reports-actions">
          <button className="report-secondary-btn" onClick={loadReportData}>
            <RefreshCw size={17} />
            Refresh
          </button>
          <button className="report-secondary-btn" onClick={exportCsv}>
            <Download size={17} />
            Export CSV
          </button>
          <button className="report-primary-btn" onClick={() => window.print()}>
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      <div className="report-filters">
        <div className="report-field">
          <label>Report</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
            <option value="SALES">Sales Report</option>
            <option value="COLLECTIONS">Collections Report</option>
            <option value="BRANCH_SALES">Branch Sales Report</option>
            <option value="CASHIER_SALES">Cashier Sales Report</option>
            <option value="ITEM_SALES">Item Sales Report</option>
            <option value="CUSTOMER_SALES">Customer Sales Report</option>
            <option value="STOCK">Stock Report</option>
            <option value="LOW_STOCK">Low Stock Report</option>
            <option value="MOVEMENTS">Stock Movement Ledger</option>
          </select>
        </div>

        <div className="report-field">
          <label>Branch</label>
          <select
            value={branchId}
            onChange={(e) => {
              const nextBranchId = e.target.value;

              if (!nextBranchId || nextBranchId === branchId) {
                return;
              }

              requestBranchSwitch?.(nextBranchId);
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code} - {branch.branch_name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label>Cashier</label>
          <select
            value={cashierId}
            onChange={(e) => setCashierId(e.target.value)}
          >
            <option value="">All Cashiers</option>
            {cashiers
              .filter((cashier) => !branchId || cashier.branch_id === branchId)
              .map((cashier) => (
                <option key={cashier.id} value={cashier.id}>
                  {cashier.name || cashier.email || cashier.cashier_code || "Unnamed Cashier"}
                </option>
              ))}
          </select>
        </div>

        <div className="report-field">
          <label>From</label>
          <div className="report-date">
            <CalendarDays size={16} />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
        </div>

        <div className="report-field">
          <label>To</label>
          <div className="report-date">
            <CalendarDays size={16} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {(reportType === "STOCK" ||
          reportType === "LOW_STOCK" ||
          reportType === "MOVEMENTS") && (
          <div className="report-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          </div>
        )}
      </div>

      <div className="report-summary-grid">
        <SummaryCard
          label={reportType === "CASHIER_SALES" ? "Net Sales" : "Sales Value"}
          value={money(reportType === "CASHIER_SALES" ? cashierReportSummary.net : salesSummary.total)}
          icon={<TrendingUp size={22} />}
        />
        <SummaryCard
          label={reportType === "CASHIER_SALES" ? "Paid To Date" : "Collected"}
          value={money(reportType === "CASHIER_SALES" ? cashierReportSummary.paid : salesSummary.collected)}
          icon={<CircleDollarSign size={22} />}
        />
        <SummaryCard
          label="Outstanding"
          value={money(reportType === "CASHIER_SALES" ? cashierReportSummary.due : salesSummary.outstanding)}
          icon={<WalletCards size={22} />}
        />
        <SummaryCard
          label="Invoices"
          value={reportType === "CASHIER_SALES" ? cashierReportSummary.invoices : salesSummary.count}
          icon={<BarChart3 size={22} />}
        />
      </div>

      <div className="report-status-grid">
        {reportType === "CASHIER_SALES" ? (
          <>
            <div><span>Gross Sales</span><strong>{money(cashierReportSummary.gross)}</strong></div>
            <div><span>Returns / Credit</span><strong>{money(cashierReportSummary.returns)}</strong></div>
            <div><span>VAT Amount</span><strong>{money(cashierReportSummary.vat)}</strong></div>
            <div><span>Paid</span><strong>{cashierReportSummary.paidCount}</strong></div>
            <div><span>Partial</span><strong>{cashierReportSummary.partialCount}</strong></div>
            <div><span>Unpaid</span><strong>{cashierReportSummary.unpaidCount}</strong></div>
          </>
        ) : (
          <>
            <div><span>VAT Sales</span><strong>{money(salesSummary.vatSales)}</strong></div>
            <div><span>Non-VAT Sales</span><strong>{money(salesSummary.nonVatSales)}</strong></div>
            <div><span>VAT Amount</span><strong>{money(salesSummary.vatAmount)}</strong></div>
            <div><span>Paid</span><strong>{salesSummary.paidCount}</strong></div>
            <div><span>Partial</span><strong>{salesSummary.partialCount}</strong></div>
            <div><span>Unpaid</span><strong>{salesSummary.unpaidCount}</strong></div>
          </>
        )}
      </div>

      {loading && <div className="report-loading">Loading report...</div>}

      {!loading && reportType === "SALES" && (
        <>
          <div className="report-card">
            <div className="report-card-header">
              <div>
                <h2>Sales Report</h2>
                <span>
                  Cancelled invoices are excluded. Returns / credit notes are deducted from sales.
                </span>
              </div>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Branch</th>
                    <th>Cashier</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="number">Gross Total</th>
                    <th className="number">Returned</th>
                    <th className="number">Net Sales</th>
                    <th className="number">Paid</th>
                    <th className="number">Due</th>
                    <th className="number">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {validInvoices.length === 0 && <EmptyRow colSpan="12" />}

                  {validInvoices.map((row) => {
                    const returned = Number(returnAmountByInvoice[row.id] || 0);
                    const net = Math.max(0, Number(row.total || 0) - returned);
                    const status =
                      row.payment_status ||
                      (Number(row.due_amount || 0) <= 0
                        ? "PAID"
                        : Number(row.paid_amount || 0) > 0
                        ? "PARTIAL"
                        : "UNPAID");

                    return (
                      <tr key={row.id}>
                        <td><strong>{row.invoice_number}</strong></td>
                        <td>{new Date(row.invoice_date).toLocaleString("en-LK")}</td>
                        <td>{branchMap[row.branch_id]?.branch_name || "-"}</td>
                        <td>
                          {row.cashier_name ||
                            cashierMap[row.cashier_id || row.cashier_user_id] ||
                            "-"}
                        </td>
                        <td>{row.customer_name || "Walk-in Customer"}</td>
                        <td>
                          <span className={`report-payment-badge ${String(status).toLowerCase()}`}>
                            {status}
                          </span>
                        </td>
                        <td className="number">{money(row.total)}</td>
                        <td className="number">
                          <strong>{money(returned)}</strong>
                        </td>
                        <td className="number">
                          <strong>{money(net)}</strong>
                        </td>
                        <td className="number">
                          {money(Math.min(Number(row.paid_amount || 0), net))}
                        </td>
                        <td className="number">
                          {money(Math.min(Number(row.due_amount || 0), net))}
                        </td>
                        <td className="number">{money(row.vat_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="report-payment-grid">
            <PaymentCard label="Gross Invoice Sales" value={salesSummary.grossTotal} />
            <PaymentCard label="Returns / Credit Notes" value={salesSummary.returnedTotal} />
            <PaymentCard label="Net Sales" value={salesSummary.total} />
          </div>
        </>
      )}

      {!loading && reportType === "COLLECTIONS" && (
        <SimpleReport
          title="Collections Report"
          headers={["Date", "Branch", "Method", "Amount", "Reference", "Notes"]}
          rows={payments.map((row) => [
            new Date(row.payment_date).toLocaleString("en-LK"),
            branchMap[row.branch_id]?.branch_name || "-",
            row.payment_method,
            money(row.amount),
            row.reference_number || "-",
            row.notes || "-",
          ])}
        />
      )}

      {!loading && reportType === "BRANCH_SALES" && (
        <SimpleReport
          title="Branch Sales Report"
          headers={["Branch", "Invoices", "Gross Sales", "Returns / Credit", "Net Sales", "VAT", "Collected", "Outstanding"]}
          rows={branchSales.map((row) => [
            row.branch_name,
            row.invoice_count,
            money(row.gross_sales),
            money(row.returns),
            money(row.net_sales),
            money(row.vat),
            money(row.collected),
            money(row.outstanding),
          ])}
        />
      )}

      {!loading && reportType === "CASHIER_SALES" && (
        <>
          <SimpleReport
            title="Cashier Sales Summary"
            headers={[
              "Cashier",
              "Invoices",
              "Gross Sales",
              "Returns",
              "Net Sales",
              "Paid",
              "Outstanding",
              "VAT",
            ]}
            rows={cashierSales.map((row) => [
              row.cashier_name,
              row.invoices,
              money(row.gross_sales),
              money(row.returns),
              money(row.net_sales),
              money(row.paid),
              money(row.due),
              money(row.vat),
            ])}
          />

          <div className="report-card">
            <div className="report-card-header">
              <div>
                <h2>Cashier Invoice Details</h2>
                <span>{validInvoices.length} invoices for the selected filters</span>
              </div>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Cashier</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="number">Gross</th>
                    <th className="number">Returned</th>
                    <th className="number">Net Sales</th>
                    <th className="number">Paid</th>
                    <th className="number">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {validInvoices.length === 0 && <EmptyRow colSpan="10" />}
                  {validInvoices.map((row) => {
                    const returned = Number(returnAmountByInvoice[row.id] || 0);
                    const net = Math.max(0, Number(row.total || 0) - returned);
                    const status =
                      row.payment_status ||
                      (Number(row.due_amount || 0) <= 0
                        ? "PAID"
                        : Number(row.paid_amount || 0) > 0
                        ? "PARTIAL"
                        : "UNPAID");

                    return (
                      <tr key={row.id}>
                        <td><strong>{row.invoice_number}</strong></td>
                        <td>{new Date(row.invoice_date).toLocaleString("en-LK")}</td>
                        <td>{row.cashier_name || cashierMap[row.cashier_id || row.cashier_user_id] || "-"}</td>
                        <td>{row.customer_name || "Walk-in Customer"}</td>
                        <td>
                          <span className={`report-payment-badge ${String(status).toLowerCase()}`}>
                            {status}
                          </span>
                        </td>
                        <td className="number">{money(row.total)}</td>
                        <td className="number">{money(returned)}</td>
                        <td className="number"><strong>{money(net)}</strong></td>
                        <td className="number">{money(Math.min(Number(row.paid_amount || 0), net))}</td>
                        <td className="number">{money(Math.min(Number(row.due_amount || 0), net))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && reportType === "ITEM_SALES" && (
        <SimpleReport
          title="Item Sales Report"
          headers={[
            "SKU",
            "Item",
            "Sold Qty",
            "Returned Qty",
            "Net Qty",
            "Gross Sales",
            "Returns / Credit",
            "Net Sales",
            "VAT",
          ]}
          rows={itemSales.map((row) => [
            row.sku,
            row.name,
            row.sold_quantity,
            row.returned_quantity,
            row.net_quantity,
            money(row.gross_sales),
            money(row.returns),
            money(row.net_sales),
            money(row.vat),
          ])}
        />
      )}

      {!loading && reportType === "CUSTOMER_SALES" && (
        <SimpleReport
          title="Customer Sales Report"
          headers={["Customer", "Invoices", "Sales", "Paid To Date", "Outstanding"]}
          rows={customerSales.map((row) => [
            row.customer,
            row.invoices,
            money(row.total),
            money(row.paid),
            money(row.outstanding),
          ])}
        />
      )}

      {!loading && (reportType === "STOCK" || reportType === "LOW_STOCK") && (
        <SimpleReport
          title={reportType === "STOCK" ? "Stock Report" : "Low Stock Report"}
          headers={["Branch", "SKU", "Item", "Category", "Unit", "Stock", "Reorder Level", "Status"]}
          rows={(reportType === "STOCK" ? stockRows : lowStockRows).map((row) => [
            row.branch_name,
            row.sku,
            row.name,
            row.category,
            row.unit,
            row.quantity,
            row.reorder_level,
            row.quantity <= 0
              ? "OUT OF STOCK"
              : row.reorder_level > 0 && row.quantity <= row.reorder_level
              ? "LOW STOCK"
              : "IN STOCK",
          ])}
        />
      )}

      {!loading && reportType === "MOVEMENTS" && (
        <SimpleReport
          title="Stock Movement Ledger"
          headers={["Date", "Branch", "SKU", "Item", "Movement", "Quantity", "Reference", "Remarks"]}
          rows={movementRows.map((row) => [
            new Date(row.created_at).toLocaleString("en-LK"),
            row.branch_name,
            row.sku,
            row.item_name,
            row.movement_type,
            row.quantity,
            row.reference_type || "-",
            row.remarks || "-",
          ])}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }) {
  return (
    <div className="report-summary-card">
      <div className="report-summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function PaymentCard({ label, value }) {
  return (
    <div className="report-payment-card">
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

function SimpleReport({ title, headers, rows }) {
  return (
    <div className="report-card">
      <div className="report-card-header">
        <div>
          <h2>{title}</h2>
          <span>{rows.length} records</span>
        </div>
      </div>

      <div className="report-table-wrap">
        <table className="report-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={headers.length} />}
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="report-empty">
        No records found for the selected filters.
      </td>
    </tr>
  );
}
