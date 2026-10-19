# JeevanDoot — Rural Community Care Platform

A web application that digitises primary healthcare delivery in rural India. It provides role-based portals built as a single-page React app with an Express + MongoDB REST API:

- **Doctor portal** — patient queue, case summaries, e-prescriptions, specialist referrals, follow-up scheduling, live teleconsultation, performance analytics.
- **Admin / Government portal** — district dashboard, disease cluster surveillance, case-level analytics, high-risk audit log, report generation & export, doctor management, platform configuration.
- **NGO portal** — health camp planning, donation tracking, community outreach and impact reporting.
- **Patient portal** — appointments, prescriptions, consultations, reports, health monitoring and notifications.

The frontend is **connected to the backend by default** (`VITE_ENABLE_MOCK_API=false`, `VITE_API_BASE_URL=http://localhost:5000/api/v1`). A full backend lives in `backend/` with JWT authentication, role-based access control and seeded demo data. Mock mode is still available as an opt-in fallback for UI-only exploration. The design follows the Material 3 "SwasthyaLink / JeevanDoot" palette.

---

## How to Run

### Option A — Frontend only (mock data, no backend required)

Set `VITE_ENABLE_MOCK_API=true` in the project-root `.env` first, then:

```bash
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with any demo account (e.g. `admin@jeevandoot.org` — any password works in mock mode).

### Option B — Full stack (frontend + API + MongoDB)

**1. Start MongoDB** (Windows service):

```powershell
net start MongoDB
```

**2. Start the backend** (in a terminal from the `backend/` folder):

```bash
cd backend
npm install
npm run seed      # seed demo data into MongoDB
npm run dev       # API on http://localhost:5000/api/v1
```

**3. Start the frontend** (in a second terminal from the project root):

```bash
npm run dev
```

**4. Log in** at http://localhost:5173 with a seeded account — all passwords are `Password@123`:

| Role       | Email                    |
| ---------- | ------------------------ |
| Admin      | `admin@jeevandoot.org`   |
| Doctor     | `doctor@jeevandoot.org`  |
| Patient    | `patient@jeevandoot.org` |
| NGO        | `ngo@jeevandoot.org`     |
| Government | `govt@jeevandoot.org`    |

> **Note:** the frontend is wired to the API (`VITE_ENABLE_MOCK_API=false`). It talks to the backend whenever the API is running.

Detailed instructions for each part are below.

---

## Prerequisites

- **Node.js** `^18 || ^20 || ^22` (developed with v26)
- **npm** `^10`
- **MongoDB** (only needed to run the backend) — local install, e.g. `mongod`

Check your versions:

```bash
node -v
npm -v
```

---

## Quick Start (full stack — connected mode)

### 1. Install dependencies

```bash
npm install
```

### 2. Run the development server

```bash
npm run dev
```

The app opens automatically at **http://localhost:5173** (if it doesn't, visit the URL Vite prints in the terminal). Since the frontend is connected to the API by default, make sure MongoDB + the backend (`backend/`, port 5000) are running first — see [Option B](#how-to-run).

### 3. Explore & log in

The root URL (`/`) shows a public **Home page** with a **Register** page (choose a role: Doctor, Patient, NGO or Government) and a **Sign In** flow. Clicking **Sign In** opens a role picker (`/login`) for Patient, Doctor, NGO and Government. Use one of the seeded accounts below (password `Password@123` — login is verified against the real API):

| Role               | Email                     |
| ------------------ | ------------------------- |
| Admin              | `admin@jeevandoot.org`    |
| Doctor             | `doctor@jeevandoot.org`   |
| Patient            | `patient@jeevandoot.org`  |
| NGO                | `ngo@jeevandoot.org`      |
| Government         | `govt@jeevandoot.org`     |

Example paths once logged in:

- Admin: `http://localhost:5173/admin/dashboard`
- Doctor: `http://localhost:5173/doctor/dashboard`
- NGO: `http://localhost:5173/ngo/dashboard`
- Patient: `http://localhost:5173/patient/dashboard`

---

## Running the Backend (API)

The REST API requires MongoDB. If you're on Windows, start the MongoDB service:

```powershell
net start MongoDB
```

Then:

```bash
cd backend
npm install

# create your environment file (optional, defaults work out of the box)
cp .env.example .env

# seed demo data into MongoDB (use `npm run seed:reset` to wipe & reseed)
npm run seed

# start the API (use `npm start` for a plain server)
npm run dev
```

The API listens at **http://localhost:5000/api/v1** (health check: `/api/v1/health`).

Backend demo accounts all use password **`Password@123`**:

| Role       | Email                    |
| ---------- | ------------------------ |
| Admin      | `admin@jeevandoot.org`   |
| Doctor     | `doctor@jeevandoot.org`  |
| Patient    | `patient@jeevandoot.org` |
| NGO        | `ngo@jeevandoot.org`     |
| Government | `govt@jeevandoot.org`    |

See [`backend/README.md`](backend/README.md) for the full API endpoint reference.

> **Note:** the frontend talks to the real API. To run UI-only with mock data instead, set `VITE_ENABLE_MOCK_API=true` (see below).

---

## Available Scripts

### Frontend (`/`)

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Starts the Vite dev server with hot reload    |
| `npm run build`    | Creates an optimised production build in `dist/` |
| `npm run preview`  | Serves the production build locally           |
| `npm run lint`     | Runs ESLint on `src` (0 warnings required)    |

### Backend (`backend/`)

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `npm run dev`      | Starts the API with nodemon (port 5000) |
| `npm start`        | Starts the API without nodemon          |
| `npm run seed`     | Seeds demo data into MongoDB            |
| `npm run seed:reset` | Wipes and reseeds demo data           |

---

## Production Build

```bash
npm run build
npm run preview
```

`vite preview` serves the build at **http://localhost:4173**.

---

## Environment Configuration

The project talks to the real backend out of the box. The project-root `.env` is:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_ENABLE_MOCK_API=false
```

To run UI-only with in-memory mock data instead (no backend needed), set:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_ENABLE_MOCK_API=true
```

Services in `src/services/` use the real API when `VITE_ENABLE_MOCK_API` is `false` and `VITE_API_BASE_URL` points at the backend.

Backend configuration lives in `backend/.env` — see `backend/.env.example` for the available variables (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, etc.).

---

## Project Structure

```
jeevandoot-web/
├── public/                 # Static assets (logo, favicon, manifest)
├── src/
│   ├── components/
│   │   ├── common/         # Button, Card, Modal, Input, Table, Badge, etc.
│   │   ├── layout/         # Sidebar, Header, DashboardLayout, AuthLayout
│   │   ├── charts/         # Chart.js wrappers & KPI widgets
│   │   ├── map/            # Surveillance map & village clusters
│   │   └── consultation/   # Video call + chat panel
│   ├── pages/
│   │   ├── auth/           # Login & registration flows
│   │   ├── admin/          # Admin pages
│   │   ├── doctor/         # Doctor pages
│   │   ├── patient/        # Patient pages
│   │   ├── ngo/            # NGO pages (dashboard, camps, donations, impact)
│   │   ├── government/     # Government pages (dashboard, schemes, queries)
│   │   └── errors/         # 404 & Unauthorized
│   ├── routes/             # Role-based route collections + ProtectedRoute
│   ├── context/            # Auth, Theme, Notification, User providers
│   ├── hooks/              # useAuth, useFetch, useDebounce, usePagination, etc.
│   ├── services/           # API clients with mock fallbacks
│   ├── utils/              # Constants, validators, formatters, helpers
│   └── styles/             # Design tokens & global styles
├── backend/                # Express + MongoDB REST API
│   ├── config/             # env.js, db.js (Mongo connection)
│   ├── middleware/         # auth (JWT + role), validate, errorHandler, upload
│   ├── models/             # Mongoose schemas (User, Patient, Doctor, ...)
│   ├── controllers/        # request handlers, one per domain
│   ├── routes/             # Express routers mounted under /api/v1
│   ├── services/           # business logic (auth, notifications, dashboards)
│   ├── uploads/            # multer file storage
│   ├── utils/              # ApiError, asyncHandler, response envelope, IDs
│   ├── seed/               # seed.js (demo data)
│   └── server.js           # app entry point
├── .env                    # API config (connected to backend by default)
├── index.html
├── package.json
└── vite.config.js
```

---

## Tech Stack

**Frontend**
- **React 18** + **Vite 5**
- **React Router v6** (role-based routing)
- **Tailwind CSS 3** with a custom Material 3 palette
- **Chart.js 4** (line, bar, doughnut, heat map)
- **i18next** (English, Hindi, Gujarati, Marathi)
- **ESLint 9** (flat config)

**Backend**
- **Express 4** + **MongoDB** (Mongoose 8)
- **JWT** authentication with role-based access control
- **express-validator**, **multer** (uploads), **bcryptjs**

---

## Deployment

### Production Build

```bash
# Frontend
npm run build
# Output: dist/ (serve with nginx, Apache, or any static file server)

# Backend
cd backend
npm run build  # if applicable, otherwise npm start
```

### Docker (example)

```dockerfile
# Backend
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./
EXPOSE 5000
CMD ["npm", "start"]
```

```dockerfile
# Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables (Production)

**Frontend** (set at build time):
```env
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
VITE_ENABLE_MOCK_API=false
```

**Backend** (`.env`):
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://mongo:27017/jeevandoot
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://yourdomain.com
AI_PROVIDER=local
# For remote AI: AI_PROVIDER=openai AI_PROVIDER_URL=... AI_PROVIDER_API_KEY=...
```

### MongoDB Setup

For production, deploy MongoDB as a replica set (required for transactions):

```bash
mongod --replSet rs0 --dbpath /data/db --bind_ip_all
# Then: mongosh --eval "rs.initiate()"
```

The unique index on `doctor, date, startTime, status` provides double-booking protection without transactions.

### Reverse Proxy (nginx example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Health Checks

- Frontend: `GET /` (served by nginx)
- Backend: `GET /api/v1/health` (basic), `GET /api/v1/ai/status` (detailed, requires auth)

### Backup & Restore (MongoDB)

```bash
# Backup
mongodump --uri=mongodb://localhost:27017/jeevandoot --out=/backups/$(date +%F)

# Restore
mongorestore --uri=mongodb://localhost:27017/jeevandoot /backups/2026-01-15/jeevandoot
```

---

## Tech Stack

**Frontend**
- **React 18** + **Vite 5**
- **React Router v6** (role-based routing)
- **Tailwind CSS 3** with a custom Material 3 palette
- **Chart.js 4** (line, bar, doughnut, heat map)
- **i18next** (English, Hindi, Gujarati, Marathi)
- **ESLint 9** (flat config)

**Backend**
- **Express 4** + **MongoDB** (Mongoose 8)
- **JWT** authentication with role-based access control
- **express-validator**, **multer** (uploads), **bcryptjs**
