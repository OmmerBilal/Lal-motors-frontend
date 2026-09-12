"use client";

import Link from "next/link";
import {
  Download, Eye, FilePlus2, Pencil, Plus, Save, Search, Trash2, X
} from "lucide-react";
import { useMemo, useState } from "react";

export function PageHeader({
  eyebrow="Operations",
  title,
  description,
  primaryLabel="Add New",
  primaryHref,
  showRecordsButton=true,
}:{
  eyebrow?:string;
  title:string;
  description:string;
  primaryLabel?:string;
  primaryHref?:string;
  showRecordsButton?:boolean;
}) {
  function scrollTo(id:string) {
    document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{description}</p>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {showRecordsButton && (
          <button className="btn btn-secondary" onClick={()=>scrollTo("all-records")}>
            <Eye size={15}/> View All Records
          </button>
        )}

        <button className="btn btn-secondary">
          <Download size={15}/> Export
        </button>

        {primaryHref ? (
          <Link href={primaryHref} className="btn btn-primary">
            <Plus size={15}/>{primaryLabel}
          </Link>
        ) : (
          <button className="btn btn-primary" onClick={()=>scrollTo("quick-add")}>
            <Plus size={15}/>{primaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function MetricCard({
  label,value,trend,icon:Icon,href
}:{
  label:string;
  value:string;
  trend?:string;
  icon:any;
  href?:string;
}) {
  const content = (
    <>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={17}/></span>
      </div>
      <div className="metric-value">{value}</div>
      {trend && <div className="metric-trend">{trend}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="metric-card" style={{ display: "block" }}>
        {content}
      </Link>
    );
  }
  return <div className="metric-card">{content}</div>;
}

type Cell = string | number;

export function DataTable({
  columns,
  rows,
  entityName="record"
}:{
  columns:string[];
  rows:Cell[][];
  entityName?:string;
}) {
  const [data,setData] = useState<Cell[][]>(rows);
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState<number | null>(null);
  const [mode,setMode] = useState<"view"|"edit"|null>(null);
  const [draft,setDraft] = useState<Cell[]>([]);

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return data.map((r,index)=>({r,index}));
    return data
      .map((r,index)=>({r,index}))
      .filter(({r})=>r.some(v=>String(v).toLowerCase().includes(q)));
  },[data,query]);

  function openView(index:number) {
    setSelected(index);
    setDraft([...data[index]]);
    setMode("view");
  }

  function openEdit(index:number) {
    setSelected(index);
    setDraft([...data[index]]);
    setMode("edit");
  }

  function saveEdit() {
    if(selected===null) return;
    setData(current=>current.map((r,i)=>i===selected ? draft : r));
    setMode(null);
  }

  function remove(index:number) {
    if(window.confirm(`Delete this ${entityName}? This is frontend-only until the database is connected.`)) {
      setData(current=>current.filter((_,i)=>i!==index));
      if(selected===index) setMode(null);
    }
  }

  return (
    <section id="all-records" className="records-section">
      <div className="records-toolbar card">
        <div>
          <div style={{fontWeight:850}}>All Records</div>
          <div className="muted" style={{fontSize:12,marginTop:3}}>
            {filtered.length} of {data.length} {entityName}{data.length===1?"":"s"}
          </div>
        </div>

        <div className="records-search">
          <Search size={15}/>
          <input
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder={`Search ${entityName}s...`}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map(c=><th key={c}>{c}</th>)}
              <th style={{width:155}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({r,index})=>(
              <tr key={index}>
                {r.map((v,j)=><td key={j}>{v}</td>)}
                <td>
                  <div className="record-actions">
                    <button className="record-action view" title="View" onClick={()=>openView(index)}><Eye size={14}/></button>
                    <button className="record-action edit" title="Edit" onClick={()=>openEdit(index)}><Pencil size={14}/></button>
                    <button className="record-action delete" title="Delete" onClick={()=>remove(index)}><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length===0 && (
              <tr>
                <td colSpan={columns.length+1} style={{textAlign:"center",padding:36}}>
                  <div style={{fontWeight:750}}>No records found</div>
                  <div className="muted" style={{fontSize:13,marginTop:5}}>Try a different search.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mode && selected!==null && (
        <div className="modal-backdrop" onMouseDown={()=>setMode(null)}>
          <div className="record-modal card" onMouseDown={e=>e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <div className="eyebrow">{mode==="edit" ? "Edit Record":"Record Details"}</div>
                <h3 style={{margin:"5px 0 0",fontSize:21}}>
                  {mode==="edit" ? `Edit ${entityName}` : `View ${entityName}`}
                </h3>
              </div>
              <button className="icon-btn" onClick={()=>setMode(null)}><X size={16}/></button>
            </div>

            <div className="form-grid">
              {columns.map((column,i)=>(
                <div key={column}>
                  <label className="form-label">{column}</label>
                  {mode==="edit" ? (
                    <input
                      className="input"
                      value={String(draft[i] ?? "")}
                      onChange={e=>{
                        const next=[...draft];
                        next[i]=e.target.value;
                        setDraft(next);
                      }}
                    />
                  ) : (
                    <div className="record-value">{String(draft[i] ?? "—")}</div>
                  )}
                </div>
              ))}
            </div>

            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
              <button className="btn btn-secondary" onClick={()=>setMode(null)}>Close</button>
              {mode==="edit" && (
                <button className="btn btn-primary" onClick={saveEdit}><Save size={15}/> Save Changes</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function SimpleForm({
  title,
  fields
}:{
  title:string;
  fields:string[];
}) {
  const [saved,setSaved]=useState(false);
  const [values,setValues]=useState<Record<string,string>>({});

  return (
    <section id="quick-add" className="card panel" style={{marginTop:18,scrollMarginTop:90}}>
      <div className="panel-head">
        <div>
          <h3 style={{margin:0}}>{title}</h3>
          <div className="muted" style={{fontSize:12,marginTop:4}}>
            This form will write to PostgreSQL after backend connection.
          </div>
        </div>
        <span className="badge blue">Quick Add</span>
      </div>

      <div className="form-grid">
        {fields.map((field,i)=>(
          <div key={field} className={i===fields.length-1 && fields.length%2===1 ? "form-full":""}>
            <label className="form-label">{field}</label>
            <input
              className="input"
              value={values[field] || ""}
              onChange={e=>setValues({...values,[field]:e.target.value})}
              placeholder={`Enter ${field.toLowerCase()}`}
            />
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <button className="btn btn-primary" onClick={()=>{
          setSaved(true);
          setTimeout(()=>setSaved(false),1800);
        }}>
          <Save size={15}/> {saved ? "Saved in UI preview":"Save Record"}
        </button>
      </div>
    </section>
  );
}
