import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Save,
  KeyRound,
} from "lucide-react";

import { supabase } from "./supabase";
import "./Branches.css";

const emptyForm = {
  branch_code: "",
  branch_name: "",
  address: "",
  phone: "",
  email: "",
  vat_number: "",
  status: "ACTIVE",
  branch_password: "",
  confirm_branch_password: "",
};

function Branches({ activeBranch, branchId: activeBranchId, requestBranchSwitch }) {
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordBranch, setPasswordBranch] = useState(null);
  const [branchPassword, setBranchPassword] = useState("");
  const [confirmBranchPassword, setConfirmBranchPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const currentBranchId = activeBranchId || activeBranch?.id || "";

  useEffect(() => {
    fetchBranches();
  }, []);

  async function fetchBranches() {
    setLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch branches error:", error);
      alert(error.message);
    } else {
      setBranches(data || []);
    }

    setLoading(false);
  }

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return branches;

    return branches.filter((branch) => {
      return (
        (branch.branch_code || "").toLowerCase().includes(q) ||
        (branch.branch_name || "").toLowerCase().includes(q) ||
        (branch.address || "").toLowerCase().includes(q) ||
        (branch.phone || "").toLowerCase().includes(q) ||
        (branch.email || "").toLowerCase().includes(q) ||
        (branch.vat_number || "").toLowerCase().includes(q) ||
        (branch.status || "").toLowerCase().includes(q)
      );
    });
  }, [branches, search]);

  const stats = useMemo(() => {
    return {
      total: branches.length,
      active: branches.filter((b) => b.status === "ACTIVE").length,
      inactive: branches.filter((b) => b.status === "INACTIVE").length,
    };
  }, [branches]);

  function openCreateModal() {
    setEditingBranch(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(branch) {
    if (!currentBranchId || branch.id !== currentBranchId) {
      alert("Switch to this branch and unlock it before editing its details.");
      requestBranchSwitch?.(branch.id);
      return;
    }

    setEditingBranch(branch);

    setForm({
      branch_code: branch.branch_code || "",
      branch_name: branch.branch_name || "",
      address: branch.address || "",
      phone: branch.phone || "",
      email: branch.email || "",
      vat_number: branch.vat_number || "",
      status: branch.status || "ACTIVE",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingBranch(null);
    setForm(emptyForm);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveBranch(event) {
    event.preventDefault();

    const branchCode = form.branch_code.trim().toUpperCase();
    const branchName = form.branch_name.trim();

    if (!branchCode) {
      alert("Branch code is required.");
      return;
    }

    if (!branchName) {
      alert("Branch name is required.");
      return;
    }

    const newBranchPassword = String(form.branch_password || "").trim();
    const newBranchPasswordConfirm = String(form.confirm_branch_password || "").trim();

    if (!editingBranch) {
      if (newBranchPassword.length < 4) {
        alert("Branch password must contain at least 4 characters.");
        return;
      }

      if (newBranchPassword !== newBranchPasswordConfirm) {
        alert("Branch passwords do not match.");
        return;
      }
    }

    const payload = {
      branch_code: branchCode,
      branch_name: branchName,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      vat_number: form.vat_number.trim() || null,
      status: form.status,
      updated_at: new Date().toISOString(),
    };

    try {
      setSaving(true);

      let error;

      if (editingBranch) {
        const result = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editingBranch.id);

        error = result.error;
      } else {
        const result = await supabase
          .from("branches")
          .insert([payload])
          .select("*")
          .single();

        error = result.error;

        if (!error) {
          const createdBranch = result.data;

          const { data: passwordData, error: passwordError } = await supabase.rpc(
            "set_branch_password",
            {
              p_branch_id: createdBranch.id,
              p_password: newBranchPassword,
            }
          );

          if (passwordError) throw passwordError;
          if (!passwordData?.success) {
            throw new Error(passwordData?.message || "Unable to set new branch password.");
          }

          const { data: verifyData, error: verifyError } = await supabase.rpc(
            "verify_branch_password",
            {
              p_branch_id: createdBranch.id,
              p_password: newBranchPassword,
            }
          );

          if (verifyError) throw verifyError;
          if (!verifyData?.success) {
            throw new Error(
              verifyData?.message ||
                "Branch was created, but its password verification failed."
            );
          }
        }
      }

      if (error) {
        throw error;
      }

      alert(
        editingBranch
          ? "Branch updated successfully."
          : "Branch created with password successfully."
      );

      closeModal();
      await fetchBranches();
    } catch (error) {
      console.error("Save branch error:", error);

      if (
        error.code === "23505" ||
        String(error.message || "").toLowerCase().includes("duplicate")
      ) {
        alert("That branch code already exists.");
      } else {
        alert(error.message || "Unable to save branch.");
      }
    } finally {
      setSaving(false);
    }
  }

  function openPasswordModal(branch) {
    // A branch with no password cannot be unlocked yet.
    // Allow its FIRST password to be configured from the currently unlocked branch.
    // Once a password exists, changing it still requires unlocking that branch.
    const hasPassword = Boolean(branch.branch_password_hash);

    if (hasPassword && (!currentBranchId || branch.id !== currentBranchId)) {
      alert("Switch to this branch and unlock it before changing its branch password.");
      requestBranchSwitch?.(branch.id);
      return;
    }

    setPasswordBranch(branch);
    setBranchPassword("");
    setConfirmBranchPassword("");
    setShowPasswordModal(true);
  }

  function closePasswordModal() {
    if (passwordSaving) return;
    setShowPasswordModal(false);
    setPasswordBranch(null);
    setBranchPassword("");
    setConfirmBranchPassword("");
  }

  async function saveBranchPassword(event) {
    event.preventDefault();

    if (!passwordBranch) return;

    const hasExistingPassword = Boolean(passwordBranch.branch_password_hash);

    // Existing passwords can only be changed while that branch is unlocked.
    // First-time password setup is allowed because a passwordless branch
    // cannot be unlocked before its first password exists.
    if (
      hasExistingPassword &&
      (!currentBranchId || passwordBranch.id !== currentBranchId)
    ) {
      alert("Unlock this branch before changing its password.");
      requestBranchSwitch?.(passwordBranch.id);
      return;
    }

    const normalizedPassword = branchPassword.trim();
    const normalizedConfirmPassword = confirmBranchPassword.trim();

    if (normalizedPassword.length < 4) {
      alert("Branch password must contain at least 4 characters.");
      return;
    }

    if (normalizedPassword !== normalizedConfirmPassword) {
      alert("Branch passwords do not match.");
      return;
    }

    try {
      setPasswordSaving(true);

      const { data, error } = await supabase.rpc("set_branch_password", {
        p_branch_id: passwordBranch.id,
        p_password: normalizedPassword,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Unable to set branch password.");
      }

      // Do not report success until the newly saved password verifies.
      const { data: verifyData, error: verifyError } = await supabase.rpc(
        "verify_branch_password",
        {
          p_branch_id: passwordBranch.id,
          p_password: normalizedPassword,
        }
      );

      if (verifyError) throw verifyError;
      if (!verifyData?.success) {
        throw new Error(
          verifyData?.message ||
            "Password was saved but verification failed. Please try again."
        );
      }

      alert(
        passwordBranch.branch_password_hash
          ? "Branch password changed and verified successfully."
          : "Branch password set and verified successfully."
      );

      setShowPasswordModal(false);
      setPasswordBranch(null);
      setBranchPassword("");
      setConfirmBranchPassword("");
      await fetchBranches();
    } catch (error) {
      console.error("Set branch password error:", error);
      alert(error.message || "Unable to set branch password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function openDeleteModal(branch) {
    setDeleteBranchTarget(branch);
    setDeletePassword("");
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deleteSaving) return;
    setShowDeleteModal(false);
    setDeleteBranchTarget(null);
    setDeletePassword("");
  }

  async function confirmDeleteBranch(event) {
    event.preventDefault();

    if (!deleteBranchTarget) return;

    const normalizedPassword = deletePassword.trim();

    if (!normalizedPassword) {
      alert("Enter the branch password.");
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete branch ${deleteBranchTarget.branch_name} (${deleteBranchTarget.branch_code})?`
    );

    if (!confirmed) return;

    try {
      setDeleteSaving(true);

      const { data, error } = await supabase.rpc(
        "delete_branch_with_password",
        {
          p_branch_id: deleteBranchTarget.id,
          p_password: normalizedPassword,
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || "Unable to delete branch.");
      }

      alert(data.message || "Branch deleted successfully.");

      const deletedId = deleteBranchTarget.id;

      setShowDeleteModal(false);
      setDeleteBranchTarget(null);
      setDeletePassword("");

      await fetchBranches();

      if (deletedId === currentBranchId) {
        requestBranchSwitch?.("");
      }
    } catch (error) {
      console.error("Delete branch error:", error);
      alert(error.message || "Unable to delete branch.");
    } finally {
      setDeleteSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="branches-page">
        <p>Loading branches...</p>
      </div>
    );
  }

  return (
    <div className="branches-page">
      <div className="branches-header">
        <div>
          <h2>Branches</h2>
          <p>
            Manage business locations and branch details.
          </p>
        </div>

        <button
          className="branch-primary-btn"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      <div className="branch-stats">
        <div className="branch-stat-card">
          <span>Total Branches</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="branch-stat-card">
          <span>Active</span>
          <strong>{stats.active}</strong>
        </div>

        <div className="branch-stat-card">
          <span>Inactive</span>
          <strong>{stats.inactive}</strong>
        </div>
      </div>

      <div className="branches-card">
        <div className="branches-toolbar">
          <div className="branch-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search branches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <span>
            {filteredBranches.length} result
            {filteredBranches.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="branches-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Branch</th>
                <th>Contact</th>
                <th>VAT No.</th>
                <th>Status</th>
                <th>Branch Password</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan="8" className="branch-empty-row">
                    No branches found.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <strong>{branch.branch_code}</strong>
                    </td>

                    <td>
                      <div className="branch-name-cell">
                        <div className="branch-icon">
                          <Building2 size={17} />
                        </div>

                        <div>
                          <strong>{branch.branch_name}</strong>
                          <span>{branch.address || "No address"}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="branch-contact">
                        <span>{branch.phone || "-"}</span>
                        <small>{branch.email || "-"}</small>
                      </div>
                    </td>

                    <td>{branch.vat_number || "-"}</td>

                    <td>
                      <span
                        className={`branch-status ${
                          branch.status === "ACTIVE"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {branch.status}
                      </span>
                    </td>

                    <td>
                      <span className={`branch-status ${branch.branch_password_hash ? "active" : "inactive"}`}>
                        {branch.branch_password_hash ? "PASSWORD SET" : "NOT SET"}
                      </span>
                    </td>

                    <td>
                      {branch.created_at
                        ? new Date(branch.created_at).toLocaleDateString("en-LK")
                        : "-"}
                    </td>

                    <td>
                      <div className="branch-actions">
                        <button
                          title={branch.branch_password_hash ? "Change branch password" : "Set branch password"}
                          onClick={() => openPasswordModal(branch)}
                        >
                          <KeyRound size={16} />
                        </button>

                        <button
                          title="Edit branch"
                          onClick={() => openEditModal(branch)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="danger"
                          title="Delete branch"
                          onClick={() => openDeleteModal(branch)}
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

      {showPasswordModal && passwordBranch && (
        <div className="branch-modal-overlay">
          <div className="branch-modal">
            <div className="branch-modal-header">
              <div>
                <h3>{passwordBranch.branch_password_hash ? "Change Branch Password" : "Set Branch Password"}</h3>
                <p>{passwordBranch.branch_code} - {passwordBranch.branch_name}</p>
              </div>
              <button className="branch-close-btn" onClick={closePasswordModal} disabled={passwordSaving}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveBranchPassword}>
              <div className="branch-form-grid">
                <div className="branch-address-field">
                  <label>New Branch Password *</label>
                  <input type="password" autoComplete="new-password" placeholder="Enter branch password"
                    value={branchPassword} onChange={(e) => setBranchPassword(e.target.value)} required minLength={4} />
                </div>
                <div className="branch-address-field">
                  <label>Confirm Branch Password *</label>
                  <input type="password" autoComplete="new-password" placeholder="Re-enter branch password"
                    value={confirmBranchPassword} onChange={(e) => setConfirmBranchPassword(e.target.value)} required minLength={4} />
                </div>
              </div>
              <div className="branch-modal-actions">
                <button type="button" className="branch-secondary-btn" onClick={closePasswordModal} disabled={passwordSaving}>Cancel</button>
                <button type="submit" className="branch-primary-btn" disabled={passwordSaving}>
                  <KeyRound size={17} /> {passwordSaving ? "Saving..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteBranchTarget && (
        <div className="branch-modal-overlay">
          <div className="branch-modal">
            <div className="branch-modal-header">
              <div>
                <h3>Delete Branch</h3>
                <p>
                  {deleteBranchTarget.branch_code} - {deleteBranchTarget.branch_name}
                </p>
              </div>

              <button
                className="branch-close-btn"
                onClick={closeDeleteModal}
                disabled={deleteSaving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={confirmDeleteBranch}>
              <div className="branch-form-grid">
                <div className="branch-address-field">
                  <label>Branch Password *</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter this branch's password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="branch-address-field">
                  <p style={{ margin: 0 }}>
                    Enter the password for this branch to authorize permanent deletion.
                    A branch with stock or business transaction history will not be deleted.
                  </p>
                </div>
              </div>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-secondary-btn"
                  onClick={closeDeleteModal}
                  disabled={deleteSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="branch-primary-btn"
                  disabled={deleteSaving}
                >
                  <Trash2 size={17} />
                  {deleteSaving ? "Deleting..." : "Delete Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="branch-modal-overlay">
          <div className="branch-modal">
            <div className="branch-modal-header">
              <div>
                <h3>
                  {editingBranch ? "Edit Branch" : "Add Branch"}
                </h3>

                <p>
                  {editingBranch
                    ? "Update branch information."
                    : "Create a new business branch."}
                </p>
              </div>

              <button
                className="branch-close-btn"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveBranch}>
              <div className="branch-form-grid">
                <div>
                  <label>Branch Code *</label>

                  <input
                    name="branch_code"
                    type="text"
                    placeholder="BR002"
                    value={form.branch_code}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Branch Name *</label>

                  <input
                    name="branch_name"
                    type="text"
                    placeholder="Colombo Branch"
                    value={form.branch_name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label>Phone</label>

                  <input
                    name="phone"
                    type="text"
                    placeholder="+94..."
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Email</label>

                  <input
                    name="email"
                    type="email"
                    placeholder="branch@example.com"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>VAT Number</label>

                  <input
                    name="vat_number"
                    type="text"
                    placeholder="VAT number"
                    value={form.vat_number}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label>Status</label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                {!editingBranch && (
                  <>
                    <div>
                      <label>Branch Password *</label>
                      <input
                        name="branch_password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Minimum 4 characters"
                        value={form.branch_password}
                        onChange={handleChange}
                        required
                        minLength={4}
                      />
                    </div>

                    <div>
                      <label>Confirm Branch Password *</label>
                      <input
                        name="confirm_branch_password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Re-enter branch password"
                        value={form.confirm_branch_password}
                        onChange={handleChange}
                        required
                        minLength={4}
                      />
                    </div>
                  </>
                )}

                <div className="branch-address-field">
                  <label>Address</label>

                  <textarea
                    name="address"
                    rows="3"
                    placeholder="Branch address"
                    value={form.address}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="branch-modal-actions">
                <button
                  type="button"
                  className="branch-secondary-btn"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="branch-primary-btn"
                  disabled={saving}
                >
                  <Save size={17} />

                  {saving
                    ? "Saving..."
                    : editingBranch
                    ? "Update Branch"
                    : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Branches;
