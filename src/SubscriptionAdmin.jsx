import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "./supabase";

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "—";

export default function SubscriptionAdmin() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadPayments() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase.rpc(
      "get_subscription_payments_admin"
    );
    if (error) setError(error.message);
    else setPayments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
  }, []);

  async function approve(payment) {
    const ok = window.confirm(
      `Approve ${payment.company_name} ${payment.plan} payment of ${money(
        payment.amount
      )}?`
    );
    if (!ok) return;

    setWorkingId(payment.id);
    setError("");
    setMessage("");

    const { error } = await supabase.rpc("approve_subscription_payment", {
      p_payment_id: payment.id,
    });

    if (error) setError(error.message);
    else {
      setMessage(`${payment.company_name} subscription activated successfully.`);
      await loadPayments();
    }

    setWorkingId("");
  }

  async function reject(payment) {
    const reason = window.prompt(
      `Reason for rejecting ${payment.company_name}'s payment:`,
      ""
    );
    if (reason === null) return;

    setWorkingId(payment.id);
    setError("");
    setMessage("");

    const { error } = await supabase.rpc("reject_subscription_payment", {
      p_payment_id: payment.id,
      p_reason: reason,
    });

    if (error) setError(error.message);
    else {
      setMessage(`${payment.company_name} payment rejected.`);
      await loadPayments();
    }

    setWorkingId("");
  }

  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 14,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>Subscription Management</h1>
          <p style={{ color: "#667085", margin: 0 }}>
            Platform Admin · {pendingCount} pending payment
            {pendingCount === 1 ? "" : "s"}
          </p>
        </div>
        <button onClick={loadPayments} style={secondaryButton}>
          <RefreshCw size={17} /> Refresh
        </button>
      </div>

      {message && (
        <div style={{ ...noticeStyle, color: "#067647", background: "#ecfdf3" }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ ...noticeStyle, color: "#b42318", background: "#fef3f2" }}>
          {error}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <ShieldCheck size={24} />
          <h2>Customer Payments</h2>
        </div>

        {loading ? (
          <p>Loading payment requests...</p>
        ) : payments.length === 0 ? (
          <p style={{ color: "#667085" }}>No subscription payments yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Business",
                    "Plan",
                    "Amount",
                    "Method",
                    "Reference",
                    "Submitted",
                    "Status",
                    "Valid Until",
                    "Action",
                  ].map((heading) => (
                    <th key={heading} style={thStyle}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td style={tdStyle}>
                      <strong>{payment.company_name}</strong>
                    </td>
                    <td style={tdStyle}>{payment.plan}</td>
                    <td style={tdStyle}>{money(payment.amount)}</td>
                    <td style={tdStyle}>{payment.payment_method || "—"}</td>
                    <td style={tdStyle}>{payment.payment_reference || "—"}</td>
                    <td style={tdStyle}>{formatDate(payment.submitted_at)}</td>
                    <td style={tdStyle}>{payment.status}</td>
                    <td style={tdStyle}>{formatDate(payment.subscription_end)}</td>
                    <td style={tdStyle}>
                      {payment.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            disabled={workingId === payment.id}
                            onClick={() => approve(payment)}
                            style={approveButton}
                          >
                            <CheckCircle2 size={16} /> Approve
                          </button>
                          <button
                            disabled={workingId === payment.id}
                            onClick={() => reject(payment)}
                            style={rejectButton}
                          >
                            <XCircle size={16} /> Reject
                          </button>
                        </div>
                      ) : payment.status === "REJECTED" ? (
                        <span title={payment.rejection_reason || ""}>
                          Rejected
                        </span>
                      ) : (
                        <span>Approved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

const noticeStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  marginBottom: 16,
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "10px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: 9,
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const approveButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: 0,
  borderRadius: 8,
  padding: "8px 10px",
  background: "#067647",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};

const rejectButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid #fda29b",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#fff",
  color: "#b42318",
  cursor: "pointer",
  fontWeight: 700,
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
