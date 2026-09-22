import { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { supabase } from "./supabase";

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "—";

export default function Subscription({ subscription, onActivated }) {
  const [plan, setPlan] = useState("MONTHLY");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadPayments() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase.rpc("get_my_subscription_payments");
    if (error) setError(error.message);
    else setPayments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function submitPayment(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const { data, error } = await supabase.rpc("submit_subscription_payment", {
      p_plan: plan,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference.trim(),
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setMessage(
      data?.message ||
        "Payment submitted successfully and is waiting for approval."
    );
    setPaymentReference("");
    await loadPayments();
    setSaving(false);
  }

  const pending = payments.find((item) => item.status === "PENDING");

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 6 }}>Subscription & Billing</h1>
        <p style={{ color: "#667085", marginTop: 0 }}>
          {subscription?.company_name || "Your business"}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#667085", fontSize: 13 }}>Current Plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>
            {subscription?.plan || "—"}
          </div>
          <div style={{ marginTop: 6 }}>{subscription?.status || "—"}</div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#667085", fontSize: 13 }}>Trial Ends</div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>
            {formatDate(subscription?.trial_ends_at)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#667085", fontSize: 13 }}>
            Paid Subscription Ends
          </div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>
            {formatDate(subscription?.subscription_ends_at)}
          </div>
        </div>
      </div>

      {pending && (
        <div
          style={{
            ...cardStyle,
            border: "1px solid #fedf89",
            background: "#fffaeb",
            marginBottom: 24,
          }}
        >
          <Clock3 size={24} />
          <h3 style={{ marginBottom: 6 }}>Payment awaiting approval</h3>
          <div>
            {pending.plan} · {money(pending.amount)}
          </div>
          <div style={{ color: "#667085", marginTop: 5 }}>
            Reference: {pending.payment_reference}
          </div>
          <div style={{ color: "#667085", marginTop: 5 }}>
            Submitted: {formatDate(pending.submitted_at)}
          </div>
        </div>
      )}

      <form onSubmit={submitPayment} style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Submit Payment</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => setPlan("MONTHLY")}
            style={plan === "MONTHLY" ? selectedPlanStyle : planStyle}
          >
            <CreditCard size={24} />
            <strong>Monthly</strong>
            <span style={{ fontSize: 25, fontWeight: 800 }}>Rs. 6,000</span>
            <span>1 month access</span>
          </button>

          <button
            type="button"
            onClick={() => setPlan("ANNUAL")}
            style={plan === "ANNUAL" ? selectedPlanStyle : planStyle}
          >
            <CreditCard size={24} />
            <strong>Annual</strong>
            <span style={{ fontSize: 25, fontWeight: 800 }}>Rs. 64,800</span>
            <span>1 year access</span>
          </button>
        </div>

        <label style={labelStyle}>Payment Method</label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          style={inputStyle}
          disabled={!!pending}
        >
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="CASH_DEPOSIT">Cash Deposit</option>
          <option value="OTHER">Other</option>
        </select>

        <label style={labelStyle}>Payment Reference / Transaction ID</label>
        <input
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          placeholder="Enter bank reference or transaction ID"
          style={inputStyle}
          required
          disabled={!!pending}
        />

        {message && (
          <div style={{ marginTop: 14, color: "#067647" }}>{message}</div>
        )}
        {error && <div style={{ marginTop: 14, color: "#b42318" }}>{error}</div>}

        <button
          type="submit"
          disabled={saving || !!pending}
          style={{
            marginTop: 18,
            border: 0,
            borderRadius: 10,
            padding: "12px 18px",
            background: saving || pending ? "#98a2b3" : "#111827",
            color: "#fff",
            fontWeight: 800,
            cursor: saving || pending ? "not-allowed" : "pointer",
          }}
        >
          {pending
            ? "Waiting for Approval"
            : saving
            ? "Submitting..."
            : `Submit ${plan === "MONTHLY" ? "Rs. 6,000" : "Rs. 64,800"} Payment`}
        </button>
      </form>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Payment History</h2>
        {loading ? (
          <p>Loading payments...</p>
        ) : payments.length === 0 ? (
          <p style={{ color: "#667085" }}>No subscription payments yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Plan", "Amount", "Reference", "Status", "Submitted", "Valid Until"].map(
                    (heading) => (
                      <th key={heading} style={thStyle}>
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {payments.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>{item.plan}</td>
                    <td style={tdStyle}>{money(item.amount)}</td>
                    <td style={tdStyle}>{item.payment_reference}</td>
                    <td style={tdStyle}>
                      {item.status === "APPROVED" && <CheckCircle2 size={16} />}
                      {item.status === "PENDING" && <Clock3 size={16} />}
                      {item.status === "REJECTED" && <XCircle size={16} />}
                      <span style={{ marginLeft: 6 }}>{item.status}</span>
                    </td>
                    <td style={tdStyle}>{formatDate(item.submitted_at)}</td>
                    <td style={tdStyle}>{formatDate(item.subscription_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={async () => {
            await loadPayments();
            if (onActivated) onActivated();
          }}
          style={{
            marginTop: 16,
            padding: "9px 14px",
            borderRadius: 9,
            border: "1px solid #d0d5dd",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Refresh Status
        </button>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 5px 18px rgba(16,24,40,0.04)",
};

const planStyle = {
  ...cardStyle,
  display: "flex",
  flexDirection: "column",
  gap: 7,
  textAlign: "left",
  cursor: "pointer",
};

const selectedPlanStyle = {
  ...planStyle,
  border: "2px solid #111827",
};

const labelStyle = {
  display: "block",
  marginTop: 14,
  marginBottom: 6,
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #d0d5dd",
  borderRadius: 9,
  fontSize: 14,
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #eaecf0",
  color: "#475467",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "11px 10px",
  borderBottom: "1px solid #f2f4f7",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
};
