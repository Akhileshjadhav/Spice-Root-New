# Spice Root

Production-ready split project for the Spice Root storefront.

## Folders

```txt
client/   React + Vite app for users and admin
server/   Node backend for payments, inventory, and admin bootstrap
```

## Architecture

```txt
Browser (client)
  ├─ Firebase Auth          login, sessions, roles
  ├─ Firestore              products, cart, orders, admin data, reviews, settings
  └─ Node server (/api)     Razorpay, inventory adjustment, admin bootstrap

Node server (server)
  └─ Firebase Admin SDK     privileged writes that should not run in the browser
```

The client is Firestore-first. The server is not a duplicate REST catalog API; it only exposes routes the browser cannot safely or reliably perform alone.

## Local Run

```bash
npm --prefix server install
npm --prefix client install
npm run server:dev
npm run client:dev
```

Open:

```txt
http://localhost:5173
```

API health:

```bash
curl http://localhost:3001/health
```

## Build

```bash
npm run build
```

## Environment Files

Copy examples before running locally:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

- `client/.env` — public `VITE_*` values only (safe for Vercel).
- `server/.env` — Firebase Admin + Razorpay secrets (Render only; never on Vercel).

Validate local env files:

```bash
npm run check:deploy
```

Production builds fail fast if required variables are missing (`client` at startup, `server` on boot).

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full Vercel + Render + Firebase checklist.

Quick reference:

| Target | Command / setting |
|--------|-------------------|
| Firestore rules + indexes + storage | `npm run deploy:firebase` (requires `.firebaserc`) |
| Client (Vercel) | Root deploy; set all `VITE_*` vars; `VITE_API_URL` → Render `/api` |
| Server (Render) | Root dir `server`; `NODE_ENV=production`; `CLIENT_ORIGIN` → Vercel URL |
| Health check | `GET https://your-api.onrender.com/health` → `"ok": true` |

Direct routes such as `/admin/login` require the Vercel SPA rewrite in `vercel.json`.
