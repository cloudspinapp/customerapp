# FreshFold — Laundry Pickup App (PRD)

## Overview
A mobile laundry pickup & delivery app. Users sign up with mobile number + OTP, select services, schedule pickup with date/time/address, and track orders with notifications.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router (file-based), React Native, expo-notifications
- **Backend**: FastAPI + Motor (MongoDB)
- **Auth**: JWT (issued after mock-OTP verification)
- **Push**: Emergent-managed Push (SuprSend relay) + in-app notification list

## Features Implemented
1. **Auth** — Mobile number + Mock OTP (OTP returned in API response & shown in UI for demo)
2. **Home** — Greeting, banner carousel, services grid (5 preloaded), multi-select with qty, floating "Schedule Pickup" bar
3. **Schedule Pickup** — Next 7 dates, 6 time slots, address picker, order summary, confirm booking
4. **Orders** — Tabs (Active / Past), order cards, detail view with status timeline (Placed → Picked Up → Washing → Out for Delivery → Delivered)
5. **Profile** — Avatar, stats, saved addresses link, past orders, logout
6. **Addresses** — Add/Edit/Delete multiple addresses with label (Home/Work/Other), default flag
7. **Notifications** — In-app list with unread bell badge, mark-all-read; auto-notification on signup & on every booking
8. **Push Notifications** — Server-side `send_push()` triggered on signup & booking (works on standalone build with `google-services.json`)

## API
All routes prefixed `/api`:
- `POST /auth/send-otp`, `POST /auth/verify-otp`, `GET /auth/me`
- `GET /services`, `GET /banners`, `POST /banners`, `DELETE /banners/{id}`
- `GET/POST /addresses`, `PUT/DELETE /addresses/{id}`
- `POST/GET /orders`, `GET /orders/{id}`
- `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/mark-read`
- `POST /register-push` (relays to Emergent push service)

## Push Notification Setup (for production)
To enable push delivery on Android devices:
1. Click **Publish** → deploy
2. Provide `google-services.json` from Firebase Console (package: `com.freshfold.app`)
3. Generate Android/iOS builds via Emergent build flow
Push will **not** work in Expo Go.

## Next Action Items
- Provide `google-services.json` for production Android push
- Add admin screen to manage banners visually (currently API-only POST/DELETE)
