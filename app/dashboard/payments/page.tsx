"use client";

import { Eye, Loader2, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message, Modal, SelectField, StatusBadge, TextAreaField, labelize, money } from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type Allocation={id:string;financial_transaction_id:string;sales_order_id:string|null;purchase_order_id:string|null;shipment_id:string|null;container_id:string|null;target_type:string;target_label:string;amount:number|string;notes:string|null};
type Payment={id:string;business_unit_id:string;transaction_number:string;transaction_date:string;direction:string;transaction_type:string;payment_purpose:string|null;customer_id:string|null;customer_name:string|null;supplier_id:string|null;supplier_name:string|null;counterparty_name:string|null;amount:number|string;currency_code:string;payment_method:string|null;status:string;transaction_reference:string|null;notes:string|null;created_by_user_id:string|null;allocated_amount:number|string;unallocated_amount:number|string;allocations:Allocation[];created_at:string;updated_at:string};
type ListResponse={total:number;offset:number;limit:number;items:Payment[]};
type Lookup={id:string;label:string;balance_due:number|string|null};

const directions=["incoming","outgoing"];const types=["income","expense","deposit","payment","refund","adjustment"];const purposes=["deposit","balance","full","partial","other"];const statuses=["draft","pending","failed"];
const empty={transaction_date:"",direction:"incoming",transaction_type:"payment",payment_purpose:"partial",customer_id:"",supplier_id:"",counterparty_name:"",amount:"",currency_code:"USD",payment_method:"",status:"pending",transaction_reference:"",notes:"",allocation_type:"none",allocation_id:"",allocation_amount:""};

type CustomerLite={id:string;name:string;company_name:string|null;outstanding_balance:number|string};
type CustomerOrderLite={id:string;order_number:string;order_date:string;balance_due:number|string};
const emptyReceive={customer_id:"",amount:"",payment_method:"cash",reference:"",notes:""};

export default function PaymentsPage(){
 const [rows,setRows]=useState<Payment[]>([]);const [customers,setCustomers]=useState<Lookup[]>([]);const [suppliers,setSuppliers]=useState<Lookup[]>([]);const [salesOrders,setSalesOrders]=useState<Lookup[]>([]);const [purchaseOrders,setPurchaseOrders]=useState<Lookup[]>([]);const [shipments,setShipments]=useState<Lookup[]>([]);const [containers,setContainers]=useState<Lookup[]>([]);const [user,setUser]=useState<CurrentUser|null>(null);const [search,setSearch]=useState("");const [directionFilter,setDirectionFilter]=useState("");const [statusFilter,setStatusFilter]=useState("");const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [success,setSuccess]=useState("");const [mode,setMode]=useState<"create"|"view"|"edit"|"receive"|null>(null);const [selected,setSelected]=useState<Payment|null>(null);const [form,setForm]=useState(empty);const [saving,setSaving]=useState(false);
 const [receiveCustomers,setReceiveCustomers]=useState<CustomerLite[]>([]);const [receiveOrders,setReceiveOrders]=useState<CustomerOrderLite[]>([]);const [receiveForm,setReceiveForm]=useState(emptyReceive);const [receiveSaving,setReceiveSaving]=useState(false);
 const isManager=useMemo(()=>{const r=new Set((user?.roles||[]).map(x=>x.toLowerCase()));return r.has("manager")||r.has("administrator")},[user]);
 const load=useCallback(async()=>{setLoading(true);try{const p=new URLSearchParams();if(search.trim())p.set("search",search.trim());if(directionFilter)p.set("direction",directionFilter);if(statusFilter)p.set("tx_status",statusFilter);p.set("limit","300");const r=await apiFetch<ListResponse>(`/payments?${p}`);setRows(r.items)}catch(e:any){setError(e?.message||"Unable to load payments.")}finally{setLoading(false)}},[search,directionFilter,statusFilter]);
 async function loadLookups(){try{const [c,s,so,po,sh,ct,u]=await Promise.all([apiFetch<Lookup[]>("/payments/lookups/customers"),apiFetch<Lookup[]>("/payments/lookups/suppliers"),apiFetch<Lookup[]>("/payments/lookups/sales-orders"),apiFetch<Lookup[]>("/payments/lookups/purchase-orders"),apiFetch<Lookup[]>("/payments/lookups/shipments"),apiFetch<Lookup[]>("/payments/lookups/containers"),getCurrentUser()]);setCustomers(c);setSuppliers(s);setSalesOrders(so);setPurchaseOrders(po);setShipments(sh);setContainers(ct);setUser(u)}catch(e:any){setError(e?.message||"Unable to load payment lookups.")}}
 useEffect(()=>{loadLookups()},[]);useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[load]);
 const autoOpenedRef=useRef(false);
 useEffect(()=>{
   if(autoOpenedRef.current)return;
   if(new URLSearchParams(window.location.search).get("action")==="receive-payment"){
     autoOpenedRef.current=true;openReceive();
   }
 },[]);
 function setField(k:keyof typeof empty,v:string){setForm(f=>({...f,[k]:v}))}
 function create(){setSelected(null);setForm(empty);setMode("create")}
 async function open(row:Payment,target:"view"|"edit"){setMode(target);try{const d=await apiFetch<Payment>(`/payments/${row.id}`);setSelected(d);setForm({...empty,transaction_date:d.transaction_date,direction:d.direction,transaction_type:d.transaction_type,payment_purpose:d.payment_purpose||"",customer_id:d.customer_id||"",supplier_id:d.supplier_id||"",counterparty_name:d.counterparty_name||"",amount:String(d.amount),currency_code:d.currency_code,payment_method:d.payment_method||"",status:d.status,transaction_reference:d.transaction_reference||"",notes:d.notes||""})}catch(e:any){setError(e?.message||"Unable to load payment.");setMode(null)}}
 function allocationList(){if(form.allocation_type==="sales_order")return salesOrders;if(form.allocation_type==="purchase_order")return purchaseOrders;if(form.allocation_type==="shipment")return shipments;if(form.allocation_type==="container")return containers;return []}
 function buildAllocation(){if(form.allocation_type==="none"||!form.allocation_id)return [];const base:any={amount:Number(form.allocation_amount||form.amount||0),notes:"Allocated from dashboard"};base[form.allocation_type+"_id"]=form.allocation_id;return [base]}
 async function save(e:FormEvent){e.preventDefault();setSaving(true);setError("");try{if(mode==="create"){await apiFetch("/payments",{method:"POST",body:JSON.stringify({transaction_date:form.transaction_date||null,direction:form.direction,transaction_type:form.transaction_type,payment_purpose:form.payment_purpose||null,customer_id:form.customer_id||null,supplier_id:form.supplier_id||null,counterparty_name:form.counterparty_name||null,amount:Number(form.amount),currency_code:form.currency_code||"USD",payment_method:form.payment_method||null,status:form.status,transaction_reference:form.transaction_reference||null,notes:form.notes||null,allocations:buildAllocation()})});setSuccess("Payment transaction created.")}else if(selected){await apiFetch(`/payments/${selected.id}`,{method:"PUT",body:JSON.stringify({transaction_date:form.transaction_date||null,direction:form.direction,transaction_type:form.transaction_type,payment_purpose:form.payment_purpose||null,customer_id:form.customer_id||null,supplier_id:form.supplier_id||null,counterparty_name:form.counterparty_name||null,amount:Number(form.amount),currency_code:form.currency_code||"USD",payment_method:form.payment_method||null,transaction_reference:form.transaction_reference||null,notes:form.notes||null})});setSuccess("Payment updated.")}await load();setMode(null)}catch(e:any){setError(e?.message||"Unable to save payment.")}finally{setSaving(false)}}
 async function post(row:Payment){if(!confirm(`Post ${row.transaction_number}? Posted transactions become locked.`))return;try{await apiFetch(`/payments/${row.id}/post`,{method:"POST"});setSuccess("Transaction posted.");await load()}catch(e:any){setError(e?.message||"Unable to post transaction.")}}
 async function voidTx(row:Payment){if(!confirm(`Void ${row.transaction_number}?`))return;try{await apiFetch(`/payments/${row.id}/void`,{method:"POST"});setSuccess("Transaction voided.");await load()}catch(e:any){setError(e?.message||"Unable to void transaction.")}}
 async function addAllocation(){if(!selected)return;const type=prompt("Target type: sales_order, purchase_order, shipment, container","sales_order");if(!type)return;const source=type==="sales_order"?salesOrders:type==="purchase_order"?purchaseOrders:type==="shipment"?shipments:type==="container"?containers:[];const id=prompt("Target ID",source[0]?.id||"");if(!id)return;const amount=Number(prompt(`Amount (unallocated ${selected.unallocated_amount})`,String(selected.unallocated_amount))||0);const body:any={amount,notes:"Allocated from dashboard"};body[type+"_id"]=id;try{const d=await apiFetch<Payment>(`/payments/${selected.id}/allocations`,{method:"POST",body:JSON.stringify(body)});setSelected(d);setSuccess("Allocation added.")}catch(e:any){setError(e?.message||"Unable to add allocation.")}}
 async function removeAllocation(a:Allocation){if(!selected||!confirm(`Remove allocation to ${a.target_label}?`))return;try{const d=await apiFetch<Payment>(`/payments/${selected.id}/allocations/${a.id}`,{method:"DELETE"});setSelected(d);setSuccess("Allocation removed.")}catch(e:any){setError(e?.message||"Unable to remove allocation.")}}

 const receiveOutstanding=useMemo(()=>receiveOrders.reduce((s,o)=>s+Number(o.balance_due),0),[receiveOrders]);

 async function openReceive(){
   setReceiveForm(emptyReceive);setReceiveOrders([]);setError("");setMode("receive");
   if(receiveCustomers.length===0){
     try{const r=await apiFetch<{items:CustomerLite[]}>("/customers?limit=300");setReceiveCustomers(r.items);}
     catch(e:any){setError(e?.message||"Unable to load customers.");}
   }
 }

 async function selectReceiveCustomer(id:string){
   setReceiveForm(f=>({...f,customer_id:id,amount:""}));setReceiveOrders([]);
   if(!id)return;
   try{
     const orders=await apiFetch<CustomerOrderLite[]>(`/customers/${id}/orders`);
     setReceiveOrders(orders.filter(o=>Number(o.balance_due)>0).sort((a,b)=>a.order_date.localeCompare(b.order_date)));
   }catch(e:any){setError(e?.message||"Unable to load customer orders.");}
 }

 async function submitReceive(e:FormEvent){
   e.preventDefault();
   if(!receiveForm.customer_id){setError("Select a customer.");return;}
   const amount=Number(receiveForm.amount);
   if(!(amount>0)){setError("Enter an amount greater than zero.");return;}
   if(receiveOutstanding>0&&amount>receiveOutstanding){setError(`Amount cannot exceed the outstanding balance (${money(receiveOutstanding)}).`);return;}
   setReceiveSaving(true);setError("");
   try{
     let remaining=amount;
     const allocations:any[]=[];
     for(const o of receiveOrders){
       if(remaining<=0)break;
       const apply=Math.min(remaining,Number(o.balance_due));
       allocations.push({sales_order_id:o.id,purchase_order_id:null,shipment_id:null,container_id:null,amount:apply,notes:`Applied to ${o.order_number}`});
       remaining-=apply;
     }
     const customer=receiveCustomers.find(c=>c.id===receiveForm.customer_id);
     const label=customer?(customer.company_name?`${customer.name} — ${customer.company_name}`:customer.name):null;
     const payment=await apiFetch<Payment>("/payments",{method:"POST",body:JSON.stringify({
       direction:"incoming",transaction_type:"payment",
       payment_purpose:receiveOrders.length===0?"deposit":amount>=receiveOutstanding?"full":"partial",
       customer_id:receiveForm.customer_id,supplier_id:null,counterparty_name:label,
       amount,currency_code:"USD",payment_method:receiveForm.payment_method||null,status:"pending",
       transaction_reference:receiveForm.reference||null,notes:receiveForm.notes||`Payment received from ${customer?.name||"customer"}`,
       allocations,
     })});
     if(isManager){
       await apiFetch(`/payments/${payment.id}/post`,{method:"POST"});
       setSuccess("Payment recorded and posted. Balance updated.");
     }else{
       setSuccess("Payment recorded as pending — a Manager/Admin must post it to update the balance.");
     }
     await load();setMode(null);
   }catch(e:any){setError(e?.message||"Unable to record payment.");}
   finally{setReceiveSaving(false);}
 }

 return <><div className="page-header"><div><div className="eyebrow">Finance</div><h1 className="page-title">Payments</h1><p className="page-copy">Customer receipts, supplier payments, allocations and posting status.</p></div><div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button><button className="btn btn-secondary" onClick={create}><Plus size={15}/>Advanced Transaction</button><button className="btn btn-primary" onClick={openReceive}><Wallet size={15}/>Receive Payment</button></div></div><Message error={error} success={success}/><div className="records-toolbar card"><div><strong>Financial Transactions</strong><div className="muted" style={{fontSize:12}}>{rows.length} visible</div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Reference or counterparty..."/></div><select className="select" style={{width:140}} value={directionFilter} onChange={e=>setDirectionFilter(e.target.value)}><option value="">All directions</option><option value="incoming">Incoming</option><option value="outgoing">Outgoing</option></select><select className="select" style={{width:140}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">All statuses</option>{["draft","pending","posted","failed","void","refunded"].map(s=><option key={s} value={s}>{labelize(s)}</option>)}</select></div></div><div className="table-wrap"><table><thead><tr><th>Transaction</th><th>Date</th><th>Direction</th><th>Counterparty</th><th>Amount</th><th>Allocated</th><th>Unallocated</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading?<LoadingRow columns={9}/>:rows.length===0?<EmptyRow columns={9}/>:rows.map(r=><tr key={r.id}><td><strong>{r.transaction_number}</strong><div className="muted" style={{fontSize:11}}>{r.transaction_reference||""}</div></td><td>{r.transaction_date}</td><td>{labelize(r.direction)}</td><td>{r.customer_name||r.supplier_name||r.counterparty_name||"—"}</td><td>{money(r.amount,r.currency_code)}</td><td>{money(r.allocated_amount,r.currency_code)}</td><td>{money(r.unallocated_amount,r.currency_code)}</td><td><StatusBadge value={r.status}/></td><td><div className="record-actions"><button className="record-action view" onClick={()=>open(r,"view")}><Eye size={14}/></button>{!["posted","void","refunded"].includes(r.status)&&<button className="record-action edit" onClick={()=>open(r,"edit")}><Pencil size={14}/></button>}{isManager&&!["posted","void","refunded"].includes(r.status)&&<button className="record-action view" title="Post" onClick={()=>post(r)}><ShieldCheck size={14}/></button>}{isManager&&r.status!=="void"&&r.status!=="refunded"&&<button className="record-action delete" title="Void" onClick={()=>voidTx(r)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>
 {mode==="receive"&&<Modal title="Receive Payment" eyebrow="Finance" onClose={()=>setMode(null)}>
   <form onSubmit={submitReceive}><div className="form-grid">
     <SelectField label="Customer" value={receiveForm.customer_id} onChange={selectReceiveCustomer} required
       options={[{value:"",label:"Select customer..."},...receiveCustomers.map(c=>({value:c.id,
         label:`${c.company_name?`${c.name} — ${c.company_name}`:c.name}${Number(c.outstanding_balance)>0?` (Owes ${money(c.outstanding_balance)})`:""}`}))]}/>
     <Field label="Payment Method" value={receiveForm.payment_method} onChange={v=>setReceiveForm({...receiveForm,payment_method:v})}/>
   </div>
   {receiveForm.customer_id&&<div className="card" style={{padding:12,margin:"14px 0",fontSize:13}}>
     <strong>Outstanding Balance: {money(receiveOutstanding)}</strong>
     {receiveOrders.length===0&&<div className="muted" style={{marginTop:4}}>No open balance on file — this will be recorded as an advance deposit.</div>}
   </div>}
   <div className="form-grid">
     <Field label="Amount Received" type="number" min="0.01" step="0.01" value={receiveForm.amount} onChange={v=>setReceiveForm({...receiveForm,amount:v})} required/>
     <Field label="Reference" value={receiveForm.reference} onChange={v=>setReceiveForm({...receiveForm,reference:v})}/>
     <TextAreaField label="Notes" value={receiveForm.notes} onChange={v=>setReceiveForm({...receiveForm,notes:v})}/>
   </div>
   <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
     <button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
     <button className="btn btn-primary" disabled={receiveSaving}>{receiveSaving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Payment"}</button>
   </div></form>
 </Modal>}
 {(mode==="create"||mode==="edit")&&<Modal title={mode==="create"?"Record Payment":`Edit ${selected?.transaction_number||"Transaction"}`} eyebrow="Finance" onClose={()=>setMode(null)}><form onSubmit={save}><div className="form-grid"><Field label="Transaction Date" type="date" value={form.transaction_date} onChange={v=>setField("transaction_date",v)}/><SelectField label="Direction" value={form.direction} onChange={v=>{setField("direction",v);setForm(f=>({...f,customer_id:"",supplier_id:"",allocation_type:v==="incoming"?"sales_order":"purchase_order",allocation_id:""}))}} options={directions.map(v=>({value:v,label:labelize(v)}))}/><SelectField label="Transaction Type" value={form.transaction_type} onChange={v=>setField("transaction_type",v)} options={types.map(v=>({value:v,label:labelize(v)}))}/><SelectField label="Purpose" value={form.payment_purpose} onChange={v=>setField("payment_purpose",v)} options={[{value:"",label:"No purpose"},...purposes.map(v=>({value:v,label:labelize(v)}))]}/>{form.direction==="incoming"?<SelectField label="Customer" value={form.customer_id} onChange={v=>setForm(f=>({...f,customer_id:v,supplier_id:""}))} options={[{value:"",label:"No customer"},...customers.map(x=>({value:x.id,label:x.label}))]}/>:<SelectField label="Supplier" value={form.supplier_id} onChange={v=>setForm(f=>({...f,supplier_id:v,customer_id:""}))} options={[{value:"",label:"No supplier"},...suppliers.map(x=>({value:x.id,label:x.label}))]}/>}<Field label="Counterparty Name" value={form.counterparty_name} onChange={v=>setField("counterparty_name",v)}/><Field label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={v=>setField("amount",v)} required/><Field label="Currency" value={form.currency_code} onChange={v=>setField("currency_code",v)}/><Field label="Payment Method" value={form.payment_method} onChange={v=>setField("payment_method",v)} placeholder="bank_transfer, cash..."/>{mode==="create"&&<SelectField label="Initial Status" value={form.status} onChange={v=>setField("status",v)} options={statuses.map(v=>({value:v,label:labelize(v)}))}/>}<Field label="Reference" value={form.transaction_reference} onChange={v=>setField("transaction_reference",v)}/>{mode==="create"&&<><SelectField label="Allocate To" value={form.allocation_type} onChange={v=>setForm(f=>({...f,allocation_type:v,allocation_id:""}))} options={[{value:"none",label:"Leave unallocated"},{value:"sales_order",label:"Sales Order"},{value:"purchase_order",label:"Purchase Order"},{value:"shipment",label:"Shipment"},{value:"container",label:"Container"}]}/>{form.allocation_type!=="none"&&<SelectField label="Allocation Target" value={form.allocation_id} onChange={v=>setField("allocation_id",v)} options={[{value:"",label:"Select target..."},...allocationList().map(x=>({value:x.id,label:x.balance_due!=null?`${x.label} · Balance ${money(x.balance_due)}`:x.label}))]}/>} {form.allocation_type!=="none"&&<Field label="Allocation Amount" type="number" min="0.01" step="0.01" value={form.allocation_amount} onChange={v=>setField("allocation_amount",v)}/>}</>}<TextAreaField label="Notes" value={form.notes} onChange={v=>setField("notes",v)}/></div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Transaction"}</button></div></form></Modal>}
 {mode==="view"&&selected&&<Modal title={selected.transaction_number} eyebrow="Financial Transaction" onClose={()=>setMode(null)} width={950}><DetailGrid rows={[["Date",selected.transaction_date],["Direction",labelize(selected.direction)],["Type",labelize(selected.transaction_type)],["Purpose",labelize(selected.payment_purpose)],["Counterparty",selected.customer_name||selected.supplier_name||selected.counterparty_name||"—"],["Amount",money(selected.amount,selected.currency_code)],["Allocated",money(selected.allocated_amount,selected.currency_code)],["Unallocated",money(selected.unallocated_amount,selected.currency_code)],["Status",<StatusBadge value={selected.status}/>],["Reference",selected.transaction_reference||"—"],["Notes",selected.notes||"—"]]}/><div className="panel-head" style={{marginTop:22}}><h3>Allocations</h3>{!["posted","void","refunded"].includes(selected.status)&&<button className="btn btn-secondary" onClick={addAllocation}><Plus size={14}/>Add Allocation</button>}</div><div className="table-wrap"><table><thead><tr><th>Target</th><th>Type</th><th>Amount</th><th>Notes</th><th>Action</th></tr></thead><tbody>{selected.allocations.length===0?<EmptyRow columns={5} text="No allocations."/>:selected.allocations.map(a=><tr key={a.id}><td>{a.target_label}</td><td>{labelize(a.target_type)}</td><td>{money(a.amount,selected.currency_code)}</td><td>{a.notes||"—"}</td><td>{!["posted","void","refunded"].includes(selected.status)&&<button className="record-action delete" onClick={()=>removeAllocation(a)}><Trash2 size={14}/></button>}</td></tr>)}</tbody></table></div></Modal>}
 <GlobalSpinStyle/></>;
}
