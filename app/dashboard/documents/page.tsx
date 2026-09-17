"use client";

import { Eye, FilePlus2, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, TextAreaField,
} from "@/components/RealUi";
import { RequirePermission } from "@/components/RequirePermission";
import { apiFetch } from "@/lib/api";

type FileMeta={id:string;storage_provider:string;bucket_name:string|null;object_key:string;original_filename:string|null;mime_type:string|null;byte_size:number|null;checksum_sha256:string|null;created_by_user_id:string|null;created_at:string};
type DocumentRecord={
  id:string;document_number:string|null;document_name:string;document_type:string;file_id:string;
  original_filename:string|null;storage_provider:string;bucket_name:string|null;object_key:string;mime_type:string|null;byte_size:number|null;
  supplier_id:string|null;supplier_name:string|null;customer_id:string|null;customer_name:string|null;item_id:string|null;item_name:string|null;
  purchase_order_id:string|null;po_number:string|null;sales_order_id:string|null;order_number:string|null;
  shipment_id:string|null;shipment_number:string|null;container_id:string|null;container_number:string|null;
  financial_transaction_id:string|null;transaction_number:string|null;qc_inspection_id:string|null;inspection_number:string|null;
  document_date:string|null;uploaded_by_user_id:string|null;uploaded_by_name:string|null;notes:string|null;created_at:string;
};
type DocumentList={total:number;offset:number;limit:number;items:DocumentRecord[]};

function DocumentsPage(){
  const [rows,setRows]=useState<DocumentRecord[]>([]);
  const [files,setFiles]=useState<FileMeta[]>([]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"create"|"view"|"edit"|"file"|null>(null);
  const [selected,setSelected]=useState<DocumentRecord|null>(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({document_number:"",document_name:"",document_type:"general",file_id:"",document_date:"",notes:""});
  const [fileForm,setFileForm]=useState({storage_provider:"supabase_storage",bucket_name:"",object_key:"",original_filename:"",mime_type:"",byte_size:"",checksum_sha256:""});

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const p=new URLSearchParams({limit:"300"});
      if(search.trim())p.set("search",search.trim());
      if(typeFilter)p.set("document_type",typeFilter);
      const [docs,fileData]=await Promise.all([
        apiFetch<DocumentList>(`/documents?${p}`),
        apiFetch<FileMeta[]>("/documents/files?limit=300"),
      ]);
      setRows(docs.items);setFiles(fileData);
    }catch(e:any){setError(e?.message||"Unable to load documents.");}
    finally{setLoading(false);}
  },[search,typeFilter]);

  useEffect(()=>{const t=setTimeout(load,220);return()=>clearTimeout(t);},[load]);

  function create(){
    setSelected(null);setForm({document_number:"",document_name:"",document_type:"general",file_id:"",document_date:"",notes:""});
    setMode("create");
  }

  async function open(row:DocumentRecord,target:"view"|"edit"){
    try{
      const d=await apiFetch<DocumentRecord>(`/documents/${row.id}`);
      setSelected(d);setForm({
        document_number:d.document_number||"",document_name:d.document_name,document_type:d.document_type,
        file_id:d.file_id,document_date:d.document_date||"",notes:d.notes||"",
      });setMode(target);
    }catch(e:any){setError(e?.message||"Unable to load document.");}
  }

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    const payload={
      document_number:form.document_number||null,document_name:form.document_name,document_type:form.document_type,
      file_id:form.file_id,document_date:form.document_date||null,notes:form.notes||null,
    };
    try{
      if(mode==="create")await apiFetch("/documents",{method:"POST",body:JSON.stringify(payload)});
      else if(selected)await apiFetch(`/documents/${selected.id}`,{method:"PUT",body:JSON.stringify(payload)});
      setSuccess(mode==="create"?"Document created.":"Document updated.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to save document.");}
    finally{setSaving(false);}
  }

  async function remove(row:DocumentRecord){
    if(!confirm(`Delete document record "${row.document_name}"? File metadata will remain.`))return;
    try{await apiFetch(`/documents/${row.id}`,{method:"DELETE"});setSuccess("Document record deleted.");await load();}
    catch(e:any){setError(e?.message||"Unable to delete document.");}
  }

  async function registerFile(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      await apiFetch("/documents/files/register",{method:"POST",body:JSON.stringify({
        storage_provider:fileForm.storage_provider,bucket_name:fileForm.bucket_name||null,
        object_key:fileForm.object_key,original_filename:fileForm.original_filename||null,
        mime_type:fileForm.mime_type||null,byte_size:fileForm.byte_size?Number(fileForm.byte_size):null,
        checksum_sha256:fileForm.checksum_sha256||null,
      })});
      setSuccess("File metadata registered.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to register file metadata.");}
    finally{setSaving(false);}
  }

  function related(d:DocumentRecord){
    return d.po_number||d.order_number||d.shipment_number||d.container_number||d.transaction_number||
      d.inspection_number||d.customer_name||d.supplier_name||d.item_name||"—";
  }

  return <>
    <div className="page-header"><div><div className="eyebrow">Records</div><h1 className="page-title">Documents</h1>
      <p className="page-copy">Live document records linked to file metadata and business entities.</p></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
        <button className="btn btn-secondary" onClick={()=>setMode("file")}><FilePlus2 size={15}/>Register File Metadata</button>
        <button className="btn btn-primary" onClick={create}><Plus size={15}/>Add Document</button></div></div>
    <Message error={error} success={success}/>
    <div className="card" style={{padding:12,marginBottom:14}}>
      <strong>Current file behavior</strong>
      <div className="muted" style={{fontSize:12,marginTop:4}}>
        PostgreSQL stores file metadata/reference only. Actual binary upload to object storage will be added during external integration/automation.
      </div>
    </div>
    <div className="records-toolbar card"><div><strong>Document Library</strong><div className="muted" style={{fontSize:12}}>{rows.length} visible</div></div>
      <div style={{display:"flex",gap:8}}><div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, number, filename..."/></div>
        <input className="input" style={{width:160}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} placeholder="Type filter"/></div></div>
    <div className="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>File</th><th>Related To</th><th>Date</th><th>Uploaded By</th><th>Actions</th></tr></thead>
      <tbody>{loading?<LoadingRow columns={7}/>:rows.length===0?<EmptyRow columns={7}/>:rows.map(d=><tr key={d.id}>
        <td><strong>{d.document_name}</strong><div className="muted" style={{fontSize:11}}>{d.document_number||""}</div></td>
        <td>{d.document_type}</td><td>{d.original_filename||d.object_key}</td><td>{related(d)}</td><td>{d.document_date||"—"}</td><td>{d.uploaded_by_name||"—"}</td>
        <td><div className="record-actions"><button className="record-action view" onClick={()=>open(d,"view")}><Eye size={14}/></button>
          <button className="record-action edit" onClick={()=>open(d,"edit")}><Pencil size={14}/></button>
          <button className="record-action delete" onClick={()=>remove(d)}><Trash2 size={14}/></button></div></td>
      </tr>)}</tbody></table></div>

    {(mode==="create"||mode==="edit")&&<Modal title={mode==="create"?"Add Document":"Edit Document"} eyebrow="Documents" onClose={()=>setMode(null)}>
      <form onSubmit={save}><div className="form-grid">
        <Field label="Document Name" value={form.document_name} onChange={v=>setForm({...form,document_name:v})} required/>
        <Field label="Document Number" value={form.document_number} onChange={v=>setForm({...form,document_number:v})}/>
        <Field label="Document Type" value={form.document_type} onChange={v=>setForm({...form,document_type:v})} required/>
        <SelectField label="Registered File" value={form.file_id} onChange={v=>setForm({...form,file_id:v})} required
          options={[{value:"",label:"Select file metadata..."},...files.map(f=>({value:f.id,label:f.original_filename||f.object_key}))]}/>
        <Field label="Document Date" type="date" value={form.document_date} onChange={v=>setForm({...form,document_date:v})}/>
        <TextAreaField label="Notes" value={form.notes} onChange={v=>setForm({...form,notes:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Document"}</button></div></form>
    </Modal>}

    {mode==="file"&&<Modal title="Register File Metadata" eyebrow="Files" onClose={()=>setMode(null)}>
      <form onSubmit={registerFile}><div className="form-grid">
        <Field label="Storage Provider" value={fileForm.storage_provider} onChange={v=>setFileForm({...fileForm,storage_provider:v})} required/>
        <Field label="Bucket Name" value={fileForm.bucket_name} onChange={v=>setFileForm({...fileForm,bucket_name:v})}/>
        <Field label="Object Key / Path" value={fileForm.object_key} onChange={v=>setFileForm({...fileForm,object_key:v})} required/>
        <Field label="Original Filename" value={fileForm.original_filename} onChange={v=>setFileForm({...fileForm,original_filename:v})}/>
        <Field label="MIME Type" value={fileForm.mime_type} onChange={v=>setFileForm({...fileForm,mime_type:v})}/>
        <Field label="Byte Size" type="number" min="0" value={fileForm.byte_size} onChange={v=>setFileForm({...fileForm,byte_size:v})}/>
        <Field label="SHA-256 (optional)" value={fileForm.checksum_sha256} onChange={v=>setFileForm({...fileForm,checksum_sha256:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>Register File</button></div></form>
    </Modal>}

    {mode==="view"&&selected&&<Modal title={selected.document_name} eyebrow="Document Details" onClose={()=>setMode(null)}>
      <DetailGrid rows={[
        ["Document Number",selected.document_number||"—"],["Type",selected.document_type],["File",selected.original_filename||selected.object_key],
        ["Storage",`${selected.storage_provider}${selected.bucket_name?` / ${selected.bucket_name}`:""}`],["Object Key",selected.object_key],
        ["Related To",related(selected)],["Document Date",selected.document_date||"—"],["Uploaded By",selected.uploaded_by_name||"—"],["Notes",selected.notes||"—"],
      ]}/>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}

export default function Page() {
  return (
    <RequirePermission perm="documents.view">
      <DocumentsPage />
    </RequirePermission>
  );
}
