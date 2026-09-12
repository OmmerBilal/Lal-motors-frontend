"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CarFront, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@lalmotors.com");
  const [password, setPassword] = useState("demo1234");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (email === "admin@lalmotors.com" && password === "demo1234") {
      router.push("/dashboard");
    } else {
      setError("Invalid demo credentials.");
    }
  }

  return (
    <main className="login-shell">
      <div style={{position:"fixed",right:22,top:22}}><ThemeToggle/></div>

      <div className="card login-card">
        <Link href="/" className="muted" style={{display:"inline-flex",gap:8,alignItems:"center",fontSize:13,marginBottom:24}}>
          <ArrowLeft size={15}/> Back to home
        </Link>

        <div className="login-logo"><CarFront size={22}/></div>
        <div className="eyebrow">Secure access</div>
        <h1 style={{fontSize:32,letterSpacing:"-.04em",margin:"8px 0 8px"}}>Welcome back.</h1>
        <p className="muted" style={{margin:"0 0 24px",lineHeight:1.6}}>
          Sign in to the Lal Motors AI Business OS.
        </p>

        <form onSubmit={submit}>
          <label className="form-label">Email</label>
          <div style={{position:"relative",marginBottom:14}}>
            <Mail size={16} style={{position:"absolute",left:13,top:13,color:"var(--muted)"}}/>
            <input className="input" style={{paddingLeft:40}} value={email} onChange={e=>setEmail(e.target.value)} />
          </div>

          <label className="form-label">Password</label>
          <div style={{position:"relative"}}>
            <LockKeyhole size={16} style={{position:"absolute",left:13,top:13,color:"var(--muted)"}}/>
            <input
              className="input"
              style={{paddingLeft:40,paddingRight:44}}
              type={show ? "text":"password"}
              value={password}
              onChange={e=>setPassword(e.target.value)}
            />
            <button type="button" onClick={()=>setShow(v=>!v)} className="icon-btn"
              style={{position:"absolute",right:4,top:4,border:"0",background:"transparent"}}>
              {show ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>

          {error && <div style={{marginTop:12,color:"var(--danger)",fontSize:13}}>{error}</div>}

          <button className="btn btn-primary" style={{width:"100%",marginTop:20}}>Login to Dashboard</button>
        </form>

        <div className="card" style={{marginTop:18,padding:14,background:"var(--bg-soft)",boxShadow:"none"}}>
          <div style={{fontWeight:700,fontSize:12}}>Demo login</div>
          <div className="muted" style={{fontSize:12,marginTop:6}}>admin@lalmotors.com / demo1234</div>
        </div>
      </div>
    </main>
  );
}
