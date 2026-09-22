import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Truck, X } from "lucide-react";
import { supabase } from "./supabase";
import "./Suppliers.css";

const EMPTY = { name:"", contact_person:"", phone:"", email:"", address:"", vat_number:"", credit_limit:"0", opening_balance:"0", status:"ACTIVE", notes:"" };
const money = (v) => `Rs. ${Number(v || 0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function Suppliers() {
  const [suppliers,setSuppliers]=useState([]);
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("ALL");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [open,setOpen]=useState(false);

  useEffect(()=>{ loadSuppliers(); },[]);

  async function loadSuppliers(){
    setLoading(true);
    const {data,error}=await supabase.from("suppliers").select("*").order("created_at",{ascending:false});
    setLoading(false);
    if(error){ alert(error.message); return; }
    setSuppliers(data||[]);
  }

  const rows=useMemo(()=>{
    const q=search.trim().toLowerCase();
    return suppliers.filter(s=>{
      if(status!=="ALL" && s.status!==status) return false;
      if(!q) return true;
      return [s.supplier_code,s.name,s.contact_person,s.phone,s.email,s.vat_number,s.address]
        .filter(Boolean).some(v=>String(v).toLowerCase().includes(q));
    });
  },[suppliers,search,status]);

  const active=suppliers.filter(s=>s.status==="ACTIVE").length;
  const opening=suppliers.reduce((a,s)=>a+Number(s.opening_balance||0),0);

  function add(){ setEditing(null); setForm(EMPTY); setOpen(true); }
  function edit(s){ setEditing(s); setForm({
    name:s.name||"", contact_person:s.contact_person||"", phone:s.phone||"", email:s.email||"",
    address:s.address||"", vat_number:s.vat_number||"", credit_limit:String(s.credit_limit??0),
    opening_balance:String(s.opening_balance??0), status:s.status||"ACTIVE", notes:s.notes||""
  }); setOpen(true); }
  function close(){ if(!saving){ setOpen(false); setEditing(null); } }
  const field=(k,v)=>setForm(f=>({...f,[k]:v}));

  async function save(e){
    e.preventDefault();
    if(!form.name.trim()){ alert("Supplier name is required."); return; }
    const credit=Number(form.credit_limit||0), openingBalance=Number(form.opening_balance||0);
    if(!Number.isFinite(credit)||credit<0){ alert("Credit limit cannot be negative."); return; }
    if(!Number.isFinite(openingBalance)){ alert("Enter a valid opening balance."); return; }

    const payload={
      name:form.name.trim(), contact_person:form.contact_person.trim()||null, phone:form.phone.trim()||null,
      email:form.email.trim()||null, address:form.address.trim()||null, vat_number:form.vat_number.trim()||null,
      credit_limit:credit, opening_balance:openingBalance, status:form.status, notes:form.notes.trim()||null
    };
    setSaving(true);
    const result=editing
      ? await supabase.from("suppliers").update(payload).eq("id",editing.id)
      : await supabase.from("suppliers").insert(payload);
    setSaving(false);
    if(result.error){ alert(result.error.message); return; }
    setOpen(false); setEditing(null); setForm(EMPTY); await loadSuppliers();
  }

  return <div className="suppliers-page">
    <div className="suppliers-header"><div><h1>Suppliers</h1><p>Manage suppliers for purchasing, GRNs and supplier payments.</p></div>
      <div className="suppliers-actions"><button className="secondary" onClick={loadSuppliers}><RefreshCw size={17}/>Refresh</button><button className="primary" onClick={add}><Plus size={18}/>Add Supplier</button></div>
    </div>

    <div className="supplier-stats">
      <div><Truck/><span>Total Suppliers</span><strong>{suppliers.length}</strong></div>
      <div><Truck/><span>Active Suppliers</span><strong>{active}</strong></div>
      <div><Truck/><span>Inactive Suppliers</span><strong>{suppliers.length-active}</strong></div>
      <div><Truck/><span>Opening Balance</span><strong>{money(opening)}</strong></div>
    </div>

    <div className="supplier-toolbar">
      <div className="supplier-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search supplier, code, phone, email or VAT..."/></div>
      <select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
    </div>

    <div className="supplier-card"><div className="card-title"><h2>Supplier Directory</h2><span>{rows.length} suppliers</span></div>
      <div className="table-wrap"><table><thead><tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Phone / Email</th><th>VAT No.</th><th className="num">Credit Limit</th><th className="num">Opening Balance</th><th>Status</th><th></th></tr></thead>
      <tbody>
        {!loading&&rows.length===0&&<tr><td colSpan="9" className="empty">No suppliers found.</td></tr>}
        {rows.map(s=><tr key={s.id}><td><strong>{s.supplier_code||"-"}</strong></td><td><strong>{s.name}</strong><small>{s.address||"No address"}</small></td><td>{s.contact_person||"-"}</td><td>{s.phone||"-"}<small>{s.email||"-"}</small></td><td>{s.vat_number||"-"}</td><td className="num">{money(s.credit_limit)}</td><td className="num">{money(s.opening_balance)}</td><td><span className={`status ${s.status.toLowerCase()}`}>{s.status}</span></td><td><button className="icon" onClick={()=>edit(s)}><Pencil size={16}/></button></td></tr>)}
      </tbody></table>{loading&&<div className="loading">Loading suppliers...</div>}</div>
    </div>

    {open&&<div className="modal-bg" onMouseDown={close}><div className="supplier-modal" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><h2>{editing?"Edit Supplier":"Add Supplier"}</h2><p>{editing?editing.supplier_code:"Supplier code is generated automatically."}</p></div><button onClick={close}><X size={20}/></button></div>
      <form onSubmit={save}><div className="form-grid">
        <label className="wide">Supplier Name *<input value={form.name} onChange={e=>field("name",e.target.value)} required autoFocus/></label>
        <label>Contact Person<input value={form.contact_person} onChange={e=>field("contact_person",e.target.value)}/></label>
        <label>Phone<input value={form.phone} onChange={e=>field("phone",e.target.value)}/></label>
        <label>Email<input type="email" value={form.email} onChange={e=>field("email",e.target.value)}/></label>
        <label>VAT Number<input value={form.vat_number} onChange={e=>field("vat_number",e.target.value)}/></label>
        <label>Credit Limit<input type="number" min="0" step="0.01" value={form.credit_limit} onChange={e=>field("credit_limit",e.target.value)}/></label>
        <label>Opening Balance<input type="number" step="0.01" value={form.opening_balance} onChange={e=>field("opening_balance",e.target.value)}/></label>
        <label>Status<select value={form.status} onChange={e=>field("status",e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
        <label className="wide">Address<textarea rows="3" value={form.address} onChange={e=>field("address",e.target.value)}/></label>
        <label className="wide">Notes<textarea rows="3" value={form.notes} onChange={e=>field("notes",e.target.value)}/></label>
      </div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving?"Saving...":editing?"Update Supplier":"Create Supplier"}</button></div></form>
    </div></div>}
  </div>;
}
