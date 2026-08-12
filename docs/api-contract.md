# Gig Lanka API Contract

**Purpose:** the single source of truth for how every endpoint in this project looks — the shape of a request, the shape of a response, and what each status code means here. Client code is written against this document, not against whichever server behavior happens to exist yet. If a real endpoint disagrees with this document, the endpoint is wrong.

This contract covers Sprint 0's auth endpoints in full. Later sprints add gig, application, and review endpoints under these same conventions — they get their own sections when specified, not their own rules.

---

## 1. Base URL and routing conventions

- All endpoints are mounted under `/api`.
- Resources are **plural, lowercase, hyphenated**: `/api/gigs`, `/api/skill-trials`, `/api/applications`.
- Auth is not a CRUD resource, so its routes are actions under `/api/auth/<action>`: `/api/auth/register`, `/api/auth/login`.
- Nesting reflects ownership, not just relation, e.g. `/api/gigs/:gigId/applications`.

### HTTP methods

| Method | Meaning |
|---|---|
| `GET` | Retrieve one resource or a collection. Never changes state. |
| `POST` | Create a new resource, or perform an action that isn't a resource CRUD op (`login`, `refresh`, `logout`). |
| `PUT` | Replace a resource in full. |
| `PATCH` | Update part of a resource. |
| `DELETE` | Remove a resource. |

---

## 2. Success response envelope

Every successful response — regardless of endpoint — returns the same outer shape. The payload lives under `data`.

```json
{
  "success": true,
  "data": { }
}
```

`data` holds whatever is appropriate to the endpoint: an object, an array, or `null` for actions with nothing to return (e.g. logout).

**Example** — `GET /api/auth/me`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "email": "seeker@giglanka.test",
      "role": "seeker",
      "createdAt": "2026-08-01T09:15:00.000Z"
    }
  }
}
```

---

## 3. Error response envelope

Every error response — regardless of cause — returns the same outer shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "email", "message": "must be a valid email address" }
    ]
  }
}
```

- `code` — a fixed, machine-readable string the client can branch on (e.g. show a specific message, redirect to login). Not the HTTP status text — a project-specific code.
- `message` — a human-readable summary, safe to show in a toast if no field-level detail applies.
- `errors` — **optional**. Present only for field-level validation failures (`400`). An array of `{ field, message }`, one entry per invalid field. Omitted entirely for errors that aren't about field validation (auth failures, not-found, conflicts, server errors).

### Error codes in use (Sprint 0)

| Code | Used for |
|---|---|
| `VALIDATION_ERROR` | Request body/params/query failed schema validation. |
| `INVALID_CREDENTIALS` | Login email/password combination doesn't match. |
| `EMAIL_ALREADY_EXISTS` | Register called with an email already in the database. |
| `UNAUTHENTICATED` | No access token, or the token is missing/malformed. |
| `TOKEN_EXPIRED` | Access or refresh token is well-formed but expired. |
| `TOKEN_INVALID` | Refresh token doesn't match a known, unrevoked token. |
| `FORBIDDEN` | Authenticated, but the user's role isn't allowed to do this. |
| `NOT_FOUND` | The requested resource doesn't exist. |
| `INTERNAL_ERROR` | Unhandled server-side failure. |

New codes may be added for later sprints' resources; existing codes are never repurposed for a different meaning.

---

## 4. Status codes in use

| Status | Meaning in this project |
|---|---|
| `200 OK` | Request succeeded. Used for `GET`, `PUT`, `PATCH`, `DELETE`, and action-style `POST`s that don't create a resource (`login`, `refresh`, `logout`). |
| `201 Created` | A new resource was created. Used for `register` and every resource-creating `POST`. |
| `400 Bad Request` | Validation failed — the request body/params/query didn't match the expected shape. Always carries `errors`. |
| `401 Unauthorized` | Not authenticated: missing/invalid/expired token, or (for login) wrong credentials. |
| `403 Forbidden` | Authenticated, but the user's role doesn't permit this action. |
| `404 Not Found` | The resource, or the route, doesn't exist. |
| `409 Conflict` | The request conflicts with existing state — e.g. registering an email that's already taken. |
| `500 Internal Server Error` | Unhandled failure on the server. Never leaks stack traces or internals to the client in production. |

---

## 5. Auth endpoints (Sprint 0)

All request/response bodies below are the JSON that goes inside the envelopes from sections 2 and 3 — i.e. a success example shows what fills `data`, and a failure example shows what fills `error`.

Tokens: `accessToken` is short-lived and sent in `Authorization: Bearer <token>` on subsequent requests. `refreshToken` is longer-lived, stored in `expo-secure-store` client-side, and used only against `/api/auth/refresh`.

### 5.1 Register — `POST /api/auth/register`

Creates a new user account.

**Request body**

```json
{
  "email": "seeker@giglanka.test",
  "password": "Password123!",
  "role": "seeker"
}
```

`role` is one of `"seeker"`, `"business"`. (`"admin"` accounts are never created through this endpoint — see `server/README.md`.)

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "email": "seeker@giglanka.test",
      "role": "seeker",
      "createdAt": "2026-08-01T09:15:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f14e45fceea167a5a36..."
  }
}
```

**Failure — `400 Bad Request`** (validation, e.g. missing password or invalid email)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "password", "message": "must be at least 8 characters" }
    ]
  }
}
```

**Failure — `409 Conflict`** (duplicate email)

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email already exists."
  }
}
```

### 5.2 Login — `POST /api/auth/login`

**Request body**

```json
{
  "email": "seeker@giglanka.test",
  "password": "Password123!"
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "email": "seeker@giglanka.test",
      "role": "seeker",
      "createdAt": "2026-08-01T09:15:00.000Z"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8f14e45fceea167a5a36..."
  }
}
```

**Failure — `401 Unauthorized`** (wrong password, or email not found — same response either way, so the client can't enumerate accounts)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect."
  }
}
```

### 5.3 Refresh — `POST /api/auth/refresh`

Exchanges a valid refresh token for a new access/refresh pair (rotation — the old refresh token is revoked).

**Request body**

```json
{
  "refreshToken": "8f14e45fceea167a5a36..."
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "3a5f8c1d9b2e04f6..."
  }
}
```

**Failure — `401 Unauthorized`** (expired)

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Refresh token has expired. Please log in again."
  }
}
```

**Failure — `401 Unauthorized`** (unknown or already-revoked token)

```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Refresh token is invalid."
  }
}
```

### 5.4 Logout — `POST /api/auth/logout`

Revokes a refresh token so it can no longer be used. Requires a valid access token (`Authorization: Bearer <accessToken>`).

**Request body**

```json
{
  "refreshToken": "8f14e45fceea167a5a36..."
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": null
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "You must be logged in to do this."
  }
}
```

### 5.5 Current user — `GET /api/auth/me`

Returns the authenticated user. Requires `Authorization: Bearer <accessToken>`.

**Request body:** none.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "email": "seeker@giglanka.test",
      "role": "seeker",
      "createdAt": "2026-08-01T09:15:00.000Z"
    }
  }
}
```

**Failure — `401 Unauthorized`** (no/invalid/expired access token)

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "You must be logged in to do this."
  }
}
```

---

## 6. Vocabularies

These are the closed vocabularies used throughout the product. "Closed" means nothing outside the list can be selected or stored. They are defined once, in `app/src/constants/enums.js`, with each entry carrying a stored `value` and a display `label`. That file is not imported into the server — duplicating it across the monorepo halves is worse than duplicating the list once in a validator — so this section is the shared reference that keeps the server's Joi schemas and the client's pickers in step. If a validator and a picker disagree, this table is correct and both are fixed to match it.

### 6.1 Gig categories

| Value | Label |
|---|---|
| `tutoring` | Tutoring |
| `delivery` | Delivery |
| `event_help` | Event help |
| `retail` | Retail |
| `hospitality` | Hospitality |
| `admin_data_entry` | Admin & data entry |
| `creative` | Creative |
| `tech` | Tech |
| `other` | Other |

### 6.2 Pay types

| Value | Label |
|---|---|
| `per_hour` | Per hour |
| `per_day` | Per day |
| `fixed_price` | Fixed price |

### 6.3 Schedule tags

| Value | Label |
|---|---|
| `weekday_mornings` | Weekday mornings |
| `weekday_evenings` | Weekday evenings |
| `weekends` | Weekends |
| `flexible_hours` | Flexible hours |

### 6.4 Commitment lengths

| Value | Label |
|---|---|
| `one_off` | One-off |
| `under_a_week` | Under a week |
| `one_to_four_weeks` | 1-4 weeks |
| `ongoing` | Ongoing |

### 6.5 Gig statuses

| Value | Label |
|---|---|
| `draft` | Draft |
| `open` | Open |
| `closed` | Closed |
| `filled` | Filled |

### 6.6 Gig sort orders

| Value | Label |
|---|---|
| `newest` | Newest |
| `highest_pay` | Highest pay |
| `starting_soon` | Starting soon |

### 6.7 Application statuses

| Value | Label |
|---|---|
| `applied` | Applied |
| `viewed` | Viewed |
| `shortlisted` | Shortlisted |
| `hired` | Hired |
| `rejected` | Rejected |
| `withdrawn` | Withdrawn |
| `closed_filled` | Closed – position filled |

### 6.8 Rejection reason codes

The seven business-selectable reasons, plus one system-only code that is never offered as a choice.

| Value | Label | Selectable by a business |
|---|---|---|
| `schedule_mismatch` | Schedule did not match | Yes |
| `location_too_far` | Location too far | Yes |
| `skill_trial_not_passed` | Skill trial not passed | Yes |
| `skill_trial_not_attempted` | Skill trial not attempted | Yes |
| `looking_for_more_experience` | Looking for more relevant experience | Yes |
| `another_applicant_closer_fit` | Another applicant was a closer fit | Yes |
| `role_no_longer_needed` | Role no longer needed | Yes |
| `positions_filled` | Positions filled | No — system-only |

### 6.9 Review categories

Business set (rated by the youth worker):

| Value | Label |
|---|---|
| `fair_payment` | Fair payment |
| `clear_job_description` | Clear job description |
| `communication` | Communication |
| `respectful_treatment` | Respectful treatment |
| `payment_on_time` | Payment on time |
| `safe_working_environment` | Safe working environment |

Youth worker set (rated by the business):

| Value | Label |
|---|---|
| `work_quality` | Work quality |
| `punctuality` | Punctuality |
| `communication` | Communication |
| `professionalism` | Professionalism |
| `reliability` | Reliability |
| `ability_to_follow_instructions` | Ability to follow instructions |

### 6.10 Rating aggregate shape

The summary that lands on a profile once reviews exist for it. Flat by design — an average, a count, and a short list of common categories, nothing here needs a histogram in Sprint 1.

```json
{
  "averageRating": 4.6,
  "reviewCount": 12,
  "topCategories": ["communication", "punctuality"]
}
```

**Ownership boundary**, stated in both directions so neither epic computes the other's number: the Review component (this contract's `6.9`) owns the aggregate and is the only thing that writes it, computed from the reviews collection starting in Sprint 2. User & Profile stores the aggregate on the profile document and displays it, and never writes it.

---

## 7. Adding a new endpoint later

1. Pick a plural, lowercase, hyphenated resource name.
2. Reuse the envelopes in sections 2 and 3 exactly — don't invent a new outer shape.
3. Reuse an existing error `code` if the failure matches one in the table in section 3; add a new row to that table if it genuinely doesn't.
4. Document the endpoint here (method, path, request body, success and failure examples) before implementing it.
