import { useEffect, useState } from "react";
import {
  ReceiptText,
  RefreshCw,
  Image as ImageIcon,
  Upload,
  Trash2,
  Save,
} from "lucide-react";
import { supabase } from "./supabase";
import "./Settings.css";

const documentTypes = [
  ["TAX_INVOICE", "Tax Invoice"],
  ["NON_VAT_INVOICE", "Non-VAT Invoice"],
  ["TAX_QUOTATION", "Tax Quotation"],
  ["NON_VAT_QUOTATION", "Non-VAT Quotation"],
];

const documentNumberFields = [
  ["logo_width", "Logo Width (px)"],
  ["logo_height", "Logo Height (px)"],
  ["title_font_size", "Title Font Size (px)"],
  ["header_font_size", "Header Font Size (px)"],
  ["party_font_size", "Supplier / Customer Font (px)"],
  ["table_header_font_size", "Table Header Font (px)"],
  ["item_font_size", "Item Font Size (px)"],
  ["total_font_size", "Totals Font Size (px)"],
  ["footer_font_size", "Footer Font Size (px)"],
  ["policy_font_size", "Policy Font Size (px)"],
  ["page_margin_mm", "Page Margin (mm)"],
  ["document_padding", "Document Padding (px)"],
  ["title_width", "Title Width (px)"],
  ["header_height", "Header Height (px)"],
  ["party_section_height", "Supplier / Customer Section Height (px)"],
  ["table_cell_padding", "Table Cell Padding (px)"],
];

const documentBooleanFields = [
  ["show_logo", "Show Logo"],
  ["show_footer", "Show Footer"],
  ["show_return_policy", "Show Return Policy"],
  ["show_address", "Show Address"],
  ["show_telephone", "Show Telephone"],
  ["show_tin", "Show TIN / VAT Number"],
  ["show_cashier", "Show Cashier"],
  ["show_branch", "Show Branch"],
  ["show_payment_method", "Show Payment Method"],
  ["show_notes", "Show Notes"],
];

export default function Settings() {
  const [documentSettings, setDocumentSettings] = useState([]);
  const [selectedDocumentType, setSelectedDocumentType] =
    useState("TAX_INVOICE");
  const [loading, setLoading] = useState(true);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentLogoFile, setDocumentLogoFile] = useState(null);
  const [documentLogoPreview, setDocumentLogoPreview] = useState("");
  const [posName, setPosName] = useState("");
  const [companyId, setCompanyId] = useState(null);
  const [posNameSaving, setPosNameSaving] = useState(false);
  const [appSettingsId, setAppSettingsId] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You are not signed in.");

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles").select("company_id").eq("id", user.id).single();
      if (profileError) throw profileError;
      if (!profile?.company_id) throw new Error("Your account is not linked to a company.");

      const currentCompanyId = profile.company_id;
      setCompanyId(currentCompanyId);

      const [documentResult, appResult] = await Promise.all([
        supabase.from("document_print_settings").select("*")
          .eq("company_id", currentCompanyId).order("document_type"),
        supabase.from("app_settings").select("id, company_id, company_name")
          .eq("company_id", currentCompanyId).maybeSingle(),
      ]);

      if (appResult.error) throw appResult.error;
      if (appResult.data) {
        setAppSettingsId(appResult.data.id);
        setPosName(appResult.data.company_name || "");
      } else {
        setAppSettingsId(null);
        setPosName("");
      }

      if (documentResult.error) throw documentResult.error;
      const rows = documentResult.data || [];
      setDocumentSettings(rows);

      const selected =
        rows.find((row) => row.document_type === selectedDocumentType) || rows[0];
      if (selected && selected.document_type !== selectedDocumentType) {
        setSelectedDocumentType(selected.document_type);
      }
      setDocumentLogoPreview(selected?.logo_url || "");
      setDocumentLogoFile(null);
    } catch (error) {
      console.error("Settings load error:", error);
      setDocumentSettings([]);
      setAppSettingsId(null);
      setPosName("");
      alert(error?.message || "Unable to load company settings.");
    } finally {
      setLoading(false);
    }
  }

  const selectedDocumentSetting =
    documentSettings.find(
      (row) => row.document_type === selectedDocumentType
    ) || null;

  function selectDocumentType(type) {
    setSelectedDocumentType(type);
    const row = documentSettings.find((item) => item.document_type === type);
    setDocumentLogoPreview(row?.logo_url || "");
    setDocumentLogoFile(null);
  }

  function updateDocumentField(name, value) {
    setDocumentSettings((prev) =>
      prev.map((row) =>
        row.document_type === selectedDocumentType
          ? { ...row, [name]: value }
          : row
      )
    );
  }

  function handleDocumentLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please choose a PNG, JPG, WEBP or SVG logo.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Logo file must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    setDocumentLogoFile(file);
    setDocumentLogoPreview(URL.createObjectURL(file));
  }

  function removeDocumentLogo() {
    setDocumentLogoFile(null);
    setDocumentLogoPreview("");
    updateDocumentField("logo_url", "");
  }

  async function uploadLogo(file) {
    const extension =
      file.name.split(".").pop()?.toLowerCase() ||
      (file.type === "image/png" ? "png" : "jpg");

    const path = `logos/${companyId || "unknown"}/document-${selectedDocumentType.toLowerCase()}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("company-assets")
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error("Unable to create logo URL.");
    }

    return data.publicUrl;
  }

  async function savePosName() {
    const nextName = String(posName || "").trim();

    if (!nextName) {
      alert("POS / Sidebar Name is required.");
      return;
    }

    if (!appSettingsId) {
      alert("App settings record was not found.");
      return;
    }

    setPosNameSaving(true);

    try {
      const { data, error } = await supabase
        .from("app_settings")
        .update({ company_name: nextName })
        .eq("id", appSettingsId)
        .eq("company_id", companyId)
        .select("id, company_id, company_name");

      if (error) throw error;

      const saved = data?.[0];
      if (!saved) {
        throw new Error(
          "POS name was not updated. Check user permission for app settings."
        );
      }

      setPosName(saved.company_name);

      window.dispatchEvent(
        new CustomEvent("app-settings-saved", {
          detail: { company_name: saved.company_name },
        })
      );

      alert("POS / Sidebar Name saved successfully.");
    } catch (error) {
      console.error("POS name save error:", error);
      alert(error?.message || "Unable to save POS / Sidebar Name.");
    } finally {
      setPosNameSaving(false);
    }
  }

  async function saveDocumentSettings() {
    if (!selectedDocumentSetting || documentSaving) return;

    setDocumentSaving(true);

    try {
      let logoUrl =
        String(selectedDocumentSetting.logo_url || "").trim() || null;

      if (documentLogoFile) {
        logoUrl = await uploadLogo(documentLogoFile);
      }

      const payload = {
        logo_url: logoUrl,
        logo_width: Number(selectedDocumentSetting.logo_width),
        logo_height: Number(selectedDocumentSetting.logo_height),
        title_font_size: Number(selectedDocumentSetting.title_font_size),
        header_font_size: Number(selectedDocumentSetting.header_font_size),
        party_font_size: Number(selectedDocumentSetting.party_font_size),
        table_header_font_size: Number(
          selectedDocumentSetting.table_header_font_size
        ),
        item_font_size: Number(selectedDocumentSetting.item_font_size),
        total_font_size: Number(selectedDocumentSetting.total_font_size),
        footer_font_size: Number(selectedDocumentSetting.footer_font_size),
        footer_text: String(selectedDocumentSetting.footer_text || "").trim(),
        policy_font_size: Number(selectedDocumentSetting.policy_font_size),
        page_margin_mm: Number(selectedDocumentSetting.page_margin_mm),
        document_padding: Number(selectedDocumentSetting.document_padding),
        title_width: Number(selectedDocumentSetting.title_width),
        header_height: Number(selectedDocumentSetting.header_height),
        party_section_height: Number(
          selectedDocumentSetting.party_section_height
        ),
        table_cell_padding: Number(
          selectedDocumentSetting.table_cell_padding
        ),
        show_logo: Boolean(selectedDocumentSetting.show_logo),
        show_footer: Boolean(selectedDocumentSetting.show_footer),
        show_return_policy: Boolean(
          selectedDocumentSetting.show_return_policy
        ),
        show_address: Boolean(selectedDocumentSetting.show_address),
        show_telephone: Boolean(selectedDocumentSetting.show_telephone),
        show_tin: Boolean(selectedDocumentSetting.show_tin),
        show_cashier: Boolean(selectedDocumentSetting.show_cashier),
        show_branch: Boolean(selectedDocumentSetting.show_branch),
        show_payment_method: Boolean(
          selectedDocumentSetting.show_payment_method
        ),
        show_notes: Boolean(selectedDocumentSetting.show_notes),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("document_print_settings")
        .update(payload)
        .eq("document_type", selectedDocumentType)
        .eq("company_id", companyId)
        .select("*");

      if (error) throw error;

      const saved = data?.[0];
      if (!saved) {
        throw new Error(
          "No document setting was updated. Check user permission for document print settings."
        );
      }

      setDocumentSettings((prev) =>
        prev.map((row) =>
          row.document_type === selectedDocumentType ? saved : row
        )
      );

      setDocumentLogoPreview(saved.logo_url || "");
      setDocumentLogoFile(null);

      window.dispatchEvent(
        new CustomEvent("document-print-settings-saved", {
          detail: saved,
        })
      );

      alert("Document print settings saved successfully.");
    } catch (error) {
      console.error("Document settings save error:", error);
      alert(error?.message || "Unable to save document print settings.");
    } finally {
      setDocumentSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1>Document / Print Settings</h1>
          <p>
            Manage invoice and quotation logos, font sizes, layout and visible
            information.
          </p>
        </div>

        <button
          className="settings-secondary-btn"
          onClick={loadSettings}
          disabled={loading}
        >
          <RefreshCw size={17} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="settings-form">
        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-icon">
              <ReceiptText size={20} />
            </div>
            <div>
              <h2>POS / Sidebar Name</h2>
              <p>Change the name displayed at the top of the POS sidebar for all users.</p>
            </div>
          </div>

          <div className="settings-grid">
            <Field label="POS / Sidebar Name" full>
              <input
                value={posName}
                maxLength={80}
                placeholder="Example: LE ELECTRICS"
                onChange={(e) => setPosName(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              className="settings-primary-btn"
              disabled={posNameSaving || loading}
              onClick={savePosName}
            >
              <Save size={17} />
              {posNameSaving ? "Saving POS Name..." : "Save POS Name"}
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <div className="settings-icon">
              <ReceiptText size={20} />
            </div>
            <div>
              <h2>Document / Print Settings</h2>
              <p>
                Each document type has its own logo, sizes and print options.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <Field label="Document Type" full>
              <select
                value={selectedDocumentType}
                onChange={(e) => selectDocumentType(e.target.value)}
              >
                {documentTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {selectedDocumentSetting ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: "18px",
                  marginBottom: "22px",
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    minHeight: "120px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "18px",
                    overflow: "hidden",
                  }}
                >
                  {documentLogoPreview ? (
                    <img
                      src={documentLogoPreview}
                      alt={`${selectedDocumentType} logo`}
                      style={{
                        maxWidth: `${selectedDocumentSetting.logo_width || 120}px`,
                        maxHeight: `${selectedDocumentSetting.logo_height || 60}px`,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: "13px",
                      }}
                    >
                      <ImageIcon size={34} />
                      <div style={{ marginTop: "7px" }}>
                        No document-specific logo
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <strong style={{ display: "block", marginBottom: "9px" }}>
                    Document Logo
                  </strong>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 14px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "9px",
                      cursor: "pointer",
                      background: "#fff",
                      fontWeight: 700,
                      fontSize: "13px",
                    }}
                  >
                    <Upload size={17} />
                    Select Logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleDocumentLogoChange}
                      style={{ display: "none" }}
                    />
                  </label>

                  {documentLogoPreview && (
                    <button
                      type="button"
                      onClick={removeDocumentLogo}
                      style={{
                        marginLeft: "8px",
                        padding: "10px 13px",
                        border: "1px solid #fecaca",
                        borderRadius: "9px",
                        background: "#fff",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      <Trash2
                        size={15}
                        style={{ verticalAlign: "middle" }}
                      />{" "}
                      Remove
                    </button>
                  )}

                  <p
                    style={{
                      marginTop: "10px",
                      color: "#64748b",
                      fontSize: "12px",
                    }}
                  >
                    PNG, JPG, WEBP or SVG. Maximum 2 MB.
                  </p>
                </div>
              </div>

              <div className="settings-grid">
                {documentNumberFields.map(([name, label]) => (
                  <Field key={name} label={label}>
                    <input
                      type="number"
                      min="0"
                      step={name === "page_margin_mm" ? "0.5" : "1"}
                      value={selectedDocumentSetting[name] ?? ""}
                      onChange={(e) =>
                        updateDocumentField(name, e.target.value)
                      }
                    />
                  </Field>
                ))}
              </div>

              <div
                style={{
                  marginTop: "22px",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "18px",
                }}
              >
                <strong>Document Footer</strong>
                <p
                  style={{
                    margin: "6px 0 12px",
                    color: "#64748b",
                    fontSize: "12px",
                  }}
                >
                  Footer text is saved separately for the selected document type.
                </p>

                <Field label="Footer Text" full>
                  <textarea
                    rows="5"
                    value={selectedDocumentSetting.footer_text ?? ""}
                    placeholder="Example: Thank you for your business."
                    onChange={(e) =>
                      updateDocumentField("footer_text", e.target.value)
                    }
                    style={{
                      width: "100%",
                      resize: "vertical",
                      minHeight: "110px",
                      boxSizing: "border-box",
                    }}
                  />
                </Field>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "18px",
                }}
              >
                <strong>Visible Information</strong>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "10px 18px",
                    marginTop: "14px",
                  }}
                >
                  {documentBooleanFields.map(([name, label]) => (
                    <label
                      key={name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "9px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(selectedDocumentSetting[name])}
                        onChange={(e) =>
                          updateDocumentField(name, e.target.checked)
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: "22px" }}>
                <button
                  type="button"
                  className="settings-primary-btn"
                  disabled={documentSaving}
                  onClick={saveDocumentSettings}
                >
                  <Save size={17} />
                  {documentSaving
                    ? "Saving Document Settings..."
                    : "Save Document Settings"}
                </button>
              </div>
            </>
          ) : loading ? (
            <p>Loading document settings...</p>
          ) : (
            <p>No document print settings found.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children, full = false }) {
  return (
    <label className={`settings-field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
