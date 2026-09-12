"use client";

import {
  Activity, KeyRound, Loader2, Plus, RefreshCw, RotateCcw,
  ShieldCheck, UserCog, Workflow,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type UserRecord={
  id:string;email:string;display_name:string|null;status:string;employee_id:string|null;
  last_login_at:string|null;created_at:string;roles:Array<{id:string;name:string}>;
};
type Role={id:string;name:string;description:string|null;is_system_role:boolean;permissions:Array<{id:string;permission_key:string;description:string|null}>};
type Permission={id:string;permission_key:string;description:string|null};
type AuditList={total:number;offset:number;limit:number;items:Array<any>};
type IntegrationAccount={id:string;provider:string;account_name:string;external_account_id:string|null;credentials_reference:string|null;settings:any;status:string;last_sync_at:string|null;created_at:string;updated_at:string};
type OutboxEvent={id:string;event_type:string;aggregate_type:string;aggregate_id:string|null;payload:any;status:string;attempts:number;next_attempt_at:string|null;last_error:string|null;created_at:string;processed_at:string|null};
type ExternalRef={id:string;integration_account_id:string;provider:string;account_name:string;entity_type:string;entity_id:string;external_id:string;external_url:string|null;metadata:any;created_at:string};

const tabs=["Users & Roles","Audit Log","Integrations","Outbox"] as const;
type Tab=(typeof tabs)[number];

export default function SystemAdminPage(){
  const [tab,setTab]=useState<Tab>("Users & Roles");
  const [currentUser,setCurrentUser]=useState<CurrentUser|null>(null);
  const [users,setUsers]=useState<UserRecord[]>([]);
  const [roles,setRoles]=useState<Role[]>([]);
  const [permissions,setPermissions]=useState<Permission[]>([]);
  const [audit,setAudit]=useState<AuditList>({total:0,offset:0,limit:100,items:[]});
  const [accounts,setAccounts]=useState<IntegrationAccount[]>([]);
  const [outbox,setOutbox]=useState<OutboxEvent[]>([]);
  const [externalRefs,setExternalRefs]=useState<ExternalRef[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"role"|"account"|null>(null);
  const [saving,setSaving]=useState(false);
  const [roleForm,setRoleForm]=useState({name:"",description:""});
  const [accountForm,setAccountForm]=useState({provider:"shopify",account_name:"",external_account_id:"",credentials_reference:"",status:"active"});

  const isAdmin=useMemo(()=>currentUser?.roles.some(r=>r.toLowerCase()==="administrator")||false,[currentUser]);
  const isManager=useMemo(()=>currentUser?.roles.some(r=>["administrator","manager"].includes(r.toLowerCase()))||false,[currentUser]);

  async function load(){
    setLoading(true);setError("");
    try{
      const me=await getCurrentUser();setCurrentUser(me);

      const [auditData,accountData,refData]=await Promise.all([
        apiFetch<AuditList>("/admin/audit?limit=100"),
        apiFetch<IntegrationAccount[]>("/integrations/accounts"),
        apiFetch<ExternalRef[]>("/integrations/external-refs"),
      ]);
      setAudit(auditData);setAccounts(accountData);setExternalRefs(refData);

      if(me.roles.some(r=>r.toLowerCase()==="administrator")){
        const [userData,roleData,permissionData]=await Promise.all([
          apiFetch<UserRecord[]>("/admin/users"),
          apiFetch<Role[]>("/admin/roles"),
          apiFetch<Permission[]>("/admin/permissions"),
        ]);
        setUsers(userData);setRoles(roleData);setPermissions(permissionData);
      }

      if(me.roles.some(r=>["administrator","manager"].includes(r.toLowerCase()))){
        const out=await apiFetch<OutboxEvent[]>("/integrations/outbox?limit=100");
        setOutbox(out);
      }
    }catch(e:any){setError(e?.message||"Unable to load system administration data.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);

  async function changeUserStatus(user:UserRecord){
    const status=prompt("User status: active, disabled, invited",user.status);
    if(!status)return;
    try{
      await apiFetch(`/admin/users/${user.id}/status`,{method:"PUT",body:JSON.stringify({status})});
      setSuccess("User status updated.");await load();
    }catch(e:any){setError(e?.message||"Unable to update user.");}
  }

  async function assignRole(user:UserRecord){
    if(roles.length===0)return;
    const n=Number(prompt(`Choose role:\n${roles.map((r,i)=>`${i+1}. ${r.name}`).join("\n")}`));
    if(!n||!roles[n-1])return;
    try{
      await apiFetch(`/admin/users/${user.id}/roles`,{method:"POST",body:JSON.stringify({role_id:roles[n-1].id})});
      setSuccess("Role assigned.");await load();
    }catch(e:any){setError(e?.message||"Unable to assign role.");}
  }

  async function removeRole(user:UserRecord){
    if(user.roles.length===0)return;
    const n=Number(prompt(`Remove role:\n${user.roles.map((r,i)=>`${i+1}. ${r.name}`).join("\n")}`));
    if(!n||!user.roles[n-1])return;
    try{
      await apiFetch(`/admin/users/${user.id}/roles/${user.roles[n-1].id}`,{method:"DELETE"});
      setSuccess("Role removed.");await load();
    }catch(e:any){setError(e?.message||"Unable to remove role.");}
  }

  async function saveRole(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/admin/roles",{method:"POST",body:JSON.stringify({name:roleForm.name,description:roleForm.description||null})});
      setSuccess("Role created.");setMode(null);setRoleForm({name:"",description:""});await load();
    }catch(e:any){setError(e?.message||"Unable to create role.");}
    finally{setSaving(false);}
  }

  async function editPermissions(role:Role){
    const selected=new Set(role.permissions.map(p=>p.id));
    const menu=permissions.map((p,i)=>`${i+1}. ${selected.has(p.id)?"[x]":"[ ]"} ${p.permission_key}`).join("\n");
    const answer=prompt(`Enter comma-separated permission numbers that this role SHOULD have.\n\n${menu}\n\nExample: 1,2,5`);
    if(answer===null)return;
    const ids=answer.split(",").map(x=>Number(x.trim())).filter(Boolean).map(n=>permissions[n-1]?.id).filter(Boolean);
    try{
      await apiFetch(`/admin/roles/${role.id}/permissions`,{method:"PUT",body:JSON.stringify({permission_ids:ids})});
      setSuccess("Role permissions replaced.");await load();
    }catch(e:any){setError(e?.message||"Unable to update permissions.");}
  }

  async function saveAccount(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/integrations/accounts",{method:"POST",body:JSON.stringify({
        provider:accountForm.provider,account_name:accountForm.account_name,
        external_account_id:accountForm.external_account_id||null,
        credentials_reference:accountForm.credentials_reference||null,
        settings:{},status:accountForm.status,
      })});
      setSuccess("Integration account record created.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to create integration account.");}
    finally{setSaving(false);}
  }

  async function toggleAccount(a:IntegrationAccount){
    const next=a.status==="active"?"disabled":"active";
    try{
      await apiFetch(`/integrations/accounts/${a.id}`,{method:"PUT",body:JSON.stringify({status:next})});
      setSuccess(`Integration account ${next}.`);await load();
    }catch(e:any){setError(e?.message||"Unable to update integration account.");}
  }

  async function retryEvent(e:OutboxEvent){
    try{
      await apiFetch(`/integrations/outbox/${e.id}/retry`,{method:"POST"});
      setSuccess("Outbox event queued for retry.");await load();
    }catch(err:any){setError(err?.message||"Unable to retry outbox event.");}
  }

  return <>
    <div className="page-header"><div><div className="eyebrow">System</div><h1 className="page-title">System Administration</h1>
      <p className="page-copy">Users, roles, permissions, audit history and integration administration.</p></div>
      <button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
    </div>
    <Message error={error} success={success}/>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      {tabs.map(x=><button key={x} className={`btn ${tab===x?"btn-primary":"btn-secondary"}`} onClick={()=>setTab(x)}>{x}</button>)}
    </div>

    {loading&&<div className="card" style={{padding:30,textAlign:"center"}}><Loader2 className="spin" size={18}/> Loading...</div>}

    {!loading&&tab==="Users & Roles"&&<>
      {!isAdmin&&<div className="card" style={{padding:16}}>
        <strong>Administrator access required</strong><div className="muted" style={{fontSize:12,marginTop:5}}>
          User, role and permission management is intentionally restricted to Administrators.
        </div>
      </div>}
      {isAdmin&&<>
        <div className="panel-head"><h3>Users</h3></div>
        <div className="table-wrap"><table><thead><tr><th>User</th><th>Status</th><th>Roles</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>{users.length===0?<EmptyRow columns={5}/>:users.map(u=><tr key={u.id}><td><strong>{u.display_name||u.email}</strong><div className="muted" style={{fontSize:11}}>{u.email}</div></td>
            <td><StatusBadge value={u.status}/></td><td>{u.roles.map(r=>r.name).join(", ")||"—"}</td><td>{u.last_login_at?new Date(u.last_login_at).toLocaleString():"—"}</td>
            <td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><button className="btn btn-ghost" onClick={()=>changeUserStatus(u)}>Status</button>
              <button className="btn btn-ghost" onClick={()=>assignRole(u)}>+ Role</button>
              <button className="btn btn-ghost" onClick={()=>removeRole(u)}>- Role</button></div></td></tr>)}</tbody></table></div>

        <div className="panel-head" style={{marginTop:22}}><h3>Roles & Permissions</h3><button className="btn btn-primary" onClick={()=>setMode("role")}><Plus size={14}/>Create Role</button></div>
        <div className="table-wrap"><table><thead><tr><th>Role</th><th>Type</th><th>Permissions</th><th>Action</th></tr></thead>
          <tbody>{roles.map(r=><tr key={r.id}><td><strong>{r.name}</strong><div className="muted" style={{fontSize:11}}>{r.description||""}</div></td>
            <td>{r.is_system_role?"System":"Custom"}</td><td>{r.permissions.length}</td>
            <td><button className="btn btn-ghost" onClick={()=>editPermissions(r)}>Edit Permissions</button></td></tr>)}</tbody></table></div>
      </>}
    </>}

    {!loading&&tab==="Audit Log"&&<>
      <div className="records-toolbar card"><div><strong>Audit History</strong><div className="muted" style={{fontSize:12}}>{audit.total} records</div></div></div>
      <div className="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr></thead>
        <tbody>{audit.items.length===0?<EmptyRow columns={5}/>:audit.items.map((a:any)=><tr key={a.id}>
          <td>{new Date(a.occurred_at).toLocaleString()}</td><td>{a.actor_name||labelize(a.actor_type)}</td><td>{labelize(a.action)}</td>
          <td>{labelize(a.entity_type)}</td><td style={{fontSize:11}}>{a.entity_id||"—"}</td></tr>)}</tbody></table></div>
    </>}

    {!loading&&tab==="Integrations"&&<>
      <div className="records-toolbar card"><div><strong>Integration Accounts</strong><div className="muted" style={{fontSize:12}}>
        Metadata only for now. Live provider execution starts in the automation phase.</div></div>
        {isManager&&<button className="btn btn-primary" onClick={()=>setMode("account")}><Plus size={14}/>Add Integration Account</button>}</div>
      <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Account</th><th>External ID</th><th>Credential Reference</th><th>Status</th><th>Last Sync</th><th>Action</th></tr></thead>
        <tbody>{accounts.length===0?<EmptyRow columns={7}/>:accounts.map(a=><tr key={a.id}><td><strong>{labelize(a.provider)}</strong></td><td>{a.account_name}</td>
          <td>{a.external_account_id||"—"}</td><td>{a.credentials_reference||"—"}</td><td><StatusBadge value={a.status}/></td><td>{a.last_sync_at?new Date(a.last_sync_at).toLocaleString():"—"}</td>
          <td>{isManager&&<button className="btn btn-ghost" onClick={()=>toggleAccount(a)}>{a.status==="active"?"Disable":"Enable"}</button>}</td></tr>)}</tbody></table></div>

      <div className="panel-head" style={{marginTop:22}}><h3>External Entity References</h3></div>
      <div className="table-wrap"><table><thead><tr><th>Provider</th><th>Account</th><th>Entity</th><th>Entity ID</th><th>External ID</th><th>URL</th></tr></thead>
        <tbody>{externalRefs.length===0?<EmptyRow columns={6} text="No external references yet."/>:externalRefs.map(r=><tr key={r.id}>
          <td>{labelize(r.provider)}</td><td>{r.account_name}</td><td>{labelize(r.entity_type)}</td><td style={{fontSize:11}}>{r.entity_id}</td>
          <td>{r.external_id}</td><td>{r.external_url?<a href={r.external_url} target="_blank" rel="noreferrer">Open</a>:"—"}</td>
        </tr>)}</tbody></table></div>
    </>}

    {!loading&&tab==="Outbox"&&<>
      {!isManager?<div className="card" style={{padding:16}}>Manager or Administrator access required.</div>:<>
        <div className="records-toolbar card"><div><strong>Integration Outbox</strong><div className="muted" style={{fontSize:12}}>Queued/retryable integration events.</div></div></div>
        <div className="table-wrap"><table><thead><tr><th>Event</th><th>Aggregate</th><th>Status</th><th>Attempts</th><th>Last Error</th><th>Action</th></tr></thead>
          <tbody>{outbox.length===0?<EmptyRow columns={6}/>:outbox.map(e=><tr key={e.id}><td>{e.event_type}</td><td>{e.aggregate_type}</td><td><StatusBadge value={e.status}/></td>
            <td>{e.attempts}</td><td>{e.last_error||"—"}</td><td>{["failed","dead_letter"].includes(e.status)&&<button className="btn btn-ghost" onClick={()=>retryEvent(e)}><RotateCcw size={13}/>Retry</button>}</td></tr>)}</tbody></table></div>
      </>}
    </>}

    {mode==="role"&&<Modal title="Create Role" eyebrow="System Admin" onClose={()=>setMode(null)}>
      <form onSubmit={saveRole}><div className="form-grid"><Field label="Role Name" value={roleForm.name} onChange={v=>setRoleForm({...roleForm,name:v})} required/>
        <TextAreaField label="Description" value={roleForm.description} onChange={v=>setRoleForm({...roleForm,description:v})}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Create Role</button></div></form>
    </Modal>}

    {mode==="account"&&<Modal title="Add Integration Account" eyebrow="Integrations" onClose={()=>setMode(null)}>
      <form onSubmit={saveAccount}><div className="form-grid">
        <SelectField label="Provider" value={accountForm.provider} onChange={v=>setAccountForm({...accountForm,provider:v})}
          options={["shopify","ebay","meta","tiktok"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Account Name" value={accountForm.account_name} onChange={v=>setAccountForm({...accountForm,account_name:v})} required/>
        <Field label="External Account ID" value={accountForm.external_account_id} onChange={v=>setAccountForm({...accountForm,external_account_id:v})}/>
        <Field label="Credentials Reference" value={accountForm.credentials_reference} onChange={v=>setAccountForm({...accountForm,credentials_reference:v})}
          placeholder="Server-side reference only; never raw API secret"/>
        <SelectField label="Status" value={accountForm.status} onChange={v=>setAccountForm({...accountForm,status:v})}
          options={["active","disabled","error"].map(x=>({value:x,label:labelize(x)}))}/>
      </div><div className="card" style={{padding:10,marginTop:12,fontSize:12}}>Do not paste Shopify/eBay/social API secrets here. Store secrets server-side later and save only a reference.</div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Save Account Record</button></div></form>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}
