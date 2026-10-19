# JeevanDoot API (backend/)

Express + MongoDB REST API for the SwasthyaLink / JeevanDoot platform.

## Prerequisites

- Node.js `^18`
- MongoDB running locally (`mongod`) — defaults to `mongodb://127.0.0.1:27017/jeevandoot`

## Getting started

```bash
cd backend
npm install

# configure environment (optional)
cp .env.example .env

# seed demo data, then start the API
npm run seed
npm run dev        # nodemon, http://localhost:5000/api/v1
```

Or without nodemon: `npm start`.

## Demo accounts

All accounts use password `Password@123`:

| Role       | Email                    |
| ---------- | ------------------------ |
| Admin      | `admin@jeevandoot.org`   |
| Doctor     | `doctor@jeevandoot.org`  |
| Patient    | `patient@jeevandoot.org` |
| NGO        | `ngo@jeevandoot.org`     |
| Government | `govt@jeevandoot.org`    |

## Structure

```
backend/
├── config/          # env.js, db.js (Mongo connection)
├── middleware/      # auth (JWT + role), validate, errorHandler, upload
├── models/          # Mongoose schemas (User, Patient, Doctor, ...)
├── controllers/     # request handlers, one per domain
├── routes/          # Express routers mounted under /api/v1
├── services/        # business logic (auth, notifications, dashboards)
├── uploads/         # multer file storage
├── utils/           # ApiError, asyncHandler, response envelope, IDs
├── seed/            # seed.js (demo data)
└── server.js        # app entry point
```

## API conventions

- Base URL: `/api/v1`
- Responses use a `{ data }` envelope for success and
  `{ success: false, message, details? }` for errors.
- Auth: send `Authorization: Bearer <token>` on protected routes. Tokens come
  from `POST /auth/login` or `POST /auth/register`.
- Role-based access control is enforced per route via `authorize('role', ...)`.
- List endpoints paginate via `?page=1&limit=20` and return
  `meta: { page, limit, total, totalPages }`.
- Entity identifiers: MongoDB `_id` plus human-readable business IDs
  (`patientId` `JD-####`, `prescriptionId` `RX-####`, `reportId` `RPT-####`,
  `referralId` `REF-####`, `sessionId` `SESS-####`, `campId` `HC-####`).

## Endpoints

### Auth
| Method | Path                       | Access        |
| ------ | -------------------------- | ------------- |
| POST   | `/auth/login`              | public        |
| POST   | `/auth/register`           | public        |
| POST   | `/auth/logout`             | public        |
| GET    | `/auth/verify`             | public        |
| POST   | `/auth/request-access`     | public        |

### Admin
| Method | Path                | Access |
| ------ | ------------------- | ------ |
| GET    | `/admin/dashboard`  | admin  |
| GET    | `/admin/users`      | admin  |
| GET    | `/admin/users/:id`  | admin  |
| PUT    | `/admin/users/:id`  | admin  |
| DELETE | `/admin/users/:id`  | admin  |
| GET    | `/admin/audit`      | admin  |
| GET    | `/admin/surveillance` | admin |

### Doctor
| Method | Path                       | Access |
| ------ | -------------------------- | ------ |
| GET    | `/doctor/dashboard`        | doctor |
| GET    | `/doctors`                 | all    |
| GET    | `/doctors/me`              | doctor |
| POST   | `/doctors`                 | admin/doctor |
| GET    | `/doctors/:id`             | all    |
| PUT    | `/doctors/:id`             | admin/doctor |
| POST   | `/doctors/:id/toggle-status` | doctor/admin |
| DELETE | `/doctors/:id`             | admin  |

### Patient
| Method | Path                      | Access |
| ------ | ------------------------- | ------ |
| GET    | `/patients`               | doctor/admin/ngo/govt |
| GET    | `/patients/me`            | patient |
| PUT    | `/patients/me`            | patient |
| GET    | `/patients/me/appointments` | patient |
| GET    | `/patients/me/prescriptions` | patient |
| GET    | `/patients/me/consultations` | patient |
| GET    | `/patients/me/reports`    | patient |
| POST   | `/patients`               | admin/doctor/ngo |
| GET    | `/patients/:id`           | all    |
| PUT    | `/patients/:id`           | admin/doctor/ngo |
| DELETE | `/patients/:id`           | admin  |

### NGO
| Method | Path              | Access |
| ------ | ----------------- | ------ |
| GET    | `/ngo/dashboard`  | ngo    |
| GET    | `/ngo/impact`     | ngo    |
| GET    | `/ngo/camps`      | ngo/admin |
| POST   | `/ngo/camps`      | ngo    |
| PUT    | `/ngo/camps/:id`  | ngo    |
| DELETE | `/ngo/camps/:id`  | ngo/admin |

### Government
| Method | Path                    | Access |
| ------ | ----------------------- | ------ |
| GET    | `/government/dashboard` | govt/admin |
| GET    | `/government/schemes`   | govt/admin |
| GET    | `/government/queries`   | govt/admin |

### Appointments
| Method | Path                    | Access |
| ------ | ----------------------- | ------ |
| GET    | `/appointments`         | doctor/patient/admin/govt |
| GET    | `/appointments/:id`     | doctor/patient/admin |
| POST   | `/appointments`         | patient/doctor/admin |
| PUT    | `/appointments/:id`     | patient/doctor/admin |
| POST   | `/appointments/:id/cancel` | patient/doctor/admin |
| DELETE | `/appointments/:id`     | admin  |

### Prescriptions
| Method | Path                         | Access |
| ------ | ---------------------------- | ------ |
| GET    | `/prescriptions`             | doctor/patient/admin |
| GET    | `/prescriptions/:id`         | doctor/patient/admin |
| POST   | `/prescriptions`             | doctor/admin |
| PUT    | `/prescriptions/:id`         | doctor/admin |
| POST   | `/prescriptions/:id/dispense` | doctor/admin |
| DELETE | `/prescriptions/:id`         | admin  |

### Consultations
| Method | Path                          | Access |
| ------ | ----------------------------- | ------ |
| GET    | `/consultations`              | doctor/patient/admin |
| POST   | `/consultations`              | doctor/admin |
| GET    | `/consultations/:sessionId/transcript` | doctor/patient/admin |
| PUT    | `/consultations/:sessionId`   | doctor/admin |
| POST   | `/consultations/:sessionId/end` | doctor/admin |
| GET    | `/consultations/:id`          | doctor/patient/admin |
| DELETE | `/consultations/:id`          | admin  |

### Reports
| Method | Path                     | Access |
| ------ | ------------------------ | ------ |
| GET    | `/reports`               | doctor/patient/admin |
| POST   | `/reports/generate`      | doctor/admin |
| GET    | `/reports/export`        | doctor/admin |
| GET    | `/reports/audit`         | doctor/admin |
| POST   | `/reports/:id/file`      | doctor/admin (multipart, field `file`) |
| GET    | `/reports/:id`           | doctor/patient/admin |
| PUT    | `/reports/:id`           | doctor/admin |
| DELETE | `/reports/:id`           | admin  |

### Referrals
| Method | Path                            | Access |
| ------ | ------------------------------- | ------ |
| GET    | `/referrals/destinations`       | doctor/patient/admin |
| GET    | `/referrals`                    | doctor/patient/admin/govt |
| POST   | `/referrals`                    | doctor/admin |
| GET    | `/referrals/:referralId/status` | doctor/patient/admin |

### Notifications
| Method | Path                      | Access |
| ------ | ------------------------- | ------ |
| GET    | `/notifications`          | any authenticated user |
| POST   | `/notifications/read-all` | any authenticated user |
| POST   | `/notifications`          | any authenticated user |
| POST   | `/notifications/:id/read` | any authenticated user |
| DELETE | `/notifications/:id`      | any authenticated user |

## Example

```bash
# 1. Log in
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"doctor","email":"doctor@jeevandoot.org","password":"Password@123"}'

# 2. Use the returned token
curl http://localhost:5000/api/v1/doctor/dashboard \
  -H "Authorization: Bearer <token>"
```

## Environment

| Variable                | Default                                   |
| ----------------------- | ----------------------------------------- |
| `PORT`                  | `5000`                                    |
| `MONGODB_URI`           | `mongodb://127.0.0.1:27017/jeevandoot`    |
| `JWT_SECRET`            | `dev-secret-change-me`                    |
| `JWT_EXPIRES_IN`        | `7d`                                      |
| `CORS_ORIGIN`           | `http://localhost:5173`                   |
| `MAX_UPLOAD_SIZE_MB`    | `5`                                       |

## AI Task Agent

The AI Task Agent provides a conversational interface for appointment booking, referrals, follow-ups, and clinic information. It uses a provider abstraction that supports multiple LLM backends.

### Provider Modes

| Mode (`AI_PROVIDER`) | Description |
|-----------------------|-------------|
| `local`               | Deterministic local provider (default, no external API calls, zero cost). |
| `openai`              | OpenAI API (requires `AI_PROVIDER_URL` and `AI_PROVIDER_API_KEY`). |
| `anthropic`           | Anthropic API (requires `AI_PROVIDER_URL` and `AI_PROVIDER_API_KEY`). |
| `openai-compatible`   | Generic OpenAI-compatible endpoint (e.g., local vLLM, Ollama, Azure OpenAI). |
| `http`                | Legacy alias for `openai-compatible`. |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_PROVIDER` | No | Provider mode (`local`, `openai`, `anthropic`, `openai-compatible`, `http`). Default: `local`. |
| `AI_PROVIDER_URL` | For remote modes | Base URL of the LLM API endpoint. |
| `AI_PROVIDER_API_KEY` | For remote modes | API key for authentication. |
| `AI_PROVIDER_MODEL` | No | Model name (e.g., `gpt-4o-mini`, `claude-3-haiku-20240307`). |
| `AI_PROVIDER_TIMEOUT_MS` | No | Request timeout in milliseconds. Default: `8000`. |
| `AI_PROVIDER_TYPE` | For `http` mode | Provider type: `openai`, `anthropic`, or `openai-compatible`. Default: `openai-compatible`. |

### Evaluation

Run the offline evaluation suite (deterministic provider, no API keys needed):

```bash
npm run eval:local
```

This runs 134 test cases and reports intent accuracy, entity accuracy, clarification accuracy, and latency. Target: intent >= 0.90, entity >= 0.80, clarification >= 0.80.

Run against a configured remote provider (requires valid API keys):

```bash
AI_PROVIDER=http npm run eval:remote
```

Note: Remote evaluation is skipped automatically if no provider is configured.

### Isolated Database for Tests

Tests that create or mutate appointments use a throwaway database:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/jeevandoot_ai_test npm test
```

The test database is cleaned up after each run. The main database is never touched.

### Known Limitations

- **Rate Limiting**: Process-local (not distributed). Multiple instances require external rate limiter (e.g., Redis).
- **Standalone MongoDB**: Single-node replica set only. Transactions require a replica set; the unique index on `doctor, date, startTime, status` provides the double-booking guard instead.
- **Remote LLM Validation**: Not tested in CI (requires paid API keys). Manual verification required for production remote provider use.
