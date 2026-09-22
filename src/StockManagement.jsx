import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  History,
  Minus,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "./supabase";
import "./StockManagement.css";

export default function StockManagement({ activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }) {
  const [branches, setBranches] = useState([]);
  const [items, setItems] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transferSourceStock, setTransferSourceStock] = useState({});
  const [branchId, setBranchId] = useState(activeBranchId || activeBranch?.id || "");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustType, setAdjustType] = useState("ADJUSTMENT_IN");
  const [adjustQty, setAdjustQty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferFromBranchId, setTransferFromBranchId] = useState("");
  const [transferToBranchId, setTransferToBranchId] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [transferCart, setTransferCart] = useState([]);
  const [transferNotes, setTransferNotes] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    const nextBranchId = activeBranchId || activeBranch?.id || "";

    if (!nextBranchId || nextBranchId === branchId) return;

    setBranchId(nextBranchId);
    setAdjustItem(null);
    setShowTransfer(false);
    setTransferFromBranchId("");
    setTransferToBranchId("");
    setTransferCart([]);
    setTransferSourceStock({});
    setTransferSearch("");
    setTransferNotes("");
  }, [activeBranchId, activeBranch?.id]);

  useEffect(() => {
    if (branchId) {
      loadBranchData(branchId);
    } else {
      setStockRows([]);
      setMovements([]);
    }
  }, [branchId]);

  async function loadBaseData() {
    setLoading(true);

    const [branchResult, itemResult] = await Promise.all([
      supabase
        .from("branches")
        .select("*")
        .eq("status", "ACTIVE")
        .order("branch_name", { ascending: true }),
      supabase
        .from("items")
        .select("*")
        .order("name", { ascending: true }),
    ]);

    if (branchResult.error) {
      alert(branchResult.error.message);
      setBranches(appBranches || []);
    } else {
      const data =
        appBranches?.length ? appBranches : branchResult.data || [];

      setBranches(data);

      const currentGlobalBranchId =
        activeBranchId || activeBranch?.id || "";

      if (currentGlobalBranchId) {
        setBranchId(currentGlobalBranchId);
      }
    }

    if (itemResult.error) {
      alert(itemResult.error.message);
    } else {
      setItems(itemResult.data || []);
    }

    setLoading(false);
  }

  async function loadBranchData(selectedBranchId) {
    setLoading(true);

    const [stockResult, movementResult] = await Promise.all([
      supabase
        .from("branch_stock")
        .select("*")
        .eq("branch_id", selectedBranchId),
      supabase
        .from("stock_movements")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (stockResult.error) {
      alert(stockResult.error.message);
    } else {
      setStockRows(stockResult.data || []);
    }

    if (movementResult.error) {
      alert(movementResult.error.message);
    } else {
      setMovements(movementResult.data || []);
    }

    setLoading(false);
  }

  const stockMap = useMemo(() => {
    const map = {};
    stockRows.forEach((row) => {
      map[row.item_id] = row;
    });
    return map;
  }, [stockRows]);

  const itemMap = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.sku, item.barcode, item.name, item.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [items, search]);

  const stats = useMemo(() => {
    let totalUnits = 0;
    let lowStock = 0;
    let outOfStock = 0;

    items.forEach((item) => {
      const row = stockMap[item.id];
      const qty = Number(row?.quantity || 0);
      const reorder = Number(row?.reorder_level ?? item.reorder_level ?? 0);
      totalUnits += qty;
      if (qty <= 0) outOfStock += 1;
      else if (reorder > 0 && qty <= reorder) lowStock += 1;
    });

    return { totalUnits, lowStock, outOfStock };
  }, [items, stockMap]);

  function openAdjustment(item, type) {
    setAdjustItem(item);
    setAdjustType(type);
    setAdjustQty("");
    setRemarks("");
  }

  function closeAdjustment() {
    if (saving) return;
    setAdjustItem(null);
  }

  async function saveAdjustment(e) {
    e.preventDefault();

    const quantity = Number(adjustQty);
    if (!branchId || !adjustItem) return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert("Enter a quantity greater than zero.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc("adjust_branch_stock", {
      p_branch_id: branchId,
      p_item_id: adjustItem.id,
      p_adjustment_type: adjustType,
      p_quantity: quantity,
      p_remarks: remarks.trim() || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setAdjustItem(null);
    await loadBranchData(branchId);
  }


  async function openTransferModal() {
    const defaultFrom = branchId || branches[0]?.id || "";
    const defaultTo =
      branches.find((branch) => branch.id !== defaultFrom)?.id || "";

    setTransferFromBranchId(defaultFrom);
    setTransferToBranchId(defaultTo);
    setTransferSearch("");
    setTransferCart([]);
    setTransferNotes("");
    setShowTransfer(true);

    if (defaultFrom) {
      await loadTransferSourceStock(defaultFrom);
    }
  }

  async function loadTransferSourceStock(sourceBranchId) {
    if (!sourceBranchId) {
      setTransferSourceStock({});
      return;
    }

    const { data, error } = await supabase
      .from("branch_stock")
      .select("item_id, quantity")
      .eq("branch_id", sourceBranchId);

    if (error) {
      alert(error.message);
      return;
    }

    const map = {};
    (data || []).forEach((row) => {
      map[row.item_id] = Number(row.quantity || 0);
    });
    setTransferSourceStock(map);
  }

  function addTransferItem(item) {
    const available = Number(transferSourceStock[item.id] || 0);

    if (available <= 0) {
      alert("This item has no stock in the source branch.");
      return;
    }

    setTransferCart((current) => {
      const existing = current.find((row) => row.item_id === item.id);

      if (existing) {
        if (existing.quantity >= available) {
          alert("Cannot transfer more than available source stock.");
          return current;
        }

        return current.map((row) =>
          row.item_id === item.id
            ? { ...row, quantity: row.quantity + 1 }
            : row
        );
      }

      return [
        ...current,
        {
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          quantity: 1,
          available,
        },
      ];
    });
  }

  function updateTransferQty(itemId, value) {
    const quantity = Number(value);
    const available = Number(transferSourceStock[itemId] || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTransferCart((current) =>
        current.filter((row) => row.item_id !== itemId)
      );
      return;
    }

    if (quantity > available) {
      alert("Cannot transfer more than available source stock.");
      return;
    }

    setTransferCart((current) =>
      current.map((row) =>
        row.item_id === itemId ? { ...row, quantity } : row
      )
    );
  }

  async function completeTransfer() {
    if (transferSaving) return;

    if (!transferFromBranchId || !transferToBranchId) {
      alert("Select both source and destination branches.");
      return;
    }

    if (transferFromBranchId === transferToBranchId) {
      alert("Source and destination branches must be different.");
      return;
    }

    if (transferCart.length === 0) {
      alert("Add at least one item to the transfer.");
      return;
    }

    setTransferSaving(true);

    const { data, error } = await supabase.rpc("transfer_branch_stock", {
      p_from_branch_id: transferFromBranchId,
      p_to_branch_id: transferToBranchId,
      p_notes: transferNotes.trim() || null,
      p_items: transferCart.map((row) => ({
        item_id: row.item_id,
        quantity: Number(row.quantity),
      })),
    });

    setTransferSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const result = Array.isArray(data) && data.length ? data[0] : null;

    alert(
      result?.transfer_number
        ? `Transfer completed successfully.\n${result.transfer_number}`
        : "Transfer completed successfully."
    );

    setShowTransfer(false);
    setTransferCart([]);
    await loadBranchData(branchId);
  }

  const transferFilteredItems = items.filter((item) => {
    const term = transferSearch.trim().toLowerCase();
    if (!term) return true;

    return [item.sku, item.barcode, item.name, item.category]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const selectedBranch = branches.find((b) => b.id === branchId);

  return (
    <div className="stock-page">
      <div className="stock-header">
        <div>
          <h1>Stock Management</h1>
          <p>Manage branch inventory, adjustments and movement history.</p>
        </div>

        <div className="stock-header-actions">
          <button
            className="stock-secondary-btn"
            onClick={() => setShowHistory((value) => !value)}
          >
            <History size={17} />
            {showHistory ? "Hide History" : "Movement History"}
          </button>

          <button
            className="stock-secondary-btn"
            onClick={() => branchId && loadBranchData(branchId)}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </div>

      <div className="stock-toolbar">
        <div className="stock-field">
          <label>Branch</label>
          <select
            value={branchId}
            onChange={(e) => {
              const nextBranchId = e.target.value;

              if (!nextBranchId || nextBranchId === branchId) {
                return;
              }

              if (adjustItem || showTransfer) {
                const confirmed = window.confirm(
                  "Switching branch will close the current stock operation after the destination branch password is accepted. Continue?"
                );

                if (!confirmed) {
                  return;
                }
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

        <div className="stock-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, SKU, barcode or category..."
          />
        </div>
      </div>

      <div className="stock-stats">
        <div className="stock-stat-card">
          <Boxes size={22} />
          <div>
            <span>Total Units</span>
            <strong>{stats.totalUnits.toLocaleString("en-LK")}</strong>
          </div>
        </div>

        <div className="stock-stat-card">
          <Minus size={22} />
          <div>
            <span>Low Stock Items</span>
            <strong>{stats.lowStock}</strong>
          </div>
        </div>

        <div className="stock-stat-card">
          <X size={22} />
          <div>
            <span>Out of Stock</span>
            <strong>{stats.outOfStock}</strong>
          </div>
        </div>
      </div>

      <div className="stock-card">
        <div className="stock-card-title">
          <div>
            <h2>{selectedBranch?.branch_name || "Branch Stock"}</h2>
            <span>{filteredItems.length} items</span>
          </div>
        </div>

        <div className="stock-table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="number">Stock</th>
                <th className="number">Reorder Level</th>
                <th>Status</th>
                <th>Adjustment</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredItems.length === 0 && (
                <tr>
                  <td colSpan="8" className="stock-empty">No items found.</td>
                </tr>
              )}

              {filteredItems.map((item) => {
                const row = stockMap[item.id];
                const quantity = Number(row?.quantity || 0);
                const reorder = Number(row?.reorder_level ?? item.reorder_level ?? 0);
                const status =
                  quantity <= 0
                    ? "OUT"
                    : reorder > 0 && quantity <= reorder
                    ? "LOW"
                    : "OK";

                return (
                  <tr key={item.id}>
                    <td><strong>{item.sku}</strong></td>
                    <td>{item.name}</td>
                    <td>{item.category || "-"}</td>
                    <td>{item.unit || "PCS"}</td>
                    <td className="number"><strong>{quantity}</strong></td>
                    <td className="number">{reorder}</td>
                    <td>
                      <span className={`stock-badge ${status.toLowerCase()}`}>
                        {status === "OUT" ? "Out of Stock" : status === "LOW" ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td>
                      <div className="stock-row-actions">
                        <button
                          className="stock-in-btn"
                          onClick={() => openAdjustment(item, "ADJUSTMENT_IN")}
                        >
                          <Plus size={15} /> In
                        </button>
                        <button
                          className="stock-out-btn"
                          onClick={() => openAdjustment(item, "ADJUSTMENT_OUT")}
                        >
                          <Minus size={15} /> Out
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

      {showHistory && (
        <div className="stock-card">
          <div className="stock-card-title">
            <div>
              <h2>Stock Movement History</h2>
              <span>Latest 100 movements for the selected branch</span>
            </div>
          </div>

          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="number">Quantity</th>
                  <th>Reference</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 && (
                  <tr>
                    <td colSpan="6" className="stock-empty">No movements recorded yet.</td>
                  </tr>
                )}

                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      {new Date(movement.created_at).toLocaleString("en-LK")}
                    </td>
                    <td>
                      {itemMap[movement.item_id]?.name || movement.item_id}
                    </td>
                    <td>
                      <span className="movement-type">
                        {movement.movement_type.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="number">{Number(movement.quantity || 0)}</td>
                    <td>{movement.reference_type || "-"}</td>
                    <td>{movement.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjustItem && (
        <div className="stock-modal-backdrop" onMouseDown={closeAdjustment}>
          <div className="stock-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="stock-modal-header">
              <div>
                <h2>Stock Adjustment</h2>
                <p>{adjustItem.sku} - {adjustItem.name}</p>
              </div>
              <button onClick={closeAdjustment}><X size={20} /></button>
            </div>

            <form onSubmit={saveAdjustment}>
              <div className="stock-current-box">
                Current {selectedBranch?.branch_name} stock:
                <strong>{Number(stockMap[adjustItem.id]?.quantity || 0)}</strong>
              </div>

              <div className="stock-field">
                <label>Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                >
                  <option value="ADJUSTMENT_IN">Stock In / Increase</option>
                  <option value="ADJUSTMENT_OUT">Stock Out / Decrease</option>
                </select>
              </div>

              <div className="stock-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="stock-field">
                <label>Remarks</label>
                <textarea
                  rows="3"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Reason for adjustment..."
                />
              </div>

              <div className="stock-modal-actions">
                <button type="button" className="stock-secondary-btn" onClick={closeAdjustment}>
                  Cancel
                </button>
                <button type="submit" className="stock-primary-btn" disabled={saving}>
                  {adjustType === "ADJUSTMENT_IN" ? <Plus size={17} /> : <Minus size={17} />}
                  {saving ? "Saving..." : "Save Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        className="stock-transfer-preview"
        onClick={openTransferModal}
      >
        <ArrowLeftRight size={20} />
        <div>
          <strong>Branch Transfers</strong>
          <span>Move stock safely between active branches.</span>
        </div>
      </button>

      {showTransfer && (
        <div
          className="stock-modal-backdrop"
          onMouseDown={() => !transferSaving && setShowTransfer(false)}
        >
          <div
            className="stock-modal stock-transfer-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="stock-modal-header">
              <div>
                <h2>Branch Stock Transfer</h2>
                <p>Transfer inventory between branches.</p>
              </div>
              <button
                onClick={() => !transferSaving && setShowTransfer(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="stock-transfer-body">
              <div className="stock-transfer-branches">
                <div className="stock-field">
                  <label>From Branch</label>
                  <select
                    value={transferFromBranchId}
                    disabled
                  >
                    {branches
                      .filter((branch) => branch.id === branchId)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branch_code} - {branch.branch_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="stock-field">
                  <label>To Branch</label>
                  <select
                    value={transferToBranchId}
                    onChange={(e) => setTransferToBranchId(e.target.value)}
                  >
                    <option value="">Select Destination Branch</option>
                    {branches
                      .filter((branch) => branch.id !== transferFromBranchId)
                      .map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.branch_code} - {branch.branch_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="stock-search">
                <Search size={18} />
                <input
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  placeholder="Search item to transfer..."
                />
              </div>

              <div className="stock-transfer-items">
                {transferFilteredItems.slice(0, 12).map((item) => {
                  const available = Number(transferSourceStock[item.id] || 0);

                  return (
                    <button
                      type="button"
                      className="stock-transfer-item"
                      key={item.id}
                      onClick={() => addTransferItem(item)}
                      disabled={available <= 0}
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.sku}</span>
                      </div>
                      <span>Available: {available}</span>
                    </button>
                  );
                })}
              </div>

              <div className="stock-card transfer-cart-card">
                <div className="stock-card-title">
                  <div>
                    <h2>Transfer Items</h2>
                    <span>{transferCart.length} selected</span>
                  </div>
                </div>

                <div className="stock-table-wrap">
                  <table className="stock-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Item</th>
                        <th className="number">Available</th>
                        <th className="number">Transfer Qty</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferCart.length === 0 && (
                        <tr>
                          <td colSpan="5" className="stock-empty">
                            Select items above.
                          </td>
                        </tr>
                      )}

                      {transferCart.map((row) => (
                        <tr key={row.item_id}>
                          <td>{row.sku}</td>
                          <td>{row.name}</td>
                          <td className="number">
                            {Number(transferSourceStock[row.item_id] || 0)}
                          </td>
                          <td className="number">
                            <input
                              className="transfer-qty-input"
                              type="number"
                              min="0.001"
                              step="0.001"
                              max={Number(
                                transferSourceStock[row.item_id] || 0
                              )}
                              value={row.quantity}
                              onChange={(e) =>
                                updateTransferQty(
                                  row.item_id,
                                  e.target.value
                                )
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="stock-out-btn"
                              type="button"
                              onClick={() =>
                                setTransferCart((current) =>
                                  current.filter(
                                    (item) =>
                                      item.item_id !== row.item_id
                                  )
                                )
                              }
                            >
                              <X size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="stock-field">
                <label>Transfer Notes</label>
                <textarea
                  rows="3"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Optional transfer remarks..."
                />
              </div>

              <div className="stock-modal-actions">
                <button
                  type="button"
                  className="stock-secondary-btn"
                  onClick={() => !transferSaving && setShowTransfer(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="stock-primary-btn"
                  onClick={completeTransfer}
                  disabled={transferSaving}
                >
                  <ArrowLeftRight size={17} />
                  {transferSaving ? "Transferring..." : "Complete Transfer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
