"use client";
import Link from "next/link";
import {
  Activity, ArrowUpRight, Box, CarFront, CircleDollarSign, ClipboardList, PackageSearch,
  Plus, ShoppingCart, Sparkles, Store, Users
} from "lucide-react";
import { MetricCard } from "@/components/Shared";
import { useState } from "react";

export default function DashboardPage() {
  const [prompt,setPrompt]=useState("");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Command Center</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-copy">A clean operating view of Lal Motors today.</p>
        </div>
        <Link className="btn btn-primary" href="/dashboard/ai"><Sparkles size={15}/> Open AI Command</Link>
      </div>

      <div className="metric-grid">
        <MetricCard label="Vehicles" value="27" trend="Migrated & verified" icon={CarFront}/>
        <MetricCard label="Used Parts" value="9" trend="Inventory connected" icon={PackageSearch}/>
        <MetricCard label="Customers" value="1" trend="Clean production record" icon={Users}/>
        <MetricCard label="Sales Orders" value="3" trend="Numbered orders migrated" icon={ShoppingCart}/>
      </div>

      <div className="dashboard-grid">
        <div className="card panel">
          <div className="panel-head"><h3>Business overview</h3><span className="badge green"><Activity size={12}/> Healthy</span></div>
          <div className="quick-grid">
            {[
              [CarFront,"Add vehicle","/dashboard/vehicles"],
              [PackageSearch,"Add used part","/dashboard/parts"],
              [Users,"Add customer","/dashboard/customers"],
              [ShoppingCart,"Create sale","/dashboard/sales"],
              [ClipboardList,"Create purchase order","/dashboard/purchases"],
              [CircleDollarSign,"Record payment","/dashboard/payments"]
            ].map(([Icon,label,href]:any)=>(
              <Link className="quick-action" href={href} key={label}><Icon size={16}/>{label}<ArrowUpRight size={14} style={{marginLeft:"auto"}}/></Link>
            ))}
          </div>

          <div style={{marginTop:18}}>
            <div className="panel-head"><h3>Channel overview</h3></div>
            <div className="channel-grid">
              {[
                ["Shopify","0 active","Drafts & products"],
                ["eBay","0 active","Drafts & listings"],
                ["Meta","0 posts","Drafts & scheduled"],
                ["TikTok","0 posts","Drafts & scheduled"],
              ].map(([name,count,meta])=>(
                <div className="channel-card" key={name}>
                  <div className="channel-brand">{name}</div>
                  <div style={{fontWeight:800}}>{count}</div>
                  <div className="channel-meta">{meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ai-box">
          <div style={{display:"flex",alignItems:"center",gap:9,fontWeight:850}}><Sparkles size={18}/> AI Command</div>
          <p className="muted" style={{fontSize:13,lineHeight:1.6}}>Later this will read and change database records through approved backend functions.</p>
          <textarea className="textarea" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="e.g. Add a 2020 BMW to inventory, show unpaid sales, create an eBay draft..." />
          <div className="ai-toolbar">
            <div className="ai-tools"><span className="badge">Voice</span><span className="badge">Image</span><span className="badge">Document</span></div>
            <Link href="/dashboard/ai" className="btn btn-primary">Open workspace</Link>
          </div>
        </div>
      </div>
    </>
  );
}
