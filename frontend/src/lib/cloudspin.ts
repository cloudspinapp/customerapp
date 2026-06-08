// Cloudspin API client + screen-name router.
//
// The Cloudspin API now returns a `next_screen` field on every response
// (e.g. "OTP Screen", "Home Screen", "Name Screen"). The frontend uses this
// to decide where to navigate, instead of hard-coding flow logic.

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL!;

async function postJson<T = any>(path: string, payload: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error("Server returned invalid response"); }
  if (!res.ok) {
    throw new Error(data?.detail || data?.message || `Request failed (${res.status})`);
  }
  return data as T;
}

// ----- Response types -----
export type CloudspinBase<TData = unknown> = {
  status: boolean;
  message: string;
  next_screen?: string;
  instruction?: string;
  data?: TData;
};

export type SendOtpResponse = CloudspinBase<{ otp: string }>;
export type VerifyOtpResponse = CloudspinBase<{ customer_id: string | number }>;

export type CloudspinAddress = {
  ID: string;
  customer_id: string;
  label: string;
  address_line: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude: string;
  longitude: string;
  is_default: string; // "0" | "1"
  created_date?: string;
};

export type AddressInput = {
  label: string;
  address_line: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: string;
  longitude?: string;
  is_default?: "0" | "1";
};

export type CloudspinOrder = {
  ID: string;
  order_no: string;
  final_amount: string;        // numeric string ("0", "850", ...)
  created_date: string;        // "YYYY-MM-DD HH:MM:SS"
  delivery_date: string;       // "YYYY-MM-DD HH:MM:SS"
  order_status: string;        // free-form status text from upstream
};

// ----- API methods -----
export const cloudspin = {
  // POST https://cloudspin.in/api/login/authenticate  body: txtcontact=<phone>
  sendOtp: (phone: string) =>
    postJson<SendOtpResponse>("/cloudspin/login/authenticate", { txtcontact: phone }),

  // POST https://cloudspin.in/api/login/otp  body: txtcontact=<phone>, otp=<otp>
  verifyOtp: (phone: string, otp: string) =>
    postJson<VerifyOtpResponse>("/cloudspin/login/otp", { txtcontact: phone, otp }),

  // POST https://cloudspin.in/api/customers/update  body: customer_id, txtname, map_location
  updateCustomer: (params: { customer_id: string; txtname: string; map_location: string }) =>
    postJson<CloudspinBase>("/cloudspin/customers/update", params),

  // GET https://cloudspin.in/api/services
  services: async (): Promise<CloudspinBase<CloudspinService[]>> => {
    const res = await fetch(`${BASE}/api/cloudspin/services`);
    const text = await res.text();
    try { return text ? JSON.parse(text) : { status: false, message: "Empty response", data: [] }; }
    catch { throw new Error("Server returned invalid response"); }
  },

  // ---------- Address APIs ----------
  // POST /api/customers/addresses { customer_id }
  listAddresses: (customer_id: string) =>
    postJson<CloudspinBase<CloudspinAddress[]>>(
      "/cloudspin/customers/addresses", { customer_id },
    ),

  // POST /api/customers/get_address_detail { address_id }
  getAddress: (address_id: string) =>
    postJson<CloudspinBase<CloudspinAddress>>(
      "/cloudspin/customers/get_address_detail", { address_id },
    ),

  // POST /api/customers/set_default_address { address_id, customer_id }
  setDefaultAddress: (customer_id: string, address_id: string) =>
    postJson<CloudspinBase<CloudspinAddress[]>>(
      "/cloudspin/customers/set_default_address", { customer_id, address_id },
    ),

  // POST /api/customers/add_address
  addAddress: (customer_id: string, addr: AddressInput) =>
    postJson<CloudspinBase>(
      "/cloudspin/customers/add_address",
      {
        customer_id,
        label: addr.label,
        address_line: addr.address_line,
        landmark: addr.landmark || "",
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        latitude: addr.latitude || "",
        longitude: addr.longitude || "",
        is_default: addr.is_default || "0",
      },
    ),

  // POST /api/customers/update_address
  updateAddress: (customer_id: string, address_id: string, addr: AddressInput) =>
    postJson<CloudspinBase<CloudspinAddress[]>>(
      "/cloudspin/customers/update_address",
      {
        customer_id,
        address_id,
        label: addr.label,
        address_line: addr.address_line,
        landmark: addr.landmark || "",
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        latitude: addr.latitude || "",
        longitude: addr.longitude || "",
        is_default: addr.is_default || "0",
      },
    ),

  // POST /api/customers/delete_address { customer_id, address_id }
  deleteAddress: (customer_id: string, address_id: string) =>
    postJson<CloudspinBase<CloudspinAddress[]>>(
      "/cloudspin/customers/delete_address", { customer_id, address_id },
    ),

  // POST /api/services/schedule
  //   { customer_id, address_id, pickup_date(DD-MM-YYYY),
  //     pickup_slot("03:00 PM - 05:00 PM"), services("Dryclean, Wash and Fold") }
  schedulePickup: (params: {
    customer_id: string;
    address_id: string;
    pickup_date: string;     // DD-MM-YYYY
    pickup_slot: string;     // e.g. "03:00 PM - 05:00 PM"
    services: string;        // comma-separated service names
  }) => postJson<CloudspinBase>("/cloudspin/services/schedule", params),

  // POST /api/orders/index { customer_id, order_type: "active" | "past" }
  listOrders: (customer_id: string, order_type: "active" | "past") =>
    postJson<CloudspinBase<CloudspinOrder[]>>(
      "/cloudspin/orders/index", { customer_id, order_type },
    ),
};

export type CloudspinService = {
  name: string;
  description: string;
  icon?: string;
};

// Fallback icon map (only used if the API ever returns a service without an `icon` field).
const SERVICE_ICONS: Record<string, string> = {
  "DRY CLEAN": "https://img.icons8.com/fluency/96/dry-clean.png",
  "STEAM IRON": "https://img.icons8.com/fluency/96/steam.png",
  "IRONING": "https://img.icons8.com/fluency/96/iron.png",
  "SHOE CLEANING": "https://img.icons8.com/fluency/96/sneakers.png",
  "WASH AND FOLD": "https://img.icons8.com/fluency/96/laundry.png",
  "WASH & FOLD": "https://img.icons8.com/fluency/96/laundry.png",
  "WASH AND STEAM IRON": "https://img.icons8.com/fluency/96/washing-machine.png",
  "PREMIUM WASH": "https://img.icons8.com/fluency/96/washing-machine.png",
};

export function iconForService(svc: CloudspinService | string): string {
  if (typeof svc === "object" && svc.icon) return svc.icon;
  const name = typeof svc === "string" ? svc : svc.name;
  return SERVICE_ICONS[name.trim().toUpperCase()] || "https://img.icons8.com/fluency/96/laundry.png";
}

// ----- Screen-name → expo-router route map -----
// Add new entries as Cloudspin introduces new screen names.
const SCREEN_ROUTES: Record<string, string> = {
  "OTP SCREEN": "/auth/otp",
  "HOME SCREEN": "/(tabs)/home",
  "NAME SCREEN": "/auth/name",
  "PROFILE SCREEN": "/auth/name",
};

export function routeForScreen(name?: string | null): string | null {
  if (!name) return null;
  return SCREEN_ROUTES[name.trim().toUpperCase()] || null;
}
