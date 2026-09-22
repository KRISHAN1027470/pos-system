import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ClipboardList, Eye, PackageCheck, Pencil, Plus, RefreshCw,
  Search, Send, ShoppingCart, Trash2, Truck, X, XCircle
} from "lucide-react";
import { supabase } from "./supabase";
import "./Purchases.css";

const emptyLine = () => ({ item_id:"", quantity:"1", unit_cost:"0", discount:"0", vat_rate:"0" });
const money = v => `Rs. ${Number(v||0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const today = () => new Date().toISOString().slice(0,10);
const blankPO = () => ({branch_id:"",supplier_id:"",po_date:today(),expected_date:"",notes:"",lines:[emptyLine()]});

export default function Purchases({ profile, activeBranch, branchId: activeBranchId, branches: appBranches = [], requestBranchSwitch }){
  const role = String(profile?.role || "").trim().toUpperCase();
  const isCashier = role === "CASHIER";
  const isReviewer = role === "ADMIN" || role === "MANAGER";
  const currentBranchId = activeBranchId || activeBranch?.id || "";


  const [tab,setTab]=useState("PO");
  const [orders,setOrders]=useState([]);
  const [grns,setGrns]=useState([]);
  const [suppliers,setSuppliers]=useState([]);
  const [branches,setBranches]=useState([]);
  const [items,setItems]=useState([]);
  const [branchStock,setBranchStock]=useState([]);
  const [branchRequests,setBranchRequests]=useState([]);
  const [branchRequestItems,setBranchRequestItems]=useState([]);
  const [branchRequestOpen,setBranchRequestOpen]=useState(false);
  const [editingBranchRequest,setEditingBranchRequest]=useState(null);
  const [viewBranchRequest,setViewBranchRequest]=useState(null);
  const [branchRequestForm,setBranchRequestForm]=useState({
    from_branch_id:"",
    to_branch_id:"",
    notes:"",
    lines:[{item_id:"",quantity:"1"}]
  });
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [branchItemSearch,setBranchItemSearch]=useState({});

  const [poOpen,setPoOpen]=useState(false);
  const [editingPO,setEditingPO]=useState(null);
  const [poForm,setPoForm]=useState(blankPO());

  const [viewOrder,setViewOrder]=useState(null);
  const [grnOpen,setGrnOpen]=useState(false);
  const [grnForm,setGrnForm]=useState({purchase_order_id:"",received_date:today(),supplier_invoice_number:"",supplier_invoice_date:"",notes:"",lines:[]});
  const [viewGrn,setViewGrn]=useState(null);

  useEffect(()=>{
  if(currentBranchId){
    loadAll();
  }
},[currentBranchId]);

  async function loadAll(){
    setLoading(true);
    const [s,b,i,p,g,bs,br,bri]=await Promise.all([
      supabase.from("suppliers").select("*").eq("status","ACTIVE").order("name"),
      supabase.from("branches").select("*").order("branch_code"),
      supabase.from("items").select("*").order("name"),
      supabase.from("purchase_orders").select("*, suppliers(name,supplier_code), branches(branch_name,branch_code)").order("created_at",{ascending:false}),
      supabase.from("goods_received_notes").select("*, suppliers(name,supplier_code), branches(branch_name,branch_code), purchase_orders(po_number)").order("created_at",{ascending:false}),
      supabase.from("branch_stock").select("branch_id,item_id,quantity"),
      supabase.from("branch_transfer_requests").select("*").order("created_at",{ascending:false}),
      supabase.from("branch_transfer_request_items").select("*").order("created_at")
    ]);
    setLoading(false);
    const err=[s,b,i,p,g,bs,br,bri].find(r=>r.error)?.error;
    if(err){ alert(err.message); return; }
    setSuppliers(s.data||[]); setBranches(appBranches?.length ? appBranches : (b.data||[])); setItems(i.data||[]);
    setOrders(p.data||[]); setGrns(g.data||[]); setBranchStock(bs.data||[]);
    setBranchRequests(br.data||[]); setBranchRequestItems(bri.data||[]);
  }

  const filteredOrders=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return orders.filter(o=>
      (!currentBranchId || o.branch_id===currentBranchId) &&
      (!q||[o.po_number,o.suppliers?.name,o.branches?.branch_name,o.status].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[orders,search,currentBranchId]);

  const filteredGrns=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return grns.filter(g=>
      (!currentBranchId || g.branch_id===currentBranchId) &&
      (!q||[g.grn_number,g.suppliers?.name,g.branches?.branch_name,g.purchase_orders?.po_number,g.status].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[grns,search,currentBranchId]);

  function lineCalc(l){
    const qty=Number(l.quantity||0), cost=Number(l.unit_cost||0), discount=Number(l.discount||0), rate=Number(l.vat_rate||0);
    const base=Math.max(qty*cost-discount,0), vat=base*rate/100;
    return {base,vat,total:base+vat};
  }

  function poTotals(lines=poForm.lines){
    return lines.reduce((a,l)=>{
      const c=lineCalc(l);
      a.subtotal+=Number(l.quantity||0)*Number(l.unit_cost||0);
      a.discount+=Number(l.discount||0);
      a.vat+=c.vat;
      a.total+=c.total;
      return a;
    },{subtotal:0,discount:0,vat:0,total:0});
  }

  const totals=poTotals();
  function setPoLine(idx,key,val){ setPoForm(f=>({...f,lines:f.lines.map((l,i)=>i===idx?{...l,[key]:val}:l)})); }
  function removePoLine(idx){ setPoForm(f=>({...f,lines:f.lines.filter((_,i)=>i!==idx)})); }

  function openNewPO(){
    if(!currentBranchId){alert("Unlock a branch before creating a Purchase Order.");return;}
    setEditingPO(null);
    setPoForm({...blankPO(),branch_id:currentBranchId});
    setPoOpen(true);
  }

  async function createPO(e){
    e.preventDefault();
    if(!isCashier){alert("Only CASHIER can create a new Purchase Order.");return;}
    if(!poForm.branch_id||!poForm.supplier_id){alert("Select branch and supplier.");return;}
    if(poForm.branch_id!==currentBranchId){alert("Switch to and unlock this branch before creating its Purchase Order.");requestBranchSwitch?.(poForm.branch_id);return;}
    if(!poForm.lines.length||poForm.lines.some(l=>!l.item_id||Number(l.quantity)<=0)){alert("Add valid purchase items.");return;}

    setSaving(true);
    const {data:{user}}=await supabase.auth.getUser();
    const t=poTotals();

    const {data:po,error}=await supabase.from("purchase_orders").insert({
      po_number:"",
      branch_id:poForm.branch_id,
      supplier_id:poForm.supplier_id,
      po_date:poForm.po_date,
      expected_date:poForm.expected_date||null,
      status:"DRAFT",
      subtotal:t.subtotal,
      discount:t.discount,
      vat_amount:t.vat,
      total:t.total,
      notes:poForm.notes||null,
      created_by:user?.id||null
    }).select().single();

    if(error){setSaving(false);alert(error.message);return;}

    const rows=poForm.lines.map(l=>{
      const item=items.find(x=>x.id===l.item_id), c=lineCalc(l);
      return {
        purchase_order_id:po.id,
        item_id:l.item_id,
        item_name:item?.name||"",
        sku:item?.sku||null,
        quantity:Number(l.quantity),
        received_quantity:0,
        unit_cost:Number(l.unit_cost||0),
        discount:Number(l.discount||0),
        vat_rate:Number(l.vat_rate||0),
        vat_amount:c.vat,
        line_total:c.total
      };
    });

    const ins=await supabase.from("purchase_order_items").insert(rows);
    setSaving(false);
    if(ins.error){alert("PO created but items failed: "+ins.error.message);return;}

    setPoOpen(false);
    setPoForm(blankPO());
    await loadAll();
  }

  async function openEditPO(po){
    if(po.branch_id!==currentBranchId){alert("Switch to this Purchase Order's branch and unlock it before editing.");requestBranchSwitch?.(po.branch_id);return;}
    if(po.status!=="DRAFT"){alert("Only DRAFT Purchase Orders can be edited.");return;}
    const {data,error}=await supabase.from("purchase_order_items").select("*").eq("purchase_order_id",po.id).order("created_at");
    if(error){alert(error.message);return;}
    setEditingPO(po);
    setPoForm({
      branch_id:po.branch_id,
      supplier_id:po.supplier_id,
      po_date:po.po_date,
      expected_date:po.expected_date||"",
      notes:po.notes||"",
      lines:(data||[]).map(l=>({
        item_id:l.item_id,
        quantity:String(l.quantity),
        unit_cost:String(l.unit_cost||0),
        discount:String(l.discount||0),
        vat_rate:String(l.vat_rate||0)
      }))
    });
    setPoOpen(true);
  }

  async function savePO(e){
    e.preventDefault();
    if(!editingPO)return;
    if(editingPO.status!=="DRAFT"){alert("Only DRAFT Purchase Orders can be edited.");return;}
    if(!poForm.lines.length||poForm.lines.some(l=>!l.item_id||Number(l.quantity)<=0)){alert("Add valid purchase items.");return;}

    setSaving(true);
    const t=poTotals();

    const header=await supabase.from("purchase_orders").update({
      branch_id:poForm.branch_id,
      supplier_id:poForm.supplier_id,
      po_date:poForm.po_date,
      expected_date:poForm.expected_date||null,
      subtotal:t.subtotal,
      discount:t.discount,
      vat_amount:t.vat,
      total:t.total,
      notes:poForm.notes||null,
      updated_at:new Date().toISOString()
    }).eq("id",editingPO.id).eq("status","DRAFT");

    if(header.error){setSaving(false);alert(header.error.message);return;}

    const del=await supabase.from("purchase_order_items").delete().eq("purchase_order_id",editingPO.id);
    if(del.error){setSaving(false);alert(del.error.message);return;}

    const rows=poForm.lines.map(l=>{
      const item=items.find(x=>x.id===l.item_id), c=lineCalc(l);
      return {
        purchase_order_id:editingPO.id,
        item_id:l.item_id,
        item_name:item?.name||"",
        sku:item?.sku||null,
        quantity:Number(l.quantity),
        received_quantity:0,
        unit_cost:Number(l.unit_cost||0),
        discount:Number(l.discount||0),
        vat_rate:Number(l.vat_rate||0),
        vat_amount:c.vat,
        line_total:c.total
      };
    });

    const ins=await supabase.from("purchase_order_items").insert(rows);
    setSaving(false);
    if(ins.error){alert("PO header saved, but item update failed: "+ins.error.message);return;}

    setPoOpen(false);
    setEditingPO(null);
    setPoForm(blankPO());
    await loadAll();
  }

  async function deletePO(po){
    if(!isCashier||po.status!=="DRAFT"){alert("Cashier can delete only a DRAFT Purchase Order.");return;}
    if(!confirm(`Delete ${po.po_number}? This cannot be undone.`))return;

    const delItems=await supabase.from("purchase_order_items").delete().eq("purchase_order_id",po.id);
    if(delItems.error){alert(delItems.error.message);return;}

    const delPO=await supabase.from("purchase_orders").delete().eq("id",po.id).eq("status","DRAFT");
    if(delPO.error){alert(delPO.error.message);return;}
    await loadAll();
  }

  async function reviewPO(po,action){
    if(po.branch_id!==currentBranchId){alert("Switch to this Purchase Order's branch and unlock it before reviewing.");requestBranchSwitch?.(po.branch_id);return;}
    if(!isReviewer){alert("Only MANAGER or ADMIN can approve or reject a Purchase Order.");return;}
    const label=action==="APPROVE"?"Approve":"Reject";
    if(!confirm(`${label} ${po.po_number}?`))return;
    const {data,error}=await supabase.rpc("review_purchase_order",{p_po_id:po.id,p_action:action});
    if(error){alert(error.message);return;}
    alert(`${data?.po_number||po.po_number} is now ${data?.status||action}.`);
    await loadAll();
  }

  async function openView(po){
    const {data,error}=await supabase.from("purchase_order_items").select("*").eq("purchase_order_id",po.id).order("created_at");
    if(error){alert(error.message);return;}
    setViewOrder({...po,lines:data||[]});
  }

  async function openGRN(po){
    if(po.branch_id!==currentBranchId){alert("Switch to this Purchase Order's branch and unlock it before sending a GRN.");requestBranchSwitch?.(po.branch_id);return;}
    if(!isReviewer){alert("Only MANAGER or ADMIN can send a Goods Received Note.");return;}
    const {data,error}=await supabase.from("purchase_order_items").select("*").eq("purchase_order_id",po.id).order("created_at");
    if(error){alert(error.message);return;}
    const remaining=(data||[]).map(l=>({...l,remaining:Number(l.quantity)-Number(l.received_quantity||0)})).filter(l=>l.remaining>0);
    if(!remaining.length){alert("This Purchase Order is already fully received.");return;}

    setGrnForm({
      purchase_order_id:po.id,
      received_date:today(),
      supplier_invoice_number:"",
      supplier_invoice_date:"",
      notes:"",
      lines:remaining.map(l=>({
        purchase_order_item_id:l.id,
        item_id:l.item_id,
        item_name:l.item_name,
        sku:l.sku,
        quantity:String(l.remaining),
        max:l.remaining,
        unit_cost:String(l.unit_cost),
        discount:"0",
        vat_rate:String(l.vat_rate||0)
      }))
    });
    setGrnOpen(true);
  }

  function setGrnLine(idx,key,val){setGrnForm(f=>({...f,lines:f.lines.map((l,i)=>i===idx?{...l,[key]:val}:l)}));}

  async function createAndSendGRN(e){
    e.preventDefault();
    if(!isReviewer){alert("Only MANAGER or ADMIN can send a GRN.");return;}
    const po=orders.find(o=>o.id===grnForm.purchase_order_id);
    if(!po)return;

    const sendLines=grnForm.lines.filter(l=>Number(l.quantity)>0);
    if(!sendLines.length){alert("Enter at least one GRN quantity.");return;}
    if(sendLines.some(l=>Number(l.quantity)>Number(l.max))){alert("GRN quantity cannot exceed PO remaining quantity.");return;}

    setSaving(true);
    const {data:{user}}=await supabase.auth.getUser();
    const gt=sendLines.reduce((a,l)=>{
      const c=lineCalc(l);
      a.subtotal+=Number(l.quantity)*Number(l.unit_cost);
      a.discount+=Number(l.discount||0);
      a.vat+=c.vat;
      a.total+=c.total;
      return a;
    },{subtotal:0,discount:0,vat:0,total:0});

    const {data:grn,error}=await supabase.from("goods_received_notes").insert({
      grn_number:"",
      purchase_order_id:po.id,
      branch_id:po.branch_id,
      supplier_id:po.supplier_id,
      received_date:grnForm.received_date,
      supplier_invoice_number:grnForm.supplier_invoice_number||null,
      supplier_invoice_date:grnForm.supplier_invoice_date||null,
      status:"DRAFT",
      subtotal:gt.subtotal,
      discount:gt.discount,
      vat_amount:gt.vat,
      total:gt.total,
      notes:grnForm.notes||null,
      created_by:user?.id||null
    }).select().single();

    if(error){setSaving(false);alert(error.message);return;}

    const rows=sendLines.map(l=>{
      const c=lineCalc(l);
      return {
        grn_id:grn.id,
        purchase_order_item_id:l.purchase_order_item_id,
        item_id:l.item_id,
        item_name:l.item_name,
        sku:l.sku||null,
        quantity:Number(l.quantity),
        unit_cost:Number(l.unit_cost),
        discount:Number(l.discount||0),
        vat_rate:Number(l.vat_rate||0),
        vat_amount:c.vat,
        line_total:c.total
      };
    });

    const ins=await supabase.from("grn_items").insert(rows);
    if(ins.error){setSaving(false);alert("GRN created but items failed: "+ins.error.message);return;}

    const sent=await supabase.rpc("send_purchase_grn",{p_grn_id:grn.id});
    setSaving(false);
    if(sent.error){alert(`GRN ${grn.grn_number} was created as DRAFT but could not be sent: ${sent.error.message}`);await loadAll();return;}

    setGrnOpen(false);
    alert(`${grn.grn_number} sent to CASHIER for acceptance. Inventory has NOT changed yet.`);
    await loadAll();
  }

  async function openViewGRN(grn){
    const {data,error}=await supabase.from("grn_items").select("*").eq("grn_id",grn.id).order("created_at");
    if(error){alert(error.message);return;}
    setViewGrn({...grn,lines:data||[]});
  }

  async function acceptGRN(grn){
    if(grn.branch_id!==currentBranchId){alert("Switch to this GRN's branch and unlock it before acceptance.");requestBranchSwitch?.(grn.branch_id);return;}
    if(!isCashier){alert("Only CASHIER can accept a sent GRN.");return;}
    if(grn.status!=="SENT"){alert("Only a SENT GRN can be accepted.");return;}
    if(!confirm(`Accept ${grn.grn_number}? The listed quantities will be added to branch inventory.`))return;

    const {data,error}=await supabase.rpc("accept_purchase_grn",{p_grn_id:grn.id});
    if(error){alert(error.message);return;}
    alert(`${data?.grn_number||grn.grn_number} accepted. Inventory has been increased.`);
    setViewGrn(null);
    await loadAll();
  }


  const branchName=id=>branches.find(b=>b.id===id)?.branch_name||"-";
  const itemName=id=>items.find(i=>i.id===id)?.name||"-";
  const stockQty=(branchId,itemId)=>Number(branchStock.find(x=>x.branch_id===branchId&&x.item_id===itemId)?.quantity||0);

  const filteredBranchRequests=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return branchRequests.filter(r=>
      r.status==="DRAFT" &&
      r.from_branch_id===currentBranchId &&
      (!q||[
        r.request_number,r.status,branchName(r.from_branch_id),branchName(r.to_branch_id)
      ].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[branchRequests,search,branches,currentBranchId]);

  const submittedBranchPOs=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return branchRequests.filter(r=>
      r.status!=="DRAFT" &&
      (r.from_branch_id===currentBranchId || r.to_branch_id===currentBranchId) &&
      (!q||[
        r.request_number,r.status,branchName(r.from_branch_id),branchName(r.to_branch_id)
      ].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[branchRequests,search,branches,currentBranchId]);

  const branchGrns=useMemo(()=>{
    const q=search.toLowerCase().trim();
    return branchRequests.filter(r=>
      ["SENT","ACCEPTED"].includes(r.status) &&
      (r.from_branch_id===currentBranchId || r.to_branch_id===currentBranchId) &&
      (!q||[
        r.request_number,r.status,branchName(r.from_branch_id),branchName(r.to_branch_id)
      ].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)))
    );
  },[branchRequests,search,branches,currentBranchId]);

  function openNewBranchRequest(){
    if(!currentBranchId){alert("Unlock a branch before creating a Branch PO.");return;}
    setEditingBranchRequest(null);
    setBranchItemSearch({});
    setBranchRequestForm({
      from_branch_id:currentBranchId,
      to_branch_id:"",
      notes:"",
      lines:[{item_id:"",quantity:"1"}]
    });
    setBranchRequestOpen(true);
  }

  function openEditBranchRequest(r){
    if(r.from_branch_id!==currentBranchId){alert("Only the requesting branch can edit this Branch PO.");return;}
    if(r.status!=="DRAFT"){alert("Only DRAFT Branch POs can be edited.");return;}
    const lines=branchRequestItems.filter(x=>x.request_id===r.id);
    setEditingBranchRequest(r);
    setBranchItemSearch({});
    setBranchRequestForm({
      from_branch_id:r.from_branch_id,
      to_branch_id:r.to_branch_id,
      notes:r.notes||"",
      lines:lines.length ? lines.map(l=>({item_id:l.item_id,quantity:String(l.requested_quantity)})) : [{item_id:"",quantity:"1"}]
    });
    setBranchRequestOpen(true);
  }

  function setBRLine(idx,key,val){
    setBranchRequestForm(f=>({...f,lines:f.lines.map((l,i)=>i===idx?{...l,[key]:val}:l)}));
  }

  function validateBranchPOForm(f){
    if(!f.from_branch_id||!f.to_branch_id){alert("Select requesting branch and supplying branch.");return false;}
    if(f.from_branch_id!==currentBranchId){alert("The requesting branch must be the currently unlocked branch.");return false;}
    if(f.from_branch_id===f.to_branch_id){alert("Requesting and supplying branches must be different.");return false;}
    if(!f.lines.length||f.lines.some(l=>!l.item_id||Number(l.quantity)<=0)){alert("Add valid Branch PO items.");return false;}
    const ids=f.lines.map(l=>l.item_id);
    if(new Set(ids).size!==ids.length){alert("The same item cannot be added twice to one Branch PO.");return false;}
    return true;
  }

  async function createBranchRequest(e){
    e.preventDefault();
    const f=branchRequestForm;
    if(!validateBranchPOForm(f))return;
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const requestNumber=`BTR-${Date.now()}`;
      const {data:req,error}=await supabase.from("branch_transfer_requests").insert({
        request_number:requestNumber,
        from_branch_id:f.from_branch_id,
        to_branch_id:f.to_branch_id,
        status:"DRAFT",
        notes:f.notes||null,
        created_by:user?.id||null
      }).select().single();
      if(error)throw error;
      const rows=f.lines.map(l=>({
        request_id:req.id,
        item_id:l.item_id,
        requested_quantity:Number(l.quantity),
        approved_quantity:0,
        sent_quantity:0,
        received_quantity:0
      }));
      const ins=await supabase.from("branch_transfer_request_items").insert(rows);
      if(ins.error)throw ins.error;
      setBranchRequestOpen(false);
      setEditingBranchRequest(null);
      await loadAll();
    }catch(error){
      alert(error.message||"Unable to create Branch PO.");
    }finally{
      setSaving(false);
    }
  }

  async function saveBranchRequest(e){
    e.preventDefault();
    if(!editingBranchRequest)return;
    const f=branchRequestForm;
    if(editingBranchRequest.status!=="DRAFT"){alert("Only DRAFT Branch POs can be edited.");return;}
    if(editingBranchRequest.from_branch_id!==currentBranchId){alert("Only the requesting branch can edit this Branch PO.");return;}
    if(!validateBranchPOForm(f))return;

    setSaving(true);
    try{
      const header=await supabase.from("branch_transfer_requests").update({
        to_branch_id:f.to_branch_id,
        notes:f.notes||null,
        updated_at:new Date().toISOString()
      }).eq("id",editingBranchRequest.id).eq("status","DRAFT");
      if(header.error)throw header.error;

      const del=await supabase.from("branch_transfer_request_items").delete().eq("request_id",editingBranchRequest.id);
      if(del.error)throw del.error;

      const rows=f.lines.map(l=>({
        request_id:editingBranchRequest.id,
        item_id:l.item_id,
        requested_quantity:Number(l.quantity),
        approved_quantity:0,
        sent_quantity:0,
        received_quantity:0
      }));
      const ins=await supabase.from("branch_transfer_request_items").insert(rows);
      if(ins.error)throw ins.error;

      setBranchRequestOpen(false);
      setEditingBranchRequest(null);
      await loadAll();
    }catch(error){
      alert(error.message||"Unable to save Branch PO.");
    }finally{
      setSaving(false);
    }
  }

  async function openBranchRequest(r){
    const lines=branchRequestItems.filter(x=>x.request_id===r.id).map(x=>({...x}));
    setViewBranchRequest({...r,lines});
  }

  async function deleteBranchRequest(r){
    if(r.from_branch_id!==currentBranchId){alert("Only the requesting branch can delete this request.");return;}
    if(r.status!=="DRAFT"){alert("Only DRAFT branch requests can be deleted.");return;}
    if(!confirm(`Delete ${r.request_number}?`))return;
    const a=await supabase.from("branch_transfer_request_items").delete().eq("request_id",r.id);
    if(a.error){alert(a.error.message);return;}
    const b=await supabase.from("branch_transfer_requests").delete().eq("id",r.id).eq("status","DRAFT");
    if(b.error){alert(b.error.message);return;}
    await loadAll();
  }

  async function submitBranchRequest(r){
    if(r.from_branch_id!==currentBranchId){alert("Only the requesting branch can submit this request.");return;}
    if(r.status!=="DRAFT")return;
    const u=await supabase.from("branch_transfer_requests").update({status:"PENDING",updated_at:new Date().toISOString()}).eq("id",r.id).eq("status","DRAFT");
    if(u.error){alert(u.error.message);return;}
    await loadAll();
    setTab("PO");
  }

  async function saveBranchApproval(r,approve=true){
    if(r.to_branch_id!==currentBranchId){
      alert("Switch to the supplying branch and unlock it before reviewing this Branch PO.");
      requestBranchSwitch?.(r.to_branch_id);
      return;
    }
    if(r.status!=="PENDING"){alert("Only a PENDING Branch PO can be reviewed.");return;}

    if(!approve){
      if(!confirm(`Reject ${r.request_number}?`))return;
      const u=await supabase.from("branch_transfer_requests")
        .update({status:"REJECTED",updated_at:new Date().toISOString()})
        .eq("id",r.id).eq("status","PENDING");
      if(u.error){alert(u.error.message);return;}
      setViewBranchRequest(null);
      await loadAll();
      return;
    }

    let positiveLines=0;
    for(const l of r.lines){
      const qty=Math.max(0,Number(l.approved_quantity||0));
      const requested=Number(l.requested_quantity||0);
      if(qty>requested){
        alert(`${itemName(l.item_id)}: Supply Qty cannot exceed PO Qty (${requested}).`);
        return;
      }
      if(qty>0)positiveLines++;
    }
    if(!positiveLines){
      alert("Enter a Supply Qty greater than 0 for at least one item.");
      return;
    }

    if(!confirm(`Approve ${r.request_number} and create/send the Branch GRN?`))return;

    setSaving(true);
    try{
      // Save supplier-adjusted quantities first.
      for(const l of r.lines){
        const qty=Math.max(0,Number(l.approved_quantity||0));
        const u=await supabase.from("branch_transfer_request_items")
          .update({approved_quantity:qty})
          .eq("id",l.id)
          .eq("request_id",r.id);
        if(u.error)throw u.error;
      }

      // Backend changes PENDING -> SENT and copies approved qty to sent qty.
      const {data,error}=await supabase.rpc("approve_branch_po_and_send_grn",{
        p_request_id:r.id
      });
      if(error)throw error;
      if(!data?.success)throw new Error(data?.message||"Unable to approve and send Branch GRN.");

      setViewBranchRequest(null);
      await loadAll();
      setTab("GRN");
      alert(data?.message||"Supply quantity approved. Branch GRN has been sent.");
    }catch(error){
      console.error("Approve Branch PO error:",error);
      alert(error.message||"Unable to approve Branch PO.");
    }finally{
      setSaving(false);
    }
  }

  async function sendBranchGRN(r){
    if(r.to_branch_id!==currentBranchId){
      alert("Switch to the supplying branch and unlock it before sending this Branch GRN.");
      requestBranchSwitch?.(r.to_branch_id);
      return;
    }
    if(r.status!=="APPROVED"){
      alert("Only APPROVED requests can be sent.");
      return;
    }

    if(!confirm(`Send ${r.request_number}? Approved quantities will be deducted from ${branchName(r.to_branch_id)} inventory.`))return;

    setSaving(true);
    try{
      const {data,error}=await supabase.rpc("send_branch_transfer_request",{
        p_request_id:r.id
      });

      if(error)throw error;
      if(!data?.success)throw new Error(data?.message||"Unable to send Branch GRN.");

      setViewBranchRequest(null);
      alert(data?.message||"Branch transfer sent successfully. Supplying stock has been deducted; receiving stock will increase only after acceptance.");
      await loadAll();
    }catch(error){
      console.error("Send Branch GRN error:",error);
      alert(error.message||"Unable to send Branch GRN.");
    }finally{
      setSaving(false);
    }
  }

  async function acceptBranchGRN(r){
    if(r.from_branch_id!==currentBranchId){
      alert("Switch to the requesting branch and unlock it before accepting this Branch GRN.");
      requestBranchSwitch?.(r.from_branch_id);
      return;
    }
    if(r.status!=="SENT"){
      alert("Only a SENT branch GRN can be accepted.");
      return;
    }
    if(!confirm(`Accept ${r.request_number}? Items will be added to ${branchName(r.from_branch_id)} inventory.`))return;

    setSaving(true);
    try{
      const {data,error}=await supabase.rpc("accept_branch_transfer_request",{
        p_request_id:r.id
      });

      if(error)throw error;
      if(!data?.success)throw new Error(data?.message||"Unable to accept Branch GRN.");

      setViewBranchRequest(null);
      alert(data?.message||"Branch transfer accepted successfully. Receiving inventory has been increased.");
      await loadAll();
    }catch(error){
      console.error("Accept Branch GRN error:",error);
      alert(error.message||"Unable to accept Branch GRN.");
    }finally{
      setSaving(false);
    }
  }

  return <div className="purchases-page">
    <div className="purchase-head">
      <div>
        <h1>Purchase Management</h1>
        <p>Cashier purchase requests, management approval, GRN sending and cashier acceptance.</p>
      </div>
      <div className="purchase-actions">
        <button className="p-secondary" onClick={loadAll}><RefreshCw size={17}/>Refresh</button>
        {isCashier&&tab==="PO"&&<button className="p-primary" onClick={openNewPO}><Plus size={18}/>New Purchase Order</button>}
        {tab==="BRANCH"&&<button className="p-primary" onClick={openNewBranchRequest}><Plus size={18}/>New Branch PO</button>}
      </div>
    </div>

    <div className="purchase-stats">
      <div><ClipboardList/><span>Purchase Orders</span><strong>{orders.length}</strong></div>
      <div><PackageCheck/><span>Completed GRNs</span><strong>{grns.filter(g=>g.status==="COMPLETED").length}</strong></div>
      <div><Truck/><span>Active Suppliers</span><strong>{suppliers.length}</strong></div>
      <div><ShoppingCart/><span>Purchase Value</span><strong>{money(orders.filter(o=>!["CANCELLED","REJECTED"].includes(o.status)).reduce((a,o)=>a+Number(o.total||0),0))}</strong></div>
    </div>

    <div className="purchase-tabs">
      <button className={tab==="PO"?"active":""} onClick={()=>setTab("PO")}>Purchase Orders</button>
      <button className={tab==="GRN"?"active":""} onClick={()=>setTab("GRN")}>Goods Received Notes</button>
      <button className={tab==="BRANCH"?"active":""} onClick={()=>setTab("BRANCH")}>New Branch PO</button>
    </div>

    <div className="purchase-search">
      <Search size={18}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab==="PO"?"purchase orders":tab==="GRN"?"GRNs":"branch POs"}...`}/>
    </div>

    <div className="purchase-card"><div className="purchase-table-wrap">
      {tab==="PO"?
        <>
        <table>
          <thead><tr><th>PO Number</th><th>Date</th><th>Supplier</th><th>Branch</th><th>Status</th><th className="num">Total</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading&&filteredOrders.length===0&&<tr><td colSpan="7" className="empty">No purchase orders found.</td></tr>}
            {filteredOrders.map(po=>
              <tr key={po.id}>
                <td><strong>{po.po_number}</strong></td>
                <td>{po.po_date}</td>
                <td>{po.suppliers?.name||"-"}</td>
                <td>{po.branches?.branch_name||"-"}</td>
                <td><span className={`p-status ${po.status.toLowerCase()}`}>{po.status.replaceAll("_"," ")}</span></td>
                <td className="num">{money(po.total)}</td>
                <td><div className="row-actions">
                  <button onClick={()=>openView(po)} title="View"><Eye size={16}/></button>

                  {po.status==="DRAFT"&&
                    <button onClick={()=>openEditPO(po)} title="Edit"><Pencil size={16}/></button>}

                  {isCashier&&po.status==="DRAFT"&&
                    <button onClick={()=>deletePO(po)} title="Delete"><Trash2 size={16}/></button>}

                  {isReviewer&&po.status==="DRAFT"&&<>
                    <button onClick={()=>reviewPO(po,"APPROVE")} title="Approve"><CheckCircle2 size={16}/>Approve</button>
                    <button onClick={()=>reviewPO(po,"REJECT")} title="Reject"><XCircle size={16}/>Reject</button>
                  </>}

                  {isReviewer &&
                    ["APPROVED","PARTIALLY_RECEIVED"].includes(po.status) &&
                    !grns.some(g =>
                      g.purchase_order_id === po.id &&
                      ["DRAFT","SENT"].includes(g.status)
                    ) &&
                    <button className="receive" onClick={()=>openGRN(po)}><Send size={16}/>Send GRN</button>}
                </div></td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="line-title" style={{marginTop:"24px"}}>
          <h3>Submitted Branch Purchase Orders</h3>
        </div>
        <table>
          <thead><tr><th>Branch PO</th><th>Requesting Branch</th><th>Supplying Branch</th><th>Status</th><th>Items</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading&&submittedBranchPOs.length===0&&<tr><td colSpan="6" className="empty">No submitted Branch Purchase Orders found.</td></tr>}
            {submittedBranchPOs.map(r=><tr key={r.id}>
              <td><strong>{r.request_number||String(r.id).slice(0,8)}</strong></td>
              <td>{branchName(r.from_branch_id)}</td>
              <td>{branchName(r.to_branch_id)}</td>
              <td><span className={`p-status ${String(r.status||"pending").toLowerCase()}`}>{r.status}</span></td>
              <td>{branchRequestItems.filter(x=>x.request_id===r.id).length}</td>
              <td><div className="row-actions">
                <button onClick={()=>openBranchRequest(r)}><Eye size={16}/>View</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
        </>
      : tab==="GRN" ?
        <>
        <table>
          <thead><tr><th>GRN Number</th><th>Date</th><th>PO</th><th>Supplier</th><th>Branch</th><th>Status</th><th className="num">Total</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading&&filteredGrns.length===0&&<tr><td colSpan="8" className="empty">No GRNs found.</td></tr>}
            {filteredGrns.map(g=>
              <tr key={g.id}>
                <td><strong>{g.grn_number}</strong></td>
                <td>{g.received_date}</td>
                <td>{g.purchase_orders?.po_number||"-"}</td>
                <td>{g.suppliers?.name||"-"}</td>
                <td>{g.branches?.branch_name||"-"}</td>
                <td><span className={`p-status ${g.status.toLowerCase()}`}>{g.status}</span></td>
                <td className="num">{money(g.total)}</td>
                <td><div className="row-actions">
                  <button onClick={()=>openViewGRN(g)} title="View GRN"><Eye size={16}/>View</button>
                  {isCashier&&g.status==="SENT"&&
                    <button
                      type="button"
                      onClick={()=>acceptGRN(g)}
                      style={{
                        background:"#ffffff",
                        color:"#000000",
                        border:"1px solid #d6deea",
                        borderRadius:"10px",
                        minHeight:"40px",
                        padding:"0 14px",
                        fontWeight:"700",
                        cursor:"pointer",
                        display:"inline-flex",
                        alignItems:"center",
                        justifyContent:"center",
                        gap:"7px",
                        opacity:1,
                        visibility:"visible",
                        pointerEvents:"auto"
                      }}
                    ><CheckCircle2 size={16} color="#000000" stroke="#000000"/><span style={{color:"#000000"}}>Accept GRN</span></button>}
                </div></td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="line-title" style={{marginTop:"24px"}}>
          <h3>Branch Goods Received Notes</h3>
        </div>
        <table>
          <thead><tr><th>GRN / Branch PO</th><th>From</th><th>Receiving Branch</th><th>Status</th><th>Items</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading&&branchGrns.length===0&&<tr><td colSpan="6" className="empty">No Branch GRNs found.</td></tr>}
            {branchGrns.map(r=><tr key={r.id}>
              <td><strong>{r.request_number||String(r.id).slice(0,8)}</strong></td>
              <td>{branchName(r.to_branch_id)}</td>
              <td>{branchName(r.from_branch_id)}</td>
              <td><span className={`p-status ${String(r.status||"sent").toLowerCase()}`}>{r.status==="ACCEPTED"?"COMPLETED":r.status}</span></td>
              <td>{branchRequestItems.filter(x=>x.request_id===r.id).length}</td>
              <td><div className="row-actions">
                <button onClick={()=>openBranchRequest(r)}><Eye size={16}/>View GRN</button>
                {r.status==="SENT"&&r.from_branch_id===currentBranchId&&
                  <button type="button" onClick={()=>acceptBranchGRN({...r,lines:branchRequestItems.filter(x=>x.request_id===r.id)})} disabled={saving}>
                    <PackageCheck size={16}/>{saving?"Accepting...":"Accept GRN"}
                  </button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
        </>
      :
        <table>
          <thead><tr><th>Branch PO</th><th>Requesting Branch</th><th>Supplying Branch</th><th>Status</th><th>Items</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading&&filteredBranchRequests.length===0&&<tr><td colSpan="6" className="empty">No Branch POs found.</td></tr>}
            {filteredBranchRequests.map(r=><tr key={r.id}>
              <td><strong>{r.request_number||String(r.id).slice(0,8)}</strong></td>
              <td>{branchName(r.from_branch_id)}</td>
              <td>{branchName(r.to_branch_id)}</td>
              <td><span className={`p-status ${String(r.status||"draft").toLowerCase()}`}>{r.status}</span></td>
              <td>{branchRequestItems.filter(x=>x.request_id===r.id).length}</td>
              <td><div className="row-actions">
                <button onClick={()=>openBranchRequest(r)}><Eye size={16}/>View</button>
                {r.status==="DRAFT"&&r.from_branch_id===currentBranchId&&<button onClick={()=>openEditBranchRequest(r)} title="Edit Branch PO"><Pencil size={16}/>Edit</button>}
                {r.status==="DRAFT"&&r.from_branch_id===currentBranchId&&<button onClick={()=>submitBranchRequest(r)}><Send size={16}/>Submit PO</button>}
                {r.status==="DRAFT"&&r.from_branch_id===currentBranchId&&<button onClick={()=>deleteBranchRequest(r)}><Trash2 size={16}/></button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      }
      {loading&&<div className="loading">Loading purchase data...</div>}
    </div></div>

    {poOpen&&<div className="p-modal-bg"><div className="p-modal large">
      <div className="p-modal-head">
        <div>
          <h2>{editingPO?`Edit ${editingPO.po_number}`:"New Purchase Order"}</h2>
          <p>{editingPO?"Edit items and quantities before approval.":"Create a purchase request for management approval."}</p>
        </div>
        <button onClick={()=>{setPoOpen(false);setEditingPO(null);}}><X/></button>
      </div>

      <form onSubmit={editingPO?savePO:createPO}>
        <div className="p-form-grid">
          <label>Branch *
            <select value={poForm.branch_id} disabled required>
              {branches.filter(b=>b.id===currentBranchId).map(b=><option key={b.id} value={b.id}>{b.branch_code} - {b.branch_name}</option>)}
            </select>
          </label>
          <label>Supplier *
            <select value={poForm.supplier_id} onChange={e=>setPoForm(f=>({...f,supplier_id:e.target.value}))} required>
              <option value="">Select supplier</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.supplier_code} - {s.name}</option>)}
            </select>
          </label>
          <label>PO Date<input type="date" value={poForm.po_date} onChange={e=>setPoForm(f=>({...f,po_date:e.target.value}))}/></label>
          <label>Expected Date<input type="date" value={poForm.expected_date} onChange={e=>setPoForm(f=>({...f,expected_date:e.target.value}))}/></label>
        </div>

        <LineEditor
          lines={poForm.lines}
          items={items}
          setLine={setPoLine}
          removeLine={removePoLine}
          addLine={()=>setPoForm(f=>({...f,lines:[...f.lines,emptyLine()]}))}
          branchId={poForm.branch_id}
          branchStock={branchStock}
        />

        <label className="notes">Notes
          <textarea rows="2" value={poForm.notes} onChange={e=>setPoForm(f=>({...f,notes:e.target.value}))}/>
        </label>

        <div className="totals">
          <span>Subtotal <b>{money(totals.subtotal)}</b></span>
          <span>Discount <b>{money(totals.discount)}</b></span>
          <span>VAT <b>{money(totals.vat)}</b></span>
          <span className="grand">Total <b>{money(totals.total)}</b></span>
        </div>

        <div className="p-modal-actions">
          <button type="button" className="p-secondary" onClick={()=>{setPoOpen(false);setEditingPO(null);}}>Cancel</button>
          <button className="p-primary" disabled={saving}>
            {saving?"Saving...":editingPO?"Save Changes":"Create Purchase Order"}
          </button>
        </div>
      </form>
    </div></div>}

    {grnOpen&&<div className="p-modal-bg"><div className="p-modal large">
      <div className="p-modal-head">
        <div><h2>Send Goods Received Note</h2><p>Enter the quantities being sent to the cashier for physical acceptance.</p></div>
        <button onClick={()=>setGrnOpen(false)}><X/></button>
      </div>

      <form onSubmit={createAndSendGRN}>
        <div className="p-form-grid">
          <label>GRN Date<input type="date" value={grnForm.received_date} onChange={e=>setGrnForm(f=>({...f,received_date:e.target.value}))}/></label>
          <label>Supplier Invoice No.<input value={grnForm.supplier_invoice_number} onChange={e=>setGrnForm(f=>({...f,supplier_invoice_number:e.target.value}))}/></label>
          <label>Supplier Invoice Date<input type="date" value={grnForm.supplier_invoice_date} onChange={e=>setGrnForm(f=>({...f,supplier_invoice_date:e.target.value}))}/></label>
        </div>

        <div className="line-table">
          <table>
            <thead><tr><th>Item</th><th>PO Remaining</th><th>GRN Qty</th><th>Unit Cost</th><th>VAT %</th></tr></thead>
            <tbody>{grnForm.lines.map((l,i)=>
              <tr key={l.purchase_order_item_id}>
                <td><strong>{l.item_name}</strong><small>{l.sku||""}</small></td>
                <td>{l.max}</td>
                <td><input type="number" min="0" max={l.max} step="0.001" value={l.quantity} onChange={e=>setGrnLine(i,"quantity",e.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={l.unit_cost} onChange={e=>setGrnLine(i,"unit_cost",e.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={l.vat_rate} onChange={e=>setGrnLine(i,"vat_rate",e.target.value)}/></td>
              </tr>
            )}</tbody>
          </table>
        </div>

        <label className="notes">Notes
          <textarea rows="2" value={grnForm.notes} onChange={e=>setGrnForm(f=>({...f,notes:e.target.value}))}/>
        </label>

        <div className="p-modal-actions">
          <button type="button" className="p-secondary" onClick={()=>setGrnOpen(false)}>Cancel</button>
          <button className="p-primary" disabled={saving}><Send size={16}/>{saving?"Sending...":"Send GRN to Cashier"}</button>
        </div>
      </form>
    </div></div>}

    {viewOrder&&<div className="p-modal-bg"><div className="p-modal">
      <div className="p-modal-head">
        <div><h2>{viewOrder.po_number}</h2><p>{viewOrder.suppliers?.name} • {viewOrder.branches?.branch_name} • {viewOrder.status}</p></div>
        <button onClick={()=>setViewOrder(null)}><X/></button>
      </div>
      <div className="view-body">
        <div className="line-table"><table>
          <thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Remaining</th><th className="num">Cost</th><th className="num">Total</th></tr></thead>
          <tbody>{viewOrder.lines.map(l=>
            <tr key={l.id}>
              <td>{l.item_name}<small>{l.sku||""}</small></td>
              <td>{l.quantity}</td>
              <td>{l.received_quantity}</td>
              <td>{Math.max(Number(l.quantity)-Number(l.received_quantity||0),0)}</td>
              <td className="num">{money(l.unit_cost)}</td>
              <td className="num">{money(l.line_total)}</td>
            </tr>
          )}</tbody>
        </table></div>
        <div className="view-total">PO Total <strong>{money(viewOrder.total)}</strong></div>
      </div>
    </div></div>}


    {branchRequestOpen&&<div className="p-modal-bg"><div className="p-modal large">
      <div className="p-modal-head">
        <div><h2>{editingBranchRequest?`Edit ${editingBranchRequest.request_number}`:"New Branch PO"}</h2><p>{editingBranchRequest?"Edit items and quantities before submitting the PO.":"Create a stock purchase order to another branch."}</p></div>
        <button onClick={()=>{setBranchRequestOpen(false);setEditingBranchRequest(null);}}><X/></button>
      </div>
      <form onSubmit={editingBranchRequest?saveBranchRequest:createBranchRequest}>
        <div className="p-form-grid">
          <label>Requesting Branch *
            <select value={branchRequestForm.from_branch_id} disabled required>
              {branches.filter(b=>b.id===currentBranchId).map(b=><option key={b.id} value={b.id}>{b.branch_code} - {b.branch_name}</option>)}
            </select>
          </label>
          <label>Order Stock From *
            <select value={branchRequestForm.to_branch_id} onChange={e=>setBranchRequestForm(f=>({...f,to_branch_id:e.target.value}))} required>
              <option value="">Select branch</option>{branches.filter(b=>b.id!==branchRequestForm.from_branch_id).map(b=><option key={b.id} value={b.id}>{b.branch_code} - {b.branch_name}</option>)}
            </select>
          </label>
        </div>
        <div className="line-table">
          <div className="line-title"><h3>Branch PO Items</h3><button type="button" onClick={()=>setBranchRequestForm(f=>({...f,lines:[...f.lines,{item_id:"",quantity:"1"}]}))}><Plus size={15}/>Add Item</button></div>
          <table><thead><tr><th>Item</th><th>Supplying Stock</th><th>PO Qty</th><th></th></tr></thead>
          <tbody>{branchRequestForm.lines.map((l,i)=><tr key={i}>
            <td>
              <input
                type="text"
                value={branchItemSearch[i]||""}
                onChange={e=>setBranchItemSearch(x=>({...x,[i]:e.target.value}))}
                placeholder="Search product by name or SKU..."
                style={{width:"100%",marginBottom:"8px"}}
              />
              <select value={l.item_id} onChange={e=>setBRLine(i,"item_id",e.target.value)} required>
                <option value="">Select item</option>
                {items
                  .filter(it=>{
                    const q=String(branchItemSearch[i]||"").trim().toLowerCase();
                    if(!q)return true;
                    return [it.name,it.sku,it.barcode]
                      .filter(Boolean)
                      .some(v=>String(v).toLowerCase().includes(q));
                  })
                  .map(it=><option key={it.id} value={it.id}>{it.sku?`${it.sku} - `:""}{it.name}</option>)}
              </select>
            </td>
            <td><strong>{branchRequestForm.to_branch_id&&l.item_id?stockQty(branchRequestForm.to_branch_id,l.item_id).toLocaleString("en-LK"):"-"}</strong></td>
            <td><input type="number" min="0.001" step="0.001" value={l.quantity} onChange={e=>setBRLine(i,"quantity",e.target.value)}/></td>
            <td><button type="button" className="remove" disabled={branchRequestForm.lines.length===1} onClick={()=>setBranchRequestForm(f=>({...f,lines:f.lines.filter((_,x)=>x!==i)}))}>×</button></td>
          </tr>)}</tbody></table>
        </div>
        <label className="notes">Notes<textarea rows="2" value={branchRequestForm.notes} onChange={e=>setBranchRequestForm(f=>({...f,notes:e.target.value}))}/></label>
        <div className="p-modal-actions">
          <button type="button" className="p-secondary" onClick={()=>{setBranchRequestOpen(false);setEditingBranchRequest(null);}}>Cancel</button>
          <button className="p-primary" disabled={saving}>{saving?"Saving...":editingBranchRequest?"Save Changes":"Create Branch PO"}</button>
        </div>
      </form>
    </div></div>}

    {viewBranchRequest&&<div className="p-modal-bg"><div className="p-modal large">
      <div className="p-modal-head">
        <div><h2>{viewBranchRequest.request_number||"Branch PO"}</h2><p>{branchName(viewBranchRequest.from_branch_id)} → {branchName(viewBranchRequest.to_branch_id)} • {viewBranchRequest.status}</p></div>
        <button onClick={()=>setViewBranchRequest(null)}><X/></button>
      </div>
      <div className="view-body">
        <div className="line-table"><table>
          <thead><tr><th>Item</th><th>PO Qty</th><th>Supplying Stock</th><th>Supply Qty</th><th>Sent</th><th>Received</th></tr></thead>
          <tbody>{viewBranchRequest.lines.map((l,i)=><tr key={l.id}>
            <td>{itemName(l.item_id)}</td>
            <td>{l.requested_quantity}</td>
            <td>{stockQty(viewBranchRequest.to_branch_id,l.item_id)}</td>
            <td>{viewBranchRequest.status==="PENDING"&&viewBranchRequest.to_branch_id===currentBranchId?
              <input type="number" min="0" max={Number(l.requested_quantity||0)} step="0.001"
                value={l.approved_quantity||""}
                onChange={e=>setViewBranchRequest(r=>({...r,lines:r.lines.map((x,n)=>n===i?{...x,approved_quantity:e.target.value}:x)}))}/>
              : l.approved_quantity}</td>
            <td>{l.sent_quantity||0}</td><td>{l.received_quantity||0}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="p-modal-actions">
          {viewBranchRequest.status==="PENDING"&&viewBranchRequest.to_branch_id===currentBranchId&&<>
            <button className="p-secondary" type="button" onClick={()=>saveBranchApproval(viewBranchRequest,false)}><XCircle size={16}/>Reject</button>
            <button className="p-primary" type="button" onClick={()=>saveBranchApproval(viewBranchRequest,true)}><CheckCircle2 size={16}/>{saving?"Approving...":"Approve Supply Qty"}</button>
          </>}
          {viewBranchRequest.status==="SENT"&&viewBranchRequest.from_branch_id===currentBranchId&&<button className="p-primary" type="button" disabled={saving} onClick={()=>acceptBranchGRN(viewBranchRequest)}><PackageCheck size={16}/>{saving?"Accepting...":"Accept GRN"}</button>}
        </div>
      </div>
    </div></div>}

    {viewGrn&&<div className="p-modal-bg"><div className="p-modal">
      <div className="p-modal-head">
        <div><h2>{viewGrn.grn_number}</h2><p>{viewGrn.purchase_orders?.po_number} • {viewGrn.suppliers?.name} • {viewGrn.status}</p></div>
        <button onClick={()=>setViewGrn(null)}><X/></button>
      </div>
      <div className="view-body">
        <p><strong>Branch:</strong> {viewGrn.branches?.branch_name||"-"}</p>
        <p><strong>GRN Date:</strong> {viewGrn.received_date}</p>
        <div className="line-table"><table>
          <thead><tr><th>Item</th><th>Quantity</th><th className="num">Unit Cost</th><th className="num">Total</th></tr></thead>
          <tbody>{viewGrn.lines.map(l=>
            <tr key={l.id}>
              <td>{l.item_name}<small>{l.sku||""}</small></td>
              <td>{l.quantity}</td>
              <td className="num">{money(l.unit_cost)}</td>
              <td className="num">{money(l.line_total)}</td>
            </tr>
          )}</tbody>
        </table></div>
        <div className="view-total">GRN Total <strong>{money(viewGrn.total)}</strong></div>
        {isCashier&&viewGrn.status==="SENT"&&
          <div className="p-modal-actions">
            <button
              type="button"
              onClick={()=>acceptGRN(viewGrn)}
              style={{
                background:"#ffffff",
                color:"#000000",
                border:"1px solid #d6deea",
                borderRadius:"10px",
                minHeight:"40px",
                padding:"0 14px",
                fontWeight:"700",
                cursor:"pointer",
                display:"inline-flex",
                alignItems:"center",
                justifyContent:"center",
                gap:"7px"
              }}
            ><CheckCircle2 size={16} color="#000000" stroke="#000000"/><span style={{color:"#000000"}}>Accept GRN</span></button>
          </div>}
      </div>
    </div></div>}
  </div>;
}

function LineEditor({lines,items,setLine,removeLine,addLine,branchId,branchStock}){
  return <div className="line-table">
    <div className="line-title"><h3>Purchase Items</h3><button type="button" onClick={addLine}><Plus size={15}/>Add Item</button></div>
    <table>
      <thead><tr><th>Item</th><th>Stock Available</th><th>Qty</th><th>Unit Cost</th><th>Discount</th><th>VAT %</th><th></th></tr></thead>
      <tbody>{lines.map((l,i)=>
        <tr key={i}>
          <td><select value={l.item_id} onChange={e=>setLine(i,"item_id",e.target.value)} required>
            <option value="">Select item</option>
            {items.map(it=><option key={it.id} value={it.id}>{it.sku?`${it.sku} - `:""}{it.name}</option>)}
          </select></td>
          <td><strong>{branchId && l.item_id ? Number(branchStock.find(x=>x.branch_id===branchId && x.item_id===l.item_id)?.quantity||0).toLocaleString("en-LK") : "-"}</strong></td>
          <td><input type="number" min="0.001" step="0.001" value={l.quantity} onChange={e=>setLine(i,"quantity",e.target.value)}/></td>
          <td><input type="number" min="0" step="0.01" value={l.unit_cost} onChange={e=>setLine(i,"unit_cost",e.target.value)}/></td>
          <td><input type="number" min="0" step="0.01" value={l.discount} onChange={e=>setLine(i,"discount",e.target.value)}/></td>
          <td><input type="number" min="0" step="0.01" value={l.vat_rate} onChange={e=>setLine(i,"vat_rate",e.target.value)}/></td>
          <td><button type="button" className="remove" onClick={()=>removeLine(i)} disabled={lines.length===1}>×</button></td>
        </tr>
      )}</tbody>
    </table>
  </div>;
}
