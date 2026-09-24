import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Package,
} from "lucide-react";

import { supabase } from "./supabase";
import "./Items.css";

const emptyForm = {
  id: "",
  sku: "",
  barcode: "",
  name: "",
  category: "",
  cost_price: "",
  selling_price: "",
  wholesale_price: "",
  vat_type: "VAT",
  vat_rate: "18",
  opening_stock: "",
  current_stock: "",
  reorder_level: "",
  unit: "PCS",
};

function Items({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === selectedBranchId) return;

    setSelectedBranchId(nextBranchId);
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }, [activeBranchId, activeBranch?.id]);

  useEffect(() => {
    if (!selectedBranchId) {
      setLoading(false);
      return;
    }
    fetchItems();
  }, [selectedBranchId]);

  async function loadPage() {
    const { data, error } = await supabase
      .from("branches")
      .select("id, branch_code, branch_name, status")
      .eq("status", "ACTIVE")
      .order("branch_name", { ascending: true });

    if (error) {
      console.error("Load branches error:", error);
      alert(error.message);

      const fallbackBranches = appBranches || [];
      setBranches(fallbackBranches);

      const currentGlobalBranchId =
        activeBranchId || activeBranch?.id || "";

      if (currentGlobalBranchId) {
        setSelectedBranchId(currentGlobalBranchId);
      } else {
        setLoading(false);
      }

      return;
    }

    const activeBranches =
      appBranches?.length ? appBranches : data || [];

    setBranches(activeBranches);

    const currentGlobalBranchId =
      activeBranchId || activeBranch?.id || "";

    if (currentGlobalBranchId) {
      setSelectedBranchId(currentGlobalBranchId);
      if (currentGlobalBranchId === selectedBranchId) {
        await fetchItems();
      }
    } else {
      setLoading(false);
    }
  }

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select(`
        *,
        branch_stock (
          quantity,
          branch_id
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load items error:", error);
      alert(error.message);
    } else {
      const normalizedItems = (data || []).map((item) => {
        const selectedBranchStock = (item.branch_stock || []).find(
          (row) => row.branch_id === selectedBranchId
        );

        const branchStockQty = Number(selectedBranchStock?.quantity || 0);

        return {
          ...item,
          stock_qty: branchStockQty,
        };
      });

      setItems(normalizedItems);
    }

    setLoading(false);
  }

  function generateSKU() {
    return `ITEM-${String(items.length + 1).padStart(4, "0")}`;
  }

  function openNewItem() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      sku: generateSKU(),
    });

    setShowForm(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "vat_type" && value !== "VAT"
        ? { vat_rate: "0" }
        : {}),
      ...(name === "vat_type" &&
      value === "VAT" &&
      Number(prev.vat_rate) === 0
        ? { vat_rate: "18" }
        : {}),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Item name is required.");
      return;
    }

    if (!form.sku.trim()) {
      alert("SKU is required.");
      return;
    }

    if (form.selling_price === "") {
      alert("Retail price is required.");
      return;
    }

    if (!selectedBranchId) {
      alert("Please select a branch.");
      return;
    }

    // Wholesale price is optional. Keep a blank field as NULL.
    const wholesalePrice =
      form.wholesale_price === "" ||
      form.wholesale_price === null ||
      form.wholesale_price === undefined
        ? null
        : Number(form.wholesale_price);

    const payload = {
      sku: form.sku.trim(),
      barcode: form.barcode.trim() || null,
      name: form.name.trim(),
      category: form.category.trim() || null,
      unit: form.unit || "PCS",
      cost_price: Number(form.cost_price || 0),
      selling_price: Number(form.selling_price || 0),
      wholesale_price: wholesalePrice,
      vat_type: form.vat_type,
      vat_rate:
        form.vat_type === "VAT"
          ? Number(form.vat_rate || 0)
          : 0,
      reorder_level: Number(form.reorder_level || 0),
    };

    if (editingId) {
      const { error } = await supabase
        .from("items")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.error("Update item error:", error);
        alert(error.message);
        return;
      }

      alert("Item updated successfully.");
    } else {
      const { error } = await supabase.rpc("create_item", {
        p_sku: payload.sku,
        p_barcode: payload.barcode,
        p_name: payload.name,
        p_category: payload.category,
        p_unit: payload.unit,
        p_cost_price: payload.cost_price,
        p_selling_price: payload.selling_price,
        p_wholesale_price: payload.wholesale_price,
        p_vat_type: payload.vat_type,
        p_vat_rate: payload.vat_rate,
        p_opening_stock: Number(form.opening_stock || 0),
        p_reorder_level: payload.reorder_level,
        p_branch_id: selectedBranchId,
      });

      if (error) {
  console.error("Create item RPC error:", error);

  alert(
    `ERROR CODE: ${error.code || "N/A"}\n\n` +
    `MESSAGE: ${error.message || "N/A"}\n\n` +
    `DETAILS: ${error.details || "N/A"}\n\n` +
    `HINT: ${error.hint || "N/A"}`
  );

  return;
}

      alert("Item saved successfully.");
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    await fetchItems();
  }

  function editItem(item) {
    setEditingId(item.id);

    setForm({
      id: item.id,
      sku: item.sku || "",
      barcode: item.barcode || "",
      name: item.name || "",
      category: item.category || "",
      cost_price: item.cost_price ?? "",
      selling_price: item.selling_price ?? "",
      wholesale_price: item.wholesale_price ?? "",
      vat_type: item.vat_type || "VAT",
      vat_rate: item.vat_rate ?? "0",
      opening_stock: item.opening_stock ?? "",
      current_stock: item.stock_qty ?? 0,
      reorder_level: item.reorder_level ?? "",
      unit: item.unit || "PCS",
    });

    setShowForm(true);
  }

  async function deleteItem(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this item?"
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase.rpc("delete_item", {
        p_item_id: id,
      });

      if (error) {
        console.error("Delete item RPC error:", error);
        alert(error.message);
        return;
      }

      alert("Item deleted successfully.");
      await fetchItems();
    } catch (err) {
      console.error("Delete item error:", err);
      alert(err?.message || "Unable to delete item.");
    }
  }

  const filteredItems = items.filter((item) => {
    const text = search.toLowerCase();

    return (
      (item.name || "").toLowerCase().includes(text) ||
      (item.sku || "").toLowerCase().includes(text) ||
      (item.barcode || "").toLowerCase().includes(text) ||
      (item.category || "").toLowerCase().includes(text)
    );
  });

  const totalStock = items.reduce(
    (sum, item) => sum + Number(item.stock_qty || 0),
    0
  );

  const lowStock = items.filter(
    (item) =>
      Number(item.stock_qty || 0) <=
      Number(item.reorder_level || 0)
  ).length;

  return (
    <div className="items-page">
      <div className="items-heading">
        <div>
          <h2>Items</h2>
          <p>Manage products, VAT status, prices and stock.</p>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedBranchId}
            onChange={(e) => {
              const nextBranchId = e.target.value;

              if (!nextBranchId || nextBranchId === selectedBranchId) {
                return;
              }

              if (showForm) {
                const confirmed = window.confirm(
                  "Switching branch will close the current item form after the destination branch password is accepted. Continue?"
                );

                if (!confirmed) {
                  return;
                }
              }

              requestBranchSwitch?.(nextBranchId);
            }}
            aria-label="Select stock branch"
            style={{
              minWidth: "230px",
              height: "46px",
              padding: "0 14px",
              border: "1px solid #d6deea",
              borderRadius: "10px",
              background: "#fff",
              fontSize: "15px",
              fontWeight: 600,
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.branch_code} - {branch.branch_name}
              </option>
            ))}
          </select>

          <button className="primary-btn" onClick={openNewItem}>
            <Plus size={18} />
            Add Item
          </button>
        </div>
      </div>

      <div className="items-stat-grid">
        <div className="item-stat">
          <div>
            <span>Total Items</span>
            <strong>{items.length}</strong>
          </div>
          <Package size={25} />
        </div>

        <div className="item-stat">
          <div>
            <span>Branch Stock Qty</span>
            <strong>{totalStock}</strong>
          </div>
          <Package size={25} />
        </div>

        <div className="item-stat">
          <div>
            <span>Low Stock Items</span>
            <strong>{lowStock}</strong>
          </div>
          <Package size={25} />
        </div>
      </div>

      <div className="items-table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search item, SKU, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Barcode</th>
                <th>VAT</th>
                <th>Retail Price</th>
                <th>Wholesale Price</th>
                <th>Branch Stock</th>
                <th>Reorder</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">Loading items...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="no-items">
                      <Package size={40} />
                      <strong>No items found</strong>
                      <span>Add your first item to begin selling.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.sku}</strong>
                    </td>

                    <td>
                      <div className="item-name">
                        <strong>{item.name}</strong>
                        <span>{item.category || "-"}</span>
                      </div>
                    </td>

                    <td>{item.barcode || "-"}</td>

                    <td>
                      <span
                        className={`item-badge ${
                          item.vat_type === "VAT"
                            ? "vat"
                            : item.vat_type === "EXEMPT"
                            ? "exempt"
                            : "non-vat"
                        }`}
                      >
                        {item.vat_type === "VAT"
                          ? `VAT ${item.vat_rate}%`
                          : item.vat_type === "EXEMPT"
                          ? "VAT Exempt"
                          : "Non-VAT"}
                      </span>
                    </td>

                    <td>
                      Rs.{" "}
                      {Number(
                        item.selling_price || 0
                      ).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td>
                      Rs.{" "}
                      {item.wholesale_price == null
                        ? "-"
                        : Number(item.wholesale_price).toLocaleString("en-LK", {
                            minimumFractionDigits: 2,
                          })}
                    </td>

                    <td>
                      <strong>{item.stock_qty || 0}</strong>{" "}
                      {item.unit}
                    </td>

                    <td>{item.reorder_level || 0}</td>

                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-btn"
                          onClick={() => editItem(item)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-btn delete"
                          onClick={() => deleteItem(item.id)}
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
          <div className="item-modal">
            <div className="modal-header">
              <div>
                <h3>{editingId ? "Edit Item" : "Add Item"}</h3>
                <p>Enter product and stock information.</p>
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
                  <label>SKU *</label>

                  <input
                    name="sku"
                    value={form.sku}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Barcode</label>

                  <input
                    name="barcode"
                    value={form.barcode}
                    onChange={handleChange}
                    placeholder="Scan or enter barcode"
                  />
                </div>

                <div className="form-group full">
                  <label>Item Name *</label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter item name"
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>

                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Unit</label>

                  <select
                    name="unit"
                    value={form.unit}
                    onChange={handleChange}
                  >
                    <option value="PCS">PCS</option>
                    <option value="BOX">BOX</option>
                    <option value="KG">KG</option>
                    <option value="M">M</option>
                    <option value="SET">SET</option>
                    <option value="UNIT">UNIT</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Cost Price (Rs.)</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="cost_price"
                    value={form.cost_price}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Retail Price (Rs.) *</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="selling_price"
                    value={form.selling_price}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Wholesale Price (Rs.) <span style={{ fontWeight: 400 }}>(Optional)</span></label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="wholesale_price"
                    value={form.wholesale_price}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>VAT Type</label>

                  <select
                    name="vat_type"
                    value={form.vat_type}
                    onChange={handleChange}
                  >
                    <option value="VAT">VAT Applicable</option>
                    <option value="EXEMPT">VAT Exempt</option>
                    <option value="NON_VAT">Non-VAT</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>VAT Rate %</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="vat_rate"
                    value={form.vat_rate}
                    onChange={handleChange}
                    disabled={form.vat_type !== "VAT"}
                  />
                </div>

                {!editingId && (
                  <div className="form-group">
                    <label>Opening Stock</label>

                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      name="opening_stock"
                      value={form.opening_stock}
                      onChange={handleChange}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Reorder Level</label>

                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    name="reorder_level"
                    value={form.reorder_level}
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
                  {editingId ? "Update Item" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Items;