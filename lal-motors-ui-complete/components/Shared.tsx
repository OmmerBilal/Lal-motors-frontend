"use client";

import Link from "next/link";
import { ArrowRight, FilePlus2, Plus, Save, Search, Sparkles } from "lucide-react";
import { useState } from "react";

export function PageHeader({
  eyebrow="Operations", title, description, primaryLabel="Add New", primaryHref
}:{
  eyebrow?:string; title:string; description:string; primaryLabel?:string; primaryHref?:string
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{description}</p>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-secondary"><FilePlus2 size={15}/> Export</button>
        {primaryHref ? (
          <Link href={primaryHref} className="btn btn-primary"><Plus size={15}/>{primaryLabel}</Link>
        ) : (
          <button className="btn btn-primary"><Plus size={15}/>{primaryLabel}</button>
        )}
      </div>
    </div>
  );
}

export function MetricCard({label,value,trend,icon:Icon}:{label:string;value:string;trend?:string;icon:any}) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div>
      <div className="metric-value">{value}</div>
      {trend && <div className="metric-trend">{trend}</div>}
    </div>
  );
}

export function DataTable({columns,rows}:{columns:string[];rows:(string|number|React.ReactNode)[][]}) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export function SimpleForm({title,fields}:{title:string;fields:string[]}) {
  const [saved,setSaved]=useState(false);
  return (
    <div className="card panel" style={{marginTop:18}}>
      <div className="panel-head"><h3>{title}</h3><span className="badge blue">Frontend mock form</span></div>
      <div className="form-grid">
        {fields.map((field,i)=>(
          <div key={field} className={i===fields.length-1 && fields.length%2===1 ? "form-full":""}>
            <label className="form-label">{field}</label>
            <input className="input" placeholder={`Enter ${field.toLowerCase()}`} />
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <button className="btn btn-primary" onClick={()=>setSaved(true)}><Save size={15}/> {saved ? "Saved (mock)":"Save"}</button>
      </div>
    </div>
  );
}
