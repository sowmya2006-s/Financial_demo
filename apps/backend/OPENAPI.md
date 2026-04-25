# Moolah Minds — API Contract (OPENAPI.md)
> **Week 1–3 scope.** This document is the source of truth for all backend endpoints.
> Breaking changes must be coordinated with both frontend teams before merging.

---

## Base URL
```
http://localhost:3000
```

## Protocol
- All endpoints: REST over HTTP
- All request/response bodies: JSON
- All protected endpoints require: `Authorization: Bearer <token>`
- All errors return: `{ "error": string, "code": string }`

---

## Error Codes Reference

| HTTP Status | Code | Meaning |
|---|---|---|
| 400 | `MISSING_FIELDS` | Required fields absent from request body |
| 400 | `VALIDATION_ERROR` | Field value fails validation rules |
| 401 | `AUTH_MISSING` | No Authorization header provided |
| 401 | `AUTH_INVALID` | Token is expired or tampered |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 404 | `PROFILE_NOT_FOUND` | Profile doesn't exist or belongs to another user |
| 404 | `NOT_FOUND` | Route does not exist |
| 409 | `EMAIL_TAKEN` | Email already registered |
| 409 | `PROFILE_LIMIT_REACHED` | User has hit max profiles for that difficulty |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Health

### `GET /health`
Checks server and database connectivity.

**Auth required:** No

**Response 200**
```json
{
  "status": "ok",
  "timestamp": "2025-03-10T08:00:00.000Z",
  "database": "connected"
}
```

**Response 503** (DB unreachable)
```json
{
  "status": "degraded",
  "timestamp": "2025-03-10T08:00:00.000Z",
  "database": "disconnected"
}
```

---

## Auth

### `POST /auth/register`
Creates a new user account.

**Auth required:** No

**Request Body**
```json
{
  "email": "alice@example.com",
  "name": "Alice Smith",
  "password": "SecurePass1"
}
```

**Password rules:** min 8 chars, at least 1 uppercase, at least 1 number.

**Response 201**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "name": "Alice Smith"
  }
}
```

**Error responses:** `400 MISSING_FIELDS`, `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`

---

### `POST /auth/login`
Authenticates a user and returns a JWT.

**Auth required:** No

**Request Body**
```json
{
  "email": "alice@example.com",
  "password": "SecurePass1"
}
```

**Response 200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "name": "Alice Smith"
  }
}
```

**Token:** JWT, expires in 7 days. Include in all subsequent requests as `Authorization: Bearer <token>`.

**Error responses:** `400 MISSING_FIELDS`, `401 INVALID_CREDENTIALS`

---

### `POST /auth/logout`
Signals logout intent. Token invalidation is client-side (discard the token).

**Auth required:** Yes

**Response 200**
```json
{ "success": true }
```

---

## Profiles

### `POST /profiles`
Creates a new game profile for the authenticated user.

**Auth required:** Yes

**Request Body**
```json
{
  "name": "My Aggressive Strategy",
  "difficulty": "BEGINNER"
}
```

**Difficulty values:** `BEGINNER` | `STANDARD` | `HARD`

**Profile limits:**
- `BEGINNER`: up to 5 profiles
- `STANDARD`: 1 profile
- `HARD`: 1 profile

**Response 201**
```json
{
  "profile": {
    "id": "profile-uuid",
    "name": "My Aggressive Strategy",
    "difficulty": "BEGINNER",
    "cohortId": "cohort-uuid",
    "createdAt": "2025-03-10T08:00:00.000Z"
  }
}
```

**Error responses:** `400 MISSING_FIELDS`, `400 VALIDATION_ERROR`, `409 PROFILE_LIMIT_REACHED`

**Side effects:** Profile creation automatically:
1. Assigns the profile to the current week's cohort
2. Seeds default obligations (rent, utilities)
3. Initialises game state at Week 1

---

### `GET /profiles`
Lists all profiles for the authenticated user.

**Auth required:** Yes

**Response 200**
```json
{
  "profiles": [
    {
      "id": "profile-uuid",
      "name": "My Aggressive Strategy",
      "difficulty": "BEGINNER",
      "cohortId": "cohort-uuid",
      "createdAt": "2025-03-10T08:00:00.000Z",
      "cohort": {
        "id": "cohort-uuid",
        "weekKey": "2025-W10"
      },
      "gameState": {
        "currentWeek": 1,
        "status": "ACTIVE",
        "salary": 3000000,
        "creditScore": 700,
        "socialScore": 50,
        "wellBeing": 75
      }
    }
  ]
}
```

**Note:** `salary` and monetary values are in **paise** (₹1 = 100 paise). Divide by 100 to display in rupees.

---

### `GET /profiles/:id`
Fetches a single profile. Returns 404 if the profile doesn't exist or belongs to another user.

**Auth required:** Yes

**Response 200**
```json
{
  "profile": {
    "id": "profile-uuid",
    "name": "My Aggressive Strategy",
    "difficulty": "BEGINNER",
    "cohortId": "cohort-uuid",
    "createdAt": "2025-03-10T08:00:00.000Z",
    "cohort": { "id": "cohort-uuid", "weekKey": "2025-W10" },
    "gameState": {
      "currentWeek": 1,
      "status": "ACTIVE",
      "salary": 3000000,
      "creditScore": 700,
      "socialScore": 50,
      "wellBeing": 75
    }
  }
}
```

**Error responses:** `404 PROFILE_NOT_FOUND`

---

## Endpoints Added in Later Milestones

The following endpoints are defined in the spec and will be implemented in Milestones 4–7.
They are listed here so frontend teams can stub/mock them early.

| Method | Path | Milestone | Description |
|---|---|---|---|
| `GET` | `/game/:profileId/state` | M4 | Current game state + balance |
| `POST` | `/game/:profileId/decisions` | M5 | Submit player decisions for the week |
| `POST` | `/game/:profileId/advance-week` | M4 | Advance game by one week (atomic tick) |
| `GET` | `/game/:profileId/history` | M7 | Transaction + summary history |
| `GET` | `/game/:profileId/summary/:week` | M7 | Weekly summary for a specific week |
| `GET` | `/finance/:profileId/portfolio` | M5 | Current investments and obligations |
| `POST` | `/finance/:profileId/invest` | M5 | Buy an investment product |
| `POST` | `/finance/:profileId/redeem` | M5 | Redeem an investment |
| `GET` | `/finance/products` | M5 | Catalogue of available investment products |
| `GET` | `/cohorts/:id/leaderboard` | M7 | Cohort-scoped leaderboard |

---

## Notes for Frontend Teams

1. **All monetary values are in paise.** Display as `₹${(amount / 100).toFixed(2)}`.
2. **JWT expiry is 7 days.** Store the token in memory or `localStorage`. On 401, redirect to login.
3. **Profiles cannot change cohorts or difficulty** after creation — these are immutable.
4. **Do not re-implement any game logic on the frontend.** Always derive displayed values from backend responses.
5. **`gameState.status`** can be `ACTIVE`, `RETIRED`, or `BANKRUPT`. Show appropriate end-state UI for non-ACTIVE profiles.
