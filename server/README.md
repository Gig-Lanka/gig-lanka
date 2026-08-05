This is where express code exists (Back-end)

## Setup

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (ask a teammate for the shared Atlas connection string — never commit this file).
2. `npm install`
3. `npm run dev`

## Deployed dev environment

The API is deployed from `dev-release` to Render, auto-deploying on every push.

- **Public URL**: https://gig-lanka.onrender.com
- **Dashboard**: https://dashboard.render.com/web/srv-d9olmnjl550s73etkmg0
- **Health check**: https://gig-lanka.onrender.com/api/health

### Adding an environment variable

In the dashboard, go to **Environment** in the left sidebar, add the key/value pair, and save — Render redeploys automatically to apply it. Never commit secrets to `.env`; they're set through the dashboard only.

### Cold starts

This is a free-tier instance, so it sleeps after periods of inactivity. The first request after a quiet period can take several seconds to respond while the instance spins back up — this is expected, not a bug.

## Seeding test data

`npm run seed` creates one test user per role against the shared cluster. It is idempotent — an existing user (matched by email) is left untouched, so running it repeatedly never creates duplicates.

| Role     | Email                  | Password     |
| -------- | ---------------------- | ------------ |
| seeker   | seeker@giglanka.test   | Password123! |
| business | business@giglanka.test | Password123! |
| admin    | admin@giglanka.test    | Password123! |

These are dev/test-only credentials for the shared cluster, not real accounts. `admin` is only ever created this way or by direct database access — never through public registration.

## Auth middleware — protecting a route

`requireAuth` and `requireRole` live in `src/middleware/auth.middleware.js`. `requireAuth` verifies the bearer token, loads the user from the database, and attaches it to `req.user`. `requireRole` is a factory that must run **after** `requireAuth` — it checks `req.user.role` against the roles you pass in.

- `requireAuth` alone → any authenticated user, any role.
- `requireAuth` + `requireRole("business")` → businesses only.
- `requireAuth` + `requireRole("business", "admin")` → either role.
- `requireRole` used without `requireAuth` first fails closed with `401 UNAUTHENTICATED` — it never trusts a missing `req.user`.

**Any authenticated user:**

```js
import { requireAuth } from '../middleware/auth.middleware.js';

router.get('/me', requireAuth, me);
```

**Business-only route:**

```js
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

router.post('/gigs', requireAuth, requireRole('business'), createGig);
```

**Admin-only route:**

```js
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

router.post('/businesses/:id/verify', requireAuth, requireRole('admin'), verifyBusiness);
```

**Error codes from `requireAuth`** (all `401`, distinct `code` so the client knows when to trigger a refresh vs. show a login screen):

| Code                  | Meaning                                      |
| --------------------- | --------------------------------------------- |
| `AUTH_HEADER_MISSING` | No `Authorization` header sent                |
| `AUTH_HEADER_MALFORMED` | Header isn't `Bearer <token>`               |
| `TOKEN_INVALID`       | Bad signature, malformed JWT, or user no longer exists |
| `TOKEN_EXPIRED`       | Token signature is valid but it has expired   |

`requireRole` responds `401 UNAUTHENTICATED` if reached with no `req.user`, and `403 FORBIDDEN` if the user's role isn't allowed.

## Schema conventions

Follow this pattern for every model added in Sprint 1 onward.

**Naming and location**

- One file per collection at `src/models/<entity>.model.js`, singular entity name (e.g. `gig.model.js`, not `gigs.model.js`).
- Export the compiled model as a named export matching the entity, e.g. `export const Gig = mongoose.model("Gig", gigSchema);`.

**Field conventions**

- Enable `timestamps: true` on every schema (adds `createdAt`/`updatedAt`) unless there's a specific reason not to.
- References between collections are `mongoose.Schema.Types.ObjectId` with a `ref`, never embedded copies — this keeps `.populate()` consistent across features.
- Enum fields (like `role`) use a fixed `enum` array, not a free string, so invalid values are rejected at the schema level.
- Never store secrets (passwords, tokens) in plaintext — only their hash, and only in fields explicitly named for it (e.g. `passwordHash`).

**Indexes**

- Declare indexes inline on the field, not in a separate `schema.index()` call, unless the index is compound or the options don't fit a single field (e.g. `unique: true` for a unique index, `expires: <seconds>` for a TTL index on a `Date` field).
- Any field that must be unique across the collection (e.g. `email`) needs `unique: true` in its schema definition.

**Sensitive data in responses**

- If a model holds sensitive fields (password hashes, internal flags), add a `toJSON` transform in the schema options that deletes them, plus `__v`, before the document is ever serialized. See `user.model.js` for the pattern.

**Example skeleton**

```js
import mongoose from 'mongoose';

const exampleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      required: true,
    },
  },
  { timestamps: true },
);

export const Example = mongoose.model('Example', exampleSchema);
```
