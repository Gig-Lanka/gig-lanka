# Gig Lanka — Feature Inventory

**What this is:** a code-level audit of everything that exists in the repo at the end of Sprint 1,
and the exact scope of each feature — what it does, what it deliberately does *not* do, and where
it lives. `ROADMAP.md` says what we plan to build; `docs/api-contract.md` says how endpoints must
behave; this file says **what is actually built right now**.

**Method:** read of every file under `app/src` and `server/src`, cross-checked against the API
contract and the roadmap. Server test suite executed (results in §9). Nothing here is inferred
from tickets — every claim points at code.

**As of:** 16 August 2026, end of Sprint 1 · branch `develop` @ `61ce592`

**Sprint 2 planning note, 17 August 2026:** the findings below were not re-audited — they are still
the state of the repo as of the audit. What has been added is a ticket key against each gap in §7
and each item in §8, so a reader can tell which of them Sprint 2 addresses, which moved to Sprint 3,
and which are still unowned. Sprint 2 is GL-209–GL-223; see `ROADMAP.md`.

**Re-checked at `f744049`, 18 August 2026.** GL-208 landed three commits after the audit commit,
touching 56 files under `app/src` and no server file. The only functional change is `headerShown:
false` on both tab navigators; the rest is a blanket em-dash-to-hyphen replacement across comments
and copy. **Every finding in §7 was re-verified against the new HEAD and all of them still hold**,
including the exact line references in §7.1 and §7.7. Two new items are recorded in §7.9.

**Status key**
✅ Built and reachable in the app · 🟡 Built but not reachable (no entry point / disabled) ·
🚧 Placeholder only · ⬜ Not started · 🔒 Deliberately out of scope

---

## 1. Snapshot

A two-half monorepo. The server implements 21 endpoints across auth, profiles, uploads, gigs,
applications and reviews. The app implements 24 screens across an auth stack, a seeker tab stack,
a business tab stack, and a shared modal/detail layer, plus a 21-component design-system kit.

| Half | Stack | Entry |
|---|---|---|
| `app/` | Expo 54, React Native 0.81, React 19, NativeWind 4 (Tailwind 3), React Navigation 7, axios, expo-secure-store, expo-image-picker | `app/App.js` → `src/navigation/RootNavigator.js` |
| `server/` | Node 22.17, Express 5, Mongoose 9 (MongoDB Atlas), Joi, jsonwebtoken, bcryptjs, multer, `@supabase/supabase-js` | `server/src/server.js` → `src/app.js` |
| CI | GitHub Actions, PRs into `develop`/`main`, lint + test per half | `.github/workflows/ci.yml` |
| Hooks | Husky pre-commit → lint-staged (per half) → eslint + prettier | `.husky/pre-commit` |
| Deploy | Server on Render (`https://gig-lanka.onrender.com`); app runs via Expo, no build pipeline yet | `app/.env.example` |

**Data model:** 6 collections — `User`, `RefreshToken`, `Profile`, `Gig`, `Application`, `Review`.
Files live in Supabase Storage; only the returned URL is stored in Mongo.

---

## 2. Sprint 1 plan vs. delivered

Every capability the roadmap put in Sprint 1 has code behind it. Two of them are not reachable
from the running app (details in §7).

| Epic | Capability (roadmap, Sprint 1) | Delivered |
|---|---|---|
| E1 | Shared kit extension — chips, badges, avatars, sheets, screen header | ✅ |
| E1 | Shared formatting utilities & domain enums | ✅ |
| E1 | Supabase storage & upload service | ✅ |
| E2 | Profile model & profile API | ✅ |
| E2 | My profile & edit profile, seeker and business | ✅ |
| E2 | Work experience & education management | ✅ |
| E2 | Profile photo upload | ✅ |
| E2 | Public profile view | ✅ |
| E3 | Gig model & gig API | ✅ |
| E3 | My gigs list | ✅ |
| E3 | Post a gig | ✅ |
| E3 | Edit & close a gig | ✅ (delete also shipped) |
| E3 | Browse gigs | ✅ (+ guest browsing, not planned for this sprint) |
| E3 | Gig detail | ✅ |
| E4 | Application model & status state machine | ✅ |
| E4 | Apply & withdraw API | ✅ |
| E4 | Apply screen | 🟡 built, no route into it |
| E4 | My applications & application detail with tracker | ✅ |
| E5 | Review model & rating aggregate schema | ✅ |
| E5 | Star rating & review components | ✅ (`ReviewCard` unused) |
| E5 | Rating summary block on profiles | ✅ (always empty — no aggregate writer yet) |
| E5 | Review submission API gated on a Hired application | ✅ |
| E5 | Rate business & rate worker screens | 🟡 built, no route into it (by design — see §7.2) |

**Scope delivered beyond the plan:** guest/unauthenticated browsing, gig delete, schedule-chip
filtering on Browse, and deadline urgency states on gig cards (roadmap placed urgency at Sprint 2).

---

## 3. Feature scope, epic by epic

### E1 · Platform & Foundations

| Feature | Status | Scope |
|---|---|---|
| Design tokens | ✅ | `app/tailwind.config.js` + `app/global.css`. Colours, radii, type scale and two font families (Schibsted Grotesk display, Inter Tight body) loaded in `App.js`. Tokens are the single source — screens never use raw hex. |
| UI kit | ✅ | 21 components in `app/src/components/ui/`: `AuthShell`, `Avatar`, `Badge`, `Brand`, `Button`, `Card`, `Chip`, `ConfirmDialog`, `DateField`, `Dropdown`, `EmptyState`, `HeroHeader` (+`HeroSheet`, `HeroStickyBar`), `Loader`, `Notice`, `ProgressPips`, `RoleStrip`, `Screen`, `ScreenHeader`, `SectionLabel`, `SegmentedControl`, `TextInput`. All are in real use; `ComponentDemoScreen` (787 lines) is a `__DEV__`-only gallery. |
| Formatting utilities | ✅ | `app/src/utils/format.js` — `formatPay`, `formatRelativeTime`, `formatDeadline` (returns `{label, urgent}`), `formatLocation`, `formatDateRange`, `formatShortDate`. `app/src/utils/validation.js` — form-level field validators. |
| Domain enums | ✅ | `app/src/constants/enums.js` — 10 frozen vocabularies matching contract §6. **Deliberately duplicated** on the server inside Joi validators and Mongoose enums rather than shared; the contract is the reconciliation point. |
| File upload service | ✅ | `POST /api/uploads`. `upload.middleware.js`: multer memory storage, 5 MB cap, PNG/JPG/PDF only, MIME **and** extension must agree (catches renamed files). `storage.service.js`: `storeFile` writes to a Supabase bucket under a random UUID key (never the client filename, never derived from a user id) and returns the public URL; `removeFile` deletes by URL or key. Storage failure → `502 STORAGE_UNAVAILABLE`, never a bare 500. `folder` is a closed list — `['avatars']` only. |
| Error/response envelopes | ✅ | `utils/response.js`, `utils/ApiError.js`, `middleware/errorHandler.js`, `middleware/notFound.js`. Every response, success or failure, uses the contract §2/§3 shape. |
| Transactional email | ⬜ | Sprint 3. |
| Sweep of empty/loading/error states | ⬜ | Sprint 4 — though most Sprint 1 screens already carry all three. |
| E2E tests, EAS release build | ⬜ | Sprint 4. |

### E2 · User & Profile Management

| Feature | Status | Scope |
|---|---|---|
| Registration & login | ✅ | `POST /api/auth/register`, `/login`. bcrypt (10 rounds). Duplicate email → `409 EMAIL_ALREADY_EXISTS` (translated from the unique index, never a 500). Login answers identically for unknown email and wrong password, so accounts can't be enumerated. Roles: `seeker`, `business`; `admin` is never creatable through the API. |
| Token lifecycle | ✅ | Access + refresh JWTs. Refresh tokens are persisted (`RefreshToken`, TTL-indexed on `expiresAt`) and **rotated** — refreshing deletes the old row and issues a new pair. Logout revokes. `TOKEN_EXPIRED` and `TOKEN_INVALID` are distinct codes. |
| RBAC | ✅ | `requireAuth` verifies the access token and **re-loads the user from the database**, so role checks never trust the token's claim. `requireRole(...roles)` fails closed. |
| Client session persistence | ✅ | `expo-secure-store` (`store/secureStorage.js`), `AuthContext` bootstraps through `/auth/me` on launch, `api/client.js` runs a single-flight refresh-and-retry interceptor with a queue for concurrent 401s, and calls `onSessionExpired` so a dead refresh token ends the session live rather than at next launch. |
| Auth screens | ✅ | `RoleSelectScreen` (+ "continue as guest"), `SignUpScreen`, `LoginScreen`. A returning signed-out user lands on Login, a fresh install on RoleSelect. |
| Profile model & API | ✅ | `Profile` is a **separate document** from `User` — credentials and role never enter a profile response. Created lazily on first read, named from the email's local part. `GET /profiles/me`, `PUT /profiles/me` (full replace — an omitted field is cleared), `GET /profiles/:userId` (public). Admin token → 403 on all three. |
| Public profile shape | ✅ | Built from an explicit **whitelist**, so a field added to the schema later stays private until deliberately published. Shared: name, photo, city, bio, ratingSummary. Seeker-only: skills, workExperience, education, skillTrialResults. Business-only: category. `PUT /profiles/:userId` exists **only to return 403** — editing is reachable through `/me` and nowhere else. |
| Role-field enforcement | ✅ | A seeker sending `category`, or a business sending `skills`/`workExperience`/`education`, gets a 400 naming the field rather than having it silently dropped. `ratingSummary`, `skillTrialResults`, `role`, `email` are rejected outright — they belong to other components. |
| Own profile screens | ✅ | `seeker/ProfileScreen`, `business/ProfileScreen` — hero header, rating summary block, role-appropriate sections, sign-out. Both refetch on focus. |
| Edit profile | ✅ | `shared/EditProfileScreen` — name, bio, city, skills (seeker) / category (business), plus the avatar. Sends fields it does not display (`photo`, `workExperience`, `education`) back untouched, because PUT replaces in full. |
| Work experience & education | ✅ | `ManageExperienceScreen` / `ExperienceFormScreen`, `ManageEducationScreen` / `EducationFormScreen` — add, edit, delete, sorted newest-first, each writing the full profile back with a `PASSTHROUGH_FIELDS` list so a PUT never clears a neighbouring section. |
| Profile photo | ✅ | `AvatarPicker` (expo-image-picker, client-side type/size checks) → `POST /api/uploads` → URL persisted via `PUT /profiles/me`. Replacing or removing a photo deletes the previous object from storage **after** the profile save succeeds, best-effort and logged, so a storage hiccup can never leave the profile pointing at nothing. |
| Public profile view | ✅ | `shared/PublicProfileScreen` — reached from a gig's business block. Loading / error / not-found states; renders seeker and business sections from the public shape. |
| Deactivation | ⬜ (guard pre-wired) | Sprint 3. `getPublicProfile` already refuses on `user.isActive === false` with the same 404 as "never existed". Whoever adds deactivation must keep that field name. |
| Account settings, change password, forgot/reset | ⬜ | Sprints 2–3. |
| Skill Trial badges | ⬜ | `skillTrialResults` exists on the schema and is published on public profiles; always empty until Sprint 3. |
| Business verification | 🔒 | Not in scope anywhere in the project. Trust is signalled by the rating summary only. |

### E3 · Gig & Job Marketplace

| Feature | Status | Scope |
|---|---|---|
| Gig model | ✅ | Closed vocabularies for category, pay type, schedule, commitment and status. `city` required unless `remote`. `applicationsCloseDate` cannot be in the past. `status` defaults to `open` and is never client-settable; `postedBy` always comes from the token. `applicantCount` is declared here but **owned and written by E4**. |
| `savedBy` privacy | ✅ (pre-emptive) | The field is declared for Sprint 2 saving, `select: false` keeps it out of every query, and the `toJSON` transform deletes it again. It cannot leak into a response — not even to the gig's owner — once saving starts writing to it. |
| Gig endpoints | ✅ | All seven: `POST /gigs`, `GET /gigs` (public, open-only, 10/page), `GET /gigs/:id` (public, any status, plus a business identity block), `GET /gigs/mine` (business, every status, unpaginated), `PUT /gigs/:id`, `PATCH /gigs/:id/close`, `DELETE /gigs/:id`. |
| Ownership ordering | ✅ | Existence is checked before ownership on update/close/delete — a missing or malformed id is 404 before the caller's identity is considered, so refusal codes can't be used to probe which ids exist. |
| Browse gigs | ✅ | `seeker/BrowseGigsScreen` — paginated infinite scroll with a single in-flight guard, pull-to-refresh, a separate inline retry for a failed "load more", result count, empty and error states. **Schedule chips filter client-side over already-loaded pages** — `GET /gigs` has no filter parameter this sprint, by design. |
| Gig detail | ✅ | `shared/GigDetailScreen` — collapsing hero, status badge, detail rows (category, schedule, commitment, location, start, positions, applicants so far), description, and a business block that routes to the public profile. Four primary-action states: owner → Edit; not open → "Applications closed" (disabled, never hidden); guest → sign-in; seeker → apply. |
| Guest browsing | ✅ | Unauthenticated users get Browse + Gig detail. The other two seeker tabs swap to a sign-in gate. Implemented as local state in `RootNavigator`, not a fourth auth status. |
| My gigs | ✅ | `business/MyGigsScreen` — status filter, per-card action row (Edit / Applicants / Close), refetch on focus, empty and error states. |
| Post & edit a gig | ✅ | `PostGigScreen`, `EditGigScreen` share `components/gig/GigForm.js` (400 lines) — every field in contract §10.3, client-side validation, field-level server errors mapped back onto inputs. Edit also carries close and delete with confirmation dialogs. |
| Deadline urgency | ✅ (early) | `formatDeadline` + `GigCard` render "Closes today / tomorrow / in N days" with an urgent treatment ≤ 3 days. Roadmap had this at Sprint 2. |
| Search, sort, category filter | ⬜ | Sprint 2. `GIG_SORT_ORDERS` is defined in enums but nothing consumes it. |
| Saved gigs | ⬜ | Sprint 2. Field declared, no endpoint. |
| `filled` / `draft` statuses | ⬜ | Both are in the vocabulary and render correctly if present, but **no code path produces them**. `filled` arrives with hiring (Sprint 3); nothing creates a draft. |

### E4 · Application & Hiring

| Feature | Status | Scope |
|---|---|---|
| Application model | ✅ | Unique compound index on `(gig, applicant)` — one application per seeker per gig, **permanently**; withdrawing does not free the slot. `viewedAt`/`decidedAt` are always-present timestamps that start `null`. |
| Frozen profile snapshot | ✅ | `profileSnapshot` embeds name, headline (from bio), experience, education and the rating aggregate at submission time. Not a reference — a later profile edit can never change what a business already judged. |
| Status state machine | ✅ | `transitionApplicationStatus()` in `application.service.js` is the **only** code allowed to write `status`. Transitions are a data table, not conditionals. Actor kinds: `business` (the gig's poster specifically, checked by ownership), `applicant` (that seeker specifically), `system` (no HTTP actor at all — an authenticated request attempting a system-only move gets 403). Terminal statuses have no outgoing entry, so nothing reopens them and status never moves backwards. |
| Rejection reason codes | ✅ (rules only) | Eight codes, seven business-selectable. Rejecting without a code, with the system-only `positions_filled`, or with a skill-trial code on a gig that carried no trial, all fail with 400. **No endpoint exposes rejection yet** — the rules are enforced for Sprint 2's caller. |
| Applicant count | ✅ | `adjustGigApplicantCount` is the single writer. `+1` on create, `-1` the moment an application leaves the live set, in the same operation as the status change. Moves within the live set never touch it. |
| Apply endpoint | ✅ | `POST /gigs/:gigId/applications`, seekers only, no accepted body. Returns the application plus `profileIncomplete` (no experience **and** no education) — a warning signal, never a block. Duplicate → 409 `APPLICATION_ALREADY_EXISTS` (translated from the index). Gig not open → 409 `GIG_CLOSED`. |
| Read endpoints | ✅ | `GET /applications/mine` (seeker, own only, no id parameter exists), `GET /applications/:id` (either party, existence checked before the party check). Each carries a gig summary — never the full gig — which reads back `null` for a deleted gig rather than failing. |
| Withdraw | ✅ | `PATCH /applications/:id/withdraw`, routed through the state machine like everything else. Withdrawing a `hired` application is refused by the transition table, not by a withdraw-specific check. The application stays visible to the business with its new status; it is never deleted or hidden. |
| Apply screen | 🟡 | `seeker/ApplyScreen` — snapshot preview of what the business will see, thin-profile notice with a route to Profile, double-submit guard, and distinct messages for `GIG_CLOSED`, `APPLICATION_ALREADY_EXISTS` and `FORBIDDEN`. On success it replaces into the application detail. **Nothing navigates to it** (§7.1). |
| My applications | ✅ | `seeker/MyApplicationsScreen` — live/decided filter, refetch on focus without flashing the loader, pull-to-refresh, two distinct empty states. |
| Application detail & tracker | ✅ | `seeker/ApplicationDetailScreen` — `ApplicationTracker` renders the transparency timeline; the rejection reason and note are shown **verbatim**, no softening or truncation. Withdraw sits behind a confirmation dialog and is offered only from `applied`/`viewed`/`shortlisted`. |
| Applicant list & detail (business side) | 🚧 | `business/ApplicantsScreen` is a 7-line placeholder, and `GigActionRow`'s "Applicants (n)" button is permanently disabled. Sprint 2. |
| Shortlist / hire / reject | ⬜ | Sprint 2. The rules exist; no endpoint reaches them. |
| Positions-filled auto-close | ⬜ | Sprint 2. `closed_filled` has a system-only transition rule and **no caller anywhere**. |
| Skill Trial, resume PDF | ⬜ | Sprint 3. |

**Reachable today:** of the eleven transitions in the table, only the three `→ withdrawn` moves have
an HTTP path. `viewed`, `shortlisted`, `hired`, `rejected` and `closed_filled` are reachable only by
`server/scripts/seed.js`, which drives a seeded application to `hired` so E5 has something to test.

### E5 · Community & Rating

| Feature | Status | Scope |
|---|---|---|
| Review model | ✅ | Unique index on `(application, direction)`. `author ≠ subject` enforced by a schema validator. `createdAt` only — **no `updatedAt`, no edit, no delete, no respond path anywhere**. Reviews are permanent; correcting one is a Sprint 4 dispute. |
| Rating aggregate schema | ✅ | `RATING_AGGREGATE_SHAPE` is exported from `review.model.js` and imported by `profile.model.js` and `application.model.js`, so the ownership boundary is expressed in code: Reviews owns the shape, Profile stores and displays it, neither computes the other's number. |
| Create review | ✅ | `POST /applications/:applicationId/reviews`. Gated in order: application exists (404) → caller is a party (403) → status is `hired` (409 `APPLICATION_NOT_HIRED`) → categories match the derived direction (400) → not a duplicate (409 `REVIEW_ALREADY_EXISTS`). `direction`, `author` and `subject` are all derived server-side and never accepted from the body. |
| Read reviews | ✅ (server only) | `GET /users/:userId/reviews`, paged 10/page, newest first, author name/photo populated **live from the profile** at read time — the opposite of the application's frozen snapshot, and deliberately so. **No client consumes it.** |
| Rating components | ✅ | `StarRating` (read + interactive), `CategoryChipGroup`, `RatingSummary`, `RatingBars`. `ReviewCard` is built and only referenced by the dev component gallery. |
| Rating summary on profiles | ✅ | Rendered on the seeker profile, business profile and public profile. Shows a "New to Gig Lanka" empty state whenever `reviewCount === 0` — which is **always**, since nothing computes the aggregate yet. Its "See all N reviews" button is intentionally disabled until Sprint 2's list screen. |
| Rate flow | 🟡 | `shared/rate/` — `RateFlowNavigator` + `RateFlowProvider` + four steps (subject & stars → categories → written review → confirmation). Direction and subject are derived once in the provider from the application and the signed-in user, so the seeker and business sides can never disagree. Submission has a double-submit guard and preserves the draft on failure. Progress pips, 20–1000 character validation, and a confirmation that pops the whole flow. **No in-app entry point** (§7.2). |
| Mark a hire complete | ⬜ | Sprint 2. This is the gate that would unlock reviewing from inside the app. |
| Aggregate computation | ⬜ | Sprint 2. Until then every `ratingSummary` in the database is `{0, 0, []}`. |
| Reviews list screen | ⬜ | Sprint 2. |
| Report / moderation | ⬜ | Sprint 3. |

### E6 · Admin & Moderation

| Feature | Status | Scope |
|---|---|---|
| Admin role | ✅ | Exists in the `User` enum and is honoured by `requireRole`. Admin accounts are never creatable through the API and have **no profile** — every profile endpoint 403s for them, and an admin's user id is never a valid public-profile target. |
| Admin screens & APIs | ⬜ | Sprint 4, split four ways. Nothing exists. |
| Leftover smoke-test route | ⚠️ | `GET /api/auth/admin-smoke-test` is still mounted from Sprint 0's GL-60. It leaks nothing (it returns a fixed string behind an admin-only gate) but it should be deleted. |

---

## 4. API surface

21 routes. Everything except the two public gig reads requires a bearer token.

| Method | Path | Auth | Status |
|---|---|---|---|
| GET | `/api/health` | — | ✅ |
| POST | `/api/auth/register` | — | ✅ |
| POST | `/api/auth/login` | — | ✅ |
| POST | `/api/auth/refresh` | — | ✅ |
| POST | `/api/auth/logout` | access token | ✅ |
| GET | `/api/auth/me` | access token | ✅ |
| GET | `/api/auth/admin-smoke-test` | admin | ⚠️ temporary, delete |
| GET | `/api/profiles/me` | seeker/business | ✅ |
| PUT | `/api/profiles/me` | seeker/business | ✅ |
| GET | `/api/profiles/:userId` | seeker/business | ✅ |
| PUT | `/api/profiles/:userId` | any | ✅ always 403, by design |
| POST | `/api/uploads` | any | ✅ `avatars` folder only |
| POST | `/api/gigs` | business | ✅ |
| GET | `/api/gigs` | **public** | ✅ open only, 10/page |
| GET | `/api/gigs/mine` | business | ✅ |
| GET | `/api/gigs/:id` | **public** | ✅ any status |
| PUT | `/api/gigs/:id` | owner | ✅ |
| PATCH | `/api/gigs/:id/close` | owner | ✅ |
| DELETE | `/api/gigs/:id` | owner | ✅ hard delete, no cascade |
| POST | `/api/gigs/:gigId/applications` | seeker | ✅ |
| GET | `/api/applications/mine` | seeker | ✅ |
| GET | `/api/applications/:id` | either party | ✅ |
| PATCH | `/api/applications/:id/withdraw` | applicant | ✅ |
| POST | `/api/applications/:applicationId/reviews` | either party | ✅ |
| GET | `/api/users/:userId/reviews` | any signed-in | ✅ server only — no client |

Not yet built, and now ticketed for Sprint 2: applicant list for a gig and applicant detail which
sets Viewed (GL-219, GL-220); shortlist / hire / reject (GL-219, GL-221); mark-complete and the
`completed` status (GL-218); gig search, filter and sort parameters (GL-215); `viewerApplication`
on gig detail, behind a new optional-auth middleware (GL-213, GL-217); the caller's own reviews
(GL-223); change password (GL-211); and rating aggregate recomputation (GL-222).

**Save/unsave a gig moved to Sprint 3** — `savedBy` stays declared and unwritten for another sprint.

---

## 5. App surface

| Route | Screen | Role | Status |
|---|---|---|---|
| `RoleSelect` | `auth/RoleSelectScreen` | guest | ✅ |
| `SignUp` | `auth/SignUpScreen` | guest | ✅ |
| `Login` | `auth/LoginScreen` | guest | ✅ |
| `Browse` (tab) | `seeker/BrowseGigsScreen` | seeker + guest | ✅ |
| `My Applications` (tab) | `seeker/MyApplicationsScreen` | seeker | ✅ (guest → sign-in gate) |
| `Profile` (tab) | `seeker/ProfileScreen` | seeker | ✅ (guest → sign-in gate) |
| `My Gigs` (tab) | `business/MyGigsScreen` | business | ✅ |
| `Applicants` (tab) | `business/ApplicantsScreen` | business | 🚧 placeholder |
| `Profile` (tab) | `business/ProfileScreen` | business | ✅ |
| `GigDetail` | `shared/GigDetailScreen` | both + guest | ✅ |
| `PublicProfile` | `shared/PublicProfileScreen` | both | ✅ |
| `EditProfile` | `shared/EditProfileScreen` | both | ✅ |
| `ManageExperience` / `ExperienceForm` | seeker | seeker | ✅ |
| `ManageEducation` / `EducationForm` | seeker | seeker | ✅ |
| `ApplicationDetail` | `seeker/ApplicationDetailScreen` | seeker | ✅ |
| `Apply` | `seeker/ApplyScreen` | seeker | 🟡 registered, unreachable |
| `PostGig` (modal) | `business/PostGigScreen` | business | ✅ |
| `EditGig` | `business/EditGigScreen` | business | ✅ |
| `RateFlow` (4 steps) | `shared/rate/*` | both | 🟡 registered, unreachable |
| `ComponentDemo` | `dev/ComponentDemoScreen` | `__DEV__` only | ✅ |

---

## 6. Cross-cutting notes

- **The client never talks to Supabase.** Uploads go to `POST /api/uploads`; the app only ever
  holds the returned URL.
- **The API client layer is split.** `api/index.js` resolves `authApi` between a mock and the real
  client, and re-exports `profileApi` / `uploadApi`. `gigApi`, `applicationApi` and `reviewApi`
  are imported directly by screens, bypassing `index.js`. Two conventions in one layer.
- **Mocks:** only `api/mock/authApi.js` exists (three seeded accounts, simulated latency, 20 s
  access-token TTL for testing refresh). No other endpoint has a mock adapter.
- **Screens never touch tokens or axios.** `client.js` attaches the header, refreshes once, and
  retries — every screen just calls its API module.
- **Every list screen refetches on focus** rather than passing data back through navigation, and
  only the first load blocks with a loader.
- **Seed data:** `npm run seed` (in `server/`) creates three accounts (`seeker@`, `business@`,
  `admin@giglanka.test`, all `Password123!`), a spread of gigs covering every deadline-urgency
  bucket, and one application driven through `viewed → shortlisted → hired` so the review
  endpoints have something valid to work against. It prints that application's id.

---

## 7. Gaps, dead ends and risks

Ranked by how much they affect a demo or Sprint 2.

### 7.1 The apply flow is broken end to end — the screen has no route into it
`app/src/screens/shared/GigDetailScreen.js:184` sets the seeker's primary action to
`{ label: 'Apply for this gig' }` with **no `onPress`**, under a comment saying the apply screen
"hasn't merged yet". It has since merged (GL-185/186/187) and is registered in `RootNavigator`,
but the CTA was never wired up. Nothing anywhere navigates to `'Apply'`. A seeker can therefore
browse, open a gig, and tap a button that does nothing. Everything behind it — the screen, the
API call, the failure paths, the detail screen it replaces into — works. **This is a one-line fix
and it is the single most demo-critical item in the repo.**

**Sprint 2: GL-214**, the first story of the sprint, which also rewrites this section when it
merges. It closes GL-122 AC7 and GL-123 AC1, both marked met and neither actually met. The four
apply failure paths from GL-187 — closed-gig race, duplicate, wrong role, guest — were signed off
as device-verified while none of them was reachable, and are re-verified separately as a cleanup
sub-task on GL-209, assigned to the E4 owner rather than to whoever fixes the button.

### 7.2 The rate flow has no entry point (expected, but worth stating)
The temporary dev route was removed in `215647b` at the close of GL-206. There is no in-app path
to a completed hire until Sprint 2 ships "mark a hire complete", so the flow was verified against
the seeded hire only. This is by design — but it means **no reviewing is demonstrable from the UI
right now**, and the whole of E5's screen work is invisible in a walkthrough.

**Sprint 2: GL-223** builds the completed-gigs screen as the real entry point, and moves the review
gate from `hired` to the `completed` status GL-218 adds.

### 7.3 `EXPO_PUBLIC_USE_MOCK` defaults to the mock, which breaks every other feature
`app/src/constants/config.js` treats anything other than the literal string `"false"` as "use the
mock" — including leaving the variable unset. But only `authApi` has a mock. So with the default
configuration you sign in against fake credentials, receive a fake token, and every profile, gig,
application and review call carries it to the real server and gets a 401. `app/.env` must set
`EXPO_PUBLIC_USE_MOCK=false` for the app to work at all. Consider flipping the default now that
the real API exists.

**Sprint 2: a named candidate on the GL-209 cleanup budget.** GL-211 also has to decide whether the
mock gains a change-password stub, precisely because the mock is what an unconfigured checkout gets.

### 7.4 No client-side tests, and CI silently passes anyway
`app/package.json` has no `test` script, so CI's `npm test --if-present` is a no-op. There is not
one test in `app/`. Every screen, the state machine's client mirror, `format.js` and
`validation.js` are all unverified by anything but manual runs.

**Still Sprint 4.** Sprint 2 adds no client-side test infrastructure; GL-212 covers the two
untested *server* components only.

### 7.5 Two server components ship with no integration tests
14 suites / 143 tests cover auth, gigs, applications and reviews. There are **no tests for the
profile endpoints and none for uploads** — including the public-profile whitelist and the
role-field rejection rules, which are the two places a privacy regression would be most costly.

**Sprint 2: GL-212.** It asserts the public profile against its *complete* expected key set rather
than against a list of fields that should be absent — the only form of the test that catches a
field added in a later sprint, which is exactly what Sprint 3 does to this document.

### 7.6 `GET /users/:userId/reviews` has no client, and `ReviewCard` has no caller
The read-reviews endpoint is built, documented and tested; `reviewApi.js` only exposes
`submitReview`. `ReviewCard` exists and is referenced only by the dev gallery. Both are waiting on
the reviews list screen — fine, but it means the endpoint has never been exercised by the app.

**The reviews list screen moved to Sprint 3**, so this stays open for another sprint and
`RatingSummary`'s "See all N reviews" button stays disabled. It is Bineth's designated pull-forward
if GL-222 and GL-223 clear early. GL-223 does add a **different** review read — `GET /api/reviews/mine`,
the caller's own reviews — so that the completed-gigs screen can tell rated from unrated in one
request rather than one per card.

### 7.7 `RatingSummary` reads a `distribution` field the contract does not define
`components/review/RatingSummary.js:22` destructures `distribution` off the rating aggregate and
passes it to `RatingBars`. Contract §6.10's aggregate is `{averageRating, reviewCount,
topCategories}` — there is no `distribution`. It degrades to zeroed bars rather than crashing, and
is invisible today because `reviewCount` is always 0. **The moment Sprint 2 computes real
aggregates, the "Rating breakdown" section will render five empty bars** unless the aggregate gains
that key or the component drops it. Decide which before the aggregate lands.

**Sprint 2: GL-222, and the decision is made — the aggregate gains `distribution`.** Five counts,
computed in the same pass, added to `RATING_AGGREGATE_SHAPE` and to contract §6.10. The shape is
exported from `review.model.js` and imported by `profile.model.js` and `application.model.js`, so
all three documents pick the field up together. GL-222's first sub-task does this **before** the
computation is written, so the story cannot ship the empty-bars state it exists to prevent.

### 7.8 Browse filtering is client-side only
Schedule chips narrow the pages already fetched, not the query. A gig on page 4 that matches your
filter is invisible until you scroll far enough to load page 4. Correct for this sprint's scope
(the endpoint has no filter parameter), but it will read as a bug to anyone testing with a large
seed set.

**Sprint 2: GL-215 adds the query parameters and GL-216 moves the client onto them.** A second,
quieter symptom goes with it: the result count comes from `total` on an *unfiltered* query while the
list is narrowed locally, so the number and the list already disagree the moment a chip is selected.
GL-121 AC9 required them to agree; server-side filtering is what finally makes that true, and GL-216
verifies it rather than assuming it arrives for free.

### 7.9 Smaller items
- `GET /api/auth/admin-smoke-test` is still mounted — leftover from Sprint 0, should be deleted.
- `DELETE /api/gigs/:id` has no cascade; applications survive with a dangling `gig` reference and
  read back `gig: null`. Documented and handled, but it will look odd in the applications list.
- `Application.create` and `adjustGigApplicantCount` are two separate writes with no transaction.
  A crash between them leaves the count one low. Low impact, worth knowing.
- `GIG_SORT_ORDERS` is defined and unused; `draft` and `filled` gig statuses are renderable but
  unproducible; `savedBy` and `skillTrialResults` are declared and never written.
- The `Applicants` button in `GigActionRow` shows a live count but is permanently disabled — it
  reads as broken rather than as "coming soon".

**Two items arriving with GL-208 (`f744049`), found on the 18 August re-check:**

- **The em-dash-to-hyphen replacement changed user-facing copy, not only comments.** Three rendered
  strings outside the dev gallery: `ApplicationTracker.js:62` ("Closed … - the position was
  filled."), `GigForm.js:328` ("Not required - this gig is remote."), and `EditGigScreen.js:283`
  (the delete confirmation body). The v3 design uses em-dashes deliberately, so this is an
  unticketed typography regression across the app. Cosmetic, but it is exactly what the GL-209
  cleanup budget is for, and it wants deciding once rather than screen by screen.
- **The Log Out block is marked `TEMP - testing only`, not merely misplaced.** Both profile screens
  say "TEMP - testing only, not part of GL-146 / GL-147 … remove this once that screen exists."
  GL-210 builds that screen and GL-225 removes the control and its comment, so this is already
  covered — but the marker means the current placement was never intended to ship, which raises its
  priority rather than leaving it a tidy-up.

**Sprint 2 disposition of the above:** the smoke-test route and the now-permanently-true
`canViewBusinessProfile` guard in `GigDetailScreen` are named candidates on the GL-209 cleanup
budget. `GIG_SORT_ORDERS` gains its consumer in GL-215. The `Applicants` button is enabled in
GL-220 — it was GL-164's deliberate stub and this is the story it was waiting for. Everything else
stays open: `savedBy` waits for Sprint 3's saved gigs, `filled` waits for Sprint 3's positions-filled
auto-close, `skillTrialResults` waits for Sprint 3's trials, and the delete-cascade and
count-transaction gaps are unowned.

---

## 8. What Sprint 2 has to unblock

In dependency order, based on what is already in place:

1. **Applicant list + applicant detail** (E4) — the business half of hiring. `GET /gigs/:id/applications`
   does not exist; `ApplicantsScreen` is empty. Everything it needs on the model side is built.
   → **GL-219** (endpoints), **GL-220** (screens), **GL-221** (the decisions on them).
2. **Shortlist / hire / reject endpoints** (E4) — the state machine, the reason-code rules and the
   count adjustment are all already written and tested. This is routing and screens, not logic.
   → **GL-219**. Shortlisting stays mandatory on the path to hiring; the transition table already
   requires it, and that chain is what the transparency tracker exists to show.
3. **Mark a hire complete** — the gate that finally makes the rate flow reachable and turns
   §7.2 from a dead end into a feature. → **GL-218**, and note the ownership correction: this is
   **E4**, not E5. It changes an application's status, and E4 owns that object. The business marks
   it complete; E5 only reads the result.
4. **Aggregate computation** (E5) — resolve §7.7 first, then compute onto profiles. Every rating
   summary in the app goes from an empty state to real data the day this lands.
   → **GL-222**, whose first sub-task is exactly "resolve §7.7 first".
5. **Reviews list screen** (E5) — the endpoint is waiting. → **moved to Sprint 3**; designated
   pull-forward if GL-222 and GL-223 clear early.
6. **Search / filter / sort** (E3) — needs query parameters on `GET /gigs`, which also fixes §7.8.
   → **GL-215** and **GL-216**. **Saved gigs moved to Sprint 3.**

And before any of that, the one-line fix in §7.1.

---

## 9. Verification performed for this document

- `npm test` in `server/` — **14 suites, 143 tests, all passing.** The first run in a cold
  environment failed 30 tests across 2 suites and passed in full on every subsequent run;
  consistent with `mongodb-memory-server` downloading/starting its binary on first use rather than
  with a real defect. Worth confirming on a clean CI runner if it recurs.
- No test run for `app/` — there is nothing to run (§7.4).
- Every route, model, service, validator and middleware in `server/src` read.
- Every screen, navigator, component, API module and utility in `app/src` read.
- Endpoint behaviour cross-checked against `docs/api-contract.md` §5–§12; no divergence found
  between the contract and the server. The one contract/client divergence is §7.7.
