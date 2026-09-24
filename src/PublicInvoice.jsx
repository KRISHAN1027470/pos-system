import { useEffect, useState } from "react";
import { Printer, ReceiptText } from "lucide-react";
import { supabase } from "./supabase";

export default function PublicInvoice({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cashierName, setCashierName] = useState("-");
  const [documentPrintSettings, setDocumentPrintSettings] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadInvoice() {
      setLoading(true);
      setError("");

      // First try the public-share RPC. New POS invoices may reach this page
      // using a public_share_token.
      let result = null;

      const { data: publicResult, error: rpcError } = await supabase.rpc(
        "get_public_invoice",
        { p_share_token: token }
      );

      if (!active) return;

      if (!rpcError && publicResult?.invoice) {
        result = publicResult;
      }

      // Reprints from Invoices.jsx use the invoice UUID in /invoice/:id.
      // If the value was not a public share token, load the authenticated
      // company's invoice directly and build the same data shape used below.
      if (!result?.invoice) {
        const { data: invoiceRow, error: invoiceError } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", token)
          .maybeSingle();

        if (invoiceError) {
          console.error("Invoice reprint load error:", invoiceError);
        }

        if (invoiceRow) {
          const [
            { data: itemRows, error: itemsError },
            { data: branchRow, error: branchError },
            { data: settingsRow, error: settingsError },
          ] = await Promise.all([
            supabase
              .from("invoice_items")
              .select("*")
              .eq("invoice_id", invoiceRow.id)
              .order("id", { ascending: true }),
            invoiceRow.branch_id
              ? supabase
                  .from("branches")
                  .select("*")
                  .eq("id", invoiceRow.branch_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            invoiceRow.company_id
              ? supabase
                  .from("app_settings")
                  .select("*")
                  .eq("company_id", invoiceRow.company_id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ]);

          if (itemsError) console.warn("Invoice items load error:", itemsError);
          if (branchError) console.warn("Invoice branch load error:", branchError);
          if (settingsError) console.warn("Invoice settings load error:", settingsError);

          result = {
            invoice: invoiceRow,
            items: itemRows || [],
            branch: branchRow || null,
            settings: settingsRow || null,
          };
        }
      }

      if (!active) return;

      if (!result?.invoice) {
        if (rpcError) {
          console.error("Public invoice load error:", rpcError);
        }
        setError("Invoice not found or link is invalid.");
        setLoading(false);
        return;
      }

      // Resolve the customer details used by the Tax Invoice.
      // Prefer customer data returned by the public invoice RPC. When the current
      // session is authenticated, fall back to the customers table so direct
      // invoices immediately show the latest address and telephone number.
      let resolvedCustomer = result?.customer || result?.invoice?.customer || null;

      if (!resolvedCustomer && result?.invoice?.customer_id) {
        const { data: customerRow, error: customerError } = await supabase
          .from("customers")
          .select("id, name, address, phone, vat_number")
          .eq("id", result.invoice.customer_id)
          .maybeSingle();

        if (!customerError && customerRow) {
          resolvedCustomer = customerRow;
        } else if (customerError) {
          console.warn("Unable to resolve invoice customer:", customerError);
        }
      }

      setCustomerDetails(resolvedCustomer);
      setData(result);

      const invoiceDocumentType =
        String(result.invoice.invoice_type || "").toUpperCase() === "VAT"
          ? "TAX_INVOICE"
          : "NON_VAT_INVOICE";

      // Use the SAME company-scoped settings logic as Settings.jsx.
      // For an authenticated reprint, the logged-in user's company is the
      // authoritative company. Fall back to the invoice company for public links.
      let printSettingsCompanyId = result.invoice.company_id || null;

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user || null;

      if (authUser) {
        const { data: profileRow, error: profileError } = await supabase
          .from("user_profiles")
          .select("company_id")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileError) {
          console.warn("Unable to resolve reprint company:", profileError);
        } else if (profileRow?.company_id) {
          printSettingsCompanyId = profileRow.company_id;
        }
      }

      let printSettingsQuery = supabase
        .from("document_print_settings")
        .select("*")
        .eq("document_type", invoiceDocumentType);

      if (printSettingsCompanyId) {
        printSettingsQuery = printSettingsQuery.eq(
          "company_id",
          printSettingsCompanyId
        );
      }

      const { data: printRow, error: printError } =
        await printSettingsQuery.maybeSingle();

      if (printError) {
        console.warn("Invoice document print settings load error:", printError);
        setDocumentPrintSettings(null);
      } else {
        setDocumentPrintSettings(printRow || null);
      }

      // Cashier may already be included by get_public_invoice.
      const embeddedCashierName =
        result?.cashier?.name ||
        result?.invoice?.cashier_name ||
        result?.invoice?.cashier?.name ||
        "";

      if (embeddedCashierName) {
        setCashierName(embeddedCashierName);
      } else if (result?.invoice?.cashier_id) {
        const { data: cashierRow, error: cashierError } = await supabase
          .from("cashiers")
          .select("name")
          .eq("id", result.invoice.cashier_id)
          .maybeSingle();

        if (!cashierError && cashierRow?.name) {
          setCashierName(cashierRow.name);
        } else {
          console.warn("Unable to resolve invoice cashier:", cashierError);
          setCashierName("-");
        }
      } else {
        setCashierName("-");
      }

      setLoading(false);
    }

    loadInvoice();

    return () => {
      active = false;
    };
  }, [token]);

  function money(value) {
    return Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function date(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("en-LK");
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={messageCardStyle}>Loading invoice...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={pageStyle}>
        <div style={messageCardStyle}>
          <ReceiptText size={36} />
          <strong>{error || "Invoice unavailable."}</strong>
        </div>
      </div>
    );
  }

  const { invoice, branch, settings, items = [] } = data;
  const currency = settings?.currency_symbol || "Rs.";
  const companyName = settings?.company_name || branch?.branch_name || "Invoice";

  if (String(invoice.invoice_type || "").toUpperCase() === "VAT") {
    return (
      <TaxInvoiceLayout
        invoice={invoice}
        customer={customerDetails}
        branch={branch}
        settings={settings}
        items={items}
        cashierName={cashierName}
        currency={currency}
        money={money}
        printSettings={documentPrintSettings}
      />
    );
  }

  return (
    <div className="public-invoice-page" style={pageStyle}>
      <div className="public-invoice-card" style={invoiceCardStyle}>
        <div className="public-no-print" style={toolbarStyle}>
          <div>
            <strong>{invoice.invoice_number}</strong>
            <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>
              Customer copy
            </span>
          </div>

          <button onClick={() => window.print()} style={printButtonStyle}>
            <Printer size={17} />
            Print / Save PDF
          </button>
        </div>

        <div style={headerStyle}>
          <div>
            {documentPrintSettings?.show_logo !== false &&
              documentPrintSettings?.logo_url && (
              <img
                src={documentPrintSettings.logo_url}
                alt={`${companyName} logo`}
                style={{
                  maxWidth: 180,
                  maxHeight: 72,
                  objectFit: "contain",
                  display: "block",
                  marginBottom: 10,
                }}
              />
            )}

            {branch?.branch_name && (
              <h1 style={{ margin: "0 0 7px", fontSize: 30, fontWeight: 900 }}>
                {branch.branch_name}
              </h1>
            )}

            {settings?.receipt_show_branch_address !== false && branch?.address && (
              <p style={smallTextStyle}>{branch.address}</p>
            )}

            {settings?.receipt_show_branch_phone !== false && branch?.phone && (
              <p style={smallTextStyle}>Tel: {branch.phone}</p>
            )}

            {branch?.email && (
              <p style={smallTextStyle}>Email: {branch.email}</p>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              {invoice.invoice_type === "VAT" ? "VAT INVOICE" : "INVOICE"}
            </div>
            <div style={{ fontWeight: 800, marginTop: 5 }}>
              {invoice.invoice_number}
            </div>
            <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800 }}>
              {invoice.status}
            </div>
          </div>
        </div>

        <div style={infoGridStyle}>
          <Info label="Date" value={date(invoice.invoice_date)} />
          <Info
            label="Branch"
            value={
              branch
                ? `${branch.branch_code || ""}${branch.branch_code ? " - " : ""}${branch.branch_name || ""}`
                : "-"
            }
          />
          <Info label="Customer" value={invoice.customer_name || "Walk-in Customer"} />
          <Info label="Cashier" value={cashierName || "-"} />
          <Info label="Payment" value={invoice.payment_method || "Credit"} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Item</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    <strong>{item.item_name}</strong>
                    {item.sku && (
                      <span style={{ display: "block", color: "#64748b", fontSize: 15 }}>
                        {item.sku}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {currency} {money(item.unit_price)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>
                    {currency} {money(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={summaryWrapStyle}>
          <Summary label="Subtotal" value={`${currency} ${money(invoice.subtotal)}`} />
          {Number(invoice.discount || 0) > 0 && (
            <Summary label="Discount" value={`${currency} ${money(invoice.discount)}`} />
          )}
          {invoice.invoice_type === "VAT" && (
            <Summary label="VAT" value={`${currency} ${money(invoice.vat_amount)}`} />
          )}
          <Summary
            label="Invoice Total"
            value={`${currency} ${money(invoice.total)}`}
            strong
          />
          {String(invoice.payment_method || "").toUpperCase() === "CASH" && (
            <Summary
              label="Received Amount"
              value={`${currency} ${money(invoice.received_amount ?? invoice.paid_amount)}`}
            />
          )}
          <Summary label="Paid" value={`${currency} ${money(invoice.paid_amount)}`} />
          {String(invoice.payment_method || "").toUpperCase() === "CASH" &&
            Number(invoice.change_amount ?? invoice.balance ?? 0) > 0 && (
              <Summary
                label="Change"
                value={`${currency} ${money(invoice.change_amount ?? invoice.balance)}`}
              />
            )}
          <Summary label="Due" value={`${currency} ${money(invoice.due_amount)}`} />
        </div>

        {documentPrintSettings?.show_footer !== false &&
          String(documentPrintSettings?.footer_text || "").trim() && (
            <div
              style={{
                ...footerStyle,
                fontSize: Number(documentPrintSettings?.footer_font_size || 9),
                whiteSpace: "pre-wrap",
              }}
            >
              {documentPrintSettings.footer_text}
            </div>
          )}
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          html,
          body,
          #root {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          body * {
            visibility: visible !important;
          }

          .public-no-print {
            display: none !important;
          }

          .public-invoice-page {
            display: block !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          .public-invoice-card {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          img {
            max-width: 100% !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoBoxStyle}>
      <span style={{ fontSize: 15, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>
        {label}
      </span>
      <strong style={{ fontSize: 15, marginTop: 4 }}>{value}</strong>
    </div>
  );
}

function Summary({ label, value, strong = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 20, padding: "8px 0", borderBottom: "1px solid #eef2f7" }}>
      <span style={{ color: "#64748b", fontSize: 17 }}>{label}</span>
      <strong style={{ fontSize: strong ? 17 : 15 }}>{value}</strong>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f1f5f9",
  padding: "24px 12px",
  fontFamily: "Inter, Arial, sans-serif",
  color: "#0f172a",
};

const invoiceCardStyle = {
  width: "min(860px, 100%)",
  margin: "0 auto",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 18px 45px rgba(15,23,42,.10)",
  padding: 28,
  boxSizing: "border-box",
};

const toolbarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 15,
  marginBottom: 20,
  borderBottom: "1px solid #e2e8f0",
};

const printButtonStyle = {
  border: 0,
  borderRadius: 9,
  padding: "10px 13px",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 30,
  paddingBottom: 18,
  marginBottom: 16,
  borderBottom: "2px solid #0f172a",
};

const smallTextStyle = {
  margin: "2px 0",
  color: "#475569",
  fontSize: 20,
};

const infoGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginBottom: 18,
};

const infoBoxStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "9px 11px",
  display: "flex",
  flexDirection: "column",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 4,
};

const thStyle = {
  padding: 9,
  background: "#f8fafc",
  borderBottom: "1px solid #cbd5e1",
  textAlign: "left",
  fontSize: 15,
  textTransform: "uppercase",
  color: "#64748b",
};

const tdStyle = {
  padding: 9,
  borderBottom: "1px solid #eef2f7",
  fontSize: 15,
};

const summaryWrapStyle = {
  width: "min(330px, 100%)",
  marginLeft: "auto",
  marginTop: 18,
};

const footerStyle = {
  textAlign: "center",
  color: "#94a3b8",
  fontSize: 15,
  borderTop: "1px solid #e2e8f0",
  marginTop: 22,
  paddingTop: 12,
};

const messageCardStyle = {
  width: "min(440px, 100%)",
  margin: "60px auto",
  background: "#fff",
  borderRadius: 14,
  padding: 28,
  boxShadow: "0 18px 45px rgba(15,23,42,.10)",
  textAlign: "center",
};



function printTaxInvoice() {
  // Print the invoice already rendered in the current page.
  // This avoids Chrome's blank about:blank print-preview issue.
  window.print();
}

function TaxInvoiceLayout({ invoice, customer: customerProp, branch, settings, items, cashierName, currency, money, printSettings }) {
  const customer = customerProp || invoice.customer || {};
  const supplierTin = branch?.vat_number || settings?.company_vat_number || settings?.vat_number || settings?.tin || settings?.tin_number || "-";
  const purchaserTin = invoice.customer_vat_number || invoice.customer_tin || customer.vat_number || customer.tin || "-";
  const supplierName = branch?.branch_name || settings?.company_name || "Lanka Electrics";
  const supplierAddress = branch?.address || settings?.company_address || "-";
  const supplierPhone = branch?.phone || settings?.company_phone || "-";
  const purchaserName = invoice.customer_name || customer.name || "Walk-in Customer";
  const purchaserAddress = invoice.customer_address || customer.address || "-";
  const purchaserPhone = invoice.customer_phone || customer.phone || "-";
  const invoiceDate = invoice.invoice_date || invoice.created_at;
  const vatRate = items.find((x) => Number(x.vat_rate || 0) > 0)?.vat_rate || 18;
  const total = Number(invoice.total || 0);
  const vat = Number(invoice.vat_amount || 0);
  const supply = Number(invoice.taxable_amount ?? (total - vat));
  const ps = printSettings || {};
  const logoUrl = ps.logo_url || "";
  const css = buildTaxDocumentCss(ps);

  return (
    <div className="tax-doc-page">
      <div className="tax-doc-toolbar public-no-print">
        <strong>{invoice.invoice_number}</strong>
        <button onClick={printTaxInvoice} style={printButtonStyle}><Printer size={17}/>Print / Save PDF</button>
      </div>
      <div className="tax-doc-sheet">
        <div className="tax-logo-row">
          {ps.show_logo !== false && logoUrl && (
            <img src={logoUrl} alt="Logo" className="tax-logo"/>
          )}
        </div>
        <div className="tax-title">Tax Invoice</div>
        <div className="tax-party-grid">
          <div className="tax-cell"><b>Date of Invoice:</b> {formatTaxDate(invoiceDate)}</div>
          <div className="tax-cell"><b>Tax Invoice No.:</b> {invoice.invoice_number}</div>
          <div className="tax-cell tax-party">
            {ps.show_tin !== false && <div><b>Supplier's TIN:</b> {supplierTin}</div>}<div><b>Supplier's Name:</b> {supplierName}</div>
            {ps.show_address !== false && <div><b>Address:</b> {supplierAddress}</div>}{ps.show_telephone !== false && <div><b>Telephone No:</b> {supplierPhone}</div>}
          </div>
          <div className="tax-cell tax-party">
            {ps.show_tin !== false && <div><b>Purchaser's TIN:</b> {purchaserTin}</div>}<div><b>Purchaser's Name:</b> {purchaserName}</div>
            {ps.show_address !== false && <div><b>Address:</b> {purchaserAddress}</div>}{ps.show_telephone !== false && <div><b>Telephone No:</b> {purchaserPhone}</div>}
          </div>
          <div className="tax-cell"><b>Date of Delivery:</b> {formatTaxDate(invoiceDate)}</div>
          <div className="tax-cell"><b>Place of Supply:</b> {ps.show_branch !== false ? (branch?.branch_name || branch?.address || "-") : "-"}</div>
        </div>
        <table className="tax-items-table">
          <thead><tr><th>Reference</th><th>Description of Goods or Services</th><th>Quantity</th><th>Unit Price</th><th>Amount<br/>Excluding VAT<br/>({currency})</th></tr></thead>
          <tbody>
            {items.map((item,index)=>{
              const qty=Number(item.quantity||0); const unit=Number(item.unit_price||0); const discount=Number(item.discount||0);
              const excluding=Math.max(qty*unit-discount,0);
              return <tr key={item.id || index}><td>{String(index+1).padStart(2,"0")}</td><td>{item.item_name}{item.sku ? <small>{item.sku}</small>:null}</td><td className="center">{qty}</td><td className="right">{currency} {money(unit)}</td><td className="right">{currency} {money(excluding)}</td></tr>
            })}
            <tr className="tax-total-row"><td colSpan="4">Total Value of Supply:</td><td className="right">{currency} {money(supply)}</td></tr>
            <tr className="tax-total-row"><td colSpan="4">VAT Amount (Total Value of Supply @ {vatRate}%):</td><td className="right">{currency} {money(vat)}</td></tr>
            <tr className="tax-total-row strong"><td colSpan="4">Total Amount including VAT:</td><td className="right">{currency} {money(total)}</td></tr>
          </tbody>
        </table>
        {(ps.show_cashier !== false || ps.show_payment_method !== false || (ps.show_notes !== false && invoice.notes)) && (
          <div className="tax-doc-meta">
            {ps.show_cashier !== false && <div><b>Cashier:</b> {cashierName || "-"}</div>}
            {ps.show_payment_method !== false && <div><b>Payment Method:</b> {invoice.payment_method || "Credit"}</div>}
            {ps.show_notes !== false && invoice.notes && <div><b>Notes:</b> {invoice.notes}</div>}
          </div>
        )}
        {ps.show_footer !== false &&
          String(ps.footer_text || "").trim() && (
            <div className="tax-doc-footer" style={{ whiteSpace: "pre-wrap" }}>
              {ps.footer_text}
            </div>
          )}
      </div>
      <style>{css}</style>
    </div>
  );
}

function formatTaxDate(value){ if(!value) return "-"; return new Date(value).toLocaleDateString("en-GB"); }
function numberToWords(value){
  const n=Math.round(Number(value||0)); if(n===0)return "Zero";
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const under1000=(x)=>{let a=[]; if(x>=100){a.push(ones[Math.floor(x/100)]+" Hundred");x%=100;} if(x>=20){a.push(tens[Math.floor(x/10)]);if(x%10)a.push(ones[x%10]);}else if(x>0)a.push(ones[x]);return a.join(" ");};
  let x=n,parts=[]; for(const [v,name] of [[10000000,"Crore"],[100000,"Lakh"],[1000,"Thousand"]]){if(x>=v){parts.push(under1000(Math.floor(x/v))+" "+name);x%=v;}} if(x)parts.push(under1000(x)); return parts.join(" ");
}

function buildTaxDocumentCss(ps = {}) {
  const n = (value, fallback) => {
    const x = Number(value);
    return Number.isFinite(x) && x >= 0 ? x : fallback;
  };

  const logoWidth = n(ps.logo_width, 120);
  const logoHeight = n(ps.logo_height, 60);
  const titleFont = n(ps.title_font_size, 21);
  const headerFont = n(ps.header_font_size, 15);
  const partyFont = n(ps.party_font_size, 15);
  const tableHeaderFont = n(ps.table_header_font_size, 11);
  const itemFont = n(ps.item_font_size, 11);
  const totalFont = n(ps.total_font_size, 11);
  const footerFont = n(ps.footer_font_size, 9);
  const policyFont = n(ps.policy_font_size, 8);
  const pageMargin = n(ps.page_margin_mm, 10);
  const documentPadding = n(ps.document_padding, 25);
  const titleWidth = Math.max(n(ps.title_width, 200), 180);
  const headerHeight = n(ps.header_height, 32);
  const partyHeight = n(ps.party_section_height, 105);
  const cellPadding = n(ps.table_cell_padding, 7);

  return `
.tax-doc-page{min-height:100vh;background:#f1f5f9;padding:20px;font-family:Arial,sans-serif;color:#000}
.tax-doc-toolbar{max-width:794px;margin:0 auto 12px;display:flex;justify-content:space-between;align-items:center}
.tax-doc-sheet{width:min(794px,100%);margin:auto;background:#fff;padding:28px ${documentPadding}px;box-sizing:border-box;position:relative}
.tax-logo-row{text-align:right;min-height:${Math.max(headerHeight, logoHeight)}px;padding-right:8px}
.tax-logo{width:auto;height:auto;max-width:${logoWidth}px;max-height:${logoHeight}px;object-fit:contain}
.tax-logo-text{display:inline-block;font-size:8px;font-weight:900;letter-spacing:2px;padding:1px 3px}
.tax-title{width:${titleWidth}px;box-sizing:border-box;margin:-2px auto 12px;border:2px solid #222;text-align:center;font-size:${titleFont}px;font-weight:800;padding:10px 6px;white-space:nowrap}
.tax-party-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #222;border-left:1px solid #222;font-size:${headerFont}px}
.tax-cell{border-right:1px solid #222;border-bottom:1px solid #222;padding:${cellPadding}px 11px;min-height:${headerHeight}px;font-size:${headerFont}px}
.tax-party{line-height:1.9;min-height:${partyHeight}px;padding-top:8px;font-size:${partyFont}px}
.tax-items-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:${itemFont}px}
.tax-items-table th,.tax-items-table td{border:1px solid #222;padding:${cellPadding}px 5px}
.tax-items-table th{text-align:center;background:#f3f3f3;font-weight:800;font-size:${tableHeaderFont}px}
.tax-items-table td{font-size:${itemFont}px}
.tax-items-table th:nth-child(1){width:12%}.tax-items-table th:nth-child(2){width:44%}.tax-items-table th:nth-child(3){width:12%}.tax-items-table th:nth-child(4){width:14%}.tax-items-table th:nth-child(5){width:18%}
.tax-items-table small{display:block;font-size:${Math.max(itemFont-2,8)}px;margin-top:2px}.center{text-align:center}.right{text-align:right}
.tax-total-row td{font-size:${totalFont}px}.tax-total-row td:first-child{text-align:right;font-weight:700}.tax-total-row.strong td{font-weight:900}
.tax-policy{border:1px solid #222;margin-top:10px;padding:9px;font-size:${policyFont}px;line-height:1.8}
.tax-doc-meta{margin-top:10px;border:1px solid #222;padding:8px 10px;font-size:${footerFont}px;line-height:1.7}
.tax-doc-footer{text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid #222;font-size:${footerFont}px}
@media print{
  @page{size:A4 portrait;margin:${pageMargin}mm}
  html,body,#root{margin:0!important;padding:0!important;width:100%!important;min-width:0!important;min-height:0!important;height:auto!important;overflow:visible!important;background:#fff!important}
  body *{visibility:hidden!important}
  .tax-doc-page,.tax-doc-page *{visibility:visible!important}
  .public-no-print{display:none!important;visibility:hidden!important}
  .tax-doc-page{position:absolute!important;left:0!important;top:0!important;width:100%!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
  .tax-doc-sheet{display:block!important;position:static!important;width:100%!important;max-width:none!important;min-height:0!important;height:auto!important;margin:0!important;padding:0 ${documentPadding}px!important;background:#fff!important;box-shadow:none!important;overflow:visible!important}
  .tax-items-table{page-break-inside:auto!important}
  .tax-items-table tr{page-break-inside:avoid!important;page-break-after:auto!important}
  img{print-color-adjust:exact;-webkit-print-color-adjust:exact}
}
`;
}
