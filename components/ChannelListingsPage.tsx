"use client";

import { Loader2, Pencil, Plus, RefreshCw, Search, Store } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { AIDraftsSection } from "@/components/AIDraftsSection";
import {
  EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, labelize, money,
} from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type Account={
  id:string;provider:string;account_name:string;external_account_id:string|null;
  credentials_reference:string|null;settings:any;status:string;last_sync_at:string|null;created_at:string;updated_at:string;
};
type Listing={
  id:string;integration_account_id:string;provider:string;account_name:string;item_id:string;item_code:string;item_name:string;
  external_listing_id:string|null;listing_url:string|null;title:string|null;listing_status:string;listing_price:number|string|null;
  currency_code:string|null;remote_payload:any;last_synced_at:string|null;created_at:string;updated_at:string;
};
type ItemLookup={id:string;item_type:string;item_code:string;sku:string|null;name:string;inventory_status:string;default_selling_price:number|string|null;quantity_available:number|string};

export function ChannelListingsPage({
  provider,
  title,
  description,
}:{
  provider:"shopify"|"ebay"|"meta"|"tiktok";
  title:string;
  description:string;
}){
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [listings,setListings]=useState<Listing[]>([]);
  const [items,setItems]=useState<ItemLookup[]>([]);
  const [user,setUser]=useState<CurrentUser|null>(null);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"create"|"edit"|null>(null);
  const [selected,setSelected]=useState<Listing|null>(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({
    integration_account_id:"",item_id:"",external_listing_id:"",listing_url:"",
    title:"",listing_status:"draft",listing_price:"",currency_code:"USD",
  });

  const canManage=useMemo(()=>{
    const s=new Set((user?.roles||[]).map(x=>x.toLowerCase()));
    return s.has("administrator")||s.has("manager");
  },[user]);

  async function load(){
    setLoading(true);setError("");
    try{
      const [me,allAccounts,allListings,itemData]=await Promise.all([
        getCurrentUser(),
        apiFetch<Account[]>("/integrations/accounts"),
        apiFetch<Listing[]>(`/integrations/listings?provider=${encodeURIComponent(provider)}`),
        apiFetch<ItemLookup[]>("/sales-orders/lookups/items?limit=300"),
      ]);
      setUser(me);
      setAccounts(allAccounts.filter(a=>a.provider.toLowerCase()===provider));
      setListings(allListings);
      setItems(itemData);
    }catch(e:any){setError(e?.message||`Unable to load ${title} data.`);}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[provider]);

  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return listings;
    return listings.filter(l=>`${l.item_name} ${l.item_code} ${l.title||""} ${l.listing_status}`.toLowerCase().includes(q));
  },[listings,search]);

  function create(){
    setSelected(null);
    setForm({
      integration_account_id:accounts[0]?.id||"",item_id:"",external_listing_id:"",listing_url:"",
      title:"",listing_status:"draft",listing_price:"",currency_code:"USD",
    });
    setMode("create");setError("");
  }

  function edit(l:Listing){
    setSelected(l);
    setForm({
      integration_account_id:l.integration_account_id,item_id:l.item_id,external_listing_id:l.external_listing_id||"",
      listing_url:l.listing_url||"",title:l.title||"",listing_status:l.listing_status,
      listing_price:l.listing_price!=null?String(l.listing_price):"",currency_code:l.currency_code||"USD",
    });
    setMode("edit");
  }

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      if(mode==="create"){
        await apiFetch("/integrations/listings",{method:"POST",body:JSON.stringify({
          integration_account_id:form.integration_account_id,item_id:form.item_id,
          external_listing_id:form.external_listing_id||null,listing_url:form.listing_url||null,
          title:form.title||null,listing_status:form.listing_status,
          listing_price:form.listing_price?Number(form.listing_price):null,
          currency_code:form.currency_code||null,remote_payload:{},
        })});
        setSuccess(`${title} listing record created.`);
      }else if(selected){
        await apiFetch(`/integrations/listings/${selected.id}`,{method:"PUT",body:JSON.stringify({
          external_listing_id:form.external_listing_id||null,listing_url:form.listing_url||null,
          title:form.title||null,listing_status:form.listing_status,
          listing_price:form.listing_price?Number(form.listing_price):null,
          currency_code:form.currency_code||null,
        })});
        setSuccess(`${title} listing record updated.`);
      }
      setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to save listing record.");}
    finally{setSaving(false);}
  }

  return <>
    <div className="page-header">
      <div><div className="eyebrow">Channel Foundation</div><h1 className="page-title">{title}</h1>
        <p className="page-copy">{description}</p></div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
        {canManage&&<button className="btn btn-primary" onClick={create} disabled={accounts.length===0}><Plus size={15}/>Create Listing Record</button>}</div>
    </div>

    <Message error={error} success={success}/>

    <AIDraftsSection provider={provider} title={title}/>

    <div className="card" style={{padding:13,marginBottom:15}}>
      <strong>Integration status</strong>
      <div className="muted" style={{fontSize:12,marginTop:4}}>
        {accounts.length===0
          ? `No ${title} integration account record exists yet. Add it in System Admin → Integrations.`
          : `${accounts.length} ${title} integration account record(s) connected to this dashboard. Live provider publishing is intentionally deferred until automation.`}
      </div>
    </div>

    <div className="records-toolbar card">
      <div><strong>{title} Listing Records</strong><div className="muted" style={{fontSize:12}}>{filtered.length} visible</div></div>
      <div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search listings..."/></div>
    </div>

    <div className="table-wrap"><table><thead><tr><th>Item</th><th>Account</th><th>Title</th><th>Price</th><th>Status</th><th>External ID</th><th>Last Sync</th><th>Action</th></tr></thead>
      <tbody>{loading?<LoadingRow columns={8}/>:filtered.length===0?<EmptyRow columns={8} text="No channel listing records yet."/>:filtered.map(l=><tr key={l.id}>
        <td><strong>{l.item_name}</strong><div className="muted" style={{fontSize:11}}>{l.item_code}</div></td><td>{l.account_name}</td><td>{l.title||"—"}</td>
        <td>{l.listing_price!=null?money(l.listing_price,l.currency_code||"USD"):"—"}</td><td><StatusBadge value={l.listing_status}/></td><td>{l.external_listing_id||"—"}</td>
        <td>{l.last_synced_at?new Date(l.last_synced_at).toLocaleString():"Not synced"}</td>
        <td>{canManage&&<button className="record-action edit" onClick={()=>edit(l)}><Pencil size={14}/></button>}</td>
      </tr>)}</tbody></table></div>

    {mode&&<Modal title={mode==="create"?`Create ${title} Listing Record`:`Edit ${title} Listing Record`} eyebrow="Channel Foundation" onClose={()=>setMode(null)}>
      <form onSubmit={save}><div className="form-grid">
        <SelectField label="Integration Account" value={form.integration_account_id} onChange={v=>setForm({...form,integration_account_id:v})}
          disabled={mode==="edit"} required options={[{value:"",label:"Select account..."},...accounts.map(a=>({value:a.id,label:a.account_name}))]}/>
        <SelectField label="Catalog Item" value={form.item_id} onChange={v=>{
          const item=items.find(i=>i.id===v);
          setForm({...form,item_id:v,title:form.title||item?.name||"",listing_price:form.listing_price||(item?.default_selling_price!=null?String(item.default_selling_price):"")});
        }} disabled={mode==="edit"} required
          options={[{value:"",label:"Select item..."},...items.map(i=>({value:i.id,label:`${i.item_code} — ${i.name}`}))]}/>
        <Field label="Listing Title" value={form.title} onChange={v=>setForm({...form,title:v})}/>
        <SelectField label="Listing Status" value={form.listing_status} onChange={v=>setForm({...form,listing_status:v})}
          options={["draft","ready","published","paused","ended","error"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Listing Price" type="number" min="0" step="0.01" value={form.listing_price} onChange={v=>setForm({...form,listing_price:v})}/>
        <Field label="Currency" value={form.currency_code} onChange={v=>setForm({...form,currency_code:v})}/>
        <Field label="External Listing ID" value={form.external_listing_id} onChange={v=>setForm({...form,external_listing_id:v})}/>
        <Field label="Listing URL" value={form.listing_url} onChange={v=>setForm({...form,listing_url:v})}/>
      </div>
      <div className="card" style={{padding:10,marginTop:12,fontSize:12}}>
        This saves the controlled listing record in PostgreSQL. It does not publish to {title} yet.
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Listing Record"}</button>
      </div></form>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}
