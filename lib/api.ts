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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

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
      }
    }

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export type CurrentUser = {
  id: string;
  business_unit_id: string;
  email: string;
  display_name: string | null;
  status: string;
  auth_provider: string | null;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me");
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
