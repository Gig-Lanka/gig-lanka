This is where express code exists (Back-end)

## Setup

1. Copy `.env.example` to `.env` and fill in `MONGODB_URI` (ask a teammate for the shared Atlas connection string — never commit this file).
2. `npm install`
3. `npm run dev`

## Seeding test data

`npm run seed` creates one test user per role against the shared cluster. It is idempotent — an existing user (matched by email) is left untouched, so running it repeatedly never creates duplicates.

| Role     | Email                     | Password      |
|----------|----------------------------|--------------|
| seeker   | seeker@giglanka.test       | Password123! |
| business | business@giglanka.test     | Password123! |
| admin    | admin@giglanka.test        | Password123! |

These are dev/test-only credentials for the shared cluster, not real accounts. `admin` is only ever created this way or by direct database access — never through public registration.

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
import mongoose from "mongoose";

const exampleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      required: true,
    },
  },
  { timestamps: true }
);

export const Example = mongoose.model("Example", exampleSchema);
```
