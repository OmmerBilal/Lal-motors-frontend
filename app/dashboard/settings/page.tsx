"use client";

import {
  Ban, CheckCircle2, KeyRound, Loader2, Plus, RefreshCw, RotateCcw,
  ShieldCheck, UserCog, Copy,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";
import { RequirePermission } from "@/components/RequirePermission";
import { usePermissions } from "@/lib/hooks/usePermissions";

type RoleRef={id:string;name:string};
type UserRecord={
  id:string;email:string;display_name:string|null;status:string;employee_id:string|null;
  must_change_password:boolean;last_login_at:string|null;created_at:string;roles:RoleRef[];
  permission_count:number;
};
type Role={id:string;name:string;description:string|null;is_system_role:boolean;permissions:Array<{id:string;permission_key:string;description:string|null}>};
type Permission={id:string;permission_key:string;description:string|null};
type AuditList={total:number;offset:number;limit:number;items:Array<any>};
type IntegrationAccount={id:string;provider:string;account_name:string;external_account_id:string|null;credentials_reference:string|null;settings:any;status:string;last_sync_at:string|null;created_at:string;updated_at:string};
type OutboxEvent={id:string;event_type:string;aggregate_type:string;aggregate_id:string|null;payload:any;status:string;attempts:number;next_attempt_at:string|null;last_error:string|null;created_at:string;processed_at:string|null};
type ExternalRef={id:string;integration_account_id:string;provider:string;account_name:string;entity_type:string;entity_id:string;external_id:string;external_url:string|null;metadata:any;created_at:string};

const tabs=["Employees & Access","Audit Log","Integrations","Outbox"] as const;
type Tab=(typeof tabs)[number];

type OverrideEffect="grant"|"revoke";

function groupPermissions(permissions:Permission[]){
  const groups=new Map<string,Permission[]>();
  for(const p of permissions){
    const key=p.permission_key.split(".")[0];
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key)!.push(p);
  }
  return Array.from(groups.entries()).sort(([a],[b])=>a.localeCompare(b));
}

function PermissionPicker({
  permissions,roleBaseKeys,overrides,onChange,
}:{
  permissions:Permission[];
  roleBaseKeys:Set<string>;
  overrides:Record<string,OverrideEffect>;
  onChange:(key:string,effect:OverrideEffect|null)=>void;
}){
  const groups=useMemo(()=>groupPermissions(permissions),[permissions]);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:420,overflowY:"auto",padding:2}}>
      {groups.map(([groupName,keys])=>(
        <details key={groupName} className="card" style={{padding:"8px 12px"}}>
          <summary style={{cursor:"pointer",fontWeight:700,fontSize:13,textTransform:"capitalize"}}>{groupName}</summary>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
            {keys.map((p)=>{
              const inherited=roleBaseKeys.has(p.permission_key);
              const effect=overrides[p.permission_key];
              const effective=effect==="revoke"?false:effect==="grant"?true:inherited;
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:12}}>
                  <span style={{opacity:effective?1:0.55}}>{p.permission_key}</span>
                  <div style={{display:"flex",gap:4}}>
                    <button type="button"
                      className={`btn btn-ghost ${!effect?"active":""}`}
                      style={{padding:"3px 8px",fontSize:11,fontWeight: !effect?800:400}}
                      onClick={()=>onChange(p.permission_key,null)}
                      title="Use role default">Default</button>
                    <button type="button"
                      className={`btn btn-ghost ${effect==="grant"?"active":""}`}
                      style={{padding:"3px 8px",fontSize:11,fontWeight:effect==="grant"?800:400,color:effect==="grant"?"var(--success,#2a8)":undefined}}
                      onClick={()=>onChange(p.permission_key,"grant")}
                      title="Force grant, even if the role doesn't include it">Grant</button>
                    <button type="button"
                      className={`btn btn-ghost ${effect==="revoke"?"active":""}`}
                      style={{padding:"3px 8px",fontSize:11,fontWeight:effect==="revoke"?800:400,color:effect==="revoke"?"var(--danger,#d33)":undefined}}
                      onClick={()=>onChange(p.permission_key,"revoke")}
                      title="Force revoke, even if the role includes it">Revoke</button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function TempPasswordModal({email,password,onClose}:{email:string;password:string;onClose:()=>void}){
  const [copied,setCopied]=useState(false);
  return (
    <Modal title="Temporary password" eyebrow="Shown once" onClose={onClose} width={460}>
      <p className="muted" style={{fontSize:13}}>
        Share this with <strong>{email}</strong> through a secure channel. It will not be shown again —
        if it's lost, use Reset Password to generate a new one. They'll be asked to set their own password on first login.
      </p>
      <div className="card" style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:10}}>
        <code style={{fontSize:15,letterSpacing:0.5}}>{password}</code>
        <button type="button" className="btn btn-ghost" onClick={()=>{navigator.clipboard?.writeText(password);setCopied(true);}}>
          <Copy size={13}/> {copied?"Copied":"Copy"}
        </button>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

export default function SystemAdminPage(){
  return (
    <RequirePermission perm="settings.view">
      <SystemAdminPageContent/>
    </RequirePermission>
  );
}

function SystemAdminPageContent(){
  const {has}=usePermissions();
  const [tab,setTab]=useState<Tab>("Employees & Access");
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
  const [mode,setMode]=useState<"role"|"account"|"employee"|"permissions"|null>(null);
  const [saving,setSaving]=useState(false);
  const [roleForm,setRoleForm]=useState({name:"",description:""});
  const [accountForm,setAccountForm]=useState({provider:"shopify",account_name:"",external_account_id:"",credentials_reference:"",status:"active"});
  const [employeeForm,setEmployeeForm]=useState({email:"",display_name:"",role_id:""});
  const [permissionTarget,setPermissionTarget]=useState<UserRecord|null>(null);
  const [permissionOverrides,setPermissionOverrides]=useState<Record<string,OverrideEffect>>({});
  const [tempPassword,setTempPassword]=useState<{email:string;password:string}|null>(null);

  const canManageEmployees=has("employees.manage");
  const canViewEmployees=has("employees.view")||canManageEmployees;
  const canManageSettings=has("settings.manage");
  const canViewAudit=has("audit.view");
  const isManager=useMemo(()=>currentUser?.roles.some(r=>["administrator","manager"].includes(r.toLowerCase()))||false,[currentUser]);

  async function load(){
    setLoading(true);setError("");
    try{
      const me=await getCurrentUser();setCurrentUser(me);

      const [accountData,refData]=await Promise.all([
        apiFetch<IntegrationAccount[]>("/integrations/accounts"),
        apiFetch<ExternalRef[]>("/integrations/external-refs"),
      ]);
      setAccounts(accountData);setExternalRefs(refData);

      if(canViewAudit){
        setAudit(await apiFetch<AuditList>("/admin/audit?limit=100"));
      }
      if(canViewEmployees){
        setUsers(await apiFetch<UserRecord[]>("/admin/users"));
        setRoles(await apiFetch<Role[]>("/admin/roles"));
        setPermissions(await apiFetch<Permission[]>("/admin/permissions"));
      }
      if(isManager){
        setOutbox(await apiFetch<OutboxEvent[]>("/integrations/outbox?limit=100"));
      }
    }catch(e:any){setError(e?.message||"Unable to load system administration data.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);

  async function createEmployee(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    try{
      const result=await apiFetch<{user:UserRecord;temporary_password:string}>("/admin/employees",{
        method:"POST",
        body:JSON.stringify({email:employeeForm.email,display_name:employeeForm.display_name,role_id:employeeForm.role_id}),
      });
      setSuccess("Employee created.");setMode(null);
      setEmployeeForm({email:"",display_name:"",role_id:""});
      setTempPassword({email:employeeForm.email,password:result.temporary_password});
      await load();
    }catch(e:any){setError(e?.message||"Unable to create employee.");}
    finally{setSaving(false);}
  }

  async function changeUserStatus(user:UserRecord,status:"active"|"disabled"){
    try{
      await apiFetch(`/admin/users/${user.id}/status`,{method:"PUT",body:JSON.stringify({status})});
      setSuccess(status==="disabled"?"Employee access disabled.":"Employee access re-enabled.");await load();
    }catch(e:any){setError(e?.message||"Unable to update employee.");}
  }

  async function resetPassword(user:UserRecord){
    if(!confirm(`Generate a new temporary password for ${user.display_name||user.email}? Their current password will stop working.`))return;
    try{
      const result=await apiFetch<{temporary_password:string}>(`/admin/users/${user.id}/reset-password`,{method:"POST"});
      setTempPassword({email:user.email,password:result.temporary_password});
      setSuccess("Password reset.");await load();
    }catch(e:any){setError(e?.message||"Unable to reset password.");}
  }

  async function assignRole(user:UserRecord){
    if(roles.length===0)return;
    const n=Number(prompt(`Change role for ${user.display_name||user.email}:\n${roles.map((r,i)=>`${i+1}. ${r.name}`).join("\n")}`));
    if(!n||!roles[n-1])return;
    try{
      for(const r of user.roles){
        await apiFetch(`/admin/users/${user.id}/roles/${r.id}`,{method:"DELETE"});
      }
      await apiFetch(`/admin/users/${user.id}/roles`,{method:"POST",body:JSON.stringify({role_id:roles[n-1].id})});
      setSuccess("Role changed.");await load();
    }catch(e:any){setError(e?.message||"Unable to change role.");}
  }

  function openPermissionEditor(user:UserRecord){
    setPermissionTarget(user);
    setPermissionOverrides({});
    setMode("permissions");
  }

  async function savePermissionOverrides(){
    if(!permissionTarget)return;
    setSaving(true);
    try{
      const overrides=Object.entries(permissionOverrides).map(([permission_key,effect])=>({permission_key,effect}));
      await apiFetch(`/admin/users/${permissionTarget.id}/permissions`,{method:"PUT",body:JSON.stringify({overrides})});
      setSuccess("Permissions updated.");setMode(null);setPermissionTarget(null);await load();
    }catch(e:any){setError(e?.message||"Unable to update permissions.");}
    finally{setSaving(false);}
  }

  async function saveRole(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/admin/roles",{method:"POST",body:JSON.stringify({name:roleForm.name,description:roleForm.description||null})});
      setSuccess("Role created.");setMode(null);setRoleForm({name:"",description:""});await load();
    }catch(e:any){setError(e?.message||"Unable to create role.");}
    finally{setSaving(false);}
  }

  async function editRolePermissions(role:Role){
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

  const targetRoleBaseKeys=useMemo(()=>{
    if(!permissionTarget)return new Set<string>();
    const roleIds=new Set(permissionTarget.roles.map(r=>r.id));
    const keys=new Set<string>();
    for(const role of roles){
      if(roleIds.has(role.id))for(const p of role.permissions)keys.add(p.permission_key);
    }
    return keys;
  },[permissionTarget,roles]);

  return <>
    <div className="page-header"><div><div className="eyebrow">System</div><h1 className="page-title">System Administration</h1>
      <p className="page-copy">Employees, roles, permissions, audit history and integration administration.</p></div>
      <button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
    </div>
    <Message error={error} success={success}/>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      {tabs.map(x=><button key={x} className={`btn ${tab===x?"btn-primary":"btn-secondary"}`} onClick={()=>setTab(x)}>{x}</button>)}
    </div>

    {loading&&<div className="card" style={{padding:30,textAlign:"center"}}><Loader2 className="spin" size={18}/> Loading...</div>}

    {!loading&&tab==="Employees & Access"&&<>
      {!canViewEmployees&&<div className="card" style={{padding:16}}>
        <strong>Access required</strong><div className="muted" style={{fontSize:12,marginTop:5}}>
          Employee and access management requires the employees.view permission.
        </div>
      </div>}
      {canViewEmployees&&<>
        <div className="panel-head">
          <h3>Employees</h3>
          {canManageEmployees&&<button className="btn btn-primary" onClick={()=>setMode("employee")}><Plus size={14}/>Create Employee</button>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last Login</th><th>Access</th>{canManageEmployees&&<th>Actions</th>}</tr></thead>
          <tbody>{users.length===0?<EmptyRow columns={canManageEmployees?6:5}/>:users.map(u=><tr key={u.id}>
            <td><strong>{u.display_name||u.email}</strong><div className="muted" style={{fontSize:11}}>{u.email}</div></td>
            <td>{u.roles.map(r=>r.name).join(", ")||"—"}</td>
            <td><StatusBadge value={u.status}/>{u.must_change_password&&<div className="muted" style={{fontSize:10,marginTop:2}}>Password change pending</div>}</td>
            <td>{u.last_login_at?new Date(u.last_login_at).toLocaleString():"Never logged in"}</td>
            <td>{u.permission_count} permission{u.permission_count===1?"":"s"}</td>
            {canManageEmployees&&<td><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button className="btn btn-ghost" onClick={()=>assignRole(u)}><UserCog size={13}/> Role</button>
              <button className="btn btn-ghost" onClick={()=>openPermissionEditor(u)}><ShieldCheck size={13}/> Permissions</button>
              <button className="btn btn-ghost" onClick={()=>resetPassword(u)}><KeyRound size={13}/> Reset Password</button>
              {u.status==="disabled"
                ?<button className="btn btn-ghost" onClick={()=>changeUserStatus(u,"active")}><CheckCircle2 size={13}/> Re-enable</button>
                :<button className="btn btn-ghost" onClick={()=>changeUserStatus(u,"disabled")}><Ban size={13}/> Disable</button>}
            </div></td>}
          </tr>)}</tbody></table></div>

        {canManageSettings&&<>
          <div className="panel-head" style={{marginTop:22}}><h3>Roles & Access</h3><button className="btn btn-primary" onClick={()=>setMode("role")}><Plus size={14}/>Create Role</button></div>
          <div className="table-wrap"><table><thead><tr><th>Role</th><th>Type</th><th>Permissions</th><th>Action</th></tr></thead>
            <tbody>{roles.map(r=><tr key={r.id}><td><strong>{r.name}</strong><div className="muted" style={{fontSize:11}}>{r.description||""}</div></td>
              <td>{r.is_system_role?"System":"Custom"}</td><td>{r.permissions.length}</td>
              <td><button className="btn btn-ghost" onClick={()=>editRolePermissions(r)}>Edit Permissions</button></td></tr>)}</tbody></table></div>
        </>}
      </>}
    </>}

    {!loading&&tab==="Audit Log"&&<>
      {!canViewAudit?<div className="card" style={{padding:16}}>Access required (audit.view).</div>:<>
        <div className="records-toolbar card"><div><strong>Audit History</strong><div className="muted" style={{fontSize:12}}>{audit.total} records</div></div></div>
        <div className="table-wrap"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th></tr></thead>
          <tbody>{audit.items.length===0?<EmptyRow columns={5}/>:audit.items.map((a:any)=><tr key={a.id}>
            <td>{new Date(a.occurred_at).toLocaleString()}</td><td>{a.actor_name||labelize(a.actor_type)}</td><td>{labelize(a.action)}</td>
            <td>{labelize(a.entity_type)}</td><td style={{fontSize:11}}>{a.entity_id||"—"}</td></tr>)}</tbody></table></div>
      </>}
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

    {mode==="employee"&&<Modal title="Create Employee" eyebrow="Employees & Access" onClose={()=>setMode(null)}>
      <form onSubmit={createEmployee}><div className="form-grid">
        <Field label="Full Name" value={employeeForm.display_name} onChange={v=>setEmployeeForm({...employeeForm,display_name:v})} required/>
        <Field label="Email" type="email" value={employeeForm.email} onChange={v=>setEmployeeForm({...employeeForm,email:v})} required/>
        <SelectField label="Role" value={employeeForm.role_id} onChange={v=>setEmployeeForm({...employeeForm,role_id:v})}
          options={roles.map(r=>({value:r.id,label:r.name}))} required/>
      </div>
      <div className="card" style={{padding:10,marginTop:12,fontSize:12}}>
        A secure one-time temporary password is generated automatically and shown once after creation.
        The employee will be asked to set their own password on first login. You can fine-tune their exact permissions afterward from the employee list.
      </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving||!employeeForm.role_id}>Create Employee</button></div></form>
    </Modal>}

    {mode==="permissions"&&permissionTarget&&<Modal title={`Permissions — ${permissionTarget.display_name||permissionTarget.email}`} eyebrow="Employee access" onClose={()=>{setMode(null);setPermissionTarget(null);}} width={620}>
      <p className="muted" style={{fontSize:12,marginTop:-6}}>
        Their role ({permissionTarget.roles.map(r=>r.name).join(", ")||"none"}) grants a base set of permissions.
        Use Grant/Revoke below only to customize specific permissions for this employee individually.
      </p>
      <PermissionPicker
        permissions={permissions}
        roleBaseKeys={targetRoleBaseKeys}
        overrides={permissionOverrides}
        onChange={(key,effect)=>setPermissionOverrides(prev=>{
          const next={...prev};
          if(effect===null)delete next[key];else next[key]=effect;
          return next;
        })}
      />
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:18,gap:8}}>
        <button className="btn btn-secondary" onClick={()=>{setMode(null);setPermissionTarget(null);}}>Cancel</button>
        <button className="btn btn-primary" disabled={saving} onClick={savePermissionOverrides}>Save Permission Overrides</button>
      </div>
    </Modal>}

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

    {tempPassword&&<TempPasswordModal email={tempPassword.email} password={tempPassword.password} onClose={()=>setTempPassword(null)}/>}

    <GlobalSpinStyle/>
  </>;
}
