import { PageHeader } from "@/components/Shared";
import { ShieldCheck, UserCog, Database, PlugZap } from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Configure users, roles, integrations and business preferences." primaryLabel="Save Changes"/>
      <div className="feature-grid">
        {[
          [UserCog,"Users & Roles","Control who can access each area of the system."],
          [ShieldCheck,"Approvals","Define which actions require human approval."],
          [Database,"Database","PostgreSQL / Supabase connection will be managed by the backend."],
          [PlugZap,"Integrations","Shopify, eBay, Meta, TikTok and future services."]
        ].map(([Icon,title,copy]:any)=>(
          <div className="feature-card" key={title}><div className="feature-icon"><Icon size={20}/></div><h3>{title}</h3><p>{copy}</p></div>
        ))}
      </div>
    </>
  );
}
