import { useEffect, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { supabase } from "./supabase";

export default function PublicQuote({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadQuote() {
      const { data: result, error: rpcError } = await supabase.rpc(
        "get_public_quote",
        { p_share_token: token }
      );

      if (!active) return;

      if (rpcError) {
        console.error(rpcError);
        setError("Unable to load this quotation.");
      } else if (!result?.quote) {
        setError("Quotation not found or link is invalid.");
      } else {
        setData(result);
      }

      setLoading(false);
    }

    loadQuote();
    return () => { active = false; };
  }, [token]);

  const money = (value) =>
    Number(value || 0).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const date = (value) =>
    value ? new Date(value).toLocaleDateString("en-LK") : "-";

  if (loading || error || !data) {
    return (
      <div style={page}>
        <div style={message}>
          <FileText size={34} />
          <strong>{loading ? "Loading quotation..." : error}</strong>
        </div>
      </div>
    );
  }

  const { quote, branch, settings, items = [] } = data;
  const currency = settings?.currency_symbol || "Rs.";

  return (
    <div style={page}>
      <div style={card}>
        <div className="public-no-print" style={toolbar}>
          <div>
            <strong>{quote.quote_number}</strong>
            <span style={{ display: "block", color: "#64748b", fontSize: 12 }}>
              Customer quotation
            </span>
          </div>
          <button onClick={() => window.print()} style={button}>
            <Printer size={17} /> Print / Save PDF
          </button>
        </div>

        <div style={header}>
          <div>
            {settings?.receipt_show_business_name !== false && (
              <h1 style={{ margin: "0 0 5px", fontSize: 25 }}>
                {settings?.company_name || branch?.branch_name || "Quotation"}
              </h1>
            )}
            {settings?.receipt_show_branch_name !== false && branch?.branch_name && (
              <p style={p}><strong>{branch.branch_name}</strong></p>
            )}
            {settings?.receipt_show_branch_address !== false && branch?.address && (
              <p style={p}>{branch.address}</p>
            )}
            {settings?.receipt_show_branch_phone !== false && branch?.phone && (
              <p style={p}>{branch.phone}</p>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0 }}>
              {quote.quote_type === "VAT" ? "VAT QUOTATION" : "QUOTATION"}
            </h2>
            <strong>{quote.quote_number}</strong>
          </div>
        </div>

        <div style={info}>
          <Info label="Quote Date" value={date(quote.quote_date)} />
          <Info label="Valid Until" value={date(quote.valid_until)} />
          <Info label="Customer" value={quote.customer_name || "Walk-in Customer"} />
          <Info label="Status" value={quote.status} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Item</th>
                <th style={th}>Qty</th>
                <th style={th}>Price</th>
                <th style={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={td}>
                    <strong>{item.item_name}</strong>
                    {item.sku && <small style={{ display:"block", color:"#64748b" }}>{item.sku}</small>}
                  </td>
                  <td style={{...td,textAlign:"right"}}>{item.quantity}</td>
                  <td style={{...td,textAlign:"right"}}>{currency} {money(item.unit_price)}</td>
                  <td style={{...td,textAlign:"right",fontWeight:800}}>{currency} {money(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={summary}>
          <Row label="Subtotal" value={`${currency} ${money(quote.subtotal)}`} />
          {Number(quote.discount || 0) > 0 && <Row label="Discount" value={`${currency} ${money(quote.discount)}`} />}
          {quote.quote_type === "VAT" && <Row label="VAT" value={`${currency} ${money(quote.vat_amount)}`} />}
          <Row label="Total" value={`${currency} ${money(quote.total)}`} big />
        </div>

        {quote.notes && (
          <div style={{ marginTop:20, padding:12, background:"#f8fafc", borderRadius:8 }}>
            <strong style={{fontSize:11}}>Notes</strong>
            <p style={{margin:"5px 0 0",fontSize:11}}>{quote.notes}</p>
          </div>
        )}

        <div style={footer}>
          {settings?.receipt_footer || "Thank you for your business."}
        </div>
      </div>

      <style>{`@media print {
        @page { size:A4; margin:10mm; }
        body { background:#fff !important; }
        .public-no-print { display:none !important; }
      }`}</style>
    </div>
  );
}

function Info({label,value}) {
  return <div style={infoBox}><span style={labelStyle}>{label}</span><strong style={{fontSize:11,marginTop:4}}>{value}</strong></div>;
}
function Row({label,value,big=false}) {
  return <div style={row}><span>{label}</span><strong style={{fontSize:big?14:11}}>{value}</strong></div>;
}

const page={minHeight:"100vh",background:"#f1f5f9",padding:"24px 12px",fontFamily:"Inter,Arial,sans-serif",color:"#0f172a"};
const card={width:"min(860px,100%)",margin:"0 auto",background:"#fff",borderRadius:14,boxShadow:"0 18px 45px rgba(15,23,42,.10)",padding:28,boxSizing:"border-box"};
const toolbar={display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,paddingBottom:15,marginBottom:20,borderBottom:"1px solid #e2e8f0"};
const button={border:0,borderRadius:9,padding:"10px 13px",background:"#0f172a",color:"#fff",fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7};
const header={display:"flex",justifyContent:"space-between",gap:30,paddingBottom:18,marginBottom:16,borderBottom:"2px solid #0f172a"};
const p={margin:"2px 0",color:"#475569",fontSize:11};
const info={display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:18};
const infoBox={border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 11px",display:"flex",flexDirection:"column"};
const labelStyle={fontSize:9,fontWeight:800,color:"#94a3b8",textTransform:"uppercase"};
const table={width:"100%",borderCollapse:"collapse"};
const th={padding:9,background:"#f8fafc",borderBottom:"1px solid #cbd5e1",textAlign:"left",fontSize:9,textTransform:"uppercase",color:"#64748b"};
const td={padding:9,borderBottom:"1px solid #eef2f7",fontSize:10};
const summary={width:"min(330px,100%)",marginLeft:"auto",marginTop:18};
const row={display:"flex",justifyContent:"space-between",gap:20,padding:"8px 0",borderBottom:"1px solid #eef2f7",fontSize:11};
const footer={textAlign:"center",color:"#94a3b8",fontSize:10,borderTop:"1px solid #e2e8f0",marginTop:22,paddingTop:12};
const message={width:"min(440px,100%)",margin:"60px auto",background:"#fff",borderRadius:14,padding:28,textAlign:"center"};
