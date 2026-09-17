"use client";

import Link from "next/link";
import { ArrowRight, CarFront, PlayCircle, Sparkles, ShieldCheck, Store, Users, Workflow } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <>
      <header className="topnav">
        <div className="container topnav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark"><CarFront size={19} /></span>
            <span>LAL MOTORS</span>
          </Link>

          <nav className="navlinks">
            <a href="#platform">Features</a>
            <a href="#ai">AI Command</a>
            <a href="#channels">Channels</a>
            <a href="#about">About</a>
          </nav>

          <div className="nav-actions">
            <ThemeToggle />
            <Link href="/login" className="btn btn-primary">Login <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="premium-home-hero">
          <div className="container">
            <div className="premium-hero-shell">
              <img src="/real-car-hero.jpg" className="premium-hero-photo" alt="Premium performance vehicle" />
              <div className="premium-hero-shade" />
              <div className="premium-hero-lines" />

              <div className="premium-hero-content">
                <div className="premium-kicker">AI-POWERED AUTOMOTIVE BUSINESS MANAGEMENT</div>
                <h1>
                  Automotive Business,
                  <span> Smarter with AI.</span>
                </h1>
                <p>
                  Manage vehicles, used parts, inventory, customers, sales and marketing
                  from one intelligent operating system.
                </p>

                <div className="hero-actions">
                  <Link href="/login" className="btn btn-primary hero-main-btn">
                    Login to Dashboard <ArrowRight size={16} />
                  </Link>
                  <a href="#ai" className="btn hero-glass-btn">
                    <PlayCircle size={16} /> Explore AI
                  </a>
                </div>

                <div className="premium-hero-benefits">
                  <span><Workflow size={15} /> One business platform</span>
                  <span><Sparkles size={15} /> AI-assisted workflows</span>
                  <span><ShieldCheck size={15} /> Human-approved actions</span>
                </div>
              </div>

              <aside className="premium-capability-card">
                <div className="premium-capability-title">Turn inventory into opportunity</div>
                <p>Everything important stays visible and connected.</p>
                <div className="premium-capability-list">
                  <div><span><CarFront size={16} /></span>Vehicle Inventory</div>
                  <div><span><Store size={16} /></span>Multi-Channel Listings</div>
                  <div><span><Sparkles size={16} /></span>AI Automation</div>
                  <div><span><Users size={16} /></span>Customer Management</div>
                </div>
              </aside>

              <div className="premium-hero-stats">
                <div><b>27</b><span>Migrated vehicles</span></div>
                <div><b>9</b><span>Used parts</span></div>
                <div><b>3</b><span>Verified sales</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="home-section">
          <div className="container">
            <div className="eyebrow">One operating system</div>
            <h2 className="section-title">Built around how Lal Motors actually works.</h2>
            <p className="section-subtitle">
              Vehicles, used parts, customers, sales, suppliers, logistics and AI workflows
              all live in one connected platform.
            </p>

            <div className="feature-grid">
              {[
                ["Inventory Operations", "Vehicles, parts, new items and storage locations."],
                ["Business Records", "Customers, suppliers, sales and purchase orders."],
                ["AI Database Actions", "Create, search and update records through approved functions."],
                ["Multi-Channel Sales", "Shopify, eBay, Meta and TikTok drafts and publishing history."]
              ].map(([title, copy]) => (
                <div className="feature-card" key={title}>
                  <div className="feature-icon"><Sparkles size={20} /></div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ai" className="home-section">
          <div className="container card card-pad">
            <div className="eyebrow">AI Command Center</div>
            <h2 className="section-title" style={{fontSize: "34px"}}>Type it. Say it. Upload it. Then approve it.</h2>
            <p className="section-subtitle">
              AI will help operate the business using text, voice, images and documents,
              while important actions stay under human approval.
            </p>
          </div>
        </section>

        <section id="channels" className="home-section">
          <div className="container">
            <div className="eyebrow">Connected channels</div>
            <h2 className="section-title">Every draft, listing and post has a home.</h2>
            <div className="feature-grid">
              {["Shopify", "eBay", "Meta", "TikTok"].map((name) => (
                <div className="feature-card" key={name}>
                  <div className="feature-icon"><Store size={20} /></div>
                  <h3>{name}</h3>
                  <p>Drafts, scheduled content, active listings and publishing history.</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="home-section">
          <div className="container card card-pad">
            <div className="eyebrow">Lal Motors</div>
            <h2 className="section-title" style={{fontSize: "34px"}}>One intelligent system for the complete operation.</h2>
            <p className="section-subtitle">
              Built to centralize data, reduce repetitive work and help the team manage
              vehicles, parts, sales and logistics more efficiently.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
