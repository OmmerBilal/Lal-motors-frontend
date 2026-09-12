import { PageHeader } from "@/components/Shared";
import { CalendarClock, FileEdit, Send, Store } from "lucide-react";

const content = [
  {title:"Front Bumper · Audi A4",status:"Draft",meta:"Updated 20 min ago"},
  {title:"Transmission · BMW 3 Series",status:"Published",meta:"Published yesterday"},
  {title:"Headlight Assembly",status:"Scheduled",meta:"Scheduled for Sep 12"},
  {title:"Used Parts Collection",status:"Draft",meta:"Updated 2 days ago"},
  {title:"Salvage Vehicle Campaign",status:"Published",meta:"Published Sep 04"},
  {title:"September Inventory Drop",status:"Draft",meta:"Updated Sep 03"},
];

export default function Page() {
  return (
    <>
      <PageHeader eyebrow="Sales Channel" title="TikTok" description="Video drafts, scheduled posts and published TikTok content." primaryLabel="Create Draft"/>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <span className="badge blue"><FileEdit size={12}/> Drafts 3</span>
        <span className="badge green"><Send size={12}/> Published 2</span>
        <span className="badge orange"><CalendarClock size={12}/> Scheduled 1</span>
      </div>
      <div className="channel-page-grid">
        {content.map((x,i)=>(
          <div className="card listing-card" key={i}>
            <div className="listing-thumb"><Store size={30}/></div>
            <div className="listing-title">{x.title}</div>
            <div className="listing-sub">{x.meta}</div>
            <div style={{marginTop:12}}><span className={`badge ${x.status==="Published"?"green":x.status==="Scheduled"?"orange":"blue"}`}>{x.status}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
