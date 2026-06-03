# Moolah Minds — Backend

Financial Literacy Simulator | Backend API | Milestones 0–3

---

## Quick Start

### Prerequisites
- Node.js LTS (v20+)
- npm
- PostgreSQL (local or Docker)

### 1. Clone and install
```bash
git clone <repo-url>
cd moolah-minds-backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET
```

### 3. Set up the database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Start the dev server
```bash
npm run dev
# Server starts at http://localhost:3000
```

### 5. Verify it's working
```bash
curl http://localhost:3000/health
# → { "status": "ok", "database": "connected", ... }
```

### 6. Run tests
```bash
npm test
npm run test:coverage
```

---

## Project Structure

```
src/
├── api/              # Controllers — route definitions only, no logic
│   ├── authController.ts
│   ├── profileController.ts
│   └── healthController.ts
│
├── services/         # Business logic — game rules live here
│   ├── authService.ts
│   └── profileService.ts
│
├── domain/           # Pure functions — no DB access, fully unit-testable
│   ├── auth.ts       # Email/password validation rules
│   ├── cohort.ts     # ISO week key derivation
│   └── profile.ts    # Profile limit rules
│
├── repositories/     # Data access — Prisma queries only, no logic
│   ├── userRepository.ts
│   ├── cohortRepository.ts
│   └── profileRepository.ts
│
├── middleware/
│   ├── auth.ts           # JWT verification
│   ├── errorHandler.ts   # Global error → { error, code } shape
│   └── requestLogger.ts  # Dev request logging
│
├── config/
│   ├── env.ts        # Environment variable loading (fails fast if missing)
│   ├── constants.ts  # All game parameters — never hardcode elsewhere
│   └── prisma.ts     # Shared Prisma client instance
│
├── types/
│   └── index.ts      # Shared TypeScript interfaces and DTOs
│
├── app.ts            # Express app setup (importable without starting server)
└── server.ts         # HTTP server entry point

prisma/
└── schema.prisma     # Single source of truth for all DB tables

tests/
├── unit/
│   ├── domain/       # Pure function tests — no mocks needed
│   └── services/     # Service tests — repositories mocked
└── integration/      # API endpoint tests (added in M8)
```

---

## Architecture

This backend follows a **strict four-layer architecture**. Every request flows through layers in this order — layers must not be bypassed:

```
HTTP Request
     │
     ▼
┌─────────────┐
│  Controller │  Validates request shape. Calls service. Returns response.
│  (api/)     │  MUST NOT contain business logic or DB calls.
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │  All game rules and state transitions live here.
│ (services/) │  Calls domain functions and repositories.
└──────┬──────┘
       │
    ┌──┴──┐
    │     │
    ▼     ▼
┌───────┐ ┌────────────┐
│Domain │ │ Repository │
│(pure) │ │ (Prisma)   │
└───────┘ └────────────┘
Domain layer: pure functions, no DB, fully deterministic.
Repository layer: Prisma queries only, no logic.
```

**If you find business logic in a controller, that is a bug.**
**If you find a Prisma call in a domain function, that is a bug.**

---

## Key Design Decisions

### Balance is never stored as a column
All financial values are stored as immutable transaction rows in the `transactions` table.
The current balance is always `SUM(amount)` across all transactions for a profile.
This gives a free audit trail and mirrors how real financial systems work.

### Monetary values are in paise
All `amount` fields in the database and API are in paise (₹1 = 100 paise) to avoid floating-point arithmetic errors. The frontend divides by 100 for display.

### Cohorts are deterministic by ISO week
A user's cohort is determined by the ISO calendar week they register in. Two users registering on any day of the same week land in the same cohort — guaranteed. Re-running the cohort assignment function with the same date always produces the same weekKey. This is tested.

### Profiles are immutable after creation
Difficulty and cohort assignment cannot be changed once a profile is created. This invariant is enforced at the service layer.

### AppError for known failure modes
Expected failures (validation errors, auth failures, not-found) are thrown as `AppError` with a `statusCode` and `code`. The global error handler catches these and returns consistent `{ error, code }` JSON. Unexpected errors return `500 INTERNAL_ERROR`.

### JWT is stateless
Logout is handled client-side by discarding the token. The backend has no session store. This is intentional for simplicity — token revocation can be added later if needed.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs. Min 32 chars recommended. |
| `PORT` | No | `3000` | Port the server listens on |
| `NODE_ENV` | No | `development` | `development` \| `test` \| `production` |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry duration |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Bcrypt cost factor. Use `1` in tests for speed. |

---

## npm Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start dev server with hot reload (nodemon + ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled output (production) |
| `npm test` | Run all Jest tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run prisma:migrate` | Run pending migrations |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |

---

## Milestones Delivered

| Milestone | Scope | Status |
|---|---|---|
| M0 | Engineering foundations, tooling setup | ✅ Done |
| M1 | Project skeleton, Express app, /health, ESLint, Prettier, Jest | ✅ Done |
| M2 | Auth: register, login, logout, JWT middleware | ✅ Done |
| M3 | Profiles, cohorts, cohort assignment, profile limits | ✅ Done |
| M4 | Weekly tick engine | 🔜 Next |
| M5 | Decisions, investments, metrics | 🔜 Upcoming |
| M6 | Random events, difficulty | 🔜 Upcoming |
| M7 | Weekly summary, leaderboards, end states | 🔜 Upcoming |
| M8 | Stabilisation, integration tests, final demo | 🔜 Upcoming |

---

## Known Limitations (Week 1–3 Scope)

- No game tick engine yet — profiles are created and initialised but cannot be advanced.
- No leaderboard endpoint yet — cohort model is in place, rankings in M7.
- Integration tests are scaffolded but empty — will be filled in M8.
- `POST /auth/logout` is stateless — tokens remain valid until expiry. Revocation list is out of scope per spec.

---

## Invariants That Must Always Hold

These are checked in code review. Any violation is a bug that must be fixed before merge.

1. Balance is never a stored column — always `SUM(transactions.amount)`
2. Business logic never lives in controllers
3. Domain layer never accesses the database
4. Difficulty cannot change after profile creation
5. A profile cannot change cohorts after assignment
6. `creditScore` stays within 300–900
7. `socialScore` stays within 0–100
8. `wellBeing` stays within 0–100
9. Weekly tick is atomic — partial advances must never persist
