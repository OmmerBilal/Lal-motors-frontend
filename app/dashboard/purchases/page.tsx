"use client";

import { Eye, Loader2, PackageCheck, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message, Modal, SelectField, StatusBadge, TextAreaField, labelize, money } from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type POItem={id:string;item_id:string;item_code_snapshot:string;description_snapshot:string|null;quantity_ordered:number|string;quantity_received:number|string;quantity_remaining:number|string;unit_cost:number|string;line_total:number|string;notes:string|null};
type PO={id:string;po_number:string;supplier_id:string;supplier_name:string;order_date:string|null;expected_delivery:string|null;status:string;currency_code:string;shipping_amount:number|string;notes:string|null;items_total:number|string;order_total:number|string;paid_amount:number|string;balance_due:number|string;payment_status:string;items:POItem[];created_at:string;updated_at:string};
type ListResponse={total:number;offset:number;limit:number;items:PO[]};
type Supplier={id:string;supplier_number:string|null;name:string;company_name:string|null;payment_terms:string|null};
type Item={id:string;item_type:string;item_code:string;sku:string|null;name:string;default_cost:number|string|null;inventory_status:string};
type Location={id:string;location_code:string;name:string|null;location_type:string;operational_status:string};
const statuses=["draft","submitted","confirmed","in_production","partially_received","fully_received","cancelled","closed"];
const manualStatuses=["draft","submitted","confirmed","in_production","closed"];

export default function PurchaseOrdersPage(){
  const [rows,setRows]=useState<PO[]>([]);const [suppliers,setSuppliers]=useState<Supplier[]>([]);const [items,setItems]=useState<Item[]>([]);const [locations,setLocations]=useState<Location[]>([]);const [user,setUser]=useState<CurrentUser|null>(null);const [search,setSearch]=useState("");const [statusFilter,setStatusFilter]=useState("");const [supplierFilter,setSupplierFilter]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [mode,setMode]=useState<"create"|"view"|"edit"|"receive"|null>(null);const [selected,setSelected]=useState<PO|null>(null);const [selectedLine,setSelectedLine]=useState<POItem|null>(null);const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({supplier_id:"",order_date:"",expected_delivery:"",status:"draft",shipping_amount:"0",notes:"",item_id:"",quantity:"1",unit_cost:""});
  const [receiveForm,setReceiveForm]=useState({storage_location_id:"",quantity:"1",notes:""});
  const isManager=useMemo(()=>{const r=new Set((user?.roles||[]).map(x=>x.toLowerCase()));return r.has("manager")||r.has("administrator")},[user]);
  const load=useCallback(async()=>{setLoading(true);try{const p=new URLSearchParams();if(search.trim())p.set("search",search.trim());if(statusFilter)p.set("po_status",statusFilter);if(supplierFilter)p.set("supplier_id",supplierFilter);p.set("limit","300");const r=await apiFetch<ListResponse>(`/purchase-orders?${p}`);setRows(r.items)}catch(e:any){setError(e?.message||"Unable to load purchase orders.")}finally{setLoading(false)}},[search,statusFilter,supplierFilter]);
  useEffect(()=>{Promise.all([apiFetch<Supplier[]>("/purchase-orders/lookups/suppliers"),apiFetch<Item[]>("/purchase-orders/lookups/items?limit=300"),apiFetch<Location[]>("/purchase-orders/lookups/storage-locations"),getCurrentUser()]).then(([s,i,l,u])=>{setSuppliers(s);setItems(i);setLocations(l);setUser(u)}).catch((e:any)=>setError(e?.message||"Unable to load PO lookups."))},[]);useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[load]);
  function create(){setForm({supplier_id:suppliers[0]?.id||"",order_date:"",expected_delivery:"",status:"draft",shipping_amount:"0",notes:"",item_id:"",quantity:"1",unit_cost:""});setSelected(null);setMode("create")}
  async function open(po:PO,target:"view"|"edit"){setMode(target);try{const d=await apiFetch<PO>(`/purchase-orders/${po.id}`);setSelected(d);setForm({supplier_id:d.supplier_id,order_date:d.order_date||"",expected_delivery:d.expected_delivery||"",status:d.status,shipping_amount:String(d.shipping_amount),notes:d.notes||"",item_id:"",quantity:"1",unit_cost:""})}catch(e:any){setError(e?.message||"Unable to load purchase order.");setMode(null)}}
  async function save(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{if(mode==="create"){await apiFetch("/purchase-orders",{method:"POST",body:JSON.stringify({supplier_id:form.supplier_id,order_date:form.order_date||null,expected_delivery:form.expected_delivery||null,status:form.status,shipping_amount:Number(form.shipping_amount||0),notes:form.notes||null,items:form.item_id?[{item_id:form.item_id,quantity_ordered:Number(form.quantity),unit_cost:Number(form.unit_cost||0),notes:null}]:[]})});setSuccess("Purchase order created.")}else if(selected){await apiFetch(`/purchase-orders/${selected.id}`,{method:"PUT",body:JSON.stringify({supplier_id:form.supplier_id,order_date:form.order_date||null,expected_delivery:form.expected_delivery||null,status:form.status,shipping_amount:Number(form.shipping_amount||0),notes:form.notes||null})});setSuccess("Purchase order updated.")}await load();setMode(null)}catch(e:any){setError(e?.message||"Unable to save purchase order.")}finally{setSaving(false)}}
  async function cancel(po:PO){if(!confirm(`Cancel ${po.po_number}?`))return;try{await apiFetch(`/purchase-orders/${po.id}`,{method:"DELETE"});setSuccess("Purchase order cancelled.");await load()}catch(e:any){setError(e?.message||"Unable to cancel PO.")}}
  async function addLine(){if(!selected)return;const itemId=prompt("Item ID",items[0]?.id||"");if(!itemId)return;const qty=Number(prompt("Quantity ordered","1")||0);const cost=Number(prompt("Unit cost","0")||0);try{await apiFetch(`/purchase-orders/${selected.id}/items`,{method:"POST",body:JSON.stringify({item_id:itemId,quantity_ordered:qty,unit_cost:cost,notes:null})});await open(selected,"view")}catch(e:any){setError(e?.message||"Unable to add PO line.")}}
  async function editLine(line:POItem){if(!selected)return;const qty=Number(prompt("Quantity ordered",String(line.quantity_ordered))||0);const cost=Number(prompt("Unit cost",String(line.unit_cost))||0);try{await apiFetch(`/purchase-orders/${selected.id}/items/${line.id}`,{method:"PUT",body:JSON.stringify({quantity_ordered:qty,unit_cost:cost})});await open(selected,"view")}catch(e:any){setError(e?.message||"Unable to edit PO line.")}}
  async function removeLine(line:POItem){if(!selected||!confirm(`Remove ${line.item_code_snapshot}?`))return;try{await apiFetch(`/purchase-orders/${selected.id}/items/${line.id}`,{method:"DELETE"});await open(selected,"view")}catch(e:any){setError(e?.message||"Unable to remove PO line.")}}
  function beginReceive(line:POItem){
    if(!selected)return;
    if(Number(line.quantity_remaining)<=0){setError("This PO line is already fully received.");return}
    const firstActive=locations.find(l=>l.operational_status==="active")||locations[0];
    setSelectedLine(line);
    setReceiveForm({
      storage_location_id:firstActive?.id||"",
      quantity:String(line.quantity_remaining),
      notes:`Received against ${selected.po_number}`,
    });
    setMode("receive");
    setError("");
  }

  async function saveReceive(e:FormEvent){
    e.preventDefault();
    if(!selected||!selectedLine)return;
    const qty=Number(receiveForm.quantity);
    if(!Number.isFinite(qty)||qty<=0){setError("Receive quantity must be greater than zero.");return}
    if(qty>Number(selectedLine.quantity_remaining)){setError(`You can receive at most ${selectedLine.quantity_remaining}.`);return}
    if(!receiveForm.storage_location_id){setError("Select a storage location.");return}
    setSaving(true);setError("");
    try{
      await apiFetch(`/purchase-orders/${selected.id}/items/${selectedLine.id}/receive`,{
        method:"POST",
        body:JSON.stringify({
          quantity:qty,
          storage_location_id:receiveForm.storage_location_id,
          notes:receiveForm.notes||null,
        }),
      });
      const updated=await apiFetch<PO>(`/purchase-orders/${selected.id}`);
      setSelected(updated);
      setSuccess("Stock received. PO received quantity, PO status, inventory balance and inventory movement were updated.");
      setMode("view");
      setSelectedLine(null);
      await load();
    }catch(e:any){
      setError(e?.message||"Unable to receive PO inventory.");
    }finally{
      setSaving(false);
    }
  }

  return <><div className="page-header"><div><div className="eyebrow">Procurement</div><h1 className="page-title">Purchase Orders</h1><p className="page-copy">Live supplier orders from draft through inventory receiving.</p></div><div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button><button className="btn btn-primary" onClick={create}><Plus size={15}/>Add PO</button></div></div><Message error={error} success={success}/>
  <div className="records-toolbar card"><div><strong>All Purchase Orders</strong><div className="muted" style={{fontSize:12}}>{rows.length} visible</div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="PO or supplier..."/></div><select className="select" style={{width:160}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s} value={s}>{labelize(s)}</option>)}</select><select className="select" style={{width:170}} value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)}><option value="">All suppliers</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
  <div className="table-wrap"><table><thead><tr><th>PO</th><th>Supplier</th><th>Date</th><th>Expected</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading?<LoadingRow columns={9}/>:rows.length===0?<EmptyRow columns={9}/>:rows.map(p=><tr key={p.id}><td><strong>{p.po_number}</strong></td><td>{p.supplier_name}</td><td>{p.order_date||"—"}</td><td>{p.expected_delivery||"—"}</td><td>{money(p.order_total,p.currency_code)}</td><td>{money(p.paid_amount,p.currency_code)}</td><td>{money(p.balance_due,p.currency_code)}</td><td><StatusBadge value={p.status}/></td><td><div className="record-actions"><button className="record-action view" onClick={()=>open(p,"view")}><Eye size={14}/></button><button className="record-action edit" onClick={()=>open(p,"edit")}><Pencil size={14}/></button>{isManager&&p.status!=="cancelled"&&<button className="record-action delete" onClick={()=>cancel(p)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>
  {(mode==="create"||mode==="edit")&&<Modal title={mode==="create"?"Create Purchase Order":`Edit ${selected?.po_number||"PO"}`} eyebrow="Purchase Order" onClose={()=>setMode(null)}><form onSubmit={save}><div className="form-grid"><SelectField label="Supplier" value={form.supplier_id} onChange={v=>setForm({...form,supplier_id:v})} required options={[{value:"",label:"Select supplier..."},...suppliers.map(s=>({value:s.id,label:s.name}))]}/><SelectField label="Status" value={form.status} onChange={v=>setForm({...form,status:v})}
  options={[
    ...(mode==="edit"&&!manualStatuses.includes(form.status)?[{value:form.status,label:`${labelize(form.status)} (Automatic)`}]:[]),
    ...manualStatuses.map(s=>({value:s,label:labelize(s)})),
  ]}/><Field label="Order Date" type="date" value={form.order_date} onChange={v=>setForm({...form,order_date:v})}/><Field label="Expected Delivery" type="date" value={form.expected_delivery} onChange={v=>setForm({...form,expected_delivery:v})}/><Field label="Shipping Amount" type="number" min="0" step="0.01" value={form.shipping_amount} onChange={v=>setForm({...form,shipping_amount:v})}/>{mode==="create"&&<><SelectField label="First Item (optional)" value={form.item_id} onChange={v=>{const i=items.find(x=>x.id===v);setForm({...form,item_id:v,unit_cost:i?.default_cost!=null?String(i.default_cost):""})}} options={[{value:"",label:"Create without line item"},...items.map(i=>({value:i.id,label:`${i.item_code} — ${i.name}`}))]}/><Field label="Quantity" type="number" min="0.001" step="0.001" value={form.quantity} onChange={v=>setForm({...form,quantity:v})}/><Field label="Unit Cost" type="number" min="0" step="0.01" value={form.unit_cost} onChange={v=>setForm({...form,unit_cost:v})}/></>}<TextAreaField label="Notes" value={form.notes} onChange={v=>setForm({...form,notes:v})}/></div>
  <div className="card" style={{padding:10,marginTop:12,fontSize:12}}>
    <strong>Receiving stock is separate from PO status.</strong>
    <div className="muted" style={{marginTop:4}}>
      Do not manually set Partially Received or Fully Received. Open the PO, click Receive on a line item, choose quantity and storage location, and the backend sets the received status automatically.
    </div>
  </div>
  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save PO"}</button></div></form></Modal>}
  {mode==="view"&&selected&&<Modal title={selected.po_number} eyebrow="Purchase Order" onClose={()=>setMode(null)} width={1050}><DetailGrid rows={[["Supplier",selected.supplier_name],["Order Date",selected.order_date||"—"],["Expected",selected.expected_delivery||"—"],["Status",<StatusBadge value={selected.status}/>],["Order Total",money(selected.order_total,selected.currency_code)],["Paid",money(selected.paid_amount,selected.currency_code)],["Balance",money(selected.balance_due,selected.currency_code)],["Payment",<StatusBadge value={selected.payment_status}/>],["Notes",selected.notes||"—"]]}/><div className="panel-head" style={{marginTop:22}}><h3>PO Lines</h3><button className="btn btn-secondary" onClick={addLine}><Plus size={14}/>Add Line</button></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Unit Cost</th><th>Total</th><th>Actions</th></tr></thead><tbody>{selected.items.length===0?<EmptyRow columns={7} text="No PO lines."/>:selected.items.map(i=><tr key={i.id}><td>{i.item_code_snapshot}</td><td>{Number(i.quantity_ordered)}</td><td>{Number(i.quantity_received)}</td><td>{Number(i.quantity_remaining)}</td><td>{money(i.unit_cost)}</td><td>{money(i.line_total)}</td><td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Number(i.quantity_remaining)>0&&<button className="btn btn-primary" onClick={()=>beginReceive(i)}><PackageCheck size={13}/>Receive Stock</button>}<button className="record-action edit" onClick={()=>editLine(i)}><Pencil size={14}/></button><button className="record-action delete" onClick={()=>removeLine(i)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div></Modal>}

  {mode==="receive"&&selected&&selectedLine&&<Modal title={`Receive ${selectedLine.item_code_snapshot}`} eyebrow={selected.po_number} onClose={()=>{setMode("view");setSelectedLine(null)}}>
    <form onSubmit={saveReceive}>
      <div className="form-grid">
        <Field label="Ordered Quantity" value={String(selectedLine.quantity_ordered)} onChange={()=>{}} disabled/>
        <Field label="Already Received" value={String(selectedLine.quantity_received)} onChange={()=>{}} disabled/>
        <Field label="Remaining Quantity" value={String(selectedLine.quantity_remaining)} onChange={()=>{}} disabled/>
        <Field label="Quantity to Receive" type="number" min="0.001" max={String(selectedLine.quantity_remaining)} step="0.001"
          value={receiveForm.quantity} onChange={v=>setReceiveForm({...receiveForm,quantity:v})} required/>
        <SelectField label="Storage Location" value={receiveForm.storage_location_id}
          onChange={v=>setReceiveForm({...receiveForm,storage_location_id:v})} required
          options={[{value:"",label:"Select storage location..."},...locations.filter(l=>l.operational_status==="active").map(l=>({
            value:l.id,label:`${l.location_code}${l.name?` — ${l.name}`:""}`
          }))]}/>
        <TextAreaField label="Receiving Notes" value={receiveForm.notes} onChange={v=>setReceiveForm({...receiveForm,notes:v})}/>
      </div>
      <div className="card" style={{padding:10,marginTop:12,fontSize:12}}>
        This action will increase Inventory and automatically update the PO line's received quantity and PO status.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>{setMode("view");setSelectedLine(null)}}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Receiving...</>:<><PackageCheck size={14}/>Receive Stock</>}</button>
      </div>
    </form>
  </Modal>}
  <GlobalSpinStyle/></>;
}
