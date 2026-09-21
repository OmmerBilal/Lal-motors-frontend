"use client";

// Defaults to the same-origin proxy (see next.config.mjs `rewrites()`) so the
// auth cookie is always first-party from the browser's point of view, in both
// dev and production. Only set NEXT_PUBLIC_API_URL to override this with a
// direct, cross-origin backend URL — doing so in production brings back the
// SameSite cross-site cookie problem this proxy exists to avoid.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 20_000;
export const AUTH_ME_TIMEOUT_MS = 8_000;
// AI chat/tool loops can exceed the 20s session-hang default. Match the
// dedicated Next.js /api/v1/ai proxy (300s) so the browser does not abort
// a still-running backend OpenAI + Shopify tool call.
export const AI_CHAT_TIMEOUT_MS = 300_000;

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: userSignal, ...init } = options;
  const headers = new Headers(init.headers);

  // A FormData body must keep the browser-generated multipart boundary in
  // its Content-Type — forcing application/json here would silently break
  // every file upload (the server would receive a mislabeled empty body).
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const abortFromUser = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener("abort", abortFromUser, { once: true });
    }
  }
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = (err instanceof DOMException && err.name === "AbortError")
      || (err instanceof Error && err.name === "AbortError");
    if (aborted) {
      throw new ApiError("Request timed out.", 408);
    }
    throw err;
  } finally {
    window.clearTimeout(timeoutId);
    userSignal?.removeEventListener("abort", abortFromUser);
  }

  let data: any = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || null;
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    if (data && typeof data === "object") {
      if (typeof data.detail === "string") {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item: any) => item?.msg || "Invalid value")
          .join(", ");
      } else if (data.detail && typeof data.detail === "object") {
        message = data.detail.message || data.detail.detail || message;
        if (Array.isArray(data.detail.missing) && data.detail.missing.length) {
          message = `${message} Missing: ${data.detail.missing.join(", ")}`;
        }
      }
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export type EmployeeSummary = {
  id: string;
  employee_number: string | null;
  display_name: string;
  employment_type: string | null;
  employment_status: string;
};

export type CurrentUser = {
  id: string;
  business_unit_id: string;
  email: string;
  display_name: string | null;
  status: string;
  must_change_password: boolean;
  auth_provider: string | null;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
  permissions: string[];
  employee: EmployeeSummary | null;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me", { timeoutMs: AUTH_ME_TIMEOUT_MS });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: formData });
}
