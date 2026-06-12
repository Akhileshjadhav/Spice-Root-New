# Spice Root deployment guide

Use this checklist when deploying the split stack: **Vercel (client)**, **Render (server)**, and **Firebase (Auth, Firestore, Storage, rules)**.

## 1. Firebase project

1. Create or select a Firebase project.
2. Enable **Authentication** (Email/Password and Google if used).
3. Enable **Firestore** and **Storage**.
4. Copy `.firebaserc.example` to `.firebaserc` and set your project id:

```bash
cp .firebaserc.example .firebaserc
```

5. Deploy security rules and indexes from the repo root:

```bash
firebase deploy --only firestore,storage
```

After changing `firestore.indexes.json`, deploy again and wait for indexes to finish building in the Firebase console.

## 2. Service account (server only)

1. Firebase console → Project settings → Service accounts → Generate new private key.
2. Map values into Render env vars (never commit the JSON file):
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY` (paste with `\n` line breaks, or wrap in quotes as in `.env.example`)
   - `FIREBASE_STORAGE_BUCKET`

## 3. Render (Node server)

Root directory: `server`

| Setting | Value |
|---------|--------|
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/health` |

Required environment variables (see `server/.env.example`):

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` (or Render default) |
| `CLIENT_ORIGIN` | Your Vercel URL, e.g. `https://your-app.vercel.app` (comma-separated for previews) |
| `ADMIN_EMAILS` | Comma-separated admin login allowlist |
| `FIREBASE_ADMIN_*` | Service account fields |
| `RAZORPAY_KEY_ID` | Test key `rzp_test_...` for demo |
| `RAZORPAY_KEY_SECRET` | Required when `RAZORPAY_MOCK_MODE=false` |
| `RAZORPAY_MOCK_MODE` | `true` for visible test checkout with current keys |
| `ALLOW_LIVE_RAZORPAY` | Keep `false` unless you intentionally use live keys |

Verify after deploy:

```bash
curl https://your-render-service.onrender.com/health
```

`ok: true` means Firebase Admin, Razorpay key, admin allowlist, and a non-localhost `CLIENT_ORIGIN` are configured.

## 4. Vercel (React client)

Deploy from the repository root. `vercel.json` builds `client/` with Vite.

Required **Environment Variables** (Production + Preview):

| Variable | Notes |
|----------|--------|
| `VITE_FIREBASE_API_KEY` | From Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_API_URL` | `https://your-render-service.onrender.com/api` |
| `VITE_ADMIN_EMAILS` | Same allowlist as server `ADMIN_EMAILS` |

`VITE_RAZORPAY_KEY_ID` is optional; checkout receives `keyId` from the server.

Redeploy after changing env vars so the build picks them up.

## 5. Local preflight

```bash
npm run check:deploy
```

Checks `client/.env` / `client/.env.local` and `server/.env` against required keys.

## 6. Post-deploy smoke test

1. Open the Vercel site — catalog and banners load from Firestore.
2. Register / log in as a customer — cart sync works.
3. Complete checkout — Razorpay test flow and order appear in admin.
4. Log in at `/admin/login` with an allowlisted email — dashboard loads.
5. Call `POST /api/auth/ensure-admin` implicitly via admin login — `admins/{uid}` exists in Firestore.

## 7. Hosting options

- **Vercel** (recommended for the SPA): uses `vercel.json` rewrites for `/admin/*` routes.
- **Firebase Hosting** (optional): `firebase.json` serves `client/dist` after `npm run build`. Do not deploy both to different URLs without updating `CLIENT_ORIGIN` and Firebase authorized domains.

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| White screen in production | Set all `VITE_*` vars in Vercel; check browser console |
| API calls fail / CORS | `CLIENT_ORIGIN` on Render must match the exact browser origin |
| Checkout cannot reach API | `VITE_API_URL` must include `/api` suffix |
| Firestore permission denied | Run `firebase deploy --only firestore` |
| Review queries fail | Deploy indexes: `firebase deploy --only firestore:indexes` |
| `/health` returns `ok: false` | Open JSON `checks` object and fill missing server env vars |
