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
  customer_code: "",
  customer_type: "NON_VAT",
  name: "",
  vat_number: "",
  phone: "",
  email: "",
  address: "",
  credit_limit: "",
};

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load customers error:", error);
      alert(error.message);
    } else {
      setCustomers(data || []);
    }

    setLoading(false);
  }

  function generateCustomerCode() {
    const nextNumber = customers.length + 1;

    return `CUS-${String(nextNumber).padStart(4, "0")}`;
  }

  function openNewCustomer() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      customer_code: generateCustomerCode(),
    });

    setShowForm(true);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Customer name is required.");
      return;
    }

    if (
      form.customer_type === "VAT" &&
      !form.vat_number.trim()
    ) {
      alert("VAT Registration Number is required.");
      return;
    }

    const payload = {
      customer_code: form.customer_code,
      customer_type: form.customer_type,
      name: form.name.trim(),
      vat_number:
        form.customer_type === "VAT"
          ? form.vat_number.trim()
          : null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      credit_limit: Number(form.credit_limit || 0),
    };

    if (editingId) {
      const { error } = await supabase.rpc("update_customer", {
        p_customer_id: editingId,
        p_customer_type: form.customer_type,
        p_name: form.name.trim(),
        p_vat_number:
          form.customer_type === "VAT" ? form.vat_number.trim() : "",
        p_phone: form.phone.trim(),
        p_email: form.email.trim(),
        p_address: form.address.trim(),
        p_credit_limit: Number(form.credit_limit || 0),
      });

      if (error) {
        console.error("Update customer RPC error:", error);
        alert(error.message);
        return;
      }

      alert("Customer updated successfully.");
    } else {
      const { error } = await supabase.rpc("create_customer", {
        p_customer_code: form.customer_code,
        p_customer_type: form.customer_type,
        p_name: form.name.trim(),
        p_vat_number:
          form.customer_type === "VAT" ? form.vat_number.trim() : "",
        p_phone: form.phone.trim(),
        p_email: form.email.trim(),
        p_address: form.address.trim(),
        p_credit_limit: Number(form.credit_limit || 0),
      });

      if (error) {
        console.error("Create customer RPC error:", error);
        alert(error.message);
        return;
      }

      alert("Customer saved successfully.");
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    fetchCustomers();
  }

  function editCustomer(customer) {
    setEditingId(customer.id);

    setForm({
      customer_code: customer.customer_code || "",
      customer_type: customer.customer_type || "NON_VAT",
      name: customer.name || "",
      vat_number: customer.vat_number || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      credit_limit: customer.credit_limit || "",
    });

    setShowForm(true);
  }

  async function deleteCustomer(id) {
    const customer = customers.find((row) => row.id === id);
    const customerName = customer?.name || "this customer";

    // IMPORTANT:
    // Never delete invoices, quotations, payments, or any other transaction
    // just to make a customer deletable. Historical records must be preserved.
    const [invoiceCheck, quoteCheck, paymentCheck] = await Promise.all([
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id),
      supabase
        .from("invoice_payments")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id),
    ]);

    const checkError =
      invoiceCheck.error ||
      quoteCheck.error ||
      paymentCheck.error;

    if (checkError) {
      console.error("Customer history check error:", checkError);
      alert(
        "Unable to check this customer's transaction history. Nothing was deleted."
      );
      return;
    }

    const invoiceCount = Number(invoiceCheck.count || 0);
    const quoteCount = Number(quoteCheck.count || 0);
    const paymentCount = Number(paymentCheck.count || 0);
    const hasHistory =
      invoiceCount > 0 ||
      quoteCount > 0 ||
      paymentCount > 0;

    if (hasHistory) {
      alert(
        `${customerName} cannot be permanently deleted because transaction history exists.\n\n` +
        `Invoices: ${invoiceCount}\n` +
        `Quotations: ${quoteCount}\n` +
        `Payments: ${paymentCount}\n\n` +
        "No invoices, quotations, payments, or other records were removed."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${customerName}?\n\n` +
      "This customer has no invoice, quotation, or payment history. " +
      "Only the customer record will be deleted."
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc("delete_customer", {
      p_customer_id: id,
    });

    if (error) {
      console.error("Delete error:", error);

      // A database foreign-key constraint is the final safety net.
      if (
        String(error.code || "") === "23503" ||
        String(error.message || "").toLowerCase().includes("foreign key")
      ) {
        alert(
          `${customerName} is linked to existing system records and cannot be deleted.\n\n` +
          "No transaction records were removed."
        );
      } else {
        alert(error.message);
      }
      return;
    }

    alert(`${customerName} deleted successfully.`);
    fetchCustomers();
  }

  const filteredCustomers = customers.filter((customer) => {
    const text = search.toLowerCase();

    return (
      (customer.name || "").toLowerCase().includes(text) ||
      (customer.customer_code || "")
        .toLowerCase()
        .includes(text) ||
      (customer.phone || "").toLowerCase().includes(text) ||
      (customer.vat_number || "")
        .toLowerCase()
        .includes(text)
    );
  });

  const vatCustomers = customers.filter(
    (customer) => customer.customer_type === "VAT"
  ).length;

  const nonVatCustomers = customers.filter(
    (customer) => customer.customer_type === "NON_VAT"
  ).length;

  return (
    <div className="customers-page">
      <div className="customer-heading">
        <div>
          <h2>Customers</h2>
          <p>Manage VAT and non-VAT customers.</p>
        </div>

        <button
          className="primary-btn"
          onClick={openNewCustomer}
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className="customer-stat-grid">
        <div className="customer-stat">
          <div>
            <span>Total Customers</span>
            <strong>{customers.length}</strong>
          </div>

          <Users size={25} />
        </div>

        <div className="customer-stat">
          <div>
            <span>VAT Customers</span>
            <strong>{vatCustomers}</strong>
          </div>

          <Users size={25} />
        </div>

        <div className="customer-stat">
          <div>
            <span>Non-VAT Customers</span>
            <strong>{nonVatCustomers}</strong>
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
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Customer</th>
                <th>Type</th>
                <th>VAT No.</th>
                <th>Phone</th>
                <th>Credit Limit</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7">
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>
                        {customer.customer_code}
                      </strong>
                    </td>

                    <td>{customer.name}</td>

                    <td>
                      {customer.customer_type === "VAT"
                        ? "VAT"
                        : "Non-VAT"}
                    </td>

                    <td>
                      {customer.vat_number || "-"}
                    </td>

                    <td>{customer.phone || "-"}</td>

                    <td>
                      Rs.{" "}
                      {Number(
                        customer.credit_limit || 0
                      ).toLocaleString("en-LK", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button
                          className="icon-btn"
                          onClick={() =>
                            editCustomer(customer)
                          }
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          className="icon-btn delete"
                          onClick={() =>
                            deleteCustomer(customer.id)
                          }
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
                <h3>
                  {editingId
                    ? "Edit Customer"
                    : "Add Customer"}
                </h3>
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
                  <label>Customer Code</label>

                  <input
                    type="text"
                    name="customer_code"
                    value={form.customer_code}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Customer Type *</label>

                  <select
                    name="customer_type"
                    value={form.customer_type}
                    onChange={handleChange}
                  >
                    <option value="NON_VAT">
                      Non-VAT Customer
                    </option>

                    <option value="VAT">
                      VAT Customer
                    </option>
                  </select>
                </div>

                <div className="form-group full">
                  <label>
                    Customer / Company Name *
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>

                {form.customer_type === "VAT" && (
                  <div className="form-group full">
                    <label>
                      VAT Registration Number *
                    </label>

                    <input
                      type="text"
                      name="vat_number"
                      value={form.vat_number}
                      onChange={handleChange}
                    />
                  </div>
                )}

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

                <div className="form-group full">
                  <label>Address</label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Credit Limit (Rs.)</label>

                  <input
                    type="number"
                    name="credit_limit"
                    min="0"
                    step="0.01"
                    value={form.credit_limit}
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

                <button
                  type="submit"
                  className="primary-btn"
                >
                  {editingId
                    ? "Update Customer"
                    : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;