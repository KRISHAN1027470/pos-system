import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Users,
} from "lucide-react";

import { supabase } from "./supabase";
import "./Customers.css";

const emptyForm = {
  cashier_code: "",
  name: "",
  phone: "",
  email: "",
  branch_id: "",
  status: "ACTIVE",
};

function Cashiers({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [cashiers, setCashiers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const currentBranchId = activeBranchId || activeBranch?.id || "";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!currentBranchId) return;

    setSearch("");
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    loadData();
  }, [currentBranchId]);

  async function loadData() {
    setLoading(true);

    if (!currentBranchId) {
      setCashiers([]);
      setBranches(appBranches || []);
      setLoading(false);
      return;
    }

    const [cashierResult, branchResult] = await Promise.all([
      supabase
        .from("cashiers")
        .select("*")
        .eq("branch_id", currentBranchId)
        .order("created_at", { ascending: false }),
      supabase
        .from("branches")
        .select("id, branch_code, branch_name, status")
        .eq("status", "ACTIVE")
        .order("branch_name", { ascending: true }),
    ]);

    if (cashierResult.error) {
      console.error("Load cashiers error:", cashierResult.error);
      alert(cashierResult.error.message);
    } else {
      setCashiers(cashierResult.data || []);
    }

    if (branchResult.error) {
      console.error("Load branches error:", branchResult.error);
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      setBranches(appBranches?.length ? appBranches : branchResult.data || []);
    }

    setLoading(false);
  }

  function generateCashierCode() {
    const numbers = cashiers
      .map((cashier) => {
        const match = String(cashier.cashier_code || "").match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter(Number.isFinite);

    const nextNumber = (numbers.length ? Math.max(...numbers) : 0) + 1;
    return `CSH-${String(nextNumber).padStart(4, "0")}`;
  }

  function openNewCashier() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      cashier_code: generateCashierCode(),
      branch_id: currentBranchId,
    });
    setShowForm(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Cashier name is required.");
      return;
    }

    if (!currentBranchId) {
      alert("Unlock a branch before managing cashiers.");
      return;
    }

    if (!form.branch_id || form.branch_id !== currentBranchId) {
      alert("Cashiers can only be saved for the currently unlocked branch.");
      return;
    }

    const payload = {
      cashier_code: form.cashier_code,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      branch_id: form.branch_id,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    if (editingId) {
      const { error } = await supabase
        .from("cashiers")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error("Update cashier error:", error);
        alert(error.message);
        return;
      }

      alert("Cashier updated successfully.");
    } else {
      const { error } = await supabase
        .from("cashiers")
        .insert([payload]);

      if (error) {
        console.error("Save cashier error:", error);
        alert(error.message);
        return;
      }

      alert("Cashier saved successfully.");
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    loadData();
  }

  function editCashier(cashier) {
    if (!currentBranchId || cashier.branch_id !== currentBranchId) {
      alert("Switch to this cashier's branch and unlock it before editing.");
      if (cashier.branch_id) requestBranchSwitch?.(cashier.branch_id);
      return;
    }

    setEditingId(cashier.id);
    setForm({
      cashier_code: cashier.cashier_code || "",
      name: cashier.name || "",
      phone: cashier.phone || "",
      email: cashier.email || "",
      branch_id: cashier.branch_id || "",
      status: cashier.status || "ACTIVE",
    });
    setShowForm(true);
  }

  async function deleteCashier(cashier) {
    if (!currentBranchId || cashier.branch_id !== currentBranchId) {
      alert("Switch to this cashier's branch and unlock it before deleting.");
      if (cashier.branch_id) requestBranchSwitch?.(cashier.branch_id);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this cashier?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("cashiers")
      .delete()
      .eq("id", cashier.id);

    if (error) {
      console.error("Delete cashier error:", error);
      alert(
        error.code === "23503"
          ? "This cashier has sales history and cannot be deleted. Set the cashier to INACTIVE instead."
          : error.message
      );
      return;
    }

    loadData();
  }

  const branchMap = Object.fromEntries(
    branches.map((branch) => [branch.id, branch])
  );

  const filteredCashiers = cashiers.filter((cashier) => {
    const text = search.toLowerCase();
    const branchName = branchMap[cashier.branch_id]?.branch_name || "";

    if (!currentBranchId || cashier.branch_id !== currentBranchId) return false;

    return (
      (cashier.name || "").toLowerCase().includes(text) ||
      (cashier.cashier_code || "").toLowerCase().includes(text) ||
      (cashier.phone || "").toLowerCase().includes(text) ||
      branchName.toLowerCase().includes(text)
    );
  });

  const activeCashiers = cashiers.filter(
    (cashier) => cashier.status === "ACTIVE"
  ).length;

  const inactiveCashiers = cashiers.filter(
    (cashier) => cashier.status === "INACTIVE"
  ).length;

  return (
    <div className="customers-page">
      <div className="customer-heading">
        <div>
          <h2>Cashiers</h2>
          <p>Create and manage cashiers for each branch.</p>
        </div>

        <button className="primary-btn" onClick={openNewCashier}>
          <Plus size={18} />
          Add Cashier
        </button>
      </div>

      <div className="customer-stat-grid">
        <div className="customer-stat">
          <div>
            <span>Total Cashiers</span>
            <strong>{cashiers.length}</strong>
          </div>
          <Users size={25} />
        </div>

        <div className="customer-stat">
          <div>
            <span>Active Cashiers</span>
            <strong>{activeCashiers}</strong>
          </div>
          <Users size={25} />
        </div>

        <div className="customer-stat">
          <div>
            <span>Inactive Cashiers</span>
            <strong>{inactiveCashiers}</strong>
          </div>
          <Users size={25} />
        </div>
      </div>

      <div className="customer-table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search cashiers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cashier Code</th>
                <th>Cashier Name</th>
                <th>Branch</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan="7">Loading cashiers...</td></tr>
              ) : filteredCashiers.length === 0 ? (
                <tr><td colSpan="7">No cashiers found.</td></tr>
              ) : (
                filteredCashiers.map((cashier) => (
                  <tr key={cashier.id}>
                    <td><strong>{cashier.cashier_code}</strong></td>
                    <td>{cashier.name}</td>
                    <td>
                      {branchMap[cashier.branch_id]
                        ? `${branchMap[cashier.branch_id].branch_code} - ${branchMap[cashier.branch_id].branch_name}`
                        : "-"}
                    </td>
                    <td>{cashier.phone || "-"}</td>
                    <td>{cashier.email || "-"}</td>
                    <td>
                      <strong>{cashier.status}</strong>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-btn"
                          onClick={() => editCashier(cashier)}
                          title="Edit cashier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn delete"
                          onClick={() => deleteCashier(cashier)}
                          title="Delete cashier"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="customer-modal">
            <div className="modal-header">
              <div>
                <h3>{editingId ? "Edit Cashier" : "Add Cashier"}</h3>
              </div>

              <button
                className="close-btn"
                onClick={() => setShowForm(false)}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Cashier Code</label>
                  <input
                    type="text"
                    name="cashier_code"
                    value={form.cashier_code}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Status *</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <div className="form-group full">
                  <label>Cashier Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group full">
                  <label>Branch *</label>
                  <select
                    name="branch_id"
                    value={form.branch_id}
                    disabled
                  >
                    {branches
                      .filter((branch) => branch.id === currentBranchId)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branch_code} - {branch.branch_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  {editingId ? "Update Cashier" : "Save Cashier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cashiers;
