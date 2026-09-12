"use client";
import { useState } from "react";
import { Bot, CheckCircle2, FileText, Image as ImageIcon, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/Shared";

export default function AIPage() {
  const [messages,setMessages]=useState([
    {role:"assistant",text:"I’m ready to help with inventory, sales, customers, suppliers, listings and reporting."}
  ]);
  const [input,setInput]=useState("");

  function send() {
    if(!input.trim()) return;
    setMessages([...messages,{role:"user",text:input},{role:"assistant",text:"Frontend preview only. When the backend is connected, I’ll analyze this request, call the correct business function and request approval before important writes."}]);
    setInput("");
  }

  return (
    <>
      <PageHeader eyebrow="AI Automation" title="AI Command Center" description="Operate the business with text, voice, images and documents—while keeping human approval visible." primaryLabel="New AI Session"/>
      <div className="dashboard-grid">
        <div className="card panel">
          <div className="panel-head"><h3>Conversation</h3><span className="badge blue"><Sparkles size={12}/> AI workspace</span></div>
          <div style={{display:"grid",gap:12,minHeight:360}}>
            {messages.map((m,i)=>(
              <div key={i} style={{
                maxWidth:"82%",justifySelf:m.role==="user"?"end":"start",padding:"13px 15px",borderRadius:16,
                background:m.role==="user"?"linear-gradient(135deg,var(--accent),var(--accent2))":"var(--bg-soft)",
                color:m.role==="user"?"white":"var(--text)",lineHeight:1.55,fontSize:14
              }}>{m.text}</div>
            ))}
          </div>
          <div className="ai-box" style={{marginTop:16}}>
            <textarea className="textarea" value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask AI to create, update, find, analyze or prepare something..." />
            <div className="ai-toolbar">
              <div className="ai-tools">
                <button className="btn btn-ghost"><Mic size={15}/> Voice</button>
                <button className="btn btn-ghost"><ImageIcon size={15}/> Image</button>
                <button className="btn btn-ghost"><FileText size={15}/> Document</button>
              </div>
              <button className="btn btn-primary" onClick={send}><Send size={15}/> Send</button>
            </div>
          </div>
        </div>

        <div style={{display:"grid",gap:16,alignContent:"start"}}>
          <div className="card panel">
            <div className="panel-head"><h3>Example database actions</h3></div>
            {[
              "Add or update a vehicle",
              "Create customer / supplier",
              "Record a sale or payment",
              "Move inventory location",
              "Show unpaid orders",
              "Prepare reports"
            ].map(x=><div className="result-item" key={x} style={{marginBottom:8}}><Bot size={15} style={{verticalAlign:"middle",marginRight:8}}/>{x}</div>)}
          </div>

          <div className="card panel">
            <div className="panel-head"><h3>Approval queue</h3><span className="badge orange">2 mock</span></div>
            <div className="result-item"><b>Publish eBay listing</b><div className="muted" style={{fontSize:12,marginTop:5}}>Front bumper · Audi A4</div><button className="btn btn-primary" style={{marginTop:10}}><CheckCircle2 size={14}/> Approve</button></div>
            <div className="result-item" style={{marginTop:10}}><b>Update sale status</b><div className="muted" style={{fontSize:12,marginTop:5}}>SO-1003 → Paid</div><button className="btn btn-primary" style={{marginTop:10}}><CheckCircle2 size={14}/> Approve</button></div>
          </div>
        </div>
      </div>
    </>
  );
}
