"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronDown, ClipboardList, Code2, Download, History, ImagePlus, Loader2, Mic, Pencil, Plus,
  RefreshCw, ScanLine, Send, Sparkles, Square, ThumbsUp, Wand2, X, XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  EmptyRow, Field, GlobalSpinStyle, Message,
  Modal, SelectField, StatusBadge, TextAreaField, labelize,
} from "@/components/RealUi";
import { type Batch, BatchReviewTable } from "@/components/BatchReviewTable";
import { AIProgressIndicator } from "@/components/AIProgressIndicator";
import { RequirePermission } from "@/components/RequirePermission";
import { ReviewListingModal } from "@/components/ReviewListingModal";
import { API_BASE_URL, AI_CHAT_TIMEOUT_MS, CurrentUser, apiFetch, apiUpload } from "@/lib/api";
import { useAIChatSession } from "@/lib/hooks/useAIChatSession";
import { newRequestId, useAIProgress } from "@/lib/hooks/useAIProgress";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { invalidate } from "@/lib/invalidate";
import { queryKeys } from "@/lib/queryKeys";

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

const historyTabs=["Requests","Approvals","Functions","Function Calls","Content Sessions"] as const;
type HistoryTab=(typeof historyTabs)[number];

// ---- AI Product Content Studio (Phase 9) ---------------------------------
type ChannelName="shopify"|"ebay"|"meta"|"tiktok";
const STUDIO_CHANNELS:{value:ChannelName;label:string}[]=[
  {value:"shopify",label:"Shopify"},{value:"ebay",label:"eBay"},
  {value:"meta",label:"Instagram + Facebook"},{value:"tiktok",label:"TikTok"},
];
type MasterProductDraft={
  id:string;product_name:string;brand:string|null;model:string|null;category:string|null;condition:string|null;
  description:string;price:number|string|null;sku:string|null;quantity:number|null;
  missing_information:string[];confidence_notes:string[];current_version:number;
};
type ChannelDraft={
  id:string;session_id:string;master_draft_id:string;channel:ChannelName;platform:string|null;status:string;
  current_version:number;payload:Record<string,any>;missing_information:string[];product_name?:string;updated_at:string;
};
type GenerateResponse={
  session_id:string;master_draft:MasterProductDraft;model_used:string;
  channel_results:{channel:ChannelName;status:"success"|"failed";draft?:ChannelDraft;error?:string}[];
};
type ContentSession={
  id:string;input_text:string;status:string;created_at:string;requested_channels:ChannelName[]|null;product_name:string|null;
};
type StudioAction={kind:"content_studio_result";sessionId:string;masterDraft:MasterProductDraft;channelResults:GenerateResponse["channel_results"]};

// ---- Scan Auction Slip -> Smart Intake batch review ----------------------
// One image (or several) can legibly show many vehicles — an auction sheet
// is usually a table, not a single record — so this now always goes through
// the same batch staging/review pipeline every module's Scan Image(s) uses
// (POST /smart-intake/vehicle/extract-images, is_acquisition=true), never a
// single-vehicle shortcut.
type AuctionBatchAction={kind:"auction_batch_review";batchId:string;batch:Batch};

function draftTitle(d:ChannelDraft):string{
  return d.payload?.title
    ||d.payload?.hook
    ||d.payload?.primary_caption
    ||d.payload?.instagram?.primary_caption
    ||d.payload?.facebook?.caption
    ||d.payload?.caption
    ||"(untitled)";
}

function downloadDraft(id:string,format:"json"|"csv"|"txt"){
  const a=document.createElement("a");
  a.href=`${API_BASE_URL}/ai/studio/drafts/${id}/export?format=${format}`;
  a.download="";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

function downloadSessionAll(sessionId:string){
  const a=document.createElement("a");
  a.href=`${API_BASE_URL}/ai/studio/sessions/${sessionId}/export/all`;
  a.download="";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}

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
  | {kind:"error"}
  | {kind:"channel_drafts";sessionId:string;productName:string;drafts:ChannelDraft[];masterDraft?:MasterProductDraft|null}
  | {kind:"generated_image";fileId:string;productName?:string|null}
  | {kind:"inventory_list";items:{product:string;location?:string;on_hand:number;reserved:number;available:number;status:string}[];label:string}
  | StudioAction
  | AuctionBatchAction;

// previewUrl is a blob: URL, only ever valid for the tab session that
// created it — optional so a restored (sessionStorage) attachment can carry
// just a fileId and fall back to the server-backed mediaUrl() below.
type ChatAttachment={previewUrl?:string;fileId?:string};

type ChatMessage={id:string;role:"user"|"assistant";text:string;action?:ChatAction;attachments?:ChatAttachment[];createdAt:string};

const QUICK_CHIPS=[
  {label:"Create sale",template:"Ahmed bought 1 Civic headlight for $100 and paid $90 cash."},
  {label:"Receive payment",template:"Ahmed paid the remaining balance."},
  {label:"Check inventory",template:"How many Civic headlights do we have?"},
  {label:"Receive stock",template:"Received 20 Civic headlights from ABC supplier."},
  {label:"Create purchase order",template:"Create a purchase order with ABC supplier for 10 brake pads."},
];

function mediaUrl(fileId:string){
  return `${API_BASE_URL}/ai/studio/media/${fileId}`;
}

function uid(){
  if(typeof crypto!=="undefined"&&"randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function MessageAttachments({attachments}:{attachments?:ChatAttachment[]}){
  if(!attachments||attachments.length===0)return null;
  return <div className="ai-thumbs">
    {attachments.map((a,i)=>{
      const src=a.previewUrl||(a.fileId?mediaUrl(a.fileId):"");
      if(!src) return null;
      return <a key={i} href={a.fileId?mediaUrl(a.fileId):src} target="_blank" rel="noreferrer">
        <img src={src} alt="Attachment"/>
      </a>;
    })}
  </div>;
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
  if(pairs.length===0) return <div style={{fontSize:15,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{text}</div>;
  return <div style={{marginTop:4}}>
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

function ChannelDraftCard({draft,onAskAI,onRegenerate,onReview,busy}:{
  draft:ChannelDraft;onAskAI:(d:ChannelDraft)=>void;onRegenerate:(d:ChannelDraft)=>void;onReview:(d:ChannelDraft)=>void;busy:boolean;
}){
  const label=STUDIO_CHANNELS.find(c=>c.value===draft.channel)?.label||draft.channel;
  return <div className="card" style={{padding:14,minWidth:240,flex:"1 1 260px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
      <div><div className="eyebrow">{label}</div><strong style={{fontSize:14}}>{draftTitle(draft)}</strong></div>
      <StatusBadge value={draft.status}/>
    </div>
    <div className="muted" style={{fontSize:11,marginTop:4}}>v{draft.current_version}</div>
    {draft.payload?.price!=null&&<div className="muted" style={{fontSize:12,marginTop:6}}>Price: {String(draft.payload.price)}</div>}
    {draft.payload?.seo_title&&<div className="muted" style={{fontSize:12,marginTop:4}}>SEO title: {String(draft.payload.seo_title)}</div>}
    {Array.isArray(draft.payload?.tags)&&draft.payload.tags.length>0&&<div className="muted" style={{fontSize:12,marginTop:4}}>Tags: {draft.payload.tags.join(", ")}</div>}
    {draft.payload?.description&&<p style={{fontSize:12,marginTop:8,lineHeight:1.5}}>{String(draft.payload.description).slice(0,160)}{String(draft.payload.description).length>160?"…":""}</p>}
    {(draft.payload?.caption||draft.payload?.instagram?.primary_caption)&&<p style={{fontSize:12,marginTop:8,lineHeight:1.5}}>{String(draft.payload.caption||draft.payload?.instagram?.primary_caption).slice(0,160)}</p>}
    {draft.missing_information?.length>0&&<div className="muted" style={{fontSize:11,marginTop:8}}>Missing: {draft.missing_information.join(", ")}</div>}
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:12}}>
      {(draft.channel==="shopify"||draft.channel==="ebay")&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} disabled={busy} onClick={()=>onReview(draft)}><ClipboardList size={12}/>Review</button>}
      {(draft.channel==="shopify"||draft.channel==="ebay")&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} disabled={busy} onClick={()=>onReview(draft)}><Pencil size={12}/>Edit</button>}
      <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} disabled={busy} onClick={()=>onAskAI(draft)}><Wand2 size={12}/>Ask AI</button>
      <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} disabled={busy} onClick={()=>onRegenerate(draft)}><RefreshCw size={12}/>Regenerate</button>
      {draft.status!=="published"&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} disabled={busy} onClick={()=>onReview(draft)}><ThumbsUp size={12}/>Approve</button>}
      <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} onClick={()=>navigator.clipboard?.writeText(JSON.stringify(draft.payload,null,2))}>Copy</button>
      <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} onClick={()=>downloadDraft(draft.id,"json")}><Download size={12}/>JSON</button>
      {(draft.channel==="shopify"||draft.channel==="ebay")&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} onClick={()=>downloadDraft(draft.id,"csv")}><Download size={12}/>CSV</button>}
      {(draft.channel==="meta"||draft.channel==="tiktok")&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} onClick={()=>downloadDraft(draft.id,"txt")}><Download size={12}/>TXT</button>}
    </div>
  </div>;
}

function GeneratedImageCard({fileId,productName,onUse}:{
  fileId:string;productName?:string|null;onUse:(text:string,fileIds:string[])=>void;
}){
  return <div className="ai-generated" style={{marginTop:10}}>
    <img src={mediaUrl(fileId)} alt="Generated marketplace image"/>
    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
      <a className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} href={mediaUrl(fileId)} download><Download size={12}/>Download</a>
      <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}} onClick={()=>onUse("Regenerate a clean professional marketplace image for this product.",[fileId])}><RefreshCw size={12}/>Regenerate</button>
      {(["shopify","meta","tiktok"] as ChannelName[]).map(ch=>
        <button key={ch} className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px"}}
          onClick={()=>onUse(`Create a ${ch} draft for ${productName||"this product"} using this image.`,[fileId])}>
          Use in {ch==="meta"?"Meta":ch[0].toUpperCase()+ch.slice(1)}
        </button>
      )}
    </div>
  </div>;
}

function AIPage(){
  const [view,setView]=useState<"chat"|"history">("chat");
  const [historyTab,setHistoryTab]=useState<HistoryTab>("Requests");
  const [functions,setFunctions]=useState<FunctionDefinition[]>([]);
  const [requests,setRequests]=useState<AIRequest[]>([]);
  const [approvals,setApprovals]=useState<Approval[]>([]);
  const [calls,setCalls]=useState<FunctionCall[]>([]);
  // DashboardShell (this page's only parent) already fetched and cached
  // /auth/me before any child of it renders — reusing that query here means
  // `user` is available synchronously on first render, not a second,
  // duplicate /auth/me request every time this page mounts.
  const { data: user } = useCurrentUser();
  const [adminLoading,setAdminLoading]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [mode,setMode]=useState<"function"|"approval"|null>(null);
  const [saving,setSaving]=useState(false);

  const welcomeMessage=useMemo<ChatMessage>(()=>({
    id:uid(),role:"assistant",
    text:"Hi! Ask me anything about sales, inventory, customers, payments or purchases — I'll figure out what to do.",
    createdAt:new Date().toISOString(),
  }),[]);
  // Keeps the conversation alive across navigation for the current user's
  // tab session (sessionStorage, cleared on logout — see DashboardShell).
  // Attachments are stripped of their blob: previewUrl before persisting;
  // MessageAttachments already falls back to mediaUrl(fileId) when absent.
  const {messages,setMessages}=useAIChatSession<ChatMessage>({
    userId:user?.id,
    initialMessages:[welcomeMessage],
    sanitize:msgs=>msgs.map(m=>m.attachments?{
      ...m,
      attachments:m.attachments.filter(a=>a.fileId).map(a=>({fileId:a.fileId})),
    }:m),
  });
  const [composer,setComposer]=useState("");
  const [sending,setSending]=useState(false);
  const aiProgress=useAIProgress();
  const abortRef=useRef<AbortController|null>(null);
  const userCancelledRef=useRef(false);
  const [listening,setListening]=useState(false);
  const [voiceSupported,setVoiceSupported]=useState(false);
  const recognitionRef=useRef<any>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const fileInputRef=useRef<HTMLInputElement>(null);
  const auctionSlipInputRef=useRef<HTMLInputElement>(null);
  const [scanningSlip,setScanningSlip]=useState(false);
  const queryClient=useQueryClient();

  // Optional channel chips hint the backend which drafts to create.
  // Attaching an image does NOT by itself start Content Studio generation.
  const [attachedImages,setAttachedImages]=useState<{file:File;previewUrl:string}[]>([]);
  const [studioChannels,setStudioChannels]=useState<ChannelName[]>([]);
  const [activeStudio,setActiveStudio]=useState<{sessionId:string;productName:string}|null>(null);
  const [studioBusyDraftId,setStudioBusyDraftId]=useState<string|null>(null);
  const [reviewDraft,setReviewDraft]=useState<ChannelDraft|null>(null);
  const [shortcutsOpen,setShortcutsOpen]=useState(false);

  const contentSessionsQuery=useQuery({
    queryKey:queryKeys.contentStudio.sessions(),
    queryFn:()=>apiFetch<ContentSession[]>("/ai/studio/sessions"),
    enabled:view==="history"&&historyTab==="Content Sessions",
    staleTime:30*1000,
  });

  function addImages(files:FileList|null){
    if(!files)return;
    const next=Array.from(files).slice(0,8-attachedImages.length).map(file=>({file,previewUrl:URL.createObjectURL(file)}));
    setAttachedImages(cur=>[...cur,...next].slice(0,8));
  }
  function removeImage(idx:number){
    setAttachedImages(cur=>cur.filter((_,i)=>i!==idx));
  }
  function toggleStudioChannel(ch:ChannelName){
    setStudioChannels(cur=>cur.includes(ch)?cur.filter(c=>c!==ch):[...cur,ch]);
  }

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

  // Functions/Requests/Approvals/Function-Calls are admin-oversight tabs
  // (settings.manage / approvals.view) — hide them entirely for an employee
  // who only holds ai.use, rather than showing a tab that's always empty.
  const visibleHistoryTabs=useMemo(()=>{
    const perms=new Set(user?.permissions||[]);
    return historyTabs.filter(t=>{
      if(t==="Functions")return perms.has("settings.manage");
      if(t==="Requests"||t==="Approvals"||t==="Function Calls")return perms.has("approvals.view");
      return true;
    });
  },[user]);

  const pendingApprovals=useMemo(()=>approvals.filter(a=>a.status==="pending").length,[approvals]);

  // Functions/Requests/Approvals/Function-Calls are admin-oversight tabs
  // (settings.manage / approvals.view) — genuinely irrelevant to the chat
  // itself, so this only ever gates the History view, never the chat.
  async function loadAdminData(currentUser:CurrentUser){
    setAdminLoading(true);setError("");
    try{
      const perms=new Set(currentUser.permissions||[]);

      // Fetching these for every employee who merely has ai.use would 403
      // and surface a scary permission error on a page everyone can open.
      const [f,r,a,c]=await Promise.all([
        perms.has("settings.manage")?apiFetch<FunctionDefinition[]>("/ai-admin/functions"):Promise.resolve([]),
        perms.has("approvals.view")?apiFetch<AIRequest[]>("/ai-admin/requests?limit=100"):Promise.resolve([]),
        perms.has("approvals.view")?apiFetch<Approval[]>("/ai-admin/approvals?limit=100"):Promise.resolve([]),
        perms.has("approvals.view")?apiFetch<FunctionCall[]>("/ai-admin/function-calls?limit=100"):Promise.resolve([]),
      ]);
      setFunctions(f);setRequests(r);setApprovals(a);setCalls(c);
    }catch(e:any){setError(e?.message||"Unable to load AI Command Center data.");}
    finally{setAdminLoading(false);}
  }

  function refresh(){
    return user?loadAdminData(user):Promise.resolve();
  }

  // Runs once per signed-in user id (not on every background /auth/me
  // refresh, which would otherwise refire this every staleTime tick).
  const adminDataLoadedForUserId=useRef<string|null>(null);
  useEffect(()=>{
    if(!user||adminDataLoadedForUserId.current===user.id)return;
    adminDataLoadedForUserId.current=user.id;
    loadAdminData(user);
  },[user]);
  useEffect(()=>{
    if(!visibleHistoryTabs.includes(historyTab)&&visibleHistoryTabs.length>0){
      setHistoryTab(visibleHistoryTabs[0]);
    }
  },[visibleHistoryTabs,historyTab]);
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

  async function sendMessage(rawText?:string, extraFileIds?:string[]){
    const images=attachedImages;
    const text=(rawText??composer).trim() || (images.length>0 || (extraFileIds&&extraFileIds.length>0) ? "Please look at the attached image." : "");
    if(!text||sending) return;
    const localAttachments:ChatAttachment[]=images.map(i=>({previewUrl:i.previewUrl}));
    setComposer("");setError("");
    const userMsgId=uid();
    setMessages(m=>[...m,{id:userMsgId,role:"user",text,attachments:localAttachments,createdAt:new Date().toISOString()}]);
    setAttachedImages([]);
    setSending(true);
    const controller=new AbortController();
    abortRef.current=controller;
    userCancelledRef.current=false;
    const requestId=newRequestId();
    aiProgress.start(requestId,images.length>0?"Uploading image…":"Understanding your request…");
    try{
      let fileIds=[...(extraFileIds||[])];
      if(images.length>0){
        const form=new FormData();
        images.forEach(i=>form.append("files",i.file));
        const uploaded=await apiUpload<{files:{file_id:string}[]}>("/ai/chat/uploads",form);
        if(controller.signal.aborted) throw new Error("Cancelled");
        fileIds=[...fileIds,...uploaded.files.map(f=>f.file_id)];
        setMessages(ms=>ms.map(msg=>msg.id===userMsgId?{
          ...msg,
          attachments:uploaded.files.map((f,i)=>({
            previewUrl:localAttachments[i]?.previewUrl||mediaUrl(f.file_id),
            fileId:f.file_id,
          })),
        }:msg));
      }else if(fileIds.length>0){
        setMessages(ms=>ms.map(msg=>msg.id===userMsgId?{
          ...msg,
          attachments:fileIds.map(id=>({previewUrl:mediaUrl(id),fileId:id})),
        }:msg));
      }

      const res=await apiFetch<ChatApiResponse>("/ai/chat",{method:"POST",timeoutMs:AI_CHAT_TIMEOUT_MS,signal:controller.signal,body:JSON.stringify({
        message:text,
        image_file_ids:fileIds,
        channels:studioChannels,
        client_request_id:requestId,
      })});

      if(res.type==="pending_approval"&&res.approval_id&&res.function){
        pushAssistant(res.text,{kind:"pending_approval",approvalId:res.approval_id,functionName:res.function,args:res.arguments||{},status:"pending"});
      }else if(res.type==="result"&&res.function==="create_channel_drafts"){
        const drafts=(res.result?.drafts||[]) as ChannelDraft[];
        setActiveStudio({sessionId:res.result?.session_id,productName:res.result?.product_name||"this product"});
        pushAssistant(res.text,{
          kind:"channel_drafts",
          sessionId:res.result?.session_id,
          productName:res.result?.product_name||"this product",
          drafts,
          masterDraft:res.result?.master_draft||null,
        });
        invalidate(queryClient,["contentStudio"]);
      }else if(res.type==="result"&&res.function==="generate_marketplace_image"&&res.result?.file_id){
        pushAssistant(res.text,{kind:"generated_image",fileId:res.result.file_id,productName:res.result.product_name});
      }else if(res.type==="result"&&(res.function==="search_inventory"||(res.function==="check_inventory"&&Array.isArray(res.result?.items)))){
        pushAssistant(res.text,{
          kind:"inventory_list",
          items:res.result?.items||[],
          label:res.result?.filter_label||res.result?.query||"Inventory",
        });
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
      if(userCancelledRef.current) pushAssistant("Cancelled. The request may still finish in the background.",{kind:"error"});
      else pushAssistant(`Sorry — ${e?.message||"something went wrong"}.`,{kind:"error"});
    }finally{
      aiProgress.stop();
      abortRef.current=null;
      setSending(false);
    }
  }

  function cancelSending(){
    userCancelledRef.current=true;
    abortRef.current?.abort();
  }

  // "Scan Auction Slip" is a dedicated upload+extract call, not a chat tool
  // call — the user shouldn't have to type a prompt to scan a document.
  // Persistence and manual entry both still work if AI extraction fails.
  async function scanAuctionSlip(files:File[]){
    if(scanningSlip||files.length===0)return;
    setScanningSlip(true);setError("");
    const scanRequestId=newRequestId();
    aiProgress.start(scanRequestId,"Uploading image…");
    const previewUrl=URL.createObjectURL(files[0]);
    setMessages(m=>[...m,{
      id:uid(),role:"user",
      text:files.length>1?`Scan auction slip (${files.length} images)`:"Scan auction slip",
      attachments:[{previewUrl}],createdAt:new Date().toISOString(),
    }]);
    try{
      const form=new FormData();
      files.forEach(f=>form.append("files",f));
      form.append("is_acquisition","true");
      form.append("client_request_id",scanRequestId);
      const batch=await apiFetch<Batch>("/smart-intake/vehicle/extract-images",{
        method:"POST",body:form,timeoutMs:AI_CHAT_TIMEOUT_MS,
      });
      const n=batch.items.length;
      const introText=n===0
        ?"I couldn't find any readable vehicles in that. Please try again or add one manually."
        :`I found ${n} vehicle${n===1?"":"s"} (${batch.summary.new??0} new, ${batch.summary.existing??0} existing`
          +`${batch.summary.possible_duplicate?`, ${batch.summary.possible_duplicate} need review`:""}). `
          +"Review them below before adding.";
      pushAssistant(introText,{kind:"auction_batch_review",batchId:batch.id,batch});
    }catch(e:any){
      pushAssistant(`Sorry — ${e?.message||"I couldn't process that file"}.`,{kind:"error"});
    }finally{
      aiProgress.stop();
      setScanningSlip(false);
    }
  }

  async function askAIOnDraft(draft:ChannelDraft){
    const instruction=prompt(`What should change on this ${draft.channel} draft?`,"");
    if(!instruction)return;
    setStudioBusyDraftId(draft.id);
    try{
      const res=await apiFetch<any>(`/ai/studio/sessions/${draft.session_id}/revise`,{
        method:"POST",body:JSON.stringify({instruction,channel:draft.channel,scope:"channel"}),
      });
      pushAssistant(`Revised the ${draft.channel} draft: "${instruction}"`,
        {kind:"content_studio_result",sessionId:draft.session_id,masterDraft:{} as any,
          channelResults:[{channel:draft.channel,status:"success",draft:res.draft}]});
      invalidate(queryClient,["contentStudio"]);
    }catch(e:any){setError(e?.message||"Unable to revise draft.");}
    finally{setStudioBusyDraftId(null);}
  }

  async function regenerateDraft(draft:ChannelDraft){
    setStudioBusyDraftId(draft.id);
    try{
      const updated=await apiFetch<ChannelDraft>(`/ai/studio/drafts/${draft.id}/regenerate`,{method:"POST"});
      pushAssistant(`Regenerated the ${draft.channel} draft.`,
        {kind:"content_studio_result",sessionId:draft.session_id,masterDraft:{} as any,
          channelResults:[{channel:draft.channel,status:"success",draft:updated}]});
      invalidate(queryClient,["contentStudio"]);
    }catch(e:any){setError(e?.message||"Unable to regenerate draft.");}
    finally{setStudioBusyDraftId(null);}
  }

  async function reopenSession(sessionId:string){
    try{
      const full=await apiFetch<{master_draft:MasterProductDraft|null;channel_drafts:ChannelDraft[]}>(`/ai/studio/sessions/${sessionId}`);
      setView("chat");
      if(full.master_draft){
        setActiveStudio({sessionId,productName:full.master_draft.product_name||"this product"});
        pushAssistant(`Reopened "${full.master_draft.product_name||"this product"}".`,{
          kind:"content_studio_result",sessionId,masterDraft:full.master_draft,
          channelResults:full.channel_drafts.map(d=>({channel:d.channel,status:"success" as const,draft:d})),
        });
      }
    }catch(e:any){setError(e?.message||"Unable to reopen session.");}
  }

  function openReview(draft:ChannelDraft){
    setReviewDraft(draft);
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
      setSuccess("Controlled function definition created.");setMode(null);await refresh();
    }catch(e:any){setError(e?.message||"Unable to create function.");}
    finally{setSaving(false);}
  }

  async function toggleFunction(f:FunctionDefinition){
    if(!isManager)return;
    try{
      await apiFetch(`/ai-admin/functions/${f.id}`,{method:"PUT",body:JSON.stringify({is_active:!f.is_active})});
      setSuccess(`Function ${f.is_active?"disabled":"enabled"}.`);await refresh();
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
      setSuccess("Approval request created.");setMode(null);await refresh();
    }catch(e:any){setError(e?.message||"Unable to create approval.");}
    finally{setSaving(false);}
  }

  async function decide(a:Approval,decision:"approve"|"reject"){
    const note=prompt(`${decision==="approve"?"Approval":"Rejection"} notes (optional)`,"")??"";
    try{
      await apiFetch(`/ai-admin/approvals/${a.id}/${decision}`,{method:"POST",body:JSON.stringify({decision_notes:note||null})});
      setSuccess(`Approval ${decision==="approve"?"approved":"rejected"}.`);await refresh();
    }catch(e:any){setError(e?.message||"Unable to decide approval.");}
  }

  const hasUserTurn=messages.some(m=>m.role==="user");
  const showShortcuts=!hasUserTurn||shortcutsOpen;

  return <div className={view==="chat"?"ai-workspace":undefined}>
    {view==="history"&&<div className="page-header" style={{padding:"26px 26px 0"}}>
      <div><div className="eyebrow">AI</div><h1 className="page-title">AI Command Center</h1>
        <p className="page-copy">Request history, approvals and content sessions.</p></div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-secondary" onClick={refresh}><RefreshCw size={15}/>Refresh</button>
        <button className="btn btn-secondary" onClick={()=>setView("chat")}><Sparkles size={15}/>Chat</button>
        <button className="btn btn-primary"><History size={15}/>History{pendingApprovals>0?` (${pendingApprovals} pending)`:""}</button>
      </div>
    </div>}

    <Message error={error} success={success}/>

    {/* Admin-oversight data (Functions/Requests/Approvals/Function-Calls) is
        irrelevant to chat — only the History view ever waits on it, so
        returning to the chat (including a restored conversation) never sits
        behind an unrelated loading spinner. */}
    {view==="history"&&adminLoading&&<div className="card" style={{padding:30,textAlign:"center",margin:26}}><Loader2 className="spin" size={18}/> Loading...</div>}

    {view==="chat"&&<>
      <div className="ai-thread">
        <div className="ai-column">
          <div className="ai-intro">
            <div className="eyebrow">AI</div>
            <h1>AI Command Center</h1>
            <p>Ask about inventory, sales, customers and payments, or attach a product photo to analyse it and create channel drafts.</p>
          </div>
          {messages.map(msg=>
            <div key={msg.id} className={`ai-msg ${msg.role}`}>
              <div className="ai-bubble" style={msg.action?.kind==="error"?{color:"var(--danger)"}:undefined}>
                <MessageAttachments attachments={msg.attachments}/>

                {msg.role==="assistant"&&msg.action?.kind==="result"
                  ?<ResultCard text={msg.text}/>
                  :msg.action?.kind==="inventory_list"
                    ?<>
                      <div style={{fontSize:15,lineHeight:1.55,marginBottom:8}}>{msg.text.split("\n")[0]}</div>
                      {msg.action.items.length>0&&<table className="ai-inventory">
                        <thead><tr><th>Product</th><th>Location</th><th>On hand</th><th>Available</th><th>Status</th></tr></thead>
                        <tbody>{msg.action.items.map((row,i)=><tr key={i}>
                          <td>{row.product}</td><td>{row.location||"—"}</td>
                          <td>{row.on_hand}</td><td>{row.available}</td><td>{row.status}</td>
                        </tr>)}</tbody>
                      </table>}
                    </>
                  :<div>{msg.text}</div>}

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

                {msg.action?.kind==="generated_image"&&
                  <GeneratedImageCard fileId={msg.action.fileId} productName={msg.action.productName} onUse={sendMessage}/>}

                {msg.action?.kind==="channel_drafts"&&<div style={{marginTop:10}}>
                  {msg.action.masterDraft?.product_name&&<div style={{marginBottom:12}}>
                    <div className="eyebrow">Product analysis</div>
                    <strong>{msg.action.masterDraft.product_name}</strong>
                    <div className="muted" style={{fontSize:12,marginTop:4}}>
                      {[msg.action.masterDraft.brand,msg.action.masterDraft.condition,msg.action.masterDraft.price!=null?String(msg.action.masterDraft.price):null].filter(Boolean).join(" · ")}
                    </div>
                  </div>}
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {msg.action.drafts.map(d=>
                      <ChannelDraftCard key={d.id} draft={d} onAskAI={askAIOnDraft} onRegenerate={regenerateDraft}
                        onReview={openReview} busy={studioBusyDraftId===d.id}/>
                    )}
                  </div>
                  {msg.action.sessionId&&<button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px",marginTop:10}}
                    onClick={()=>downloadSessionAll(msg.action?.kind==="channel_drafts"?msg.action.sessionId:"")}>
                    <Download size={12}/>Download All
                  </button>}
                </div>}

                {msg.action?.kind==="content_studio_result"&&<div style={{marginTop:10}}>
                  {msg.action.masterDraft?.product_name&&<div style={{marginBottom:12}}>
                    <div className="eyebrow">Product analysis</div>
                    <strong>{msg.action.masterDraft.product_name}</strong>
                  </div>}
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {msg.action.channelResults.map(r=>r.status==="success"&&r.draft
                      ?<ChannelDraftCard key={r.draft.id} draft={r.draft} onAskAI={askAIOnDraft} onRegenerate={regenerateDraft}
                          onReview={openReview} busy={studioBusyDraftId===r.draft.id}/>
                      :<div key={r.channel} style={{padding:12,minWidth:200,color:"var(--danger)",fontSize:12}}>
                          <strong>{r.channel}</strong> failed: {r.error}
                        </div>
                    )}
                  </div>
                  <button className="btn btn-ghost" style={{fontSize:11,padding:"6px 9px",marginTop:10}}
                    onClick={()=>downloadSessionAll(msg.action?.kind==="content_studio_result"?msg.action.sessionId:"")}>
                    <Download size={12}/>Download All
                  </button>
                </div>}

                {msg.action?.kind==="auction_batch_review"&&
                  <div style={{marginTop:10}}>
                    <BatchReviewTable
                      batchId={msg.action.batchId}
                      initialBatch={msg.action.batch}
                      onCreated={res=>{
                        pushAssistant(
                          `${res.created_count} vehicle${res.created_count===1?"":"s"} added as Incoming / In Transit.`
                          +(res.skipped_count?` ${res.skipped_count} already existed.`:"")
                          +" You'll find them under Vehicles → Incoming / In Transit.",
                          {kind:"result"},
                        );
                        invalidate(queryClient,["vehicles","inventory","dashboard"]);
                      }}
                    />
                  </div>}
              </div>
            </div>
          )}
          {sending&&<div className="ai-msg assistant"><AIProgressIndicator progress={aiProgress.progress} onCancel={cancelSending}/></div>}
          {scanningSlip&&<div className="ai-msg assistant"><AIProgressIndicator progress={aiProgress.progress}/></div>}
          <div ref={bottomRef}/>
        </div>
      </div>

      <div className="ai-composer-dock">
        <div className="ai-view-switch">
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={refresh}><RefreshCw size={14}/>Refresh</button>
          <button className="btn btn-primary" style={{fontSize:12,padding:"6px 10px"}}><Sparkles size={14}/>Chat</button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>setView("history")}>
            <History size={14}/>History{pendingApprovals>0?` (${pendingApprovals})`:""}
          </button>
        </div>
        <div className="ai-composer">
          {activeStudio&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:8}}>
            <span style={{fontSize:12}}><Wand2 size={12} style={{marginRight:6,verticalAlign:"-2px"}}/>Drafts for <strong>{activeStudio.productName}</strong></span>
            <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>setActiveStudio(null)}>Dismiss</button>
          </div>}

          {attachedImages.length>0&&<div className="ai-thumbs" style={{marginBottom:8}}>
            {attachedImages.map((img,i)=><div key={i} style={{position:"relative",width:56,height:56}}>
              <img src={img.previewUrl} alt={img.file.name} style={{width:56,height:56,objectFit:"cover",borderRadius:10}}/>
              <button type="button" onClick={()=>removeImage(i)} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,.6)",border:"none",borderRadius:6,color:"#fff",width:18,height:18,display:"grid",placeItems:"center",cursor:"pointer"}}>
                <X size={11}/>
              </button>
            </div>)}
          </div>}

          {attachedImages.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            <span className="muted" style={{fontSize:11,alignSelf:"center"}}>Channels</span>
            {STUDIO_CHANNELS.map(c=>
              <button key={c.value} type="button" className={`btn ${studioChannels.includes(c.value)?"btn-primary":"btn-ghost"}`}
                style={{fontSize:11,padding:"5px 10px"}} onClick={()=>toggleStudioChannel(c.value)}>{c.label}</button>
            )}
          </div>}

          {hasUserTurn&&<button type="button" className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px",marginBottom:showShortcuts?8:0}}
            onClick={()=>setShortcutsOpen(o=>!o)}><ChevronDown size={12}/>Shortcuts</button>}
          {showShortcuts&&<div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
            {QUICK_CHIPS.map(c=>
              <button key={c.label} type="button" className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}}
                onClick={()=>setComposer(c.template)}>{c.label}</button>
            )}
          </div>}
          <form onSubmit={e=>{e.preventDefault();sendMessage();}} className="ai-composer-row">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
              onChange={e=>{addImages(e.target.files);e.target.value="";}}/>
            <button type="button" className="icon-btn" title="Attach product images" onClick={()=>fileInputRef.current?.click()}>
              <ImagePlus size={16}/>
            </button>
            {(user?.permissions||[]).includes("vehicles.acquisition.manage")&&<>
              <input ref={auctionSlipInputRef} type="file" accept="image/*,application/pdf" capture="environment" multiple hidden
                onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value="";if(files.length)scanAuctionSlip(files);}}/>
              <button type="button" className="btn btn-ghost" style={{fontSize:12,padding:"8px 10px",whiteSpace:"nowrap"}}
                title="Camera / Upload" disabled={scanningSlip} onClick={()=>auctionSlipInputRef.current?.click()}>
                {scanningSlip?<Loader2 size={15} className="spin"/>:<ScanLine size={15}/>} Scan Auction Slip
              </button>
            </>}
            <textarea
              className="textarea"
              style={{flex:1}}
              placeholder={attachedImages.length>0?"Ask about this image, or request Shopify/Meta/TikTok drafts...":"Ask anything about sales, inventory, customers, payments, purchases..."}
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
            <button className="btn btn-primary" disabled={sending||(!composer.trim()&&attachedImages.length===0)} style={{height:44}}><Send size={15}/>Send</button>
          </form>
        </div>
      </div>
    </>}

    {!adminLoading&&view==="history"&&<div style={{padding:"16px 26px 26px"}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        {visibleHistoryTabs.map(x=><button key={x} className={`btn ${historyTab===x?"btn-primary":"btn-secondary"}`} onClick={()=>setHistoryTab(x)}>{x}</button>)}
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

      {historyTab==="Content Sessions"&&<>
        <div className="records-toolbar card"><div><strong>AI Content Generation Sessions</strong><div className="muted" style={{fontSize:12}}>
          Every product-content generation, with the channels it created. Reopen to view or keep revising.</div></div></div>
        <div className="table-wrap"><table><thead><tr><th>Product / Prompt</th><th>Channels</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>{contentSessionsQuery.isLoading?<EmptyRow columns={5} text="Loading..."/>:(contentSessionsQuery.data||[]).length===0?<EmptyRow columns={5}/>:(contentSessionsQuery.data||[]).map(s=><tr key={s.id}>
            <td><strong>{s.product_name||s.input_text.slice(0,60)}</strong></td>
            <td>{(s.requested_channels||[]).map(ch=>STUDIO_CHANNELS.find(c=>c.value===ch)?.label||ch).join(", ")||"—"}</td>
            <td><StatusBadge value={s.status}/></td><td>{new Date(s.created_at).toLocaleString()}</td>
            <td><button className="btn btn-ghost" onClick={()=>reopenSession(s.id)}>Reopen</button></td>
          </tr>)}</tbody></table></div>
      </>}
    </div>}

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
    {reviewDraft&&<ReviewListingModal draft={reviewDraft} onClose={()=>setReviewDraft(null)} onDone={msg=>setSuccess(msg)}/>}
    <GlobalSpinStyle/>
  </div>;
}

export default function Page() {
  return (
    <RequirePermission perm="ai.use">
      <AIPage />
    </RequirePermission>
  );
}
