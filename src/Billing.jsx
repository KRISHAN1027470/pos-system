import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  DollarSign,
  FileText,
  Search,
  WalletCards,
  X,
  RefreshCw,
  History,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Billing.css";

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Billing({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setSearch("");
    setStatusFilter("ALL");
    setSelectedInvoice(null);
    setShowPayment(false);
    setShowHistory(false);
  }, [activeBranchId, activeBranch?.id]);

  async function loadData() {
    setLoading(true);

    const currentBranchId = activeBranchId || activeBranch?.id || branchId;

    if (!currentBranchId) {
      setInvoices([]);
      setPayments([]);
      setBranches(appBranches || []);
      setLoading(false);
      return;
    }

    const [invoiceResult, paymentResult, branchResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("branch_id", currentBranchId)
        .neq("status", "CANCELLED")
        .order("invoice_date", { ascending: false }),
      supabase
        .from("invoice_payments")
        .select("*")
        .eq("branch_id", currentBranchId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("branches")
        .select("id, branch_code, branch_name")
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

    if (branchResult.error) {
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      setBranches(appBranches?.length ? appBranches : branchResult.data || []);
      setBranchId(currentBranchId);
    }

    setLoading(false);
  }

  const branchMap = useMemo(() => {
    const map = {};
    branches.forEach((branch) => {
      map[branch.id] = branch;
    });
    return map;
  }, [branches]);

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const paid = Number(invoice.paid_amount ?? invoice.total ?? 0);
      const due = Number(invoice.due_amount ?? 0);
      const status =
        invoice.payment_status ||
        (due <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID");

      if (branchId && invoice.branch_id !== branchId) return false;
      if (statusFilter !== "ALL" && status !== statusFilter) return false;

      if (!term) return true;

      return [
        invoice.invoice_number,
        invoice.customer_name,
        invoice.customer_vat_number,
        invoice.payment_method,
        branchMap[invoice.branch_id]?.branch_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [invoices, search, branchId, statusFilter, branchMap]);

  const summary = useMemo(() => {
    let invoiced = 0;
    let paid = 0;
    let due = 0;
    let outstandingCount = 0;

    filteredInvoices.forEach((invoice) => {
      const total = Number(invoice.total || 0);
      const paidAmount = Number(invoice.paid_amount ?? total);
      const dueAmount = Number(invoice.due_amount ?? Math.max(total - paidAmount, 0));

      invoiced += total;
      paid += paidAmount;
      due += dueAmount;

      if (dueAmount > 0) outstandingCount += 1;
    });

    return { invoiced, paid, due, outstandingCount };
  }, [filteredInvoices]);

  function openPayment(invoice) {
    const currentBranchId = activeBranchId || activeBranch?.id || branchId;
    if (!currentBranchId || invoice.branch_id !== currentBranchId) {
      alert("Switch to this invoice's branch and unlock it before receiving payment.");
      if (invoice.branch_id) requestBranchSwitch?.(invoice.branch_id);
      return;
    }

    const due = Number(invoice.due_amount || 0);
    setSelectedInvoice(invoice);
    setPaymentAmount(due > 0 ? due.toFixed(2) : "");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setNotes("");
    setShowPayment(true);
  }

  async function savePayment(e) {
    e.preventDefault();

    if (!selectedInvoice) return;

    const currentBranchId = activeBranchId || activeBranch?.id || branchId;
    if (!currentBranchId || selectedInvoice.branch_id !== currentBranchId) {
      alert("The selected invoice does not belong to the currently unlocked branch.");
      setShowPayment(false);
      setSelectedInvoice(null);
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("record_invoice_payment", {
      p_invoice_id: selectedInvoice.id,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber.trim() || null,
      p_notes: notes.trim() || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setShowPayment(false);
    setSelectedInvoice(null);
    await loadData();
  }

  const selectedInvoicePayments = useMemo(() => {
    if (!selectedInvoice) return [];
    return payments.filter((payment) => payment.invoice_id === selectedInvoice.id);
  }, [payments, selectedInvoice]);

  return (
    <div className="billing-page">
      <div className="billing-header">
        <div>
          <h1>Billing</h1>
          <p>Track invoice payments, balances and settlement history.</p>
        </div>

        <button className="billing-secondary-btn" onClick={loadData}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="billing-stats">
        <BillingStat
          icon={<FileText size={22} />}
          label="Total Invoiced"
          value={money(summary.invoiced)}
        />

        <BillingStat
          icon={<DollarSign size={22} />}
          label="Total Paid"
          value={money(summary.paid)}
        />

        <BillingStat
          icon={<WalletCards size={22} />}
          label="Outstanding"
          value={money(summary.due)}
        />

        <BillingStat
          icon={<CreditCard size={22} />}
          label="Outstanding Invoices"
          value={summary.outstandingCount}
        />
      </div>

      <div className="billing-toolbar">
        <div className="billing-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer or branch..."
          />
        </div>

        <select
          value={branchId}
          onChange={(e) => {
            const nextBranchId = e.target.value;

            if (!nextBranchId || nextBranchId === branchId) return;

            if (showPayment || showHistory) {
              const confirmed = window.confirm(
                "Switching branch will close the current billing window after the destination branch password is accepted. Continue?"
              );
              if (!confirmed) return;
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

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Payment Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
      </div>

      <div className="billing-card">
        <div className="billing-card-header">
          <div>
            <h2>Invoice Billing</h2>
            <span>{filteredInvoices.length} invoices</span>
          </div>
        </div>

        <div className="billing-table-wrap">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Branch</th>
                <th>Customer</th>
                <th className="number">Total</th>
                <th className="number">Paid</th>
                <th className="number">Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="9" className="billing-empty">
                    No billing records found.
                  </td>
                </tr>
              )}

              {filteredInvoices.map((invoice) => {
                const total = Number(invoice.total || 0);
                const paid = Number(invoice.paid_amount ?? total);
                const due = Number(invoice.due_amount ?? Math.max(total - paid, 0));
                const status =
                  invoice.payment_status ||
                  (due <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID");

                return (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number}</strong></td>
                    <td>{new Date(invoice.invoice_date).toLocaleString("en-LK")}</td>
                    <td>{branchMap[invoice.branch_id]?.branch_name || "-"}</td>
                    <td>{invoice.customer_name || "Walk-in Customer"}</td>
                    <td className="number">{money(total)}</td>
                    <td className="number">{money(paid)}</td>
                    <td className="number"><strong>{money(due)}</strong></td>
                    <td>
                      <span className={`billing-badge ${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                    <td>
                      <div className="billing-row-actions">
                        {due > 0 && (
                          <button
                            className="billing-primary-btn"
                            onClick={() => openPayment(invoice)}
                          >
                            <CreditCard size={15} />
                            Receive
                          </button>
                        )}

                        <button
                          className="billing-secondary-btn"
                          onClick={() => {
                            const currentBranchId =
                              activeBranchId || activeBranch?.id || branchId;

                            if (!currentBranchId || invoice.branch_id !== currentBranchId) {
                              alert("Switch to this invoice's branch and unlock it before viewing payment history.");
                              if (invoice.branch_id) requestBranchSwitch?.(invoice.branch_id);
                              return;
                            }

                            setSelectedInvoice(invoice);
                            setShowHistory(true);
                          }}
                        >
                          <History size={15} />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showPayment && selectedInvoice && (
        <div className="billing-modal-backdrop" onMouseDown={() => !saving && setShowPayment(false)}>
          <div className="billing-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <div>
                <h2>Receive Payment</h2>
                <p>{selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => !saving && setShowPayment(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={savePayment}>
              <div className="billing-balance-box">
                <span>Outstanding Balance</span>
                <strong>{money(selectedInvoice.due_amount)}</strong>
              </div>

              <div className="billing-field">
                <label>Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedInvoice.due_amount || 0)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>

              <div className="billing-field">
                <label>Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>

              <div className="billing-field">
                <label>Reference Number</label>
                <input
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional bank/card reference"
                />
              </div>

              <div className="billing-field">
                <label>Notes</label>
                <textarea
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                />
              </div>

              <div className="billing-modal-actions">
                <button
                  type="button"
                  className="billing-secondary-btn"
                  onClick={() => !saving && setShowPayment(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="billing-primary-btn"
                  disabled={saving}
                >
                  <CreditCard size={17} />
                  {saving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistory && selectedInvoice && (
        <div className="billing-modal-backdrop" onMouseDown={() => setShowHistory(false)}>
          <div className="billing-modal billing-history-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <div>
                <h2>Payment History</h2>
                <p>{selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => setShowHistory(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="billing-history-body">
              {selectedInvoicePayments.length === 0 ? (
                <div className="billing-empty-block">
                  No additional payment records for this invoice.
                </div>
              ) : (
                <div className="billing-table-wrap">
                  <table className="billing-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Notes</th>
                        <th>Status</th>
                        <th className="number">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoicePayments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{new Date(payment.payment_date).toLocaleString("en-LK")}</td>
                          <td>{payment.payment_method}</td>
                          <td>{payment.reference_number || "-"}</td>
                          <td>{payment.notes || "-"}</td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 8px",
                                borderRadius: "999px",
                                fontSize: "11px",
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
                          <td className="number">
                            <strong
                              style={{
                                textDecoration:
                                  payment.status === "VOIDED"
                                    ? "line-through"
                                    : "none",
                                opacity:
                                  payment.status === "VOIDED" ? 0.6 : 1,
                              }}
                            >
                              {money(payment.amount)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BillingStat({ icon, label, value }) {
  return (
    <div className="billing-stat-card">
      <div className="billing-stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
