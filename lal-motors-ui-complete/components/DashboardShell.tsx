"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CarFront, Menu, Search, Sparkles } from "lucide-react";
import { navGroups } from "@/lib/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function DashboardShell({children}:{children:React.ReactNode}) {
  const pathname = usePathname();

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark"><CarFront size={18}/></span>
            <span className="sidebar-brand-copy">LAL MOTORS</span>
          </Link>
        </div>

        {navGroups.map(group=>(
          <div key={group.title}>
            <div className="nav-section-title">{group.title}</div>
            {group.items.map(item=>{
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link className={`side-link ${active ? "active":""}`} href={item.href} key={item.href}>
                  <Icon size={17}/><span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}

        <div className="side-footer">
          <div className="user-chip">
            <div className="avatar">AD</div>
            <div className="user-copy">
              <div style={{fontWeight:800,fontSize:13}}>Admin User</div>
              <div className="muted" style={{fontSize:11}}>admin@lalmotors.com</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <button className="icon-btn mobile-menu"><Menu size={17}/></button>
          <div className="searchbox">
            <Search size={16}/><input placeholder="Search vehicles, parts, customers, orders..." />
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Link href="/dashboard/ai" className="btn btn-ghost"><Sparkles size={15}/> AI</Link>
            <button className="icon-btn"><Bell size={17}/></button>
            <ThemeToggle/>
          </div>
        </div>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
