"use client";

import { Eye, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { apiFetch } from "@/lib/api";

type Task = {
  id:string; title:string; description:string|null; due_at:string|null; priority:string; status:string;
  assigned_to_user_id:string|null; assigned_to_name:string|null; created_by_user_id:string|null;
  created_by_name:string|null; completed_at:string|null; created_at:string; updated_at:string;
  links:Array<{entity_type:string;entity_id:string;label:string|null}>;
};
type TaskList = {total:number;offset:number;limit:number;items:Task[]};
type UserLookup = {id:string;name:string;email:string;status:string};

const priorities=["low","medium","high","urgent"];
const statuses=["todo","in_progress","blocked","completed","cancelled"];

export default function TasksPage(){
  const [rows,setRows]=useState<Task[]>([]);
  const [users,setUsers]=useState<UserLookup[]>([]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("");
  const [priorityFilter,setPriorityFilter]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"create"|"edit"|"view"|null>(null);
  const [selected,setSelected]=useState<Task|null>(null);
  const [saving,setSaving]=useState(false);
  const [form,setForm]=useState({
    title:"",description:"",due_at:"",priority:"medium",status:"todo",assigned_to_user_id:"",
  });

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const p=new URLSearchParams({limit:"300"});
      if(search.trim())p.set("search",search.trim());
      if(statusFilter)p.set("task_status",statusFilter);
      if(priorityFilter)p.set("priority",priorityFilter);
      const data=await apiFetch<TaskList>(`/tasks?${p}`);
      setRows(data.items);
    }catch(e:any){setError(e?.message||"Unable to load tasks.");}
    finally{setLoading(false);}
  },[search,statusFilter,priorityFilter]);

  useEffect(()=>{apiFetch<UserLookup[]>("/tasks/lookups/users").then(setUsers).catch(()=>{});},[]);
  useEffect(()=>{const t=setTimeout(load,220);return()=>clearTimeout(t);},[load]);

  function create(){
    setSelected(null);setForm({title:"",description:"",due_at:"",priority:"medium",status:"todo",assigned_to_user_id:""});
    setMode("create");setError("");setSuccess("");
  }

  async function open(task:Task,target:"view"|"edit"){
    setError("");
    try{
      const detail=await apiFetch<Task>(`/tasks/${task.id}`);
      setSelected(detail);
      setForm({
        title:detail.title,description:detail.description||"",
        due_at:detail.due_at?detail.due_at.slice(0,16):"",
        priority:detail.priority,status:detail.status,
        assigned_to_user_id:detail.assigned_to_user_id||"",
      });
      setMode(target);
    }catch(e:any){setError(e?.message||"Unable to load task.");}
  }

  async function save(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    const payload={
      title:form.title,
      description:form.description||null,
      due_at:form.due_at?new Date(form.due_at).toISOString():null,
      priority:form.priority,status:form.status,
      assigned_to_user_id:form.assigned_to_user_id||null,
    };
    try{
      if(mode==="create"){
        await apiFetch("/tasks",{method:"POST",body:JSON.stringify({...payload,links:[]})});
        setSuccess("Task created.");
      }else if(selected){
        await apiFetch(`/tasks/${selected.id}`,{method:"PUT",body:JSON.stringify(payload)});
        setSuccess("Task updated.");
      }
      await load();setMode(null);
    }catch(e:any){setError(e?.message||"Unable to save task.");}
    finally{setSaving(false);}
  }

  async function cancel(task:Task){
    if(!confirm(`Cancel task "${task.title}"?`))return;
    try{await apiFetch(`/tasks/${task.id}`,{method:"DELETE"});setSuccess("Task cancelled.");await load();}
    catch(e:any){setError(e?.message||"Unable to cancel task.");}
  }

  async function addLink(){
    if(!selected)return;
    const entity_type=prompt("Entity type: item, vehicle, used_part, new_item, customer, supplier, sales_order, purchase_order, shipment, container, payment, qc_inspection");
    if(!entity_type)return;
    const entity_id=prompt("Paste the related record UUID");
    if(!entity_id)return;
    try{
      const updated=await apiFetch<Task>(`/tasks/${selected.id}/links`,{
        method:"POST",body:JSON.stringify({entity_type,entity_id})
      });
      setSelected(updated);setSuccess("Task link added.");
    }catch(e:any){setError(e?.message||"Unable to add task link.");}
  }

  async function removeLink(link:Task["links"][number]){
    if(!selected)return;
    try{
      const updated=await apiFetch<Task>(`/tasks/${selected.id}/links/${link.entity_type}/${link.entity_id}`,{method:"DELETE"});
      setSelected(updated);setSuccess("Task link removed.");
    }catch(e:any){setError(e?.message||"Unable to remove task link.");}
  }

  return <>
    <div className="page-header">
      <div><div className="eyebrow">Operations</div><h1 className="page-title">Tasks & Follow-ups</h1>
        <p className="page-copy">Live operational tasks with owners, priorities, due dates and linked records.</p></div>
      <div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
        <button className="btn btn-primary" onClick={create}><Plus size={15}/>Add Task</button></div>
    </div>
    <Message error={error} success={success}/>
    <div className="records-toolbar card">
      <div><strong>Task List</strong><div className="muted" style={{fontSize:12}}>{rows.length} visible</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks..."/></div>
        <select className="select" style={{width:160}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>{statuses.map(x=><option key={x} value={x}>{labelize(x)}</option>)}
        </select>
        <select className="select" style={{width:145}} value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>{priorities.map(x=><option key={x} value={x}>{labelize(x)}</option>)}
        </select>
      </div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Task</th><th>Assigned</th><th>Due</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{loading?<LoadingRow columns={6}/>:rows.length===0?<EmptyRow columns={6}/>:rows.map(t=><tr key={t.id}>
        <td><strong>{t.title}</strong></td><td>{t.assigned_to_name||"Unassigned"}</td>
        <td>{t.due_at?new Date(t.due_at).toLocaleString():"—"}</td><td><StatusBadge value={t.priority}/></td><td><StatusBadge value={t.status}/></td>
        <td><div className="record-actions"><button className="record-action view" onClick={()=>open(t,"view")}><Eye size={14}/></button>
          <button className="record-action edit" onClick={()=>open(t,"edit")}><Pencil size={14}/></button>
          {t.status!=="cancelled"&&<button className="record-action delete" onClick={()=>cancel(t)}><Trash2 size={14}/></button>}</div></td>
      </tr>)}</tbody></table></div>

    {(mode==="create"||mode==="edit")&&<Modal title={mode==="create"?"Create Task":"Edit Task"} eyebrow="Tasks" onClose={()=>setMode(null)}>
      <form onSubmit={save}><div className="form-grid">
        <Field label="Title" value={form.title} onChange={v=>setForm({...form,title:v})} required/>
        <SelectField label="Assigned To" value={form.assigned_to_user_id} onChange={v=>setForm({...form,assigned_to_user_id:v})}
          options={[{value:"",label:"Unassigned"},...users.map(u=>({value:u.id,label:u.name||u.email}))]}/>
        <Field label="Due At" type="datetime-local" value={form.due_at} onChange={v=>setForm({...form,due_at:v})}/>
        <SelectField label="Priority" value={form.priority} onChange={v=>setForm({...form,priority:v})} options={priorities.map(x=>({value:x,label:labelize(x)}))}/>
        <SelectField label="Status" value={form.status} onChange={v=>setForm({...form,status:v})} options={statuses.map(x=>({value:x,label:labelize(x)}))}/>
        <TextAreaField label="Description" value={form.description} onChange={v=>setForm({...form,description:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Task"}</button>
      </div></form>
    </Modal>}

    {mode==="view"&&selected&&<Modal title={selected.title} eyebrow="Task Details" onClose={()=>setMode(null)}>
      <DetailGrid rows={[
        ["Assigned",selected.assigned_to_name||"Unassigned"],["Status",<StatusBadge value={selected.status}/>],
        ["Priority",<StatusBadge value={selected.priority}/>],["Due",selected.due_at?new Date(selected.due_at).toLocaleString():"—"],
        ["Created By",selected.created_by_name||"—"],["Description",selected.description||"—"],
      ]}/>
      <div className="panel-head" style={{marginTop:20}}><h3>Linked Records</h3><button className="btn btn-secondary" onClick={addLink}><Plus size={14}/>Add Link</button></div>
      {selected.links.length===0?<div className="muted">No linked business records.</div>:<div style={{display:"grid",gap:8}}>
        {selected.links.map(link=><div className="card" style={{padding:10,display:"flex",justifyContent:"space-between",alignItems:"center"}} key={`${link.entity_type}-${link.entity_id}`}>
          <div><strong>{labelize(link.entity_type)}</strong><div className="muted" style={{fontSize:12}}>{link.label||link.entity_id}</div></div>
          <button className="record-action delete" onClick={()=>removeLink(link)}><Trash2 size={14}/></button>
        </div>)}
      </div>}
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}
