from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import uuid
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get("JWT_SECRET", "secret")
JWT_ALG = "HS256"
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")

push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(401, "Missing token")
    try:
        decoded = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": decoded["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def add_notification(user_id: str, title: str, body: str, ntype: str = "general"):
    notif = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": ntype,
        "read": False,
        "created_at": now_iso(),
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)
    return notif

async def send_push(recipients: List[str], data: dict):
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        return
    payload = {"recipients": recipients, "data": data}
    try:
        await push_client.post("/api/v1/push/trigger", json=payload)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Push notification failed (non-blocking): {e}")

# ---------- Models ----------
class SendOtpBody(BaseModel):
    phone: str

class VerifyOtpBody(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None

class AddressIn(BaseModel):
    label: str  # Home / Work / Other
    full_name: str
    phone: str
    line1: str
    line2: Optional[str] = ""
    city: str
    pincode: str
    landmark: Optional[str] = ""
    is_default: bool = False

class BannerIn(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    image_url: str
    cta_text: Optional[str] = ""

class OrderItem(BaseModel):
    service_id: str
    service_name: str
    price: float
    quantity: int

class OrderIn(BaseModel):
    items: List[OrderItem]
    pickup_date: str  # ISO date string
    pickup_slot: str  # e.g. "10:00 AM - 12:00 PM"
    address_id: str
    notes: Optional[str] = ""

class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str

# ---------- Auth ----------
@api_router.post("/auth/send-otp")
async def send_otp(body: SendOtpBody):
    if not body.phone or len(body.phone) < 7:
        raise HTTPException(400, "Invalid phone")
    otp = f"{random.randint(1000, 9999)}"
    # For demo, use a fixed OTP if needed; here we use random and return it
    record = {
        "phone": body.phone,
        "otp": otp,
        "created_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    await db.otps.update_one({"phone": body.phone}, {"$set": record}, upsert=True)
    # Mock: return OTP in response so user can see it
    return {"success": True, "phone": body.phone, "otp": otp, "message": "Mock OTP generated. Use this OTP to verify."}

@api_router.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtpBody):
    rec = await db.otps.find_one({"phone": body.phone}, {"_id": 0})
    if not rec:
        raise HTTPException(400, "Please request OTP first")
    if rec["otp"] != body.otp:
        raise HTTPException(400, "Invalid OTP")

    # Upsert user
    existing = await db.users.find_one({"phone": body.phone}, {"_id": 0})
    if existing:
        user = existing
        if body.name and not existing.get("name"):
            await db.users.update_one({"id": user["id"]}, {"$set": {"name": body.name}})
            user["name"] = body.name
    else:
        user = {
            "id": str(uuid.uuid4()),
            "phone": body.phone,
            "name": body.name or "",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user.copy())
        # Welcome notification
        await add_notification(user["id"], "Welcome to FreshFold 🧺",
                               "Thanks for joining! Browse services & schedule your first pickup.",
                               "welcome")
        try:
            await send_push([user["id"]], {
                "title": "Welcome to FreshFold",
                "message": "Schedule your first pickup and enjoy clean laundry."
            })
        except Exception:
            pass

    await db.otps.delete_one({"phone": body.phone})
    token = make_token(user["id"])
    user.pop("_id", None)
    return {"token": token, "user": user}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ---------- Services ----------
DEFAULT_SERVICES = [
    {"name": "Wash & Fold", "description": "Everyday clothes washed and neatly folded.", "price": 49, "icon": "shirt-outline", "color": "#3B82F6", "image_url": "https://img.icons8.com/fluency/96/laundry.png"},
    {"name": "Dry Clean", "description": "Professional dry cleaning for delicates & formals.", "price": 149, "icon": "sparkles-outline", "color": "#8B5CF6", "image_url": "https://img.icons8.com/fluency/96/dry-clean.png"},
    {"name": "Ironing", "description": "Crisp ironing for any garment.", "price": 19, "icon": "flame-outline", "color": "#F59E0B", "image_url": "https://img.icons8.com/fluency/96/iron.png"},
    {"name": "Steam Press", "description": "Wrinkle-free steam pressing.", "price": 29, "icon": "cloud-outline", "color": "#10B981", "image_url": "https://img.icons8.com/fluency/96/steam.png"},
    {"name": "Premium Wash", "description": "Premium detergent & softener for delicate care.", "price": 99, "icon": "star-outline", "color": "#EC4899", "image_url": "https://img.icons8.com/fluency/96/washing-machine.png"},
]

async def seed_data():
    count = await db.services.count_documents({})
    if count == 0:
        for s in DEFAULT_SERVICES:
            await db.services.insert_one({"id": str(uuid.uuid4()), **s})
    else:
        # Migration: ensure all existing services have image_url
        for s in DEFAULT_SERVICES:
            await db.services.update_one(
                {"name": s["name"]},
                {"$set": {"image_url": s["image_url"], "color": s["color"], "icon": s["icon"]}}
            )
    bcount = await db.banners.count_documents({})
    if bcount == 0:
        banners = [
            {"id": str(uuid.uuid4()), "title": "30% OFF First Pickup", "subtitle": "Use code FRESH30 at checkout", "image_url": "https://static.prod-images.emergentagent.com/jobs/1644b8bc-ad0f-4fa8-890a-bd74752287e5/images/bf0992d02ce8e2690561a657acd5619dcd5fa49cbbf1b6e276688635f59175ee.png", "cta_text": "Book Now", "created_at": now_iso()},
            {"id": str(uuid.uuid4()), "title": "Free Pickup & Delivery", "subtitle": "On orders above ₹299", "image_url": "https://static.prod-images.emergentagent.com/jobs/1644b8bc-ad0f-4fa8-890a-bd74752287e5/images/3318cd611bf95c580bb9291ab53e68d57f1939243e93af16f82425d37b242e43.png", "cta_text": "Explore", "created_at": now_iso()},
        ]
        for b in banners:
            await db.banners.insert_one(b.copy())

@api_router.get("/services")
async def list_services():
    items = await db.services.find({}, {"_id": 0}).to_list(100)
    return items

# ---------- Banners ----------
@api_router.get("/banners")
async def list_banners():
    items = await db.banners.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items

@api_router.post("/banners")
async def create_banner(body: BannerIn, user=Depends(get_current_user)):
    banner = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": now_iso()}
    await db.banners.insert_one(banner.copy())
    banner.pop("_id", None)
    return banner

@api_router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, user=Depends(get_current_user)):
    await db.banners.delete_one({"id": banner_id})
    return {"success": True}

# ---------- Addresses ----------
@api_router.get("/addresses")
async def list_addresses(user=Depends(get_current_user)):
    items = await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    return items

@api_router.post("/addresses")
async def create_address(body: AddressIn, user=Depends(get_current_user)):
    addr = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(), "created_at": now_iso()}
    if body.is_default:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.insert_one(addr.copy())
    addr.pop("_id", None)
    return addr

@api_router.put("/addresses/{address_id}")
async def update_address(address_id: str, body: AddressIn, user=Depends(get_current_user)):
    if body.is_default:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.update_one(
        {"id": address_id, "user_id": user["id"]},
        {"$set": body.model_dump()},
    )
    addr = await db.addresses.find_one({"id": address_id}, {"_id": 0})
    return addr

@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, user=Depends(get_current_user)):
    await db.addresses.delete_one({"id": address_id, "user_id": user["id"]})
    return {"success": True}

# ---------- Orders ----------
ORDER_STATUSES = ["Placed", "Picked Up", "Washing", "Out for Delivery", "Delivered"]

@api_router.post("/orders")
async def create_order(body: OrderIn, user=Depends(get_current_user)):
    address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    if not address:
        raise HTTPException(400, "Address not found")
    total = sum(i.price * i.quantity for i in body.items)
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "order_no": f"FF{random.randint(10000, 99999)}",
        "items": [i.model_dump() for i in body.items],
        "pickup_date": body.pickup_date,
        "pickup_slot": body.pickup_slot,
        "address": address,
        "notes": body.notes or "",
        "total": total,
        "status": "Placed",
        "timeline": [{"status": "Placed", "at": now_iso()}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    order.pop("_id", None)

    await add_notification(
        user["id"],
        f"Booking Confirmed • {order['order_no']}",
        f"Pickup scheduled on {body.pickup_date} • {body.pickup_slot}. Total ₹{total:.0f}.",
        "order",
    )
    try:
        await send_push([user["id"]], {
            "title": "Pickup Scheduled",
            "message": f"Order {order['order_no']} • {body.pickup_slot}",
        })
    except Exception:
        pass
    return order

@api_router.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order

# ---------- Notifications ----------
@api_router.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api_router.get("/notifications/unread-count")
async def unread_count(user=Depends(get_current_user)):
    c = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"count": c}

@api_router.post("/notifications/mark-read")
async def mark_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"success": True}

# ---------- Push registration ----------
@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"register-push failed: {e}")
        return {"status": "skipped"}
    return {"status": "registered"}

# ---------- Cloudspin proxy (so web preview can call cloudspin.in without CORS) ----------
CLOUDSPIN_BASE = "https://cloudspin.in/api"
_otp_sessions: dict[str, str] = {}  # phone -> ci_session cookie value

@api_router.post("/cloudspin/login/authenticate")
async def cloudspin_send_otp(payload: dict):
    phone = str(payload.get("txtcontact", "")).strip()
    if not phone:
        raise HTTPException(400, "txtcontact is required")
    async with httpx.AsyncClient(timeout=15.0) as cs:
        files = {"txtcontact": (None, phone)}
        resp = await cs.post(f"{CLOUDSPIN_BASE}/login/authenticate", files=files)
        cookie = resp.cookies.get("ci_session")
        if cookie:
            _otp_sessions[phone] = cookie
        try:
            return resp.json()
        except Exception:
            return {"status": False, "message": f"Upstream returned non-JSON (HTTP {resp.status_code})"}

@api_router.post("/cloudspin/login/otp")
async def cloudspin_verify_otp(payload: dict):
    phone = str(payload.get("txtcontact", "")).strip()
    otp_val = str(payload.get("otp", "")).strip()
    if not phone or not otp_val:
        raise HTTPException(400, "txtcontact and otp are required")
    cookie = _otp_sessions.get(phone)
    cookies = {"ci_session": cookie} if cookie else None
    async with httpx.AsyncClient(timeout=15.0, cookies=cookies) as cs:
        files = {"txtcontact": (None, phone), "otp": (None, otp_val)}
        resp = await cs.post(f"{CLOUDSPIN_BASE}/login/otp", files=files)
        try:
            return resp.json()
        except Exception:
            return {"status": False, "message": f"Upstream returned non-JSON (HTTP {resp.status_code})"}

@api_router.post("/cloudspin/customers/update")
async def cloudspin_customers_update(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    txtname = str(payload.get("txtname", "")).strip()
    map_location = str(payload.get("map_location", "")).strip()
    if not customer_id:
        raise HTTPException(400, "customer_id is required")
    async with httpx.AsyncClient(timeout=15.0) as cs:
        files = {
            "customer_id": (None, customer_id),
            "txtname": (None, txtname),
            "map_location": (None, map_location),
        }
        resp = await cs.post(f"{CLOUDSPIN_BASE}/customers/update", files=files)
        try:
            return resp.json()
        except Exception:
            return {"status": False, "message": f"Upstream returned non-JSON (HTTP {resp.status_code})"}

@api_router.get("/cloudspin/services")
async def cloudspin_services():
    async with httpx.AsyncClient(timeout=15.0) as cs:
        resp = await cs.get(f"{CLOUDSPIN_BASE}/services")
        try:
            return resp.json()
        except Exception:
            return {"status": False, "message": f"Upstream returned non-JSON (HTTP {resp.status_code})", "data": []}

# ---------- Cloudspin Address proxy ----------
async def _cs_post(path: str, payload: dict):
    """Generic POST helper for Cloudspin endpoints that accept multipart/form-data."""
    files = {k: (None, str(v)) for k, v in payload.items() if v is not None}
    async with httpx.AsyncClient(timeout=15.0) as cs:
        resp = await cs.post(f"{CLOUDSPIN_BASE}/{path}", files=files)
        try:
            return resp.json()
        except Exception:
            return {"status": False, "message": f"Upstream returned non-JSON (HTTP {resp.status_code})"}

@api_router.post("/cloudspin/customers/addresses")
async def cloudspin_addresses_list(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    if not customer_id:
        raise HTTPException(400, "customer_id is required")
    return await _cs_post("customers/addresses", {"customer_id": customer_id})

@api_router.post("/cloudspin/customers/get_address_detail")
async def cloudspin_address_detail(payload: dict):
    address_id = str(payload.get("address_id", "")).strip()
    if not address_id:
        raise HTTPException(400, "address_id is required")
    return await _cs_post("customers/get_address_detail", {"address_id": address_id})

@api_router.post("/cloudspin/customers/set_default_address")
async def cloudspin_address_default(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    address_id = str(payload.get("address_id", "")).strip()
    if not customer_id or not address_id:
        raise HTTPException(400, "customer_id and address_id are required")
    return await _cs_post("customers/set_default_address", {
        "customer_id": customer_id, "address_id": address_id,
    })

ADDRESS_FIELDS = ["label", "address_line", "landmark", "city", "state",
                  "pincode", "latitude", "longitude", "is_default"]

@api_router.post("/cloudspin/customers/add_address")
async def cloudspin_address_add(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    if not customer_id:
        raise HTTPException(400, "customer_id is required")
    body = {"customer_id": customer_id}
    for f in ADDRESS_FIELDS:
        body[f] = str(payload.get(f, "")).strip()
    return await _cs_post("customers/add_address", body)

@api_router.post("/cloudspin/customers/update_address")
async def cloudspin_address_update(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    address_id = str(payload.get("address_id", "")).strip()
    if not customer_id or not address_id:
        raise HTTPException(400, "customer_id and address_id are required")
    body = {"customer_id": customer_id, "address_id": address_id}
    for f in ADDRESS_FIELDS:
        body[f] = str(payload.get(f, "")).strip()
    return await _cs_post("customers/update_address", body)

@api_router.post("/cloudspin/customers/delete_address")
async def cloudspin_address_delete(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    address_id = str(payload.get("address_id", "")).strip()
    if not customer_id or not address_id:
        raise HTTPException(400, "customer_id and address_id are required")
    return await _cs_post("customers/delete_address", {
        "customer_id": customer_id, "address_id": address_id,
    })

@api_router.post("/cloudspin/services/schedule")
async def cloudspin_schedule_pickup(payload: dict):
    customer_id = str(payload.get("customer_id", "")).strip()
    address_id = str(payload.get("address_id", "")).strip()
    pickup_date = str(payload.get("pickup_date", "")).strip()  # DD-MM-YYYY
    pickup_slot = str(payload.get("pickup_slot", "")).strip()
    services = str(payload.get("services", "")).strip()
    missing = [k for k, v in {
        "customer_id": customer_id, "address_id": address_id,
        "pickup_date": pickup_date, "pickup_slot": pickup_slot, "services": services,
    }.items() if not v]
    if missing:
        raise HTTPException(400, f"Missing required fields: {', '.join(missing)}")
    return await _cs_post("services/schedule", {
        "customer_id": customer_id, "address_id": address_id,
        "pickup_date": pickup_date, "pickup_slot": pickup_slot, "services": services,
    })

# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"message": "FreshFold Laundry API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await seed_data()
    logger.info("FreshFold API started — seed complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await push_client.aclose()
