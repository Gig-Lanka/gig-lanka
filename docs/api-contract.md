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
| `UNAUTHENTICATED` | Reached a role check with no authenticated user. |
| `AUTH_HEADER_MISSING` | No `Authorization` header on a request that requires one. |
| `AUTH_HEADER_MALFORMED` | `Authorization` header present but not `Bearer <token>`. |
| `TOKEN_EXPIRED` | Access or refresh token is well-formed but expired. |
| `TOKEN_INVALID` | Access token is invalid, or a refresh token doesn't match a known, unrevoked token. |
| `FORBIDDEN` | Authenticated, but the user's role isn't allowed to do this. |
| `NOT_FOUND` | The requested resource doesn't exist. |
| `INTERNAL_ERROR` | Unhandled server-side failure. |
| `FILE_MISSING` | An upload request had no file in the fixed field name. |
| `UNSUPPORTED_FILE_TYPE` | An uploaded file's MIME type isn't PNG, JPG or PDF. |
| `FILE_TYPE_MISMATCH` | An uploaded file's extension doesn't match its reported MIME type. |
| `FILE_TOO_LARGE` | An uploaded file exceeds the 5MB limit. |
| `STORAGE_UNAVAILABLE` | The storage backend (Supabase) failed or was unreachable. Always `502`. |
| `GIG_CLOSED` | Attempted to apply to or save a gig whose status isn't `open`. Always `409`. |
| `APPLICATION_ALREADY_EXISTS` | `POST /api/gigs/:gigId/applications` for a `(gig, applicant)` pair that already has an application (§11.7). Always `409`; the duplicate-key error from the unique index (§11.1) is translated here rather than surfacing as `500` — the same trap GL-15 hit with duplicate emails. Holds whether the earlier application is live, withdrawn or rejected. |
| `INVALID_APPLICATION_TRANSITION` | Attempted to move an application to a status not reachable from its current status (§11.3). Always `409`, and the message names both the current and the attempted status. Withdrawing a `hired` application (§11.10) surfaces through this same code — Hired's only outgoing move is to `completed`, so a withdraw is refused by the transition table itself, not by a withdraw-specific check. Marking anything other than a `hired` application complete (§11.11) is refused the same way. |
| `APPLICATION_NOT_COMPLETED` | `POST /api/applications/:applicationId/reviews` on an application whose status isn't `completed` (§12.3). Always `409` — a review requires a completed gig. |
| `REVIEW_ALREADY_EXISTS` | `POST /api/applications/:applicationId/reviews` for an `(application, direction)` pair that already has a review (§12.3). Always `409`; the duplicate-key error from the unique index (§7) is translated here rather than surfacing as `500`. |

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
| `502 Bad Gateway` | A dependency the server calls out to (e.g. Supabase Storage) failed or was unreachable. Distinguishes "the thing you sent was fine but our infrastructure isn't" from a `400`/`500`. |

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
| `completed` | Completed |
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

The summary that lands on a profile once reviews exist for it: an average, a count, a short list of common categories, and a star-by-star histogram.

```json
{
  "averageRating": 4.6,
  "reviewCount": 12,
  "topCategories": ["communication", "punctuality"],
  "distribution": { "1": 0, "2": 0, "3": 1, "4": 3, "5": 8 }
}
```

- `distribution` — the count of reviews at each star value, keyed `"1"` through `"5"`. Always all five keys, each defaulting to `0`. The five counts sum to `reviewCount`.

**Ownership boundary**, stated in both directions so neither epic computes the other's number: the Review component (this contract's `6.9`) owns the aggregate and is the only thing that writes it, computed from the reviews collection starting in Sprint 2. User & Profile stores the aggregate on the profile document and displays it, and never writes it.

---

## 7. Review document shape

`server/src/models/review.model.js`. This is the shape `POST /api/applications/:applicationId/reviews` returns (§12.1) — as stored, `author` and `subject` are bare reference ids. `GET /api/users/:userId/reviews` (§12.2) returns the same shape with `author` replaced by a populated `{ id, name, photo }` object read live from the profile, not this frozen id.

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d2",
  "application": "64f1a2b3c4d5e6f7a8b9c0d3",
  "author": "64f1a2b3c4d5e6f7a8b9c0d1",
  "subject": "64f1a2b3c4d5e6f7a8b9c0d4",
  "direction": "seeker_to_business",
  "rating": 5,
  "categories": ["fair_payment", "communication"],
  "text": "Paid on time and communicated clearly throughout the gig.",
  "createdAt": "2026-08-12T09:15:00.000Z"
}
```

- `application` — the application this review came from. A review can only exist because that application reached `completed` (§6.7); it points at the application, not directly at a user.
- `author`, `subject` — always derived from the application and the authenticated user, never accepted from a request body. Reference ids only — no author name or photo is copied onto the review, so a profile edit is reflected on every past review instead of being frozen into it. The opposite of the application's frozen snapshot, and for the opposite reason: an application records what was true then, a review shows who someone is now. Author and subject are never the same user.
- `direction` — one of exactly two values: `seeker_to_business` or `business_to_seeker`. There is no third kind of review.
- `rating` — a whole number, 1 to 5. No half stars, no zero, no decimals.
- `categories` — optional, may be empty. Validated against `direction`: `seeker_to_business` accepts only the business set, `business_to_seeker` accepts only the youth worker set (§6.9).
- `text` — required, 20–1000 characters, not whitespace-only.
- `createdAt` — set once, on creation. There is no `updatedAt`: reviews are permanent, with no edit or delete path. Correcting one is a dispute, handled by Admin in Sprint 4.
- At most one review per `(application, direction)` pair — a unique index enforces it, so the same person can't review the same completed gig twice.

---

## 8. Profile endpoints (Sprint 1)

`server/src/models/profile.model.js`. The profile is a separate document from the user, one per user, holding everything another person is allowed to see. The `User` record keeps credentials and the role and is never returned by these endpoints — that separation is what guarantees a public profile can't leak a field that only exists because of authentication.

All three endpoints require `Authorization: Bearer <accessToken>`. **Admin accounts have no profile**: any of these called with an admin token returns `403`, and an admin's user id is never a valid target for a public profile read.

A profile is created lazily on first read, so an account that predates profiles never 404s on its own profile. The display name is required and is seeded from the email's local part when the profile is created this way — a user with no name yet gets `seeker@giglanka.test` → `"seeker"`, not a blank.

### 8.1 Own profile shape

Returned by `GET /api/profiles/me` and `PUT /api/profiles/me`, under `data.profile`. This is the full document — the owner sees everything on it.

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d5",
  "user": "64f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Nimal Perera",
  "photo": "https://cdn.giglanka.test/u/nimal.jpg",
  "bio": "Second-year student, free weekday evenings and weekends.",
  "city": "Colombo",
  "skills": ["barista", "cashier", "customer service"],
  "workExperience": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d6",
      "roleTitle": "Barista",
      "employer": "Cafe Kandy",
      "startDate": "2025-06-01",
      "endDate": "2025-12-31",
      "ongoing": false,
      "description": "Weekend shifts making coffee and handling the till."
    }
  ],
  "education": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
      "institution": "University of Colombo",
      "qualification": "BSc Computer Science",
      "startDate": "2024-01-15",
      "endDate": "2027-12-01"
    }
  ],
  "category": "Hospitality",
  "ratingSummary": {
    "averageRating": 0,
    "reviewCount": 0,
    "topCategories": [],
    "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  },
  "skillTrialResults": [],
  "createdAt": "2026-08-12T22:31:14.195Z",
  "updatedAt": "2026-08-12T22:31:14.209Z"
}
```

- `id` — the profile's own id. `user` is the owner's user id; the two are different values and both appear.
- `name` — required, trimmed, max 60 characters. The only field that is always present.
- `photo` — a URL string. This story stores a string and never handles a file; upload is GL-105/GL-114.
- `bio` — max 500 characters. `city` and `category` are free text.
- `skills`, `workExperience`, `education` — **seeker fields**. `category` — a **business field**. See 8.2 for how role decides which are readable publicly, and 8.4 for which are writable.
- `ratingSummary` — the aggregate from §6.10. Owned by the Review component, read-only here.
- `skillTrialResults` — Skill Trial badges, owned by Application & Hiring, read-only here. Empty until Sprint 3.
- **Optional fields are omitted, not null.** A profile that has never set `photo`, `bio`, `city` or `category` has no such key at all. Arrays always appear, empty at minimum. Clients must treat absent and empty as the same thing.
- **Both roles carry all the arrays.** A business's own profile includes `skills: []`, `workExperience: []` and `education: []` because they are schema defaults. They are always empty for a business — 8.4 rejects any attempt to fill them — and they are absent from a business's *public* profile.
- Key order is not significant and varies between responses. Read by key, never by position.
- Subdocument entries in `workExperience`, `education` and `skillTrialResults` carry `_id`, not `id` — these are the one place in the API that does not follow the `_id` → `id` convention. GL-112 needs those ids to edit an individual row.

### 8.2 Public profile shape

Returned by `GET /api/profiles/:userId`, under `data.profile`. Built from an explicit whitelist, so a field added to the schema later is absent here until it is deliberately published.

**Seeker**

```json
{
  "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Nimal Perera",
  "photo": "https://cdn.giglanka.test/u/nimal.jpg",
  "city": "Colombo",
  "bio": "Second-year student, free weekday evenings and weekends.",
  "skills": ["barista", "cashier", "customer service"],
  "workExperience": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d6",
      "roleTitle": "Barista",
      "employer": "Cafe Kandy",
      "startDate": "2025-06-01",
      "endDate": "2025-12-31",
      "ongoing": false,
      "description": "Weekend shifts making coffee and handling the till."
    }
  ],
  "education": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d7",
      "institution": "University of Colombo",
      "qualification": "BSc Computer Science",
      "startDate": "2024-01-15",
      "endDate": "2027-12-01"
    }
  ],
  "skillTrialResults": [],
  "ratingSummary": {
    "averageRating": 0,
    "reviewCount": 0,
    "topCategories": [],
    "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  }
}
```

**Business**

```json
{
  "userId": "64f1a2b3c4d5e6f7a8b9c0d4",
  "name": "Kandy Coffee Co",
  "photo": "https://cdn.giglanka.test/u/kandy.jpg",
  "city": "Kandy",
  "bio": "Independent coffee shop on Peradeniya Road.",
  "category": "Hospitality",
  "ratingSummary": {
    "averageRating": 0,
    "reviewCount": 0,
    "topCategories": [],
    "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
  }
}
```

- `userId` is the **user's** id, not the profile's. The profile's own `id` is not published — callers address a public profile by user id, which is what every other feature already holds.
- Shared for both roles: `name`, `photo`, `city`, `bio`, `ratingSummary`. Seeker only: `skills`, `workExperience`, `education`, `skillTrialResults`. Business only: `category`.
- **Never present, for anyone:** the email address, the account status, `role`, `passwordHash`, `createdAt`/`updatedAt`, or any contact detail. Contact details are not shown on a public profile anywhere in this product — there is no phone number or address field to expose, and if one is ever added it stays out of this shape until it is deliberately listed.
- Optional fields are omitted rather than null, exactly as in 8.1.

### 8.3 Read own profile — `GET /api/profiles/me`

Returns the signed-in user's full profile, creating it first if it does not exist yet.

**Request body:** none.

**Success — `200 OK`** — `data.profile` is the shape in 8.1. A brand-new profile reads back as:

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "64f1a2b3c4d5e6f7a8b9c0d5",
      "user": "64f1a2b3c4d5e6f7a8b9c0d1",
      "name": "seeker",
      "skills": [],
      "workExperience": [],
      "education": [],
      "skillTrialResults": [],
      "ratingSummary": { "averageRating": 0, "reviewCount": 0, "topCategories": [], "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 } },
      "createdAt": "2026-08-12T22:31:14.195Z",
      "updatedAt": "2026-08-12T22:31:14.195Z"
    }
  }
}
```

**Failure — `401 Unauthorized`** (no header; see the table in 8.6 for the other 401 codes)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_HEADER_MISSING",
    "message": "Authorization header is missing."
  }
}
```

**Failure — `403 Forbidden`** (admin token)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

### 8.4 Update own profile — `PUT /api/profiles/me`

Updates the signed-in user's own profile. There is no endpoint that takes a target user id and a body — see 8.5.

**`PUT` replaces in full.** A field left out of the body is cleared, not preserved: omitting `bio` removes it, omitting `skills` empties the list. Send the whole profile, not a patch.

**Request body** — seeker:

```json
{
  "name": "Nimal Perera",
  "photo": "https://cdn.giglanka.test/u/nimal.jpg",
  "bio": "Second-year student, free weekday evenings and weekends.",
  "city": "Colombo",
  "skills": ["barista", "cashier", "customer service"],
  "workExperience": [
    {
      "roleTitle": "Barista",
      "employer": "Cafe Kandy",
      "startDate": "2025-06-01",
      "endDate": "2025-12-31",
      "ongoing": false,
      "description": "Weekend shifts making coffee and handling the till."
    }
  ],
  "education": [
    {
      "institution": "University of Colombo",
      "qualification": "BSc Computer Science",
      "startDate": "2024-01-15",
      "endDate": "2027-12-01"
    }
  ]
}
```

**Request body** — business:

```json
{
  "name": "Kandy Coffee Co",
  "photo": "https://cdn.giglanka.test/u/kandy.jpg",
  "bio": "Independent coffee shop on Peradeniya Road.",
  "city": "Kandy",
  "category": "Hospitality"
}
```

| Field | Rule |
|---|---|
| `name` | **Required.** Trimmed, max 60 characters. |
| `photo`, `city` | Optional free text. `""` clears the field. |
| `bio` | Optional, max 500 characters. `""` clears it. |
| `skills` | **Seeker only.** Array of strings. |
| `workExperience` | **Seeker only.** `roleTitle` and `employer` required per entry; `startDate`, `endDate`, `ongoing`, `description` (max 1000) optional. Dates are `YYYY-MM-DD` and must be real calendar dates. No limit on entries, no approval step — this is self-reported history. Omit `_id` when adding an entry. |
| `education` | **Seeker only.** `institution` and `qualification` required per entry; `startDate`, `endDate` optional, same date format. |
| `category` | **Business only.** Free text. |
| `ratingSummary`, `skillTrialResults`, `role`, `email` | **Rejected.** See below. |

Unknown fields not listed above are ignored silently.

**Success — `200 OK`** — `data.profile` is the updated profile in the shape from 8.1.

**Failure — `400 Bad Request`** (a field this component does not own). `ratingSummary` and `skillTrialResults` belong to other components; `role` and `email` live on `User` and are not editable here. Each is named rather than silently dropped:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "ratingSummary", "message": "ratingSummary is not allowed" }
    ]
  }
}
```

All offending fields are reported at once — sending both `role` and `email` returns two entries.

**Failure — `400 Bad Request`** (a field belonging to the other role). A seeker sending `category`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "category", "message": "is not a field on a seeker profile" }
    ]
  }
}
```

A business sending `skills`, `workExperience` or `education` gets the same shape with `"is not a field on a business profile"`.

**Failure — `400 Bad Request`** (ordinary validation), e.g. a missing name:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "name", "message": "name is required" }
    ]
  }
}
```

**Failure — `401 Unauthorized`, `403 Forbidden`** (admin token) — as in 8.3.

### 8.5 Read a public profile — `GET /api/profiles/:userId`

Returns the public profile of any seeker or business to any signed-in caller. `:userId` is the **user's** id, not a profile id.

**Request body:** none.

**Success — `200 OK`** — `data.profile` is the shape in 8.2.

**Failure — `404 Not Found`**

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Profile not found."
  }
}
```

This exact response is returned for **every** case where a profile is not shown, and the cases are deliberately indistinguishable:

- no user with that id
- a malformed id
- the id belongs to an admin
- **the account has been deactivated** — it answers as though the profile never existed, rather than revealing the account was shut off

Deactivation itself lands in Sprint 3; the guard is already in the read path and keys off `isActive === false`, so a profile stays visible while the flag is absent. Whoever adds deactivation must keep that field name or update this endpoint with it.

**Failure — `401 Unauthorized`, `403 Forbidden`** (admin **caller**) — as in 8.3.

**There is no update path here.** `PUT /api/profiles/:userId` exists only to refuse:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only update your own profile."
  }
}
```

It returns `403` rather than `404` so the answer reads as "not allowed, ever" instead of "wrong id". Editing is only ever reachable through `/me`.

### 8.6 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Body failed validation, a system-owned field was sent, or a field of the other role was sent. Always carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists. |
| `403` | `FORBIDDEN` | Admin token on any profile endpoint, or an update attempted through a path other than `/me`. |
| `404` | `NOT_FOUND` | Public profile not shown, for any of the reasons in 8.5. |

---

## 9. Upload endpoint (Sprint 1)

Backs profile photos this sprint; skill trial file submissions and resume PDFs reuse the same endpoint from Sprint 3 onward. See GL-105 for the storage design — the client never talks to Supabase directly, only to this endpoint.

### 9.1 Upload a file — `POST /api/uploads`

**Request:** `multipart/form-data`, not JSON.

| Field | Rule |
|---|---|
| `file` | **Required.** The file itself. PNG, JPG or PDF only, checked against both its MIME type and its extension. Max 5MB. |
| `folder` | **Required.** A closed list of purposes, not a free path — a caller can't write anywhere else in the bucket. Only `avatars` this sprint. |

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "url": "https://<project>.supabase.co/storage/v1/object/public/<bucket>/avatars/9b1e3f2a-....png"
  }
}
```

The returned name is generated server-side and unguessable — never the filename the client sent, and never derived from the caller's user id.

**Failure — `400 Bad Request`** (bad `folder`, same shape as any other `VALIDATION_ERROR`):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "folder", "message": "must be one of [avatars]" }
    ]
  }
}
```

**Failure — `400 Bad Request`** (no file in the `file` field):

```json
{
  "success": false,
  "error": {
    "code": "FILE_MISSING",
    "message": "No file was provided."
  }
}
```

**Failure — `400 Bad Request`** (wrong type, mismatched extension, or oversize) — see 9.2 for the three distinct codes.

**Failure — `401 Unauthorized`** — as in 8.3. Guests cannot upload.

**Failure — `502 Bad Gateway`** (Supabase is down or rejects the request):

```json
{
  "success": false,
  "error": {
    "code": "STORAGE_UNAVAILABLE",
    "message": "Could not upload the file. Please try again."
  }
}
```

A `502` means the file itself may have been fine — try again. A `400` means the file or request was the problem — retrying unchanged won't help.

### 9.2 Error codes for this endpoint

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `folder` missing or not in the closed list. Carries `errors`. |
| `400` | `FILE_MISSING` | No file in the `file` field. |
| `400` | `UNSUPPORTED_FILE_TYPE` | File's MIME type isn't PNG, JPG or PDF. |
| `400` | `FILE_TYPE_MISMATCH` | File's extension doesn't match its reported MIME type — catches a renamed file. |
| `400` | `FILE_TOO_LARGE` | File exceeds 5MB. |
| `401` | `AUTH_HEADER_MISSING` | No `Authorization` header. |
| `401` | `AUTH_HEADER_MALFORMED` | Header present but not `Bearer <token>`. |
| `401` | `TOKEN_EXPIRED` | Access token expired. |
| `401` | `TOKEN_INVALID` | Access token invalid, or its user no longer exists. |
| `502` | `STORAGE_UNAVAILABLE` | Supabase failed or was unreachable. The request may have been valid — safe to retry. |

---

## 10. Gig endpoints (Sprint 1)

`server/src/models/gig.model.js`. The gig is what a business posts and a seeker browses; applications, saves and reviews all point back at one. `GET /api/gigs` and `GET /api/gigs/:id` are the only two public endpoints in this project — no `Authorization` header required, browsing without an account is deliberate. Every other gig endpoint requires a **business** token; a seeker token gets `403`, no token gets `401`.

### 10.1 Gig shape

Returned under `data.gig` (single) or `data.gigs` (list), everywhere a gig appears.

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d8",
  "title": "Weekend event helper",
  "description": "Help set up and run a community weekend event, greeting guests.",
  "category": "event_help",
  "payAmount": 2500,
  "payType": "per_day",
  "city": "Colombo",
  "area": "Peradeniya Road",
  "remote": false,
  "schedule": ["weekends"],
  "commitment": "one_off",
  "positions": 2,
  "startDate": "2026-09-01",
  "applicationsCloseDate": "2026-08-25",
  "status": "open",
  "postedBy": "64f1a2b3c4d5e6f7a8b9c0d4",
  "applicantCount": 0,
  "createdAt": "2026-08-12T09:15:00.000Z",
  "updatedAt": "2026-08-12T09:15:00.000Z"
}
```

- `category`, `payType`, `schedule`, `commitment`, `status` — the closed vocabularies at §6.1–§6.5. Any other value is rejected with `400` naming the field.
- `city` — required unless `remote` is `true`. `area`, `startDate`, `applicationsCloseDate` are always optional.
- `applicationsCloseDate` (and `startDate`) are plain `YYYY-MM-DD` strings, not ISO timestamps. A closing date in the past is rejected with `400` on both create and update.
- `status` defaults to `open` on creation and cannot be set by a client — see 10.3.
- `postedBy` is a user id, taken from the caller's token on create and never from the request body.
- `applicantCount` defaults to `0`. It is owned by Application & Hiring (GL-110 and later); this component only declares and defaults it, never writes it.
- **`savedBy` is never present in any response, for anyone, including the gig's own owner** — not even once Sprint 2 starts writing saver ids to it. A business learns how many people applied (`applicantCount`), never who saved.
- Optional fields (`area`, `startDate`, `applicationsCloseDate`) are omitted, not null, when unset — same convention as profiles (§8.1).

### 10.2 Business block

`GET /api/gigs/:id` additionally returns the posting business's public identity under `data.business`, so the detail screen can render it without a second call:

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d4",
  "name": "Kandy Coffee Co",
  "photo": "https://cdn.giglanka.test/u/kandy.jpg"
}
```

`id` matches the gig's `postedBy`. `name` and `photo` come from the business's profile (§8.1), not the `User` record. If the business has never filled in a profile, both read back as `null` rather than the request failing.

### 10.3 Create a gig — `POST /api/gigs`

Businesses only.

**Request body**

```json
{
  "title": "Weekend event helper",
  "description": "Help set up and run a community weekend event, greeting guests.",
  "category": "event_help",
  "payAmount": 2500,
  "payType": "per_day",
  "city": "Colombo",
  "schedule": ["weekends"],
  "commitment": "one_off",
  "positions": 2
}
```

| Field | Rule |
|---|---|
| `title` | Required, max 80 characters. |
| `description` | Required, 20–2000 characters. |
| `category` | Required, one of §6.1. |
| `payAmount` | Required, a number greater than zero. Strings, ranges and `"negotiable"` are rejected with `400` — there is no free-text pay path. |
| `payType` | Required, one of §6.2. |
| `remote` | Optional boolean, defaults to `false`. |
| `city` | Required unless `remote` is `true`. |
| `area` | Optional. |
| `schedule` | Required array, at least one value from §6.3. An empty array is `400`, not an accepted default. |
| `commitment` | Required, one of §6.4. |
| `positions` | Optional integer, minimum 1, defaults to `1`. |
| `startDate`, `applicationsCloseDate` | Optional, `YYYY-MM-DD`. `applicationsCloseDate` cannot be in the past. |

`status`, `postedBy` and `applicantCount` are not accepted fields on this schema — if sent, they are silently stripped rather than rejected, the same as any other field the endpoint doesn't recognize. `status` always comes back `open`; `postedBy` always comes back the caller's id.

**Success — `201 Created`** — `data.gig`, the shape in 10.1.

**Failure — `400 Bad Request`** (validation — one entry per invalid field):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "payAmount", "message": "payAmount must be a number" },
      { "field": "schedule", "message": "schedule must contain at least 1 items" }
    ]
  }
}
```

**Failure — `401 Unauthorized`** (guest) — `AUTH_HEADER_MISSING` etc., as in §8.6.

**Failure — `403 Forbidden`** (seeker token):

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

### 10.4 List gigs — `GET /api/gigs`

Public — no `Authorization` header required. With no parameters: `status: 'open'` gigs, newest first (`createdAt` descending), ten per page — unchanged from Sprint 1. `page`, plus the search, filter and sort parameters below, narrow and reorder that same base set.

**Request:** `?page=<n>` — optional, defaults to `1`. Malformed or missing values fall back to `1`.

**Search, filter and sort parameters.** All are optional.

| Parameter | Type | Matches |
|---|---|---|
| `q` | string, max 200 characters | Case-insensitive substring, against `title` **or** `description`. Not full-text, not fuzzy, not ranked. |
| `category` | one or more of §6.1 | A gig whose `category` is any of the given values. |
| `schedule` | one or more of §6.3 | A gig whose `schedule` array contains any of the given tags. |
| `payType` | one or more of §6.2 | A gig whose `payType` is any of the given values. |
| `commitment` | one or more of §6.4 | A gig whose `commitment` is any of the given values. |
| `remote` | boolean (`true` / `false`) | Exact match. |
| `city` | string, max 120 characters | Case-insensitive **exact** match — not a substring. |
| `minPay` | number, `>= 0` | `payAmount >= minPay`. See the limitation below. |
| `sort` | one of §6.6 | Reorders the result; see below. Defaults to `newest`. |

**Combination rules:** every parameter ANDs with every other — a gig must satisfy `q` **and** `category` **and** `remote`, etc., all at once. Within `category`, `schedule`, `payType` and `commitment`, multiple values OR — a gig matching *any one* of the values given for that parameter satisfies it. `status: 'open'` is applied unconditionally underneath all of this; no combination of parameters can surface a `closed`, `filled` or `draft` gig.

**Multi-value wire format:** `category`, `schedule`, `payType` and `commitment` each take a **comma-separated** list of values from their closed vocabulary — e.g. `?category=tech,creative`. A single value needs no comma. This is the one shape both this endpoint and its client (GL-216) build to; repeated keys (`category=tech&category=creative`) are not accepted.

An item outside the vocabulary fails the whole request with `400 VALIDATION_ERROR` naming that field — it is never dropped silently, which would otherwise be indistinguishable from "no gigs match". Empty items from a stray comma (`?category=tech,`) are ignored; an entirely empty value (`?category=` or `?category=,`) still 400s, since it names no value at all.

**`minPay`'s known limitation:** it compares the raw `payAmount` regardless of `payType`, so `minPay=1000` matches a Rs 1,000-per-hour gig and a Rs 1,000 fixed-price gig identically. This is deliberate, not an oversight — normalising per-hour against fixed-price would require an assumed number of hours that a gig does not carry. Do not "fix" this into a guessed conversion.

**`sort` — one of `newest` (default), `highest_pay`, `starting_soon`:**

| Value | Orders by | Tiebreak |
|---|---|---|
| `newest` | `createdAt` descending | `_id` descending |
| `highest_pay` | `payAmount` descending | `_id` descending |
| `starting_soon` | `startDate` ascending, gigs with **no** `startDate` sorted last | `_id` ascending |

Every sort carries a secondary `_id` tiebreak in the same direction as the primary key, so a paginated scroll never repeats or drops a row between pages. `startDate` is optional; without the explicit "no date sorts last" rule, `starting_soon` would put every undated gig first, since Mongo orders a missing field before every value ascending.

**Failure — `400 Bad Request`** (an unrecognised value on a closed-vocabulary parameter):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [
      { "field": "category", "message": "category must only contain: tutoring, delivery, event_help, retail, hospitality, admin_data_entry, creative, tech, other" }
    ]
  }
}
```

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "gigs": [ /* gig shapes, 10.1, newest first */ ],
    "total": 23,
    "page": 1,
    "limit": 10
  }
}
```

`total` is the count of every `open` gig matching the request's filters, not just the page returned — computed after filtering, so the number on screen and the list always agree. The client uses it to render "23 gigs" or to compute the last page. A closed, filled or draft gig never appears here, even to the business that posted it, and no parameter can change that.

`gigs`, `page` and `limit` (`10`) are unchanged in shape from Sprint 1. `sort`, `page` and every filter compose freely — pagination and sorting are always applied on top of the filtered set, never the other way round.

No failure modes beyond the `400` above — an empty result set is still `200` with `"gigs": []`.

### 10.5 Read a gig — `GET /api/gigs/:id`

Public — no `Authorization` header required, and none of the behaviour below changes that. Returns one gig **at any status** to anyone, so a link to a since-closed gig still resolves.

An `Authorization` header is read if present (optional authentication), purely to compute `viewerApplication`. A missing header, a malformed one, or an expired or invalid token all fall through to exactly the same response a guest gets — this endpoint never 401s.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "gig": { /* 10.1 */ },
    "business": { /* 10.2 */ },
    "viewerApplication": { "id": "...", "status": "shortlisted" }
  }
}
```

`viewerApplication` is `{ id, status }` for a signed-in seeker who has an application against this gig, **at any status** — applied, viewed, shortlisted, hired, completed, rejected or withdrawn all carry it. It is `null` in every other case: a guest, a signed-in business, or a signed-in seeker who has never applied to this gig. A seeker whose access token has expired is treated as a guest here and also gets `null`. Nothing beyond `id` and `status` is included — the profile snapshot, the rejection reason and every timestamp live on `GET /api/applications/:id` (§11.9), not here.

**Failure — `404 Not Found`** (no gig with that id, or the id isn't a valid Mongo id — both answer identically):

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Gig not found."
  }
}
```

### 10.6 My gigs — `GET /api/gigs/mine`

Businesses only. Returns the signed-in business's own gigs **at every status**, not just `open` — this is the one place a business sees its `closed` and `filled` postings.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "gigs": [ /* gig shapes, 10.1, newest first, every status, includes applicantCount */ ]
  }
}
```

Unlike 10.4, there is no pagination or `total` here — a business's own list is expected to be small enough to return in full.

**Failure — `401 Unauthorized`, `403 Forbidden`** — as in 10.3.

### 10.7 Update a gig — `PUT /api/gigs/:id`

Only the business that posted the gig may update it. `PUT` replaces the editable fields in full, using the same request body and validation as 10.3 create.

**Success — `200 OK`** — `data.gig`, the updated shape.

**Failure — `400 Bad Request`** — same validation as create.

**Failure — `401 Unauthorized`** (guest), **`403 Forbidden`** (seeker token, or a business token that isn't the owner) — see 10.9 for the ownership ordering.

**Failure — `404 Not Found`** — no gig with that id.

### 10.8 Close a gig — `PATCH /api/gigs/:id/close`

Only the owner. Sets `status` to `closed`. No request body.

Closing is not deleting: the gig disappears from `GET /api/gigs` immediately, but stays visible through `GET /api/gigs/mine` and `GET /api/gigs/:id`, and everyone who already applied is untouched.

**Success — `200 OK`** — `data.gig`, with `status: "closed"`.

**Failure — `401`, `403`, `404`** — same as 10.7.

### 10.9 Delete a gig — `DELETE /api/gigs/:id`

Only the owner. Permanently deletes the gig. There is no soft delete and no undo — a deleted gig immediately 404s from every other endpoint, including `GET /api/gigs/mine`.

**Success — `200 OK`**

```json
{ "success": true, "data": null }
```

**Failure — `401`, `403`, `404`** — same as 10.7.

**Ownership check order (10.7–10.9):** the owner check runs **after** the existence check. A gig that doesn't exist (or has a malformed id) is `404`, before the caller's identity is even considered; a gig that exists but belongs to someone else is `403`. The two are never conflated into a single `403`-or-`404` — doing that would let a caller learn which ids exist by noticing which refusal they got instead.

### 10.10 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Body failed create/update validation (§10.3). Always carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` / `AUTH_HEADER_MALFORMED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` | No/malformed/expired/invalid token on a route that requires one. Never returned by `GET /api/gigs` or `GET /api/gigs/:id` — both are public. |
| `403` | `FORBIDDEN` | Authenticated but not a business (`POST`, `GET /mine`, `PUT`, `PATCH .../close`, `DELETE`), **or** a business token that isn't the gig's owner (`PUT`, `PATCH .../close`, `DELETE`). Same code, same shape, both cases — the distinction is which endpoint and whether the gig exists (see 10.9's ordering). |
| `404` | `NOT_FOUND` | `GET /api/gigs/:id` for a gig that doesn't exist, or `PUT` / `PATCH .../close` / `DELETE` for a gig that doesn't exist or has a malformed id — checked before ownership. |
| `409` | `GIG_CLOSED` | **Not returned by any endpoint in this section.** None of the seven gig endpoints reject on gig status. `GIG_CLOSED` is the guard (`assertGigIsOpen` in `gig.service.js`) that GL-110's apply endpoint and Sprint 2's save endpoint call before acting on a gig — documented here because it is this component's error code, first surfaced through theirs. See §3 for the shared definition. |

---

## 11. Application model & status transitions (Sprint 1)

`server/src/models/application.model.js`, `server/src/services/application.service.js`, `server/src/routes/application.routes.js`, `server/src/controllers/application.controller.js`, `server/src/validators/application.validator.js`. The four endpoints (§11.6–§11.9) are GL-110; the shape and transition rules below are also what GL-111's review gate and GL-124's tracker are built against. Sprint 2's business-side endpoints (§11.12–§11.17, GL-219) reuse this same shape and the same `transitionApplicationStatus` — GL-252 built the two lists, GL-253 the four transitions, GL-254 (this section) documents both. §11.12 also touches `server/src/routes/gig.routes.js`, the one endpoint in this section nested under a gig rather than declared here.

### 11.1 Application shape

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d9",
  "gig": "64f1a2b3c4d5e6f7a8b9c0d8",
  "applicant": "64f1a2b3c4d5e6f7a8b9c0d1",
  "profileSnapshot": {
    "name": "Nimal Perera",
    "headline": "Second-year student, free weekday evenings and weekends.",
    "experience": [
      {
        "roleTitle": "Barista",
        "employer": "Cafe Kandy",
        "startDate": "2025-06-01",
        "endDate": "2025-12-31",
        "ongoing": false,
        "description": "Weekend shifts making coffee and handling the till."
      }
    ],
    "education": [
      {
        "institution": "University of Colombo",
        "qualification": "BSc Computer Science",
        "startDate": "2024-01-15",
        "endDate": "2027-12-01"
      }
    ],
    "rating": { "averageRating": 4.6, "reviewCount": 12, "topCategories": ["communication"], "distribution": { "1": 0, "2": 0, "3": 1, "4": 3, "5": 8 } }
  },
  "status": "applied",
  "appliedAt": "2026-08-04T09:15:00.000Z",
  "viewedAt": null,
  "decidedAt": null,
  "completedAt": null,
  "createdAt": "2026-08-04T09:15:00.000Z",
  "updatedAt": "2026-08-04T09:15:00.000Z"
}
```

- `gig`, `applicant` — reference ids. `gig` is indexed, `applicant` is indexed, and the pair is uniquely indexed together: one application per seeker per gig, permanently. Withdrawing does not free the slot — a withdrawn application still occupies that unique pair.
- `profileSnapshot` — an embedded copy of the applicant's profile (`name`, `headline` from the profile's `bio`, `experience` from `workExperience`, `education`, `rating` from `ratingSummary`), taken once at submission. Not a reference: a later edit to the applicant's live profile (§8) never changes an existing application. What was submitted is what gets judged.
- `status` — one of the eight values in §11.2. Defaults to `applied` and is never accepted from a request body; see §11.3 for how it changes.
- `appliedAt` — set once, at creation.
- `viewedAt`, `decidedAt`, `completedAt` — `null` until set by a transition (§11.3), never cleared or overwritten afterwards. Present as `null` rather than omitted, unlike the optional-field convention elsewhere in this document (§8.1) — these are always-present timestamps that happen to start empty, not optional data.
- `completedAt` — the moment the business marked the work finished, set the first time `completed` is reached. Separate from `decidedAt`, which is already occupied by the hire and guarded against being overwritten: one application carries both, and they are different moments.
- `rejectionReasonCode`, `rejectionNote` — absent until the application is rejected. `rejectionReasonCode` is one of §11.4's codes. `rejectionNote` is free text up to 300 characters, stored exactly as written, shown to the applicant verbatim.

### 11.2 Status vocabulary

The eight values are §6.7. **Reachability is governed by the transition table in §11.3 and by nothing else** — a status can be moved out of exactly when §11.3 gives it an outgoing row.

Four of the eight have no outgoing row and end the line: `completed`, `rejected`, `withdrawn` and `closed_filled` can never be reopened by any transition, by anyone, including the system. `hired` has exactly one outgoing move, to `completed` — a hire is a decision, but the work still has to be finished. The remaining three — `applied`, `viewed`, `shortlisted` — are the ones still in progress.

Separately from reachability, five statuses are **decided** — `hired`, `completed`, `rejected`, `withdrawn` and `closed_filled` — meaning a decision has been made about the application. That is the set that stamps `decidedAt` (§11.3), and the only thing that set does. `hired` remains in it now that it has an outgoing move: dropping it would stop `decidedAt` being stamped at the moment of hire.

"Live" applications are `applied`, `viewed`, `shortlisted`, `hired` and `completed` — the five that count toward a gig's `applicantCount` (§10.1, §11.5). `rejected`, `withdrawn` and `closed_filled` are not live. Finishing the work is not leaving the process, which is why `completed` is live.

### 11.3 Status transitions

`transitionApplicationStatus(application, targetStatus, actor, reason)` in `application.service.js` is the **only** code path allowed to change `status`. `actor` is `{ id, role }` for an HTTP-authenticated caller, or absent for a system-triggered call (Sprint 2/3 auto-close logic calling the function directly, never via a request). `reason` is `{ code, note }`, inspected only when rejecting.

| From | To | Actor allowed |
|---|---|---|
| `applied` | `viewed` | The business that posted the gig |
| `applied` | `rejected` | The business that posted the gig, with a reason code (§11.4) |
| `applied` | `withdrawn` | The applicant |
| `applied` | `closed_filled` | System only |
| `viewed` | `shortlisted` | The business that posted the gig |
| `viewed` | `rejected` | The business that posted the gig, with a reason code (§11.4) |
| `viewed` | `withdrawn` | The applicant |
| `viewed` | `closed_filled` | System only |
| `shortlisted` | `hired` | The business that posted the gig |
| `shortlisted` | `rejected` | The business that posted the gig, with a reason code (§11.4) |
| `shortlisted` | `withdrawn` | The applicant |
| `hired` | `completed` | The business that posted the gig |

`hired -> completed` is the **only** outgoing move Hired has, and the only way into `completed`. Hiring still requires shortlisting first: `applied -> hired` and `viewed -> hired` are absent from this table and stay refused, so the chain a seeker sees in the tracker is real.

Every move not in this table — including any move out of a status that has no outgoing row, and any move backwards (a `shortlisted` application can never return to `viewed`) — is rejected with `409 INVALID_APPLICATION_TRANSITION`, naming the current and attempted status.

"The business that posted the gig" is checked by ownership, not just role: a business token belonging to a different business gets `403 FORBIDDEN`, the same as a seeker token. "The applicant" is checked the same way: a seeker token that isn't the one who submitted the application gets `403 FORBIDDEN`. "System only" means no HTTP-authenticated actor at all — a request from a business (or anyone else) attempting `closed_filled` gets `403 FORBIDDEN`; only an internal call with no `actor` succeeds.

`viewedAt` is set the first time `viewed` is reached and never cleared or overwritten by any later transition. `decidedAt` is set the first time any **decided** status (§11.2) is reached and never changes afterwards — on a hired application that is the moment of hire, and completing it later does not move it. `completedAt` is set the first time `completed` is reached and is likewise never overwritten; completion needs a stamp of its own precisely because `decidedAt` is already occupied by the hire.

Marking an application complete takes **no reason** — `reason` is inspected only when rejecting.

### 11.4 Rejection reason codes

§6.8 lists the eight codes: seven business-selectable, plus `positions_filled` which is system-only. Rejecting (any `-> rejected` move in §11.3) requires `reason.code`:

- Missing entirely — `400 VALIDATION_ERROR`.
- `positions_filled`, or any code outside the eight — `400 VALIDATION_ERROR`. A business can never select the system-only code through a rejection.
- `skill_trial_not_passed` or `skill_trial_not_attempted` while the gig did not carry a skill trial — `400 VALIDATION_ERROR`. Skill Trials arrive in Sprint 3; until a gig can carry one, these two codes are always refused.

`reason.note`, when supplied, is stored on `rejectionNote` exactly as given (§11.1).

### 11.5 Applicant count

A gig's `applicantCount` (§10.1) is maintained by this component, not by the marketplace — GL-158 declares the field and defaults it to zero, and never writes it. `adjustGigApplicantCount(gigId, delta)` in `application.service.js` is the only code that changes it:

- `+1` when an application is created (`applied` is a live status) — called by GL-110's apply endpoint.
- `-1` the moment an application leaves the live set for `rejected`, `withdrawn` or `closed_filled` — called automatically by `transitionApplicationStatus` in the same operation as the status change, never as a separate call a client can forget to make.

The live set is `applied`, `viewed`, `shortlisted`, `hired` and `completed` (§11.2). A move that stays within it (`applied -> viewed`, `viewed -> shortlisted`, `shortlisted -> hired`, `hired -> completed`) never touches the count. `completed` is deliberately in the set: a count that falls the moment the work is finished reads as a bug, and the count should only fall when someone leaves the process.

### 11.6 Gig summary shape

Returned under `data.applications[].gig` (§11.7) and `data.application.gig` (§11.8, §11.9) — never the full gig (§10.1), just enough to recognise which posting an application belongs to. Sprint 2's `data.applications[].gig` on §11.13 (for-my-gigs) uses the same shape; §11.12 (a single gig's applications) omits it, since the caller already supplied the gig id.

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d8",
  "title": "Weekend event helper",
  "payAmount": 2500,
  "payType": "per_day",
  "city": "Colombo",
  "status": "open"
}
```

`null` if the gig no longer exists — `DELETE /api/gigs/:id` (§10.9) has no cascade to applications, so an orphaned application reads back with `gig: null` rather than the request failing. **Not present** on the apply response (§11.7): the caller already knows which gig they just applied to, and `application.gig` there is still the bare reference id from §11.1.

### 11.7 Apply to a gig — `POST /api/gigs/:gigId/applications`

Seekers only. A business token gets `403`, a guest gets `401`.

**Request body:** none. `status` and `appliedAt` are never accepted from the client — sending them (or anything else) has no effect, since the validator strips every field.

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "application": { /* 11.1, gig is the bare reference id */ },
    "profileIncomplete": true
  }
}
```

`profileIncomplete` is `true` when the applicant's profile has no `workExperience` and no `education` entries at the time of applying. It never blocks the application — an empty profile is valid, deciding someone isn't ready is the business's job, not the app's — the client uses this flag to warn the seeker beforehand, not after.

**Failure — `401 Unauthorized`** (guest) — `AUTH_HEADER_MISSING` etc., as in §8.6.

**Failure — `403 Forbidden`** (business token) — `FORBIDDEN`, as in §10.3.

**Failure — `404 Not Found`** (no gig with that id, or a malformed id):

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Gig not found." } }
```

**Failure — `409 Conflict`** (the gig exists but isn't `open`):

```json
{ "success": false, "error": { "code": "GIG_CLOSED", "message": "This gig is no longer open." } }
```

**Failure — `409 Conflict`** (a second application to the same gig — the unique `(gig, applicant)` index from §11.1 enforces this; the duplicate-key error is translated here, never a `500`. Holds whether the earlier application is live, withdrawn or rejected):

```json
{
  "success": false,
  "error": { "code": "APPLICATION_ALREADY_EXISTS", "message": "You have already applied to this gig." }
}
```

### 11.8 List my applications — `GET /api/applications/mine`

Seekers only — a business doesn't submit applications, it receives them. Requires `Authorization: Bearer <accessToken>`.

**Request body:** none.

**Success — `200 OK`** — the signed-in seeker's own applications, newest first (`createdAt` descending), each with a gig summary (§11.6). No pagination — like `GET /api/gigs/mine` (§10.6), a seeker's own application list is expected to stay small enough to return in full.

```json
{
  "success": true,
  "data": {
    "applications": [
      { /* 11.1, gig replaced with the §11.6 summary */ }
    ]
  }
}
```

An empty list is still `200` with `"applications": []`, not `404`. This endpoint never returns another seeker's application under any parameter — it is scoped to the caller's own id, with no id accepted from the request.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** (business token) — `FORBIDDEN`, as in §10.3.

### 11.9 Read an application — `GET /api/applications/:id`

Returns one application to the seeker who owns it or the business that posted the gig it belongs to. Requires `Authorization: Bearer <accessToken>`; either role may call it, so there's no role restriction beyond being a party to this specific application — the same shape of check as reviews (§12.1).

**Request body:** none.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "application": { /* 11.1, gig replaced with the §11.6 summary */ }
  }
}
```

The full application is returned, including the decision once made — `status`, `rejectionReasonCode` and `rejectionNote` (§11.1) shown exactly as the business wrote it, no softening, no truncation, no paraphrase.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `404 Not Found`** (no application with that id, or the id isn't a valid Mongo id — both answer identically, checked **before** the party check below):

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Application not found." } }
```

**Failure — `403 Forbidden`** (signed in, but neither the applicant nor the business that posted the gig):

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." }
}
```

No endpoint in this story reveals the identity of any other applicant to a seeker, or any application belonging to a gig the caller does not own — this endpoint only ever resolves the single id given, gated by the party check above.

### 11.10 Withdraw an application — `PATCH /api/applications/:id/withdraw`

Only the applicant may call it, and only while the application is `applied`, `viewed` or `shortlisted` (§11.3). Moves the application to `withdrawn` **through `transitionApplicationStatus`** (§11.3) — no route, controller or service here writes `status` directly.

**Request body:** none.

**Success — `200 OK`** — same shape as §11.9, with `status: "withdrawn"` and `decidedAt` now set. Withdrawing decrements the gig's live applicant count (§11.5) in the same operation as the status change. The application is never deleted or hidden: it **remains visible to the business** exactly where it was, just with the new status — so nobody is left waiting on somebody who has already left.

Combined with the permanent unique index (§11.1), withdrawal is one-way: the seeker cannot re-apply to that gig afterwards — a second `POST` to §11.7 for the same gig returns `409 APPLICATION_ALREADY_EXISTS`, the same as any other duplicate.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** (a business token, or a seeker token that isn't the applicant) — `FORBIDDEN`, as in §11.9.

**Failure — `404 Not Found`** (no application with that id, or a malformed id) — as in §11.9.

**Failure — `409 Conflict`** (the application is `hired`, or already terminal — `rejected`, `withdrawn` or `closed_filled`). Hiring is terminal: a `hired` application has no outgoing move in §11.3's table, so it's refused the same way any other terminal status is, not by a withdraw-specific check:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_APPLICATION_TRANSITION",
    "message": "Cannot move an application from \"hired\" to \"withdrawn\"."
  }
}
```

### 11.11 Mark an application complete — `PATCH /api/applications/:id/complete`

**The business that posted the gig marks the work finished, and nobody else.** Only from `hired` (§11.3). Moves the application to `completed` **through `transitionApplicationStatus`** (§11.3) — no route, controller or service here writes `status` directly, and there is no second path that does, not even for testing.

**Request body:** none. Completion takes no reason (§11.3) — a body sent with the request is ignored, not stored.

**Success — `200 OK`** — same shape as §11.9, with `status: "completed"` and `completedAt` now set. `decidedAt` keeps the moment of hire and does not move (§11.3). The gig's applicant count is **unchanged**: `completed` is a live status (§11.2, §11.5), because finishing the work is not leaving the process.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** — `FORBIDDEN`. A seeker token, **including the applicant's own**, and a business token belonging to a business that did not post the gig. Ownership is checked exactly as every other business transition checks it (§11.3), not by role alone.

**Failure — `404 Not Found`** (no application with that id, or a malformed id) — as in §11.9.

**Failure — `409 Conflict`** (the application is at any status other than `hired`):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_APPLICATION_TRANSITION",
    "message": "Cannot move an application from \"shortlisted\" to \"completed\"."
  }
}
```

Calling it twice returns this same `409` the second time, naming `completed` as the current status — `completed` has no outgoing row in §11.3, and `completedAt` is not moved by the refused call.

**A known limitation, recorded rather than solved.** Because only the business can mark completion, a business that never marks it leaves both sides unable to review once GL-223 moves the review gate to `completed`. Nobody gains an advantage — each loses their review — but the seeker is the one who did the work. Accepted for Sprint 2 and carried in `ROADMAP.md`; disputes are the Sprint 4 admin story.

### 11.12 List applications for a gig — `GET /api/gigs/:gigId/applications`

Only the business that posted the gig (GL-252). Nested under the gig it belongs to — declared in `server/src/routes/gig.routes.js`, not `application.routes.js`, unlike every other endpoint in this section.

**Request query — optional `status`** — one or more values from §6.7, as repeated params (`status=viewed&status=shortlisted`) or a comma-separated list (`status=viewed,shortlisted`). An unrecognised value is `400 VALIDATION_ERROR`. Omitted entirely, applications at every status are returned.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "applications": [
      { /* §11.1, no `gig` field — the caller already knows which gig this is */ }
    ]
  }
}
```

Every application to this gig, newest first (`createdAt` descending, `_id` descending tiebreak). Each row is the full §11.1 shape — `profileSnapshot`, `status`, `appliedAt`, `viewedAt`, `decidedAt`, and the rejection reason/note once decided — **never the applicant's live profile**: an application records what was true when it was submitted.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `404 Not Found`** (the gig doesn't exist, or the id is malformed) — checked **before** ownership, matching `findOwnedGig` (§10.9):

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Gig not found." } }
```

**Failure — `403 Forbidden`** (a seeker token, or a business token belonging to a different business):

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." }
}
```

Existence is always checked first, so a non-owning business gets the same `403` whether the gig belongs to someone else or the caller mistyped an id that exists — the ordering, not the response body, is what stops a refusal being used to probe which gig ids exist.

**Failure — `400 Bad Request`** (an unrecognised `status` value):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "status", "message": "\"unknown\" is not a valid application status" }]
  }
}
```

### 11.13 List applications across my gigs — `GET /api/applications/for-my-gigs`

Business only (GL-252). Every application across every gig the caller has posted, in one list — the unfiltered source GL-220's Applicants tab and GL-223's business-side completed list both read from.

**Request query — optional `status`** — same rules as §11.12.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "applications": [
      { /* §11.1, `gig` replaced with the §11.6 summary so the caller can tell which posting each row belongs to */ }
    ]
  }
}
```

Newest first (`createdAt` descending, `_id` descending tiebreak). Found by the caller's own gigs (`postedBy`), then applications by gig `$in` — a business id is never stored on the application itself, so the two can't fall out of step. No pagination, matching `GET /api/gigs/mine` (§10.6) and `GET /api/applications/mine` (§11.8): a business's own applicant list is expected to return in full.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** (a seeker token) — as in §11.12.

**Failure — `400 Bad Request`** (an unrecognised `status` value) — as in §11.12.

### 11.14 View an application — `PATCH /api/applications/:id/view`

Only the business that posted the gig (GL-253). Moves the application from `applied` to `viewed` (§11.3), **through `transitionApplicationStatus`** — no route, controller or service here writes `status` directly.

**Request body:** none.

**Success — `200 OK`** — same shape as §11.9, with `status: "viewed"` and `viewedAt` now set.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** (a seeker token, or a business token belonging to a different business) — `FORBIDDEN`, as in §11.9.

**Failure — `404 Not Found`** (no application with that id, or a malformed id) — as in §11.9.

**Failure — `409 Conflict`** (the application isn't `applied` — most commonly already `viewed` or later):

```json
{
  "success": false,
  "error": {
    "code": "INVALID_APPLICATION_TRANSITION",
    "message": "Cannot move an application from \"viewed\" to \"viewed\"."
  }
}
```

GL-220 calls this every time a business opens an applicant, including a second time — **the client is expected to swallow this `409` quietly**; opening an applicant twice is not an error a business should ever see.

### 11.15 Shortlist an application — `PATCH /api/applications/:id/shortlist`

Only the business that posted the gig (GL-253). Moves the application from `viewed` to `shortlisted` (§11.3), through `transitionApplicationStatus`.

**Request body:** none.

**Success — `200 OK`** — same shape as §11.9, with `status: "shortlisted"`.

**Failure — `401`, `403`, `404`** — as in §11.14.

**Failure — `409 Conflict`** (the application isn't `viewed` — most commonly still `applied`, naming both statuses) — as in §11.14.

### 11.16 Hire an application — `PATCH /api/applications/:id/hire`

Only the business that posted the gig (GL-253). Moves the application from `shortlisted` to `hired` (§11.3), through `transitionApplicationStatus`. `applied -> hired` and `viewed -> hired` are both absent from §11.3's table and stay refused — hiring always requires shortlisting first.

**Request body:** none.

**Success — `200 OK`** — same shape as §11.9, with `status: "hired"` and `decidedAt` now set.

**Failure — `401`, `403`, `404`** — as in §11.14.

**Failure — `409 Conflict`** (the application isn't `shortlisted`) — as in §11.14.

### 11.17 Reject an application — `PATCH /api/applications/:id/reject`

Only the business that posted the gig (GL-253). Moves the application from `applied`, `viewed` or `shortlisted` to `rejected` (§11.3), through `transitionApplicationStatus`.

**Request body**

```json
{
  "reasonCode": "schedule_mismatch",
  "note": "We ended up needing someone for Tuesday mornings specifically."
}
```

| Field | Rule |
|---|---|
| `reasonCode` | Required. One of the seven business-selectable codes in §6.8; `positions_filled` and any value outside the eight are refused (§11.4). |
| `note` | Optional, up to 300 characters, stored on `rejectionNote` exactly as written — not trimmed, not sanitised (§11.1), since the applicant reads it verbatim. |

**Success — `200 OK`** — same shape as §11.9, with `status: "rejected"`, `decidedAt` now set, and `rejectionReasonCode`/`rejectionNote` (once given) present.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `403 Forbidden`** (a seeker token, or a business token belonging to a different business) — as in §11.9.

**Failure — `404 Not Found`** (no application with that id, or a malformed id) — as in §11.9.

**Failure — `409 Conflict`** (the application isn't `applied`, `viewed` or `shortlisted` — most commonly already `rejected`, `withdrawn` or `hired`) — as in §11.14.

**Failure — `400 Bad Request`** (any of the four rules in §11.4 — a missing `reasonCode`, `positions_filled` or a value outside the eight codes, or a Skill Trial code on a gig that carried no trial):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A rejection reason code is required.",
    "errors": [{ "field": "reasonCode", "message": "reasonCode is required when rejecting an application" }]
  }
}
```

### 11.18 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | §11.12/§11.13 for an unrecognised `status` filter value. §11.17 for a missing, non-selectable, unrecognised, or Skill-Trial-without-a-trial rejection reason code (§11.4). |
| `401` | `AUTH_HEADER_MISSING` / `AUTH_HEADER_MALFORMED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` | No/malformed/expired/invalid token — every endpoint in this section requires one. |
| `403` | `FORBIDDEN` | A business token on §11.7 or §11.8; a seeker or business token that isn't a party to the application on §11.9; a business token or the wrong seeker on §11.10; any seeker token, or a business that didn't post the gig, on §11.11, §11.12, §11.13, §11.14, §11.15, §11.16 or §11.17. |
| `404` | `NOT_FOUND` | §11.7 or §11.12 for a gig that doesn't exist or has a malformed id. §11.9/§11.10/§11.11/§11.14/§11.15/§11.16/§11.17 for an application that doesn't exist or has a malformed id, checked before the party/ownership check above. |
| `409` | `GIG_CLOSED` | §11.7 for a gig that exists but isn't `open`. |
| `409` | `APPLICATION_ALREADY_EXISTS` | §11.7 for a `(gig, applicant)` pair that already has an application, live, withdrawn or rejected. |
| `409` | `INVALID_APPLICATION_TRANSITION` | §11.10 for an application that isn't `applied`, `viewed` or `shortlisted`. §11.11 for an application that isn't `hired`. §11.14 for an application that isn't `applied`. §11.15 for an application that isn't `viewed`. §11.16 for an application that isn't `shortlisted`. §11.17 for an application that isn't `applied`, `viewed` or `shortlisted`. |

---

## 12. Review endpoints (Sprint 1)

`server/src/routes/review.routes.js`, `review.controller.js`, `review.validator.js`, `review.service.js`. A rating is only worth reading if the platform can prove the two people actually worked together — that's why creation takes an application id, not a user id, and why it's gated on that application having reached `completed` (§6.7). Hiring doesn't exist in the product until Sprint 2, so both endpoints below are verified against the hire seeded by `npm run seed` (`scripts/seed.js` prints its id).

### 12.1 Create a review — `POST /api/applications/:applicationId/reviews`

Either party to the application — the applicant or the business that posted the gig — reviewing the other. Requires `Authorization: Bearer <accessToken>`; either role may call it, so there's no role restriction beyond being a party to this specific application.

**Request body**

```json
{
  "rating": 5,
  "text": "Paid on time and communicated clearly throughout the gig.",
  "categories": ["fair_payment", "communication"]
}
```

| Field | Rule |
|---|---|
| `rating` | Required, a whole number 1–5. |
| `text` | Required, 20–1000 characters. Rejected if whitespace-only (trimmed before the length check, so an all-whitespace string fails the minimum). |
| `categories` | Optional array, defaults to `[]`. Each value must be a real category (§6.9) **and** match the derived direction — see the 400 example below. |

`direction`, `author` and `subject` are not accepted fields — if sent, they're silently stripped like any other field the schema doesn't recognize (§10.3's convention). All three are derived server-side:

- **Direction**: `seeker_to_business` if the caller is the applicant, `business_to_seeker` if the caller is the business that posted the gig.
- **Author**: the caller.
- **Subject**: the other party to the application.

**Success — `201 Created`** — `data.review`, the shape in §7.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `404 Not Found`** (no application with that id, or the id isn't a valid Mongo id — both answer identically):

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "Application not found." }
}
```

**Failure — `403 Forbidden`** (signed in, but neither the applicant nor the business that posted the gig). Checked after existence, so a missing application always 404s before a wrong party ever sees a 403:

```json
{
  "success": false,
  "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." }
}
```

**Failure — `409 Conflict`** (application exists, caller is a party, but its status isn't `completed`):

```json
{
  "success": false,
  "error": {
    "code": "APPLICATION_NOT_COMPLETED",
    "message": "A review requires a completed gig — this application has not reached Completed."
  }
}
```

**Failure — `400 Bad Request`** (a category from the other direction's set — a business rating a seeker on `fair_payment` instead of §6.9's youth worker set):

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "errors": [{ "field": "categories", "message": "\"fair_payment\" is not a valid category for this review" }]
  }
}
```

**Failure — `409 Conflict`** (a second review in the same direction on the same application — the unique index on `(application, direction)` from §7 enforces this; the duplicate-key error is translated here, never a `500`):

```json
{
  "success": false,
  "error": { "code": "REVIEW_ALREADY_EXISTS", "message": "You have already reviewed this application." }
}
```

### 12.2 Read reviews about a user — `GET /api/users/:userId/reviews`

The reviews written about `:userId`, newest first (`createdAt` descending), ten per page. Requires `Authorization: Bearer <accessToken>` — any signed-in caller, not just the two parties.

**Request:** `?page=<n>` — optional, defaults to `1`. Malformed or missing values fall back to `1`, the same as §10.4.

**Success — `200 OK`**

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "application": "64f1a2b3c4d5e6f7a8b9c0d3",
        "author": {
          "id": "64f1a2b3c4d5e6f7a8b9c0d1",
          "name": "Cafe Kandy",
          "photo": "https://cdn.giglanka.test/u/cafekandy.jpg"
        },
        "subject": "64f1a2b3c4d5e6f7a8b9c0d4",
        "direction": "business_to_seeker",
        "rating": 5,
        "categories": ["work_quality", "punctuality"],
        "text": "Reliable, on time every shift, great with customers.",
        "createdAt": "2026-08-12T09:15:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

`author` is populated from the author's current profile (§8) at read time, not a frozen copy — a display name change is reflected on every past review, not just new ones. `name`/`photo` come back `null` if the author has no profile yet, the same as §10.2's business block. `total` counts every review about this user, not just the page returned. This component never checks whether `:userId` belongs to a real, active user — a deactivated account's reviews are unaffected by deactivation (§8.5's privacy rules don't apply here). A well-formed id nobody has ever reviewed returns `200` with an empty page (see below), not `404`; only a syntactically invalid id 404s.

`categories`, `rating`, `text`, `createdAt` are exactly §7. There is no `updatedAt` — reviews are permanent, with no edit, delete or respond endpoint anywhere in this component.

**Failure — `401 Unauthorized`** (guest) — as in §8.6.

**Failure — `404 Not Found`** (`:userId` isn't a syntactically valid Mongo id):

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "User not found." }
}
```

No other failure modes — a well-formed id with no reviews is still `200` with `"reviews": []` and `"total": 0`.

### 12.3 Error codes for these endpoints

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | `rating`/`text` failed schema validation (§12.1), or `categories` contains a value from the wrong direction's set. Always carries `errors`. |
| `401` | `AUTH_HEADER_MISSING` / `AUTH_HEADER_MALFORMED` / `TOKEN_EXPIRED` / `TOKEN_INVALID` | No/malformed/expired/invalid token on either endpoint — both require one. |
| `403` | `FORBIDDEN` | `POST` by a signed-in user who is neither the applicant nor the business that posted the gig. Not returned by `GET` — any signed-in caller may read. |
| `404` | `NOT_FOUND` | `POST` for an application that doesn't exist or has a malformed id (checked before the 403 party check above). `GET` for a `:userId` that isn't a syntactically valid id. |
| `409` | `APPLICATION_NOT_COMPLETED` | `POST` where the application exists and the caller is a party to it, but its status isn't `completed`. |
| `409` | `REVIEW_ALREADY_EXISTS` | `POST` for an `(application, direction)` pair that already has a review. |

---

## 13. Adding a new endpoint later

1. Pick a plural, lowercase, hyphenated resource name.
2. Reuse the envelopes in sections 2 and 3 exactly — don't invent a new outer shape.
3. Reuse an existing error `code` if the failure matches one in the table in section 3; add a new row to that table if it genuinely doesn't.
4. Document the endpoint here (method, path, request body, success and failure examples) before implementing it.
