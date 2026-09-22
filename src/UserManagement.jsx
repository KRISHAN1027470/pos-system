import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
} from "lucide-react";
import { supabase } from "./supabase";

const ROLES = ["ADMIN", "MANAGER", "CASHIER"];
const STATUSES = ["PENDING", "ACTIVE", "INACTIVE"];

export default function UserManagement({ currentUser, branches = [] }) {
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError("");
    setMessage("");

    const { data, error: loadError } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role, branch_id, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message || "Unable to load users.");
      setLoading(false);
      return;
    }

    const rows = data || [];
    setUsers(rows);

    const nextDrafts = {};
    rows.forEach((user) => {
      nextDrafts[user.id] = {
        role: String(user.role || "CASHIER").toUpperCase(),
        status: String(user.status || "PENDING").toUpperCase(),
        branch_id: user.branch_id || "",
      };
    });
    setDrafts(nextDrafts);
    setLoading(false);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      [user.full_name, user.email, user.role, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [users, search]);

  function updateDraft(userId, field, value) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  }

  async function saveUser(userId, override = {}) {
    const current = drafts[userId] || {};
    const next = { ...current, ...override };

    if (!ROLES.includes(next.role)) {
      setError("Select a valid role.");
      return;
    }

    if (!STATUSES.includes(next.status)) {
      setError("Select a valid status.");
      return;
    }

    setSavingId(userId);
    setError("");
    setMessage("");

    const { data, error: saveError } = await supabase.rpc(
      "admin_update_user_access",
      {
        p_user_id: userId,
        p_role: next.role,
        p_status: next.status,
        p_branch_id: next.branch_id || null,
      }
    );

    if (saveError) {
      setError(saveError.message || "Unable to update user.");
      setSavingId("");
      return;
    }

    if (!data?.success) {
      setError("The user could not be updated.");
      setSavingId("");
      return;
    }

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: next,
    }));

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId
          ? {
              ...user,
              role: next.role,
              status: next.status,
              branch_id: next.branch_id || null,
            }
          : user
      )
    );

    setMessage(
      next.status === "ACTIVE"
        ? "User access updated successfully."
        : "User status updated successfully."
    );
    setSavingId("");
  }

  const pendingCount = users.filter(
    (user) => String(user.status).toUpperCase() === "PENDING"
  ).length;

  if (String(currentUser?.role || "").toUpperCase() !== "ADMIN") {
    return (
      <div style={styles.notice}>
        <ShieldCheck size={22} />
        Only administrators can manage user accounts.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>User Management</h2>
          <p style={styles.muted}>
            Approve new accounts, assign roles and branches, and control access.
          </p>
        </div>

        <button onClick={loadUsers} disabled={loading} style={styles.secondaryButton}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.muted}>Total Users</span>
          <strong style={styles.summaryNumber}>{users.length}</strong>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.muted}>Pending Approval</span>
          <strong style={styles.summaryNumber}>{pendingCount}</strong>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, role or status..."
            style={styles.searchInput}
          />
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.empty}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={styles.empty}>No users found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Branch</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const draft = drafts[user.id] || {
                    role: "CASHIER",
                    status: "PENDING",
                    branch_id: "",
                  };
                  const isSelf = user.id === currentUser?.id;
                  const saving = savingId === user.id;

                  return (
                    <tr key={user.id}>
                      <td style={styles.td}>
                        <strong>{user.full_name || "Unnamed user"}</strong>
                        <div style={styles.email}>{user.email || "-"}</div>
                        {isSelf && <span style={styles.youBadge}>YOU</span>}
                      </td>

                      <td style={styles.td}>
                        <select
                          value={draft.role}
                          onChange={(event) =>
                            updateDraft(user.id, "role", event.target.value)
                          }
                          disabled={saving}
                          style={styles.select}
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <select
                          value={draft.branch_id}
                          onChange={(event) =>
                            updateDraft(user.id, "branch_id", event.target.value)
                          }
                          disabled={saving}
                          style={styles.select}
                        >
                          <option value="">All / No fixed branch</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.branch_code} - {branch.branch_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            updateDraft(user.id, "status", event.target.value)
                          }
                          disabled={saving || isSelf}
                          style={styles.select}
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actions}>
                          {draft.status === "PENDING" && !isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                saveUser(user.id, { status: "ACTIVE" })
                              }
                              disabled={saving}
                              style={styles.approveButton}
                            >
                              <CheckCircle2 size={16} />
                              {saving ? "Saving..." : "Approve"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => saveUser(user.id)}
                            disabled={saving}
                            style={styles.saveButton}
                          >
                            <UserCog size={16} />
                            {saving ? "Saving..." : "Save"}
                          </button>

                          {!isSelf && draft.status === "ACTIVE" && (
                            <button
                              type="button"
                              onClick={() =>
                                saveUser(user.id, { status: "INACTIVE" })
                              }
                              disabled={saving}
                              style={styles.deactivateButton}
                            >
                              <UserX size={16} />
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  muted: {
    color: "#667085",
    margin: "6px 0 0",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: "14px",
    padding: "18px",
    display: "grid",
    gap: "7px",
  },
  summaryNumber: {
    fontSize: "28px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  searchWrap: {
    width: "100%",
    maxWidth: "520px",
    background: "#fff",
    border: "1px solid #d0d5dd",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "0 12px",
  },
  searchInput: {
    width: "100%",
    border: 0,
    outline: "none",
    padding: "11px 0",
    background: "transparent",
  },
  tableCard: {
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: "14px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "950px",
  },
  th: {
    textAlign: "left",
    padding: "13px 14px",
    borderBottom: "1px solid #eaecf0",
    background: "#f9fafb",
    color: "#475467",
    fontSize: "13px",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #eaecf0",
    verticalAlign: "middle",
  },
  email: {
    color: "#667085",
    fontSize: "13px",
    marginTop: "4px",
  },
  youBadge: {
    display: "inline-block",
    marginTop: "6px",
    padding: "2px 7px",
    borderRadius: "999px",
    background: "#eef4ff",
    color: "#3538cd",
    fontSize: "11px",
    fontWeight: 700,
  },
  select: {
    minWidth: "150px",
    padding: "9px 10px",
    border: "1px solid #d0d5dd",
    borderRadius: "9px",
    background: "#fff",
  },
  actions: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    padding: "9px 13px",
    border: "1px solid #d0d5dd",
    borderRadius: "9px",
    background: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontWeight: 600,
  },
  approveButton: {
    padding: "9px 11px",
    border: 0,
    borderRadius: "9px",
    background: "#067647",
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 700,
  },
  saveButton: {
    padding: "9px 11px",
    border: 0,
    borderRadius: "9px",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 700,
  },
  deactivateButton: {
    padding: "9px 11px",
    border: "1px solid #fecdca",
    borderRadius: "9px",
    background: "#fff",
    color: "#b42318",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontWeight: 700,
  },
  error: {
    padding: "11px 13px",
    borderRadius: "9px",
    background: "#fef3f2",
    border: "1px solid #fecdca",
    color: "#b42318",
  },
  success: {
    padding: "11px 13px",
    borderRadius: "9px",
    background: "#ecfdf3",
    border: "1px solid #abefc6",
    color: "#067647",
  },
  empty: {
    padding: "30px",
    textAlign: "center",
    color: "#667085",
  },
  notice: {
    padding: "16px",
    background: "#fff",
    border: "1px solid #eaecf0",
    borderRadius: "12px",
    display: "flex",
    gap: "9px",
    alignItems: "center",
  },
};
