import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendRoot(): string {
  return path.resolve(process.cwd(), "..", "lal-motors-backend-foundation");
}

export async function GET() {
  const backend = backendRoot();
  const python = path.join(backend, ".venv", "Scripts", "python.exe");
  const runner = path.join(backend, "scripts", "_run_verify.py");
  const statusPath = path.join(backend, "scripts", "_verify_status.json");
  const lockPath = path.join(backend, "scripts", "_verify_lock.txt");

  if (!fs.existsSync(python)) {
    return Response.json({ ok: false, error: "venv python missing", python }, { status: 500 });
  }
  if (!fs.existsSync(runner)) {
    return Response.json({ ok: false, error: "runner missing", runner }, { status: 500 });
  }

  let already = false;
  if (fs.existsSync(lockPath)) {
    already = true;
  } else {
    fs.writeFileSync(lockPath, new Date().toISOString(), "utf8");
    const child = spawn(python, [runner], {
      cwd: backend,
      env: { ...process.env, PYTHONPATH: backend, PYTHONUNBUFFERED: "1" },
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  }

  let status = null;
  if (fs.existsSync(statusPath)) {
    try {
      status = JSON.parse(fs.readFileSync(statusPath, "utf8"));
    } catch {
      status = null;
    }
  }
  return Response.json({ ok: true, already, python, runner, status });
}
