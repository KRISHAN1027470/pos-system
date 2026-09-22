import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  ReceiptText,
  FileText,
  Users,
  TrendingUp,
  CreditCard,
  Banknote,
  Building2,
  RefreshCw,
  WalletCards,
  CircleDollarSign,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Dashboard.css";

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function Dashboard({ activeBranch, branchId, branches: appBranches = [], requestBranchSwitch }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [invoiceReturns, setInvoiceReturns] = useState([]);
  const selectedBranchId = branchId || activeBranch?.id || "";
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const start = todayStartISO();

    const [
      invoiceResult,
      paymentResult,
      customerResult,
      branchResult,
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .gte("invoice_date", start)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("invoice_payments")
        .select("*")
        .eq("status", "ACTIVE")
        .gte("payment_date", start)
        .order("payment_date", { ascending: false }),
      supabase.from("customers").select("id"),
      supabase
        .from("branches")
        .select("id, branch_code, branch_name, status")
        .order("branch_name"),
    ]);

    if (invoiceResult.error) {
      alert(invoiceResult.error.message);
      setInvoices([]);
    } else {
      setInvoices(invoiceResult.data || []);
    }

    if (paymentResult.error) {
      alert(paymentResult.error.message);
      setPayments([]);
    } else {
      setPayments(paymentResult.data || []);
    }

    if (customerResult.error) {
      alert(customerResult.error.message);
      setCustomers([]);
    } else {
      setCustomers(customerResult.data || []);
    }

    if (branchResult.error) {
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      setBranches(
        appBranches?.length ? appBranches : branchResult.data || []
      );
    }

    const todayInvoiceIds = (invoiceResult.data || []).map((invoice) => invoice.id);
    if (todayInvoiceIds.length) {
      const { data: returnData, error: returnError } = await supabase
        .from("invoice_returns")
        .select("id, invoice_id, return_number, return_amount, processed_at")
        .in("invoice_id", todayInvoiceIds);
      if (returnError) {
        console.error("Load dashboard returns error:", returnError);
        setInvoiceReturns([]);
      } else {
        setInvoiceReturns(returnData || []);
      }
    } else {
      setInvoiceReturns([]);
    }

    setLoading(false);
  }

  const branchInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.branch_id === selectedBranchId),
    [invoices, selectedBranchId]
  );

  const branchPayments = useMemo(
    () => payments.filter((payment) => payment.branch_id === selectedBranchId),
    [payments, selectedBranchId]
  );

  const completedInvoices = useMemo(
    () => branchInvoices.filter((invoice) => invoice.status !== "CANCELLED"),
    [branchInvoices]
  );

  const returnAmountByInvoice = useMemo(() => {
    const map = {};
    invoiceReturns.forEach((row) => {
      map[row.invoice_id] = Number(map[row.invoice_id] || 0) + Number(row.return_amount || 0);
    });
    return map;
  }, [invoiceReturns]);

  const summary = useMemo(() => {
    let totalSales = 0, grossSales = 0, returnedSales = 0;
    let vatSales = 0, nonVatSales = 0, outstanding = 0, vatAmount = 0;
    let paidCount = 0, partialCount = 0, unpaidCount = 0;

    completedInvoices.forEach((invoice) => {
      const gross = Number(invoice.total || 0);
      const returned = Number(returnAmountByInvoice[invoice.id] || 0);
      const net = Math.max(0, gross - returned);
      grossSales += gross;
      returnedSales += returned;
      totalSales += net;
      outstanding += Math.min(Number(invoice.due_amount || 0), net);
      vatAmount += Number(invoice.vat_amount || 0);
      if (invoice.invoice_type === "VAT") vatSales += net;
      if (invoice.invoice_type === "NON_VAT") nonVatSales += net;
      if (invoice.payment_status === "PAID") paidCount += 1;
      if (invoice.payment_status === "PARTIAL") partialCount += 1;
      if (invoice.payment_status === "UNPAID") unpaidCount += 1;
    });

    let rawCollected = 0, rawCash = 0, rawCard = 0, rawBank = 0;
    branchPayments.forEach((payment) => {
      const amount = Number(payment.amount || 0);
      rawCollected += amount;
      if (payment.payment_method === "CASH") rawCash += amount;
      if (payment.payment_method === "CARD") rawCard += amount;
      if (payment.payment_method === "BANK") rawBank += amount;
    });

    // Until refunds are stored as payment transactions, cap collections at net sales + due.
    const collected = Math.min(rawCollected, totalSales + outstanding);
    const ratio = rawCollected > 0 ? collected / rawCollected : 0;

    return {
      totalSales, grossSales, returnedSales, vatSales, nonVatSales,
      outstanding, vatAmount, collected,
      cash: rawCash * ratio, card: rawCard * ratio, bank: rawBank * ratio,
      paidCount, partialCount, unpaidCount, count: completedInvoices.length,
    };
  }, [completedInvoices, branchPayments, returnAmountByInvoice]);

  const branchSales = useMemo(() => {
    const map = {};
    completedInvoices.forEach((invoice) => {
      const branch = branches.find((b) => b.id === invoice.branch_id);
      const id = invoice.branch_id || "UNASSIGNED";
      const name = branch?.branch_name || "Unknown Branch";
      if (!map[id]) map[id] = { name, sales: 0, returns: 0, outstanding: 0, collected: 0 };
      const gross = Number(invoice.total || 0);
      const returned = Number(returnAmountByInvoice[invoice.id] || 0);
      const net = Math.max(0, gross - returned);
      map[id].sales += net;
      map[id].returns += returned;
      map[id].outstanding += Math.min(Number(invoice.due_amount || 0), net);
    });

    branchPayments.forEach((payment) => {
      const branch = branches.find((b) => b.id === payment.branch_id);
      const id = payment.branch_id || "UNASSIGNED";
      const name = branch?.branch_name || "Unknown Branch";
      if (!map[id]) map[id] = { name, sales: 0, returns: 0, outstanding: 0, collected: 0 };
      map[id].collected += Number(payment.amount || 0);
    });

    return Object.values(map)
      .map((row) => ({ ...row, collected: Math.min(row.collected, row.sales + row.outstanding) }))
      .sort((a, b) => b.sales - a.sales);
  }, [completedInvoices, branchPayments, branches, returnAmountByInvoice]);

  return (
    <div className="dashboard-live">
      <div className="dashboard-live-header">
        <div>
          <h2>Welcome back 👋</h2>
          <p>
            {`Here is today's live POS business overview for ${
              activeBranch?.branch_name ||
              branches.find((branch) => branch.id === selectedBranchId)?.branch_name ||
              "selected branch"
            }.`}
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              const nextBranchId = e.target.value;
              if (nextBranchId && nextBranchId !== selectedBranchId) {
                requestBranchSwitch?.(nextBranchId);
              }
            }}
            aria-label="Select dashboard branch"
            style={{
              minWidth: "220px",
              height: "48px",
              padding: "0 14px",
              border: "1px solid #dbe3ef",
              borderRadius: "12px",
              background: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              color: "#13213a",
              cursor: "pointer",
            }}
          >
            {branches
              .filter((branch) => branch.status === "ACTIVE")
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.branch_code} - {branch.branch_name}
                </option>
              ))}
          </select>

          <button className="dashboard-refresh-btn" onClick={loadDashboard}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>

      <div className="dashboard-live-stats">
        <DashboardStat
          title="Today's Sales"
          value={money(summary.totalSales)}
          icon={<ShoppingCart size={22} />}
        />

        <DashboardStat
          title="Collected Today"
          value={money(summary.collected)}
          icon={<CircleDollarSign size={22} />}
        />

        <DashboardStat
          title="Outstanding"
          value={money(summary.outstanding)}
          icon={<WalletCards size={22} />}
        />

        <DashboardStat
          title="VAT Sales"
          value={money(summary.vatSales)}
          icon={<ReceiptText size={22} />}
        />

        <DashboardStat
          title="Non-VAT Sales"
          value={money(summary.nonVatSales)}
          icon={<FileText size={22} />}
        />

        <DashboardStat
          title="Today's Invoices"
          value={summary.count}
          icon={<TrendingUp size={22} />}
        />

        <DashboardStat
          title="Total Customers"
          value={customers.length}
          icon={<Users size={22} />}
        />

        <DashboardStat
          title="Active Branches"
          value={activeBranch ? 1 : 0}
          icon={<Building2 size={22} />}
        />
      </div>

      <div className="dashboard-status-strip">
        <div><span>PAID</span><strong>{summary.paidCount}</strong></div>
        <div><span>PARTIAL</span><strong>{summary.partialCount}</strong></div>
        <div><span>UNPAID</span><strong>{summary.unpaidCount}</strong></div>
        <div><span>VAT Amount</span><strong>{money(summary.vatAmount)}</strong></div>
        <div><span>Returns / Credit</span><strong>{money(summary.returnedSales)}</strong></div>
        <div>
          <span>Cancelled Today</span>
          <strong>{branchInvoices.filter((i) => i.status === "CANCELLED").length}</strong>
        </div>
      </div>

      <div className="dashboard-live-grid">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <h3>Recent Sales</h3>
              <span>Latest invoices created today</span>
            </div>
          </div>

          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th className="number">Gross</th>
                  <th className="number">Returned</th>
                  <th className="number">Net</th>
                  <th className="number">Paid</th>
                  <th className="number">Due</th>
                </tr>
              </thead>

              <tbody>
                {!loading && completedInvoices.length === 0 && (
                  <tr>
                    <td colSpan="9" className="dashboard-empty">
                      No sales recorded today.
                    </td>
                  </tr>
                )}

                {completedInvoices.slice(0, 10).map((invoice) => {
                  const returned = Number(returnAmountByInvoice[invoice.id] || 0);
                  const net = Math.max(0, Number(invoice.total || 0) - returned);
                  return (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number}</strong></td>
                    <td>{invoice.customer_name || "Walk-in Customer"}</td>
                    <td>
                      <span
                        className={`dashboard-payment-badge ${String(
                          invoice.payment_status || "PAID"
                        ).toLowerCase()}`}
                      >
                        {invoice.payment_status || "PAID"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`dashboard-type-badge ${
                          invoice.invoice_type === "VAT" ? "vat" : "nonvat"
                        }`}
                      >
                        {invoice.invoice_type}
                      </span>
                    </td>
                    <td className="number">{money(invoice.total)}</td>
                    <td className="number">{money(returned)}</td>
                    <td className="number"><strong>{money(net)}</strong></td>
                    <td className="number">{money(Math.min(Number(invoice.paid_amount || 0), net))}</td>
                    <td className="number">{money(Math.min(Number(invoice.due_amount || 0), net))}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-side">
          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3>Collections Today</h3>
                <span>Actual money received, including older invoice settlements</span>
              </div>
            </div>

            <div className="dashboard-payment-row">
              <div><Banknote size={18} /><span>Cash</span></div>
              <strong>{money(summary.cash)}</strong>
            </div>

            <div className="dashboard-payment-row">
              <div><CreditCard size={18} /><span>Card</span></div>
              <strong>{money(summary.card)}</strong>
            </div>

            <div className="dashboard-payment-row">
              <div><Building2 size={18} /><span>Bank</span></div>
              <strong>{money(summary.bank)}</strong>
            </div>

            <div className="dashboard-payment-row total">
              <div><TrendingUp size={18} /><span>Total Collected</span></div>
              <strong>{money(summary.collected)}</strong>
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <h3>Branch Performance</h3>
                <span>Today's invoice sales and collections</span>
              </div>
            </div>

            {branchSales.length === 0 ? (
              <div className="dashboard-empty-block">No branch activity today.</div>
            ) : (
              branchSales.map((branch) => (
                <div className="dashboard-branch-row dashboard-branch-detail" key={branch.name}>
                  <span>{branch.name}</span>
                  <div>
                    <strong>{money(branch.sales)}</strong>
                    <small>Returns {money(branch.returns)}</small>
                    <small>Collected {money(branch.collected)}</small>
                    <small>Due {money(branch.outstanding)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardStat({ title, value, icon }) {
  return (
    <div className="dashboard-live-stat">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
      <div className="dashboard-live-stat-icon">{icon}</div>
    </div>
  );
}
