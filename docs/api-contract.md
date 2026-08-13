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

## 7. Review document shape

`server/src/models/review.model.js`. No endpoint reads or writes this yet — that's GL-111 — but the shape is fixed here so GL-115's components are built against something stable.

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

- `application` — the application this review came from. A review can only exist because that application reached `hired` (§6.7); it points at the application, not directly at a user.
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
    "topCategories": []
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
    "topCategories": []
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
    "topCategories": []
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
      "ratingSummary": { "averageRating": 0, "reviewCount": 0, "topCategories": [] },
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

## 10. Adding a new endpoint later

1. Pick a plural, lowercase, hyphenated resource name.
2. Reuse the envelopes in sections 2 and 3 exactly — don't invent a new outer shape.
3. Reuse an existing error `code` if the failure matches one in the table in section 3; add a new row to that table if it genuinely doesn't.
4. Document the endpoint here (method, path, request body, success and failure examples) before implementing it.
