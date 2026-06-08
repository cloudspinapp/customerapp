import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL!;

async function getToken(): Promise<string | null> {
  return await storage.getItem<string>("auth_token", "");
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  sendOtp: (phone: string) =>
    request("/auth/send-otp", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    request<{ token: string; user: any }>("/auth/verify-otp", {
      method: "POST",
      body: { phone, otp, name },
      auth: false,
    }),
  me: () => request("/auth/me"),
  services: () => request<any[]>("/services"),
  banners: () => request<any[]>("/banners"),
  addresses: () => request<any[]>("/addresses"),
  addAddress: (a: any) => request("/addresses", { method: "POST", body: a }),
  updateAddress: (id: string, a: any) =>
    request(`/addresses/${id}`, { method: "PUT", body: a }),
  deleteAddress: (id: string) => request(`/addresses/${id}`, { method: "DELETE" }),
  createOrder: (o: any) => request("/orders", { method: "POST", body: o }),
  orders: () => request<any[]>("/orders"),
  order: (id: string) => request(`/orders/${id}`),
  notifications: () => request<any[]>("/notifications"),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  markRead: () => request("/notifications/mark-read", { method: "POST" }),
  registerPush: (user_id: string, platform: string, device_token: string) =>
    request("/register-push", {
      method: "POST",
      body: { user_id, platform, device_token },
    }),
};

export async function saveAuth(token: string, user: any) {
  await storage.setItem("auth_token", token);
  await storage.setItem("auth_user", JSON.stringify(user));
}
export async function clearAuth() {
  await storage.removeItem("auth_token");
  await storage.removeItem("auth_user");
}
export async function getUser(): Promise<any | null> {
  const raw = await storage.getItem<string>("auth_user", "");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
