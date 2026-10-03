This is where express code exists (Back-end)

## Setup

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (ask a teammate for the shared Atlas connection string — never commit this file).
2. Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_BUCKET_NAME` the same way — ask a teammate for the shared Supabase project credentials. The API fails loudly on startup if any of these three are missing, rather than only failing the first time something tries to upload a file.
3. `npm install`
4. `npm run dev`

## Testing

`npm test` runs the full Jest + Supertest suite once and exits — no watch mode, no `.env` required.

- Tests run against an in-memory MongoDB instance (`mongodb-memory-server`), spun up once for the whole run in `tests/setup.js`. They never connect to the shared Atlas cluster, so running the suite is always safe.
- `tests/setup.js` also clears every collection after each test, so tests don't leak state into one another and the suite passes regardless of run order.
- Test files live in `tests/integration/*.test.js`, one file per endpoint group (e.g. `auth.register.test.js`, `auth.login.test.js`, `auth.tokens.test.js`, `auth.rbac.test.js`).

**Adding a new test**

1. Add a `*.test.js` file under `tests/integration/` (or a new subfolder if it's a different area of the API).
2. Import the app with `import app from '../../src/app.js'` — never `server.js`. `server.js` calls `app.listen`, which leaves the process hanging after the suite finishes; Supertest binds its own ephemeral port from the `app` instance directly.
3. Drive the endpoint with `supertest`, e.g. `await request(app).post('/api/auth/login').send({ ... })`, and assert on `res.status` / `res.body`.
4. If the test needs a user that can't be created through the public API (e.g. an `admin`), create it directly with the Mongoose model (`User.create(...)`) — the same restriction applies in tests as in production, so this is the intended workaround, not a hack.
5. To simulate an expired token, sign one directly with `jsonwebtoken` using a negative `expiresIn` instead of waiting for a real token to expire (see `auth.tokens.test.js`).
6. Run `npm test` to confirm it passes, then check it also passes with `node --experimental-vm-modules node_modules/jest/bin/jest.js --randomize` if it depends on data another test might create, to make sure ordering isn't accidentally required.

## Deployment (production)

The API runs as a single Render web service, and the app's release builds point at it.

- **Render service**: the web service served at the URL below — find it at https://dashboard.render.com
- **Public URL**: https://gig-lanka-u1kg.onrender.com
- **Health check**: https://gig-lanka-u1kg.onrender.com/api/health
- **Branch deployed**: `dev-release`
- **Start command**: `npm start` (`node src/server.js`)

### How a deploy is triggered

Render auto-deploys on every push to `dev-release`, so merging `develop` into `dev-release` is the release. A deploy can also be started by hand from the service's **Manual Deploy** menu in the dashboard, and changing an environment variable redeploys automatically. After any deploy, check the health check URL answers `{"status":"ok", ...}`.

### Environment variables

Set these in the dashboard under **Environment** — never commit them, and never write their values in this file. "Required" means the server refuses to start (or cannot sign users in) without it.

| Variable                    | Required               | Purpose                                                                                                                                                            |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                  | Yes — `production`     | Switches the server out of development mode. Defaults to `development` if unset.                                                                                   |
| `PORT`                      | No                     | Render supplies this itself; leave it unset.                                                                                                                       |
| `MONGODB_URI`               | Yes                    | MongoDB Atlas connection string for the shared cluster. The database connection fails without it.                                                                  |
| `JWT_ACCESS_SECRET`         | Yes                    | Signs and verifies access tokens. Must differ from the refresh secret. Not checked at startup — if missing, sign-in and every protected call fail.                 |
| `JWT_REFRESH_SECRET`        | Yes                    | Signs and verifies refresh tokens. Same caveat as above.                                                                                                           |
| `JWT_ACCESS_EXPIRES_IN`     | No — defaults to `15m` | Lifetime of an access token.                                                                                                                                       |
| `JWT_REFRESH_EXPIRES_IN`    | No — defaults to `7d`  | Lifetime of a refresh token.                                                                                                                                       |
| `SUPABASE_URL`              | Yes                    | Supabase project URL, used for file storage. The server fails on startup without it.                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes                    | Supabase service-role key. Server-side only; it bypasses row-level security. Fails on startup without it.                                                          |
| `SUPABASE_BUCKET_NAME`      | Yes                    | Name of the storage bucket uploads go to. Fails on startup without it.                                                                                             |
| `EMAIL_TRANSPORT`           | Yes — `brevo`          | Anything other than `brevo`, including unset, selects the no-op transport, which reports success but sends no real mail.                                           |
| `EMAIL_FROM`                | Yes                    | The sender address on outgoing mail. It must be a sender verified in Brevo, or Brevo rejects the message.                                                          |
| `BREVO_API_KEY`             | Yes when using Brevo   | Brevo API key. The server fails on startup if `EMAIL_TRANSPORT=brevo` and this is missing.                                                                         |
| `PASSWORD_RESET_URL_BASE`   | Yes                    | Base of the link in password-reset emails: the production URL followed by `/reset-password`. If unset it falls back to a placeholder domain the team does not own. |

### Adding or changing an environment variable

In the dashboard, go to **Environment** in the left sidebar, add or edit the key/value pair, and save — Render redeploys automatically to apply it. Secrets are set through the dashboard only. The template for local development is `.env.example`.

### Cold starts

This is a free-tier instance, so it sleeps after a period without traffic. A first request to a sleeping instance took about **33 seconds** to answer (measured 2 October 2026, `GET /api/health`); once awake, requests answer in well under a second. This is expected, not a bug.

Before a demo, pre-warm the service and wait for it to answer:

```bash
curl https://gig-lanka-u1kg.onrender.com/api/health
```

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

| Code                    | Meaning                                                |
| ----------------------- | ------------------------------------------------------ |
| `AUTH_HEADER_MISSING`   | No `Authorization` header sent                         |
| `AUTH_HEADER_MALFORMED` | Header isn't `Bearer <token>`                          |
| `TOKEN_INVALID`         | Bad signature, malformed JWT, or user no longer exists |
| `TOKEN_EXPIRED`         | Token signature is valid but it has expired            |

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
