"use client";

import {
  Bot, CheckCircle2, Code2, History, Loader2, Mic, Plus,
  RefreshCw, Send, Sparkles, Square, XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  EmptyRow, Field, GlobalSpinStyle, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { CurrentUser, apiFetch, getCurrentUser } from "@/lib/api";

type FunctionDefinition={
  id:string;name:string;description:string;version:number;input_schema:any;handler_type:string;handler_key:string|null;
  handler_config:any;required_permission_key:string|null;risk_level:string;approval_policy:string;is_active:boolean;
  created_by_user_id:string|null;created_at:string;updated_at:string;
};
type AIRequest={id:string;requested_by_user_id:string|null;requested_by_name:string|null;input_mode:string;input_text:string;
  voice_audio_file_id:string|null;model_name:string|null;status:string;created_at:string;completed_at:string|null};
type Approval={id:string;requested_by_user_id:string|null;requested_by_name:string|null;approval_type:string;risk_level:string;
  title:string;explanation:string|null;payload:any;status:string;decided_by_user_id:string|null;decided_by_name:string|null;
  decided_at:string|null;decision_notes:string|null;created_at:string};
type FunctionCall={id:string;ai_request_id:string;function_definition_id:string;function_name:string;sequence_number:number;
  extracted_arguments:any;approval_request_id:string|null;status:string;result:any;error_message:string|null;
  started_at:string|null;completed_at:string|null;created_at:string};

const historyTabs=["Requests","Approvals","Functions","Function Calls"] as const;
type HistoryTab=(typeof historyTabs)[number];

// Server response shapes for POST /ai/chat — the real Groq-backed orchestrator
// decides intent and calls a registered backend function; the frontend just renders it.
type ChatApiResponse={
  request_id:string;
  type:"message"|"result"|"pending_approval"|"error";
  text:string;
  function?:string;
  result?:any;
  approval_id?:string;
  function_call_id?:string;
  arguments?:Record<string,any>;
};

type ChatAction=
  | {kind:"result"}
  | {kind:"pending_approval";approvalId:string;functionName:string;args:Record<string,any>;status:"pending"|"approved"|"rejected"}
  | {kind:"error"};

type ChatMessage={id:string;role:"user"|"assistant";text:string;action?:ChatAction;createdAt:string};

const QUICK_CHIPS=[
  {label:"Create sale",template:"Ahmed bought 1 Civic headlight for $100 and paid $90 cash."},
  {label:"Receive payment",template:"Ahmed paid the remaining balance."},
  {label:"Check inventory",template:"How many Civic headlights do we have?"},
  {label:"Receive stock",template:"Received 20 Civic headlights from ABC supplier."},
  {label:"Create purchase order",template:"Create a purchase order with ABC supplier for 10 brake pads."},
];

function uid(){
  if(typeof crypto!=="undefined"&&"randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parsePairs(text:string):{label:string;value:string}[]{
  return text.split("\n")
    .map(l=>l.trim())
    .filter(l=>l && l.includes(": ") && !l.toLowerCase().startsWith("note:"))
    .map(l=>{
      const idx=l.indexOf(": ");
      return {label:l.slice(0,idx),value:l.slice(idx+2)};
    });
}

function ResultCard({text}:{text:string}){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  const headline=lines.find(l=>l.toLowerCase().startsWith("completed successfully"));
  const note=lines.find(l=>l.toLowerCase().startsWith("note:"));
  const pairs=parsePairs(text);
  if(pairs.length===0) return <div style={{fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{text}</div>;
  return <div className="card" style={{padding:14,marginTop:6,background:"var(--bg-elev)"}}>
    {headline&&<div style={{display:"flex",alignItems:"center",gap:6,color:"var(--success)",fontWeight:800,fontSize:13,marginBottom:10}}>
      <CheckCircle2 size={14}/>{headline}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
      {pairs.map((p,i)=><div key={i}>
        <div className="muted" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".04em"}}>{p.label}</div>
        <div style={{fontWeight:600,fontSize:14,marginTop:2}}>{p.value}</div>
      </div>)}
    </div>
    {note&&<div className="muted" style={{fontSize:12,marginTop:10}}>{note}</div>}
  </div>;
}

export default function AIPage(){
  const [view,setView]=useState<"chat"|"history">("chat");
  const [historyTab,setHistoryTab]=useState<HistoryTab>("Requests");
  const [functions,setFunctions]=useState<FunctionDefinition[]>([]);
  const [requests,setRequests]=useState<AIRequest[]>([]);
  const [approvals,setApprovals]=useState<Approval[]>([]);
  const [calls,setCalls]=useState<FunctionCall[]>([]);
  const [user,setUser]=useState<CurrentUser|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"function"|"approval"|null>(null);
  const [saving,setSaving]=useState(false);

  const [messages,setMessages]=useState<ChatMessage[]>([{
    id:uid(),role:"assistant",
    text:"Hi! Ask me anything about sales, inventory, customers, payments or purchases — I'll figure out what to do.",
    createdAt:new Date().toISOString(),
  }]);
  const [composer,setComposer]=useState("");
  const [sending,setSending]=useState(false);
  const [listening,setListening]=useState(false);
  const [voiceSupported,setVoiceSupported]=useState(false);
  const recognitionRef=useRef<any>(null);
  const bottomRef=useRef<HTMLDivElement>(null);

  const [functionForm,setFunctionForm]=useState({
    name:"",description:"",version:"1",handler_type:"internal",handler_key:"",
    required_permission_key:"",risk_level:"low",approval_policy:"risk_based",input_schema:"{}",handler_config:"{}",
  });
  const [approvalForm,setApprovalForm]=useState({
    approval_type:"manual_test",risk_level:"medium",title:"",explanation:"",payload:"{}",
  });

  const isManager=useMemo(()=>{
    const r=new Set((user?.roles||[]).map(x=>x.toLowerCase()));
    return r.has("administrator")||r.has("manager");
  },[user]);

  const pendingApprovals=useMemo(()=>approvals.filter(a=>a.status==="pending").length,[approvals]);

  async function load(){
    setLoading(true);setError("");
    try{
      const [me,f,r,a,c]=await Promise.all([
        getCurrentUser(),
        apiFetch<FunctionDefinition[]>("/ai-admin/functions"),
        apiFetch<AIRequest[]>("/ai-admin/requests?limit=100"),
        apiFetch<Approval[]>("/ai-admin/approvals?limit=100"),
        apiFetch<FunctionCall[]>("/ai-admin/function-calls?limit=100"),
      ]);
      setUser(me);setFunctions(f);setRequests(r);setApprovals(a);setCalls(c);
    }catch(e:any){setError(e?.message||"Unable to load AI Command Center data.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages,sending]);

  useEffect(()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  },[]);

  function toggleListening(){
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR) return;
    if(listening){recognitionRef.current?.stop();return;}
    const recognition=new SR();
    recognition.lang="en-US";recognition.interimResults=false;recognition.maxAlternatives=1;
    recognition.onresult=(e:any)=>{
      const transcript=e.results?.[0]?.[0]?.transcript;
      if(transcript) setComposer(c=>(c?`${c} `:"")+transcript);
    };
    recognition.onend=()=>setListening(false);
    recognition.onerror=()=>setListening(false);
    recognitionRef.current=recognition;
    recognition.start();setListening(true);
  }

  function pushAssistant(text:string,action?:ChatAction){
    setMessages(m=>[...m,{id:uid(),role:"assistant",text,action,createdAt:new Date().toISOString()}]);
  }

  async function sendMessage(rawText?:string){
    const text=(rawText??composer).trim();
    if(!text||sending) return;
    setComposer("");setError("");
    setMessages(m=>[...m,{id:uid(),role:"user",text,createdAt:new Date().toISOString()}]);
    setSending(true);
    try{
      const res=await apiFetch<ChatApiResponse>("/ai/chat",{method:"POST",body:JSON.stringify({message:text})});

      if(res.type==="pending_approval"&&res.approval_id&&res.function){
        pushAssistant(res.text,{kind:"pending_approval",approvalId:res.approval_id,functionName:res.function,args:res.arguments||{},status:"pending"});
      }else if(res.type==="result"){
        pushAssistant(res.text,{kind:"result"});
      }else if(res.type==="error"){
        pushAssistant(res.text,{kind:"error"});
      }else{
        pushAssistant(res.text);
      }

      apiFetch<AIRequest[]>("/ai-admin/requests?limit=100").then(setRequests).catch(()=>{});
      apiFetch<Approval[]>("/ai-admin/approvals?limit=100").then(setApprovals).catch(()=>{});
    }catch(e:any){
      pushAssistant(`Sorry — something went wrong: ${e?.message||"unknown error"}.`,{kind:"error"});
    }finally{
      setSending(false);
    }
  }

  async function decideChatApproval(msg:ChatMessage,decision:"approve"|"reject"){
    if(msg.action?.kind!=="pending_approval") return;
    const action=msg.action;
    try{
      const res=await apiFetch<Approval&{execution?:{status:string;text:string}}>(`/ai-admin/approvals/${action.approvalId}/${decision}`,{
        method:"POST",body:JSON.stringify({decision_notes:null}),
      });
      setMessages(ms=>ms.map(m=>m.id===msg.id?{...m,action:{...action,status:decision==="approve"?"approved":"rejected"}}:m));
      if(decision==="approve"&&res.execution){
        pushAssistant(res.execution.text,{kind:res.execution.status==="succeeded"?"result":"error"});
      }else if(decision==="reject"){
        pushAssistant("Rejected. No action was taken.");
      }
      apiFetch<Approval[]>("/ai-admin/approvals?limit=100").then(setApprovals).catch(()=>{});
      apiFetch<AIRequest[]>("/ai-admin/requests?limit=100").then(setRequests).catch(()=>{});
    }catch(e:any){setError(e?.message||"Unable to record the decision.");}
  }

  async function saveFunction(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    let inputSchema:any={};let handlerConfig:any={};
    try{inputSchema=JSON.parse(functionForm.input_schema||"{}");handlerConfig=JSON.parse(functionForm.handler_config||"{}");}
    catch{setSaving(false);setError("Input Schema and Handler Config must be valid JSON.");return;}
    try{
      await apiFetch("/ai-admin/functions",{method:"POST",body:JSON.stringify({
        name:functionForm.name,description:functionForm.description,version:Number(functionForm.version),
        input_schema:inputSchema,handler_type:functionForm.handler_type,handler_key:functionForm.handler_key||null,
        handler_config:handlerConfig,required_permission_key:functionForm.required_permission_key||null,
        risk_level:functionForm.risk_level,approval_policy:functionForm.approval_policy,is_active:true,
      })});
      setSuccess("Controlled function definition created.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to create function.");}
    finally{setSaving(false);}
  }

  async function toggleFunction(f:FunctionDefinition){
    if(!isManager)return;
    try{
      await apiFetch(`/ai-admin/functions/${f.id}`,{method:"PUT",body:JSON.stringify({is_active:!f.is_active})});
      setSuccess(`Function ${f.is_active?"disabled":"enabled"}.`);await load();
    }catch(e:any){setError(e?.message||"Unable to update function.");}
  }

  async function saveApproval(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");
    let payload:any={};
    try{payload=JSON.parse(approvalForm.payload||"{}");}
    catch{setSaving(false);setError("Approval payload must be valid JSON.");return;}
    try{
      await apiFetch("/ai-admin/approvals",{method:"POST",body:JSON.stringify({
        approval_type:approvalForm.approval_type,risk_level:approvalForm.risk_level,title:approvalForm.title,
        explanation:approvalForm.explanation||null,payload,
      })});
      setSuccess("Approval request created.");setMode(null);await load();
    }catch(e:any){setError(e?.message||"Unable to create approval.");}
    finally{setSaving(false);}
  }

  async function decide(a:Approval,decision:"approve"|"reject"){
    const note=prompt(`${decision==="approve"?"Approval":"Rejection"} notes (optional)`,"")??"";
    try{
      await apiFetch(`/ai-admin/approvals/${a.id}/${decision}`,{method:"POST",body:JSON.stringify({decision_notes:note||null})});
      setSuccess(`Approval ${decision==="approve"?"approved":"rejected"}.`);await load();
    }catch(e:any){setError(e?.message||"Unable to decide approval.");}
  }

  return <>
    <div className="page-header">
      <div><div className="eyebrow">AI</div><h1 className="page-title">AI Command Center</h1>
        <p className="page-copy">Give instructions to create sales, receive stock, record payments, and other business actions.</p></div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={15}/>Refresh</button>
        <button className={`btn ${view==="chat"?"btn-primary":"btn-secondary"}`} onClick={()=>setView("chat")}><Sparkles size={15}/>Chat</button>
        <button className={`btn ${view==="history"?"btn-primary":"btn-secondary"}`} onClick={()=>setView("history")}>
          <History size={15}/>History{pendingApprovals>0?` (${pendingApprovals} pending)`:""}
        </button>
      </div>
    </div>

    <Message error={error} success={success}/>

    {loading&&<div className="card" style={{padding:30,textAlign:"center"}}><Loader2 className="spin" size={18}/> Loading...</div>}

    {!loading&&view==="chat"&&<div className="card" style={{padding:0,display:"flex",flexDirection:"column",height:"min(74vh, 740px)"}}>
      <div style={{flex:1,overflowY:"auto",padding:"22px 22px 6px",display:"flex",flexDirection:"column",gap:14}}>
        {messages.map(msg=>
          <div key={msg.id} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"80%",padding:"12px 15px",borderRadius:16,
              background:msg.role==="user"?"var(--accent)":msg.action?.kind==="error"?"color-mix(in srgb, var(--danger) 8%, var(--bg-soft))":"var(--bg-soft)",
              color:msg.role==="user"?"#fff":"var(--text)",
              border:msg.role==="user"?"none":msg.action?.kind==="error"?"1px solid color-mix(in srgb, var(--danger) 35%, var(--line))":"1px solid var(--line)",
            }}>
              {msg.role==="assistant"&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:11,fontWeight:800,color:"var(--accent)",textTransform:"uppercase",letterSpacing:".06em"}}>
                <Bot size={13}/>Assistant
              </div>}

              {msg.role==="assistant"&&msg.action?.kind==="result"
                ?<ResultCard text={msg.text}/>
                :<div style={{fontSize:14,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{msg.text}</div>}

              {msg.action?.kind==="pending_approval"&&<>
                {Object.keys(msg.action.args).length>0&&
                  <div className="card" style={{padding:12,marginTop:10,background:"var(--bg-elev)"}}>
                    <div style={{display:"grid",gap:6}}>
                      {Object.entries(msg.action.args).map(([k,v])=>
                        <div key={k} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:13}}>
                          <span className="muted">{labelize(k)}</span>
                          <strong>{typeof v==="object"?JSON.stringify(v):String(v)}</strong>
                        </div>
                      )}
                    </div>
                  </div>}
                <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <StatusBadge value={msg.action.status}/>
                  {msg.action.status==="pending"&&isManager&&<div style={{display:"flex",gap:8}}>
                    <button type="button" className="btn btn-primary" style={{fontSize:13,padding:"8px 13px"}} onClick={()=>decideChatApproval(msg,"approve")}><CheckCircle2 size={14}/>Approve</button>
                    <button type="button" className="btn btn-ghost" style={{fontSize:13,padding:"8px 13px"}} onClick={()=>decideChatApproval(msg,"reject")}><XCircle size={14}/>Reject</button>
                  </div>}
                  {msg.action.status==="pending"&&!isManager&&<span className="muted" style={{fontSize:12}}>Waiting for a Manager/Administrator to approve.</span>}
                </div>
              </>}
            </div>
          </div>
        )}
        {sending&&<div style={{display:"flex",justifyContent:"flex-start"}}>
          <div className="muted" style={{fontSize:13,display:"flex",gap:8,alignItems:"center",padding:"12px 15px"}}><Loader2 size={14} className="spin"/>Thinking...</div>
        </div>}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:16,borderTop:"1px solid var(--line)"}}>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
          {QUICK_CHIPS.map(c=>
            <button key={c.label} type="button" className="btn btn-ghost" style={{fontSize:12,padding:"7px 12px"}}
              onClick={()=>setComposer(c.template)}>{c.label}</button>
          )}
        </div>
        <form onSubmit={e=>{e.preventDefault();sendMessage();}} style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea
            className="textarea"
            style={{minHeight:52,maxHeight:120,flex:1}}
            placeholder="Ask anything about sales, inventory, customers, payments, purchases..."
            value={composer}
            onChange={e=>setComposer(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
          />
          <button
            type="button"
            className="icon-btn"
            title={voiceSupported?(listening?"Stop listening":"Voice input"):"Voice input isn't supported in this browser"}
            disabled={!voiceSupported}
            onClick={toggleListening}
            style={listening?{background:"var(--danger)",color:"#fff",borderColor:"var(--danger)"}:undefined}
          >
            {listening?<Square size={16}/>:<Mic size={16}/>}
          </button>
          <button className="btn btn-primary" disabled={sending||!composer.trim()} style={{height:44}}><Send size={15}/>Send</button>
        </form>
        <div className="muted" style={{fontSize:11,marginTop:8}}>
          Powered by a real language model with controlled backend functions — it can only act through
          registered, audited actions, and larger actions need Manager approval first.
        </div>
      </div>
    </div>}

    {!loading&&view==="history"&&<>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {historyTabs.map(x=><button key={x} className={`btn ${historyTab===x?"btn-primary":"btn-secondary"}`} onClick={()=>setHistoryTab(x)}>{x}</button>)}
      </div>

      {historyTab==="Requests"&&<>
        <div className="records-toolbar card"><div><strong>AI Request History</strong><div className="muted" style={{fontSize:12}}>{requests.length} records — every chat message you send is logged here.</div></div></div>
        <div className="table-wrap"><table><thead><tr><th>Request</th><th>Mode</th><th>User</th><th>Model</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>{requests.length===0?<EmptyRow columns={6}/>:requests.map(r=><tr key={r.id}>
            <td style={{maxWidth:420}}><strong>{r.input_text}</strong></td><td>{labelize(r.input_mode)}</td><td>{r.requested_by_name||"—"}</td>
            <td>{r.model_name||"Not selected"}</td><td><StatusBadge value={r.status}/></td><td>{new Date(r.created_at).toLocaleString()}</td>
          </tr>)}</tbody></table></div>
      </>}

      {historyTab==="Approvals"&&<>
        <div className="records-toolbar card"><div><strong>Approval Queue</strong><div className="muted" style={{fontSize:12}}>
          {pendingApprovals} pending</div></div>
          {isManager&&<button className="btn btn-primary" onClick={()=>setMode("approval")}><Plus size={14}/>Create Approval</button>}</div>
        <div className="table-wrap"><table><thead><tr><th>Approval</th><th>Risk</th><th>Type</th><th>Status</th><th>Requested By</th><th>Actions</th></tr></thead>
          <tbody>{approvals.length===0?<EmptyRow columns={6}/>:approvals.map(a=><tr key={a.id}>
            <td><strong>{a.title}</strong><div className="muted" style={{fontSize:11}}>{a.explanation||""}</div></td>
            <td><StatusBadge value={a.risk_level}/></td><td>{labelize(a.approval_type)}</td><td><StatusBadge value={a.status}/></td><td>{a.requested_by_name||"—"}</td>
            <td>{isManager&&a.status==="pending"&&<div style={{display:"flex",gap:6}}>
              <button className="btn btn-ghost" onClick={()=>decide(a,"approve")}><CheckCircle2 size={13}/>Approve</button>
              <button className="btn btn-ghost" onClick={()=>decide(a,"reject")}><XCircle size={13}/>Reject</button>
            </div>}</td>
          </tr>)}</tbody></table></div>
      </>}

      {historyTab==="Functions"&&<>
        <div className="records-toolbar card"><div><strong>Controlled Functions</strong><div className="muted" style={{fontSize:12}}>
          The registry of actions the AI is allowed to call — nothing outside this list can execute.</div></div>
          {isManager&&<button className="btn btn-primary" onClick={()=>setMode("function")}><Plus size={14}/>Add Function</button>}</div>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Version</th><th>Handler</th><th>Risk</th><th>Approval</th><th>Permission</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{functions.length===0?<EmptyRow columns={8}/>:functions.map(f=><tr key={f.id}><td><strong>{f.name}</strong><div className="muted" style={{fontSize:11}}>{f.description}</div></td>
            <td>{f.version}</td><td>{labelize(f.handler_type)} {f.handler_key||""}</td><td><StatusBadge value={f.risk_level}/></td><td>{labelize(f.approval_policy)}</td>
            <td>{f.required_permission_key||"—"}</td><td><StatusBadge value={f.is_active?"active":"disabled"}/></td>
            <td>{isManager&&<button className="btn btn-ghost" onClick={()=>toggleFunction(f)}>{f.is_active?"Disable":"Enable"}</button>}</td></tr>)}</tbody></table></div>
      </>}

      {historyTab==="Function Calls"&&<>
        <div className="records-toolbar card"><div><strong>Function-call History</strong><div className="muted" style={{fontSize:12}}>Every action the AI actually executed, with its arguments and result.</div></div></div>
        <div className="table-wrap"><table><thead><tr><th>Function</th><th>Request</th><th>Sequence</th><th>Status</th><th>Error</th><th>Created</th></tr></thead>
          <tbody>{calls.length===0?<EmptyRow columns={6}/>:calls.map(c=><tr key={c.id}><td><strong>{c.function_name}</strong></td><td style={{fontSize:11}}>{c.ai_request_id}</td>
            <td>{c.sequence_number}</td><td><StatusBadge value={c.status}/></td><td>{c.error_message||"—"}</td><td>{new Date(c.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
      </>}
    </>}

    {mode==="function"&&<Modal title="Create Controlled Function" eyebrow="AI Foundation" onClose={()=>setMode(null)} width={960}>
      <form onSubmit={saveFunction}><div className="form-grid">
        <Field label="Function Name" value={functionForm.name} onChange={v=>setFunctionForm({...functionForm,name:v})} required/>
        <Field label="Version" type="number" min="1" value={functionForm.version} onChange={v=>setFunctionForm({...functionForm,version:v})} required/>
        <SelectField label="Handler Type" value={functionForm.handler_type} onChange={v=>setFunctionForm({...functionForm,handler_type:v})}
          options={["internal","http","workflow"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Handler Key" value={functionForm.handler_key} onChange={v=>setFunctionForm({...functionForm,handler_key:v})}/>
        <SelectField label="Risk Level" value={functionForm.risk_level} onChange={v=>setFunctionForm({...functionForm,risk_level:v})}
          options={["low","medium","high","critical"].map(x=>({value:x,label:labelize(x)}))}/>
        <SelectField label="Approval Policy" value={functionForm.approval_policy} onChange={v=>setFunctionForm({...functionForm,approval_policy:v})}
          options={["none","always","risk_based"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Required Permission Key" value={functionForm.required_permission_key} onChange={v=>setFunctionForm({...functionForm,required_permission_key:v})}/>
        <TextAreaField label="Description" value={functionForm.description} onChange={v=>setFunctionForm({...functionForm,description:v})} required/>
        <TextAreaField label="Input Schema JSON" value={functionForm.input_schema} onChange={v=>setFunctionForm({...functionForm,input_schema:v})}/>
        <TextAreaField label="Handler Config JSON" value={functionForm.handler_config} onChange={v=>setFunctionForm({...functionForm,handler_config:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}><Code2 size={14}/>Create Function</button></div></form>
    </Modal>}

    {mode==="approval"&&<Modal title="Create Approval Request" eyebrow="AI Foundation" onClose={()=>setMode(null)}>
      <form onSubmit={saveApproval}><div className="form-grid">
        <Field label="Approval Type" value={approvalForm.approval_type} onChange={v=>setApprovalForm({...approvalForm,approval_type:v})} required/>
        <SelectField label="Risk Level" value={approvalForm.risk_level} onChange={v=>setApprovalForm({...approvalForm,risk_level:v})}
          options={["low","medium","high","critical"].map(x=>({value:x,label:labelize(x)}))}/>
        <Field label="Title" value={approvalForm.title} onChange={v=>setApprovalForm({...approvalForm,title:v})} required/>
        <TextAreaField label="Explanation" value={approvalForm.explanation} onChange={v=>setApprovalForm({...approvalForm,explanation:v})}/>
        <TextAreaField label="Payload JSON" value={approvalForm.payload} onChange={v=>setApprovalForm({...approvalForm,payload:v})}/>
      </div><div style={{display:"flex",justifyContent:"flex-end",marginTop:18}}><button className="btn btn-primary" disabled={saving}>Create Approval</button></div></form>
    </Modal>}
    <GlobalSpinStyle/>
  </>;
}
