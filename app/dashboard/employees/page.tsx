"use client";

import {
  CalendarDays, Clock3, Eye, Loader2, Pencil, Plus, RefreshCw,
  Search, Trash2, UserRoundCog,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  DetailGrid, EmptyRow, Field, GlobalSpinStyle, LoadingRow, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { RequirePermission } from "@/components/RequirePermission";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type Employee={
  id:string;employee_number:string|null;first_name:string|null;last_name:string|null;display_name:string;
  employment_type:string|null;employment_status:string;email:string|null;phone:string|null;home_address:string|null;
  hire_date:string|null;birthday:string|null;has_key:boolean;notes:string|null;created_at:string;updated_at:string;
  job_roles:Array<{id:string;name:string;is_primary:boolean}>;
  availability:Array<{id:string;day_of_week:number;available_from:string|null;available_to:string|null;is_available:boolean;notes:string|null}>;
};
type EmployeeList={total:number;offset:number;limit:number;items:Employee[]};
type JobRole={id:string;name:string;description:string|null};
type Shift={id:string;employee_id:string;employee_name:string;starts_at:string;ends_at:string;status:string;notes:string|null;created_at:string;updated_at:string};
type TimeOff={id:string;employee_id:string;employee_name:string;start_date:string;end_date:string;approval_status:string;reviewed_by_user_id:string|null;reviewed_at:string|null;notes:string|null;total_days:number|string;created_at:string};

const employmentTypes=["full_time","part_time","contractor","temporary"];
const employmentStatuses=["active","inactive","terminated","leave"];
const tabs=["Employees","Job Roles","Shifts","Time Off"] as const;
type Tab=(typeof tabs)[number];

function EmployeesPage(){
  const [tab,setTab]=useState<Tab>("Employees");
  const [employees,setEmployees]=useState<Employee[]>([]);
  const [roles,setRoles]=useState<JobRole[]>([]);
  const [shifts,setShifts]=useState<Shift[]>([]);
  const [timeOff,setTimeOff]=useState<TimeOff[]>([]);
  const [user,setUser]=useState<CurrentUser|null>(null);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"employee-create"|"employee-edit"|"employee-view"|"role-create"|"shift-create"|"timeoff-create"|null>(null);
  const [selected,setSelected]=useState<Employee|null>(null);
  const [saving,setSaving]=useState(false);

  const [employeeForm,setEmployeeForm]=useState({
    employee_number:"",first_name:"",last_name:"",display_name:"",employment_type:"full_time",
    employment_status:"active",email:"",phone:"",home_address:"",hire_date:"",birthday:"",has_key:false,notes:"",
  });
  const [roleForm,setRoleForm]=useState({name:"",description:""});
  const [shiftForm,setShiftForm]=useState({employee_id:"",starts_at:"",ends_at:"",status:"scheduled",notes:""});
  const [timeOffForm,setTimeOffForm]=useState({employee_id:"",start_date:"",end_date:"",notes:""});

  const isManager=useMemo(()=>{
    const s=new Set((user?.roles||[]).map(x=>x.toLowerCase()));
    return s.has("administrator")||s.has("manager");
  },[user]);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const p=new URLSearchParams({limit:"300"});
      if(search.trim())p.set("search",search.trim());
      const [e,r,s,t]=await Promise.all([
        apiFetch<EmployeeList>(`/hr/employees?${p}`),
        apiFetch<JobRole[]>("/hr/job-roles"),
        apiFetch<Shift[]>("/hr/shifts?limit=300"),
        apiFetch<TimeOff[]>("/hr/time-off"),
      ]);
      setEmployees(e.items);setRoles(r);setShifts(s);setTimeOff(t);
    }catch(e:any){setError(e?.message||"Unable to load HR data.");}
    finally{setLoading(false);}
  },[search]);

  useEffect(()=>{getCurrentUser().then(setUser).catch(()=>{});},[]);
  useEffect(()=>{const t=setTimeout(load,180);return()=>clearTimeout(t);},[load]);

  function newEmployee(){
    setEmployeeForm({employee_number:"",first_name:"",last_name:"",display_name:"",employment_type:"full_time",
      employment_status:"active",email:"",phone:"",home_address:"",hire_date:"",birthday:"",has_key:false,notes:""});
    setSelected(null);setMode("employee-create");
  }

  async function openEmployee(row:Employee,target:"employee-view"|"employee-edit"){
    try{
      const d=await apiFetch<Employee>(`/hr/employees/${row.id}`);
      setSelected(d);
      setEmployeeForm({
        employee_number:d.employee_number||"",first_name:d.first_name||"",last_name:d.last_name||"",display_name:d.display_name,
        employment_type:d.employment_type||"full_time",employment_status:d.employment_status,email:d.email||"",phone:d.phone||"",
        home_address:d.home_address||"",hire_date:d.hire_date||"",birthday:d.birthday||"",has_key:d.has_key,notes:d.notes||"",
      });
      setMode(target);
    }catch(e:any){setError(e?.message||"Unable to load employee.");}
  }

  async function saveEmployee(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    const payload={
      employee_number:employeeForm.employee_number||null,first_name:employeeForm.first_name||null,last_name:employeeForm.last_name||null,
      display_name:employeeForm.display_name,employment_type:employeeForm.employment_type||null,employment_status:employeeForm.employment_status,
      email:employeeForm.email||null,phone:employeeForm.phone||null,home_address:employeeForm.home_address||null,
      hire_date:employeeForm.hire_date||null,birthday:employeeForm.birthday||null,has_key:employeeForm.has_key,notes:employeeForm.notes||null,
    };
    try{
      if(mode==="employee-create")await apiFetch("/hr/employees",{method:"POST",body:JSON.stringify(payload)});
      else if(selected)await apiFetch(`/hr/employees/${selected.id}`,{method:"PUT",body:JSON.stringify(payload)});
      setSuccess(mode==="employee-create"?"Employee created.":"Employee updated.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to save employee.");}
    finally{setSaving(false);}
  }

  async function deactivate(row:Employee){
    if(!confirm(`Deactivate ${row.display_name}?`))return;
    try{await apiFetch(`/hr/employees/${row.id}`,{method:"DELETE"});setSuccess("Employee deactivated.");await load();}
    catch(e:any){setError(e?.message||"Unable to deactivate employee.");}
  }

  async function assignRole(){
    if(!selected)return;
    if(roles.length===0){setError("Create a job role first.");return;}
    const options=roles.map((r,i)=>`${i+1}. ${r.name}`).join("\n");
    const n=Number(prompt(`Choose job role number:\n${options}`));
    if(!n||!roles[n-1])return;
    const primary=confirm("Make this the employee's primary job role?");
    try{
      const d=await apiFetch<Employee>(`/hr/employees/${selected.id}/job-roles`,{
        method:"POST",body:JSON.stringify({job_role_id:roles[n-1].id,is_primary:primary})
      });
      setSelected(d);setSuccess("Job role assigned.");
    }catch(e:any){setError(e?.message||"Unable to assign role.");}
  }

  async function removeRole(roleId:string){
    if(!selected)return;
    try{
      const d=await apiFetch<Employee>(`/hr/employees/${selected.id}/job-roles/${roleId}`,{method:"DELETE"});
      setSelected(d);setSuccess("Job role removed.");
    }catch(e:any){setError(e?.message||"Unable to remove role.");}
  }

  async function configureAvailability(){
    if(!selected)return;
    const dayText=prompt("Day of week number (0 to 6). Use the same numbering shown in the current availability list.","0");
    if(dayText===null)return;
    const day=Number(dayText);
    if(!Number.isInteger(day)||day<0||day>6){setError("Day of week must be a number from 0 to 6.");return;}
    const existing=selected.availability.find(a=>a.day_of_week===day);
    const available=confirm("OK = available on this day. Cancel = unavailable on this day.");
    const from=available ? (prompt("Available from (HH:MM), leave blank for any time",existing?.available_from?.slice(0,5)||"")??"") : "";
    const to=available ? (prompt("Available to (HH:MM), leave blank for any time",existing?.available_to?.slice(0,5)||"")??"") : "";
    const entries=selected.availability
      .filter(a=>a.day_of_week!==day)
      .map(a=>({
        day_of_week:a.day_of_week,
        available_from:a.available_from?a.available_from.slice(0,5):null,
        available_to:a.available_to?a.available_to.slice(0,5):null,
        is_available:a.is_available,
        notes:a.notes,
      }));
    entries.push({
      day_of_week:day,
      available_from:from||null,
      available_to:to||null,
      is_available:available,
      notes:existing?.notes||null,
    });
    entries.sort((a,b)=>a.day_of_week-b.day_of_week);
    try{
      const d=await apiFetch<Employee>(`/hr/employees/${selected.id}/availability`,{
        method:"PUT",body:JSON.stringify({entries})
      });
      setSelected(d);setSuccess("Employee availability updated.");
    }catch(e:any){setError(e?.message||"Unable to update availability.");}
  }

  async function saveRole(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/hr/job-roles",{method:"POST",body:JSON.stringify({name:roleForm.name,description:roleForm.description||null})});
      setSuccess("Job role created.");setMode(null);setRoleForm({name:"",description:""});await load();
    }catch(e:any){setError(e?.message||"Unable to create job role.");}
    finally{setSaving(false);}
  }

  async function saveShift(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/hr/shifts",{method:"POST",body:JSON.stringify({
        employee_id:shiftForm.employee_id,starts_at:new Date(shiftForm.starts_at).toISOString(),
        ends_at:new Date(shiftForm.ends_at).toISOString(),status:shiftForm.status,notes:shiftForm.notes||null
      })});
      setSuccess("Shift created.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to create shift.");}
    finally{setSaving(false);}
  }

  async function updateShiftStatus(row:Shift){
    const st=prompt("Shift status: scheduled, completed, cancelled, no_show",row.status);
    if(!st)return;
    try{await apiFetch(`/hr/shifts/${row.id}`,{method:"PUT",body:JSON.stringify({status:st})});setSuccess("Shift updated.");await load();}
    catch(e:any){setError(e?.message||"Unable to update shift.");}
  }

  async function saveTimeOff(e:FormEvent){
    e.preventDefault();setSaving(true);
    try{
      await apiFetch("/hr/time-off",{method:"POST",body:JSON.stringify({
        employee_id:timeOffForm.employee_id,start_date:timeOffForm.start_date,end_date:timeOffForm.end_date,notes:timeOffForm.notes||null
      })});
      setSuccess("Time-off request created.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to create time-off request.");}
    finally{setSaving(false);}
  }

  async function reviewTimeOff(row:TimeOff){
    const decision=prompt("Decision: finding_replacement, approved, denied",row.approval_status);
    if(!decision)return;
    try{
      await apiFetch(`/hr/time-off/${row.id}/review`,{method:"POST",body:JSON.stringify({approval_status:decision,notes:null})});
      setSuccess("Time-off request reviewed.");await load();
    }catch(e:any){setError(e?.message||"Unable to review time off.");}
  }

  return <>
    <div className="page-header">
      <div><div className="eyebrow">People</div><h1 className="page-title">Employees & HR</h1>
        <p className="page-copy">Employees, job roles, availability, shifts and time-off requests from PostgreSQL.</p></div>
      <button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
    </div>

    <Message error={error} success={success}/>

    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      {tabs.map(x=><button key={x} className={`btn ${tab===x?"btn-primary":"btn-secondary"}`} onClick={()=>setTab(x)}>{x}</button>)}
    </div>

    {tab==="Employees"&&<>
      <div className="records-toolbar card">
        <div><strong>Employees</strong><div className="muted" style={{fontSize:12}}>{employees.length} visible</div></div>
        <div style={{display:"flex",gap:8}}><div className="records-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employees..."/></div>
          {isManager&&<button className="btn btn-primary" onClick={newEmployee}><Plus size={15}/>Add Employee</button>}</div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>Email</th><th>Phone</th><th>Hire Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{loading?<LoadingRow columns={7}/>:employees.length===0?<EmptyRow columns={7}/>:employees.map(e=><tr key={e.id}>
          <td><strong>{e.display_name}</strong><div className="muted" style={{fontSize:11}}>{e.employee_number||""}</div></td>
          <td>{labelize(e.employment_type)}</td><td>{e.email||"—"}</td><td>{e.phone||"—"}</td><td>{e.hire_date||"—"}</td><td><StatusBadge value={e.employment_status}/></td>
          <td><div className="record-actions"><button className="record-action view" onClick={()=>openEmployee(e,"employee-view")}><Eye size={14}/></button>
            {isManager&&<button className="record-action edit" onClick={()=>openEmployee(e,"employee-edit")}><Pencil size={14}/></button>}
            {isManager&&e.employment_status==="active"&&<button className="record-action delete" onClick={()=>deactivate(e)}><Trash2 size={14}/></button>}</div></td>
        </tr>)}</tbody></table></div>
    </>}

    {tab==="Job Roles"&&<>
      <div className="records-toolbar card"><div><strong>Job Roles</strong></div>
        {isManager&&<button className="btn btn-primary" onClick={()=>setMode("role-create")}><Plus size={15}/>Add Job Role</button>}</div>
      <div className="table-wrap"><table><thead><tr><th>Role</th><th>Description</th></tr></thead>
        <tbody>{roles.length===0?<EmptyRow columns={2}/>:roles.map(r=><tr key={r.id}><td><strong>{r.name}</strong></td><td>{r.description||"—"}</td></tr>)}</tbody></table></div>
    </>}

    {tab==="Shifts"&&<>
      <div className="records-toolbar card"><div><strong>Employee Shifts</strong></div>
        {isManager&&<button className="btn btn-primary" onClick={()=>setMode("shift-create")}><Plus size={15}/>Add Shift</button>}</div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Start</th><th>End</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead>
        <tbody>{shifts.length===0?<EmptyRow columns={6}/>:shifts.map(s=><tr key={s.id}><td>{s.employee_name}</td>
          <td>{new Date(s.starts_at).toLocaleString()}</td><td>{new Date(s.ends_at).toLocaleString()}</td><td><StatusBadge value={s.status}/></td><td>{s.notes||"—"}</td>
          <td>{isManager&&<button className="btn btn-ghost" onClick={()=>updateShiftStatus(s)}>Update</button>}</td></tr>)}</tbody></table></div>
    </>}

    {tab==="Time Off"&&<>
      <div className="records-toolbar card"><div><strong>Time-off Requests</strong></div>
        <button className="btn btn-primary" onClick={()=>setMode("timeoff-create")}><Plus size={15}/>Request Time Off</button></div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Notes</th><th>Action</th></tr></thead>
        <tbody>{timeOff.length===0?<EmptyRow columns={7}/>:timeOff.map(t=><tr key={t.id}><td>{t.employee_name}</td><td>{t.start_date}</td><td>{t.end_date}</td>
          <td>{Number(t.total_days)}</td><td><StatusBadge value={t.approval_status}/></td><td>{t.notes||"—"}</td>
          <td>{isManager&&t.approval_status==="pending"&&<button className="btn btn-ghost" onClick={()=>reviewTimeOff(t)}>Review</button>}</td></tr>)}</tbody></table></div>
    </>}

    {(mode==="employee-create"||mode==="employee-edit")&&<Modal title={mode==="employee-create"?"Add Employee":"Edit Employee"} eyebrow="HR" onClose={()=>setMode(null)}>
      <form onSubmit={saveEmployee}><div className="form-grid">
        <Field label="Employee Number" value={employeeForm.employee_number} onChange={v=>setEmployeeForm({...employeeForm,employee_number:v})}/>
        <Field label="Display Name" value={employeeForm.display_name} onChange={v=>setEmployeeForm({...employeeForm,display_name:v})} required/>
        <Field label="First Name" value={employeeForm.first_name} onChange={v=>setEmployeeForm({...employeeForm,first_name:v})}/>
        <Field label="Last Name" value={employeeForm.last_name} onChange={v=>setEmployeeForm({...employeeForm,last_name:v})}/>
        <SelectField label="Employment Type" value={employeeForm.employment_type} onChange={v=>setEmployeeForm({...employeeForm,employment_type:v})}
          options={employmentTypes.map(x=>({value:x,label:labelize(x)}))}/>
        <SelectField label="Status" value={employeeForm.employment_status} onChange={v=>setEmployeeForm({...employeeForm,employment_status:v})}
          options={employmentStatuses.map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Email" type="email" value={employeeForm.email} onChange={v=>setEmployeeForm({...employeeForm,email:v})}/>
        <Field label="Phone" value={employeeForm.phone} onChange={v=>setEmployeeForm({...employeeForm,phone:v})}/>
        <Field label="Hire Date" type="date" value={employeeForm.hire_date} onChange={v=>setEmployeeForm({...employeeForm,hire_date:v})}/>
        <Field label="Birthday" type="date" value={employeeForm.birthday} onChange={v=>setEmployeeForm({...employeeForm,birthday:v})}/>
        <Field label="Home Address" value={employeeForm.home_address} onChange={v=>setEmployeeForm({...employeeForm,home_address:v})}/>
        <label className="badge" style={{cursor:"pointer",alignSelf:"end"}}><input type="checkbox" checked={employeeForm.has_key}
          onChange={e=>setEmployeeForm({...employeeForm,has_key:e.target.checked})}/> Has Key</label>
        <TextAreaField label="Notes" value={employeeForm.notes} onChange={v=>setEmployeeForm({...employeeForm,notes:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><button type="button" className="btn btn-secondary" onClick={()=>setMode(null)}>Cancel</button>
        <button className="btn btn-primary" disabled={saving}>{saving?<><Loader2 className="spin" size={15}/>Saving...</>:"Save Employee"}</button></div></form>
    </Modal>}

    {mode==="employee-view"&&selected&&<Modal title={selected.display_name} eyebrow="Employee Details" onClose={()=>setMode(null)}>
      <DetailGrid rows={[
        ["Employee Number",selected.employee_number||"—"],["Status",<StatusBadge value={selected.employment_status}/>],["Type",labelize(selected.employment_type)],
        ["Email",selected.email||"—"],["Phone",selected.phone||"—"],["Hire Date",selected.hire_date||"—"],["Has Key",selected.has_key?"Yes":"No"],["Notes",selected.notes||"—"],
      ]}/>
      <div className="panel-head" style={{marginTop:20}}><h3>Job Roles</h3>{isManager&&<button className="btn btn-secondary" onClick={assignRole}><Plus size={14}/>Assign Role</button>}</div>
      {selected.job_roles.length===0?<div className="muted">No job roles assigned.</div>:<div style={{display:"grid",gap:8}}>
        {selected.job_roles.map(r=><div className="card" style={{padding:10,display:"flex",justifyContent:"space-between"}} key={r.id}>
          <div><strong>{r.name}</strong>{r.is_primary&&<span className="badge" style={{marginLeft:8}}>Primary</span>}</div>
          {isManager&&<button className="record-action delete" onClick={()=>removeRole(r.id)}><Trash2 size={14}/></button>}
        </div>)}
      </div>}
      <div style={{marginTop:20}}>
        <div className="panel-head"><h3>Availability</h3>{isManager&&<button className="btn btn-secondary" onClick={configureAvailability}>Set Availability</button>}</div>
        {selected.availability.length===0?<div className="muted">No availability schedule recorded.</div>:selected.availability.map(a=><div key={a.id} className="result-item" style={{marginBottom:6}}>
          Day {a.day_of_week}: {a.is_available?`${a.available_from||"Any"} – ${a.available_to||"Any"}`:"Unavailable"}
        </div>)}
      </div>
    </Modal>}

    {mode==="role-create"&&<Modal title="Add Job Role" eyebrow="HR" onClose={()=>setMode(null)}>
      <form onSubmit={saveRole}><div className="form-grid"><Field label="Role Name" value={roleForm.name} onChange={v=>setRoleForm({...roleForm,name:v})} required/>
        <TextAreaField label="Description" value={roleForm.description} onChange={v=>setRoleForm({...roleForm,description:v})}/></div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Create Role</button></div></form>
    </Modal>}

    {mode==="shift-create"&&<Modal title="Add Shift" eyebrow="HR" onClose={()=>setMode(null)}>
      <form onSubmit={saveShift}><div className="form-grid">
        <SelectField label="Employee" value={shiftForm.employee_id} onChange={v=>setShiftForm({...shiftForm,employee_id:v})} required
          options={[{value:"",label:"Select employee..."},...employees.map(e=>({value:e.id,label:e.display_name}))]}/>
        <SelectField label="Status" value={shiftForm.status} onChange={v=>setShiftForm({...shiftForm,status:v})}
          options={["scheduled","completed","cancelled","no_show"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Starts At" type="datetime-local" value={shiftForm.starts_at} onChange={v=>setShiftForm({...shiftForm,starts_at:v})} required/>
        <Field label="Ends At" type="datetime-local" value={shiftForm.ends_at} onChange={v=>setShiftForm({...shiftForm,ends_at:v})} required/>
        <TextAreaField label="Notes" value={shiftForm.notes} onChange={v=>setShiftForm({...shiftForm,notes:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Create Shift</button></div></form>
    </Modal>}

    {mode==="timeoff-create"&&<Modal title="Request Time Off" eyebrow="HR" onClose={()=>setMode(null)}>
      <form onSubmit={saveTimeOff}><div className="form-grid">
        <SelectField label="Employee" value={timeOffForm.employee_id} onChange={v=>setTimeOffForm({...timeOffForm,employee_id:v})} required
          options={[{value:"",label:"Select employee..."},...employees.map(e=>({value:e.id,label:e.display_name}))]}/>
        <Field label="Start Date" type="date" value={timeOffForm.start_date} onChange={v=>setTimeOffForm({...timeOffForm,start_date:v})} required/>
        <Field label="End Date" type="date" value={timeOffForm.end_date} onChange={v=>setTimeOffForm({...timeOffForm,end_date:v})} required/>
        <TextAreaField label="Notes" value={timeOffForm.notes} onChange={v=>setTimeOffForm({...timeOffForm,notes:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Submit Request</button></div></form>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}

export default function Page() {
  return (
    <RequirePermission perm="employees.view">
      <EmployeesPage />
    </RequirePermission>
  );
}
