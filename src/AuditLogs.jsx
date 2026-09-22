import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Search,
  RefreshCw,
  Filter,
  CalendarDays,
  Building2,
  FileText,
  X,
} from "lucide-react";
import { supabase } from "./supabase";
import "./AuditLogs.css";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-LK");
}

export default function AuditLogs({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [logs, setLogs] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("ALL");
  const [actionType, setActionType] = useState("ALL");
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setSearch("");
    setEntityType("ALL");
    setActionType("ALL");
    setSelectedLog(null);
  }, [activeBranchId, activeBranch?.id]);

  async function loadData() {
    setLoading(true);

    const currentBranchId = activeBranchId || activeBranch?.id || branchId;

    if (!currentBranchId) {
      setLogs([]);
      setBranches(appBranches || []);
      setLoading(false);
      return;
    }

    const [logResult, branchResult] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("*")
        .eq("branch_id", currentBranchId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("branches")
        .select("id, branch_code, branch_name")
        .order("branch_name"),
    ]);

    if (logResult.error) {
      alert(logResult.error.message);
      setLogs([]);
    } else {
      setLogs(logResult.data || []);
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

  const entityTypes = useMemo(
    () =>
      [...new Set(logs.map((log) => log.entity_type).filter(Boolean))].sort(),
    [logs]
  );

  const actionTypes = useMemo(
    () =>
      [...new Set(logs.map((log) => log.action_type).filter(Boolean))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return logs.filter((log) => {
      if (entityType !== "ALL" && log.entity_type !== entityType) return false;
      if (actionType !== "ALL" && log.action_type !== actionType) return false;
      if (branchId && log.branch_id !== branchId) return false;

      if (!term) return true;

      const branchName = branchMap[log.branch_id]?.branch_name || "";

      return [
        log.action_type,
        log.entity_type,
        log.description,
        log.user_name,
        branchName,
        log.entity_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [logs, search, entityType, actionType, branchId, branchMap]);

  return (
    <div className="audit-page">
      <div className="audit-header">
        <div>
          <h1>Audit Logs</h1>
          <p>Review system activity and important business changes.</p>
        </div>

        <button className="audit-secondary-btn" onClick={loadData}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </div>

      <div className="audit-summary">
        <div className="audit-summary-card">
          <ClipboardList size={22} />
          <div>
            <span>Total Logs</span>
            <strong>{logs.length}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <Filter size={22} />
          <div>
            <span>Filtered Results</span>
            <strong>{filteredLogs.length}</strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <CalendarDays size={22} />
          <div>
            <span>Latest Activity</span>
            <strong>
              {logs[0]?.created_at
                ? new Date(logs[0].created_at).toLocaleDateString("en-LK")
                : "-"}
            </strong>
          </div>
        </div>

        <div className="audit-summary-card">
          <Building2 size={22} />
          <div>
            <span>Branches</span>
            <strong>{branches.length}</strong>
          </div>
        </div>
      </div>

      <div className="audit-toolbar">
        <div className="audit-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, entity, description..."
          />
        </div>

        <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="ALL">All Entities</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="ALL">All Actions</option>
          {actionTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={branchId}
          onChange={(e) => {
            const nextBranchId = e.target.value;

            if (!nextBranchId || nextBranchId === branchId) return;

            if (selectedLog) {
              const confirmed = window.confirm(
                "Switching branch will close the current audit detail window after the destination branch password is accepted. Continue?"
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
      </div>

      <div className="audit-card">
        <div className="audit-card-header">
          <div>
            <h2>Activity History</h2>
            <span>{filteredLogs.length} records</span>
          </div>
        </div>

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Branch</th>
                <th>User</th>
                <th>Description</th>
                <th>Details</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="7" className="audit-empty">
                    No audit logs found.
                  </td>
                </tr>
              )}

              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.created_at)}</td>

                  <td>
                    <span className="audit-badge action">
                      {log.action_type}
                    </span>
                  </td>

                  <td>
                    <span className="audit-badge entity">
                      {log.entity_type}
                    </span>
                  </td>

                  <td>
                    {branchMap[log.branch_id]?.branch_name || "-"}
                  </td>

                  <td>{log.user_name || "Admin"}</td>

                  <td>{log.description || "-"}</td>

                  <td>
                    <button
                      className="audit-secondary-btn"
                      onClick={() => {
                        const currentBranchId =
                          activeBranchId || activeBranch?.id || branchId;

                        if (!currentBranchId || log.branch_id !== currentBranchId) {
                          alert("Switch to this audit log's branch and unlock it before viewing details.");
                          if (log.branch_id) requestBranchSwitch?.(log.branch_id);
                          return;
                        }

                        setSelectedLog(log);
                      }}
                    >
                      <FileText size={15} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLog && (
        <div
          className="audit-modal-backdrop"
          onMouseDown={() => setSelectedLog(null)}
        >
          <div
            className="audit-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="audit-modal-header">
              <div>
                <h2>Audit Details</h2>
                <p>{selectedLog.action_type} · {selectedLog.entity_type}</p>
              </div>

              <button onClick={() => setSelectedLog(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="audit-detail-grid">
              <div>
                <span>Date & Time</span>
                <strong>{formatDate(selectedLog.created_at)}</strong>
              </div>

              <div>
                <span>User</span>
                <strong>{selectedLog.user_name || "Admin"}</strong>
              </div>

              <div>
                <span>Branch</span>
                <strong>
                  {branchMap[selectedLog.branch_id]?.branch_name || "-"}
                </strong>
              </div>

              <div>
                <span>Entity ID</span>
                <strong>{selectedLog.entity_id || "-"}</strong>
              </div>
            </div>

            <div className="audit-description-box">
              <span>Description</span>
              <p>{selectedLog.description || "-"}</p>
            </div>

            <div className="audit-json-section">
              <h3>Old Data</h3>
              <pre>
                {selectedLog.old_data
                  ? JSON.stringify(selectedLog.old_data, null, 2)
                  : "No old data"}
              </pre>
            </div>

            <div className="audit-json-section">
              <h3>New Data</h3>
              <pre>
                {selectedLog.new_data
                  ? JSON.stringify(selectedLog.new_data, null, 2)
                  : "No new data"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
