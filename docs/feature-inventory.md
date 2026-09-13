# Gig Lanka — Feature Inventory

**What this is:** a code-level audit of everything that exists in the repo at the end of Sprint 2,
and the exact scope of each feature — what it does, what it deliberately does *not* do, and where
it lives. `ROADMAP.md` says what we plan to build; `docs/api-contract.md` says how endpoints must
behave; this file says **what is actually built right now**.

**Method:** read of every route, model, service, validator and middleware under `server/src`, and
every screen, navigator, component and API module under `app/src`, cross-checked against the API
contract and the roadmap. Server test suite executed (results in §9). Nothing here is inferred from
tickets — every claim points at code. Where a ticket is cited it is provenance, not evidence.

**As of:** 6 September 2026, end of Sprint 2 · branch `develop` @ `be92b4d`

**Re-baselined from the Sprint 1 edition.** The previous version of this file described the repo at
the end of Sprint 1 (`61ce592`, re-checked at `f744049`) with Sprint 2 plans layered on top as
annotations. Sprint 2 has closed, so §1–§6 and §9 now describe the current tree directly and §7
records each gap as either closed or still open. Sprint 1 history is kept only where it explains
why something is shaped the way it is.

**Status key**
✅ Built and reachable in the app · 🟡 Built but not reachable (no entry point / disabled) ·
🚧 Placeholder only · ⬜ Not started · 🔒 Deliberately out of scope

---

## 1. Snapshot

A two-half monorepo. The server implements 34 endpoints across auth, profiles, uploads, gigs,
applications and reviews. The app implements 28 screens across an auth stack, a seeker tab stack,
a business tab stack, and a shared modal/detail layer, plus a 51-component library of which 21 are
the generic UI kit.

| Half | Stack | Entry |
|---|---|---|
| `app/` | Expo 54, React Native 0.81, React 19, NativeWind 4 (Tailwind 3), React Navigation 7, axios, expo-secure-store, expo-image-picker | `app/App.js` → `src/navigation/RootNavigator.js` |
| `server/` | Node 22.17, Express 5, Mongoose 9 (MongoDB Atlas), Joi, jsonwebtoken, bcryptjs, multer, `@supabase/supabase-js` | `server/src/server.js` → `src/app.js` |
| CI | GitHub Actions, PRs into `develop`/`main`, lint + test per half | `.github/workflows/ci.yml` |
| Hooks | Husky pre-commit → lint-staged (per half) → eslint + prettier | `.husky/pre-commit` |
| Deploy | Server on Render (`https://gig-lanka.onrender.com`); app runs via Expo, no build pipeline yet | `app/.env.example` |

**Data model:** 6 collections — `User`, `RefreshToken`, `Profile`, `Gig`, `Application`, `Review`.
Files live in Supabase Storage; only the returned URL is stored in Mongo. No collection was added
in Sprint 2; `Application` gained `completedAt` and a `completed` status, and the rating aggregate
embedded in `Profile` and `Application` gained a `distribution` array.

**The headline change of Sprint 2 is that the hire-and-rate loop now closes end to end inside the
app.** At the end of Sprint 1 a seeker could not apply (the button had no `onPress`), a business
could not see applicants (the screen was a 7-line placeholder), nothing could reach `hired`, and no
rating aggregate was ever computed. All four are now live, in sequence: apply → view → shortlist →
hire → mark complete → rate → aggregate onto the profile.

---

## 2. Sprint plan vs. delivered

### Sprint 2 (17–23 August 2026, GL-209–GL-223)

15 stories, 67 points planned, **67 delivered, all Done, no spillover.** 60 sub-tasks, all Done.
Nothing was added mid-sprint and nothing was pulled forward.

| Epic | Capability (roadmap, Sprint 2) | Story | Delivered |
|---|---|---|---|
| E1 | App-wide cleanup pass | GL-209 | ✅ budget spent — see the caveat below |
| E2 | Account settings screen | GL-210 | ✅ |
| E2 | Change password | GL-211 | ✅ (no automated tests — §7.4) |
| E2 | Profile & upload integration tests | GL-212 | ✅ |
| E2 | Optional authentication middleware | GL-213 | ✅ |
| E3 | Apply action wired on gig detail | GL-214 | ✅ |
| E3 | Search, filter, sort on the gig list API | GL-215 | ✅ |
| E3 | Search, filters, sort on Browse | GL-216 | ✅ |
| E3 | Already-applied state on gig detail | GL-217 | ✅ |
| E4 | The `completed` status and its transitions | GL-218 | ✅ |
| E4 | Applicant endpoints — list, shortlist, hire, reject | GL-219 | ✅ |
| E4 | Applicants list & applicant detail screens | GL-220 | ✅ |
| E4 | Decisions from applicant detail | GL-221 | ✅ |
| E5 | Aggregate ratings computed onto profiles | GL-222 | ✅ |
| E5 | Completed gigs screen and the review gate | GL-223 | ✅ |

**Scope delivered beyond the plan:** server-side deadline auto-close (a gig whose
`applicationsCloseDate` has passed is closed on read rather than left stale), which arrived as
GL-283 inside the cleanup budget rather than as a planned story.

**The one caveat on GL-209.** It closed Done and its 13 points were fully spent, on eleven
sub-tasks: tab-bar, spinner, date-picker and dropdown colours; heading, nav-bar and profile-scroll
spacing; clipped filter chips; the profile black-screen artefact; the docs update; and GL-283. Every
one of those was a mismatch found *during* the sweep, which is what the budget is for. The
consequence is that the five items this document had **named for GL-209 in advance were never
reached**, and they are still in the code. They are listed in §7.9 and they are now unowned — no
sprint claims them.

### Sprint 1 (reference)

Every Sprint 1 capability had code behind it and still does. Two things were built but unreachable
at the time — the apply flow and the rate flow — and Sprint 2 gave both an entry point. The full
Sprint 1 table is in this file's git history; it is not repeated here now that the gaps it recorded
are closed.

---

## 3. Feature scope, epic by epic

### E1 · Platform & Foundations

| Feature | Status | Scope |
|---|---|---|
| Design tokens | ✅ | `app/tailwind.config.js` + `app/global.css`. Colours, radii, type scale and two font families (Schibsted Grotesk display, Inter Tight body) loaded in `App.js`. Tokens are the single source — screens never use raw hex. |
| UI kit | ✅ | 21 components in `app/src/components/ui/`: `AuthShell`, `Avatar`, `Badge`, `Brand`, `Button`, `Card`, `Chip`, `ConfirmDialog`, `DateField`, `Dropdown`, `EmptyState`, `HeroHeader` (+`HeroSheet`, `HeroStickyBar`), `Loader`, `Notice`, `ProgressPips`, `RoleStrip`, `Screen`, `ScreenHeader`, `SectionLabel`, `SegmentedControl`, `TextInput`. All are in real use; `ComponentDemoScreen` is a `__DEV__`-only gallery. |
| Theme consistency sweep | ✅ | GL-209's largest strand. `navigation/tabBarTheme.js` is a new shared source for both tab navigators (GL-274); spinner colours (GL-275), heading spacing (GL-276), `@react-native-community/datetimepicker` colours (GL-277), profile scroll spacing (GL-278), nav-bar-to-content spacing across five screens (GL-279), clipped filter chips (GL-280), `Dropdown` colours (GL-281) and the profile black-screen artefact (GL-282) were all brought onto the token palette. |
| Formatting utilities | ✅ | `app/src/utils/format.js` — `formatPay`, `formatRelativeTime`, `formatDeadline` (returns `{label, urgent}`), `formatLocation`, `formatDateRange`, `formatShortDate`. `app/src/utils/validation.js` — form-level field validators. |
| Domain enums | ✅ | `app/src/constants/enums.js` — frozen vocabularies matching contract §6, now including the `completed` application status and `GIG_SORT_ORDERS` (which finally has a consumer). **Deliberately duplicated** on the server inside Joi validators and Mongoose enums rather than shared; the contract is the reconciliation point. |
| File upload service | ✅ | `POST /api/uploads`. `upload.middleware.js`: multer memory storage, 5 MB cap, PNG/JPG/PDF only, MIME **and** extension must agree (catches renamed files). `storage.service.js`: `storeFile` writes to a Supabase bucket under a random UUID key (never the client filename, never derived from a user id) and returns the public URL; `removeFile` deletes by URL or key. Storage failure → `502 STORAGE_UNAVAILABLE`, never a bare 500. `folder` is a closed list — `['avatars']` only. Tested since GL-233. |
| Error/response envelopes | ✅ | `utils/response.js`, `utils/ApiError.js`, `middleware/errorHandler.js`, `middleware/notFound.js`. Every response, success or failure, uses the contract §2/§3 shape. |
| Transactional email | ⬜ | Sprint 3. |
| Sweep of empty/loading/error states | ⬜ | Sprint 4 — though every screen built so far carries all three. |
| E2E tests, EAS release build | ⬜ | Sprint 4. |

### E2 · User & Profile Management

| Feature | Status | Scope |
|---|---|---|
| Registration & login | ✅ | `POST /api/auth/register`, `/login`. bcrypt (10 rounds). Duplicate email → `409 EMAIL_ALREADY_EXISTS` (translated from the unique index, never a 500). Login answers identically for unknown email and wrong password, so accounts can't be enumerated. Roles: `seeker`, `business`; `admin` is never creatable through the API. |
| Token lifecycle | ✅ | Access + refresh JWTs. Refresh tokens are persisted (`RefreshToken`, TTL-indexed on `expiresAt`) and **rotated** — refreshing deletes the old row and issues a new pair. Logout revokes. `TOKEN_EXPIRED` and `TOKEN_INVALID` are distinct codes. |
| RBAC | ✅ | `requireAuth` verifies the access token and **re-loads the user from the database**, so role checks never trust the token's claim. `requireRole(...roles)` fails closed. |
| Optional authentication | ✅ | `optionalAuth` (GL-213/GL-234) sets `req.user` when a valid token is present and passes through silently when one is absent, invalid or expired — so a route can serve guests and signed-in users from one handler without branching on a try/catch. Mounted on exactly one route, `GET /api/gigs/:id`, which is what `viewerApplication` needed. Every failure path is covered by `auth.optional.test.js` (GL-235). |
| Client session persistence | ✅ | `expo-secure-store` (`store/secureStorage.js`), `AuthContext` bootstraps through `/auth/me` on launch, `api/client.js` runs a single-flight refresh-and-retry interceptor with a queue for concurrent 401s, and calls `onSessionExpired` so a dead refresh token ends the session live rather than at next launch. |
| Auth screens | ✅ | `RoleSelectScreen` (+ "continue as guest"), `SignUpScreen`, `LoginScreen`. A returning signed-out user lands on Login, a fresh install on RoleSelect. |
| Account settings | ✅ | `shared/AccountSettingsScreen` (GL-224/226), registered in `RootNavigator` and reached from both profile screens. Three sections; carries Log Out, which GL-225 moved off both profile screens where it had shipped marked `TEMP - testing only`. The deactivate control is present and **deliberately disabled** — Sprint 3 builds what it calls. |
| Change password | ✅ | `POST /api/auth/change-password` (GL-227) requires the current password and rejects on mismatch; on success **every other refresh token for that user is revoked** (GL-228), so a second device is signed out while the acting device keeps its session. `shared/ChangePasswordScreen` (GL-229) carries a strength indicator and maps the refusal paths back onto fields (GL-230). **No automated tests — §7.4.** |
| Profile model & API | ✅ | `Profile` is a **separate document** from `User` — credentials and role never enter a profile response. Created lazily on first read, named from the email's local part. `GET /profiles/me`, `PUT /profiles/me` (full replace — an omitted field is cleared), `GET /profiles/:userId` (public). Admin token → 403 on all three. |
| Public profile shape | ✅ | Built from an explicit **whitelist**, so a field added to the schema later stays private until deliberately published. Shared: name, photo, city, bio, ratingSummary. Seeker-only: skills, workExperience, education, skillTrialResults. Business-only: category. `PUT /profiles/:userId` exists **only to return 403** — editing is reachable through `/me` and nowhere else. Pinned against its complete key set by `profile.public.test.js` (GL-232). |
| Role-field enforcement | ✅ | A seeker sending `category`, or a business sending `skills`/`workExperience`/`education`, gets a 400 naming the field rather than having it silently dropped. `ratingSummary`, `skillTrialResults`, `role`, `email` are rejected outright — they belong to other components. Covered by `profile.me.test.js` (GL-231). |
| Own profile screens | ✅ | `seeker/ProfileScreen`, `business/ProfileScreen` — hero header, rating summary block (now showing real numbers), role-appropriate sections. Both refetch on focus. Sign-out moved to Account Settings. |
| Edit profile | ✅ | `shared/EditProfileScreen` — name, bio, city, skills (seeker) / category (business), plus the avatar. Sends fields it does not display (`photo`, `workExperience`, `education`) back untouched, because PUT replaces in full. |
| Work experience & education | ✅ | `ManageExperienceScreen` / `ExperienceFormScreen`, `ManageEducationScreen` / `EducationFormScreen` — add, edit, delete, sorted newest-first, each writing the full profile back with a `PASSTHROUGH_FIELDS` list so a PUT never clears a neighbouring section. |
| Public profile view | ✅ | `shared/PublicProfileScreen` — reached from a gig's business block. Loading / error / not-found states; renders seeker and business sections from the public shape. |
| Deactivation | ⬜ (guard pre-wired) | Sprint 3. `getPublicProfile` already refuses on `user.isActive === false` with the same 404 as "never existed", and `profile.public.test.js` pins that behaviour ahead of the field existing. The disabled control on Account Settings is its entry point. |
| Forgot / reset password | ⬜ | Sprint 3. |
| Skill Trial badges | ⬜ | `skillTrialResults` exists on the schema and is published on public profiles; always empty until Sprint 3. |
| Business verification | 🔒 | Not in scope anywhere in the project. Trust is signalled by the rating summary only. |

### E3 · Gig & Job Marketplace

| Feature | Status | Scope |
|---|---|---|
| Gig model | ✅ | Closed vocabularies for category, pay type, schedule, commitment and status. `city` required unless `remote`. `applicationsCloseDate` cannot be in the past. `status` defaults to `open` and is never client-settable; `postedBy` always comes from the token. `applicantCount` is declared here but **owned and written by E4**. |
| `savedBy` privacy | ✅ (pre-emptive) | The field is declared for Sprint 3 saving, `select: false` keeps it out of every query, and the `toJSON` transform deletes it again. It cannot leak into a response — not even to the gig's owner — once saving starts writing to it. Pinned by `gig.saved-privacy.test.js`. Still never written. |
| Gig endpoints | ✅ | `POST /gigs`, `GET /gigs` (public, open-only, 10/page, now filtered and sorted server-side), `GET /gigs/:id` (public via `optionalAuth`, any status, plus a business identity block and `viewerApplication`), `GET /gigs/mine` (business, every status, unpaginated), `PUT /gigs/:id`, `PATCH /gigs/:id/close`, `DELETE /gigs/:id`, and `GET /gigs/:gigId/applications` (E4's, declared in `gig.routes.js`). |
| Search, filter, sort | ✅ | GL-215/GL-238–240. `listGigsQuerySchema` accepts `q`, `category`, `schedule`, `payType`, `commitment`, `remote`, `city`, `minPay` and `sort`; the multi-value ones take a comma-separated list validated against the enum (`?category=tech,creative`). `sort` is one of `newest` (default), `highest_pay`, `starting_soon`. Documented at contract §10.4, covered by `gig.search.test.js`. A `validateQuery` middleware exists because **Express 5 makes `req.query` read-only**, so the usual validate-and-reassign pattern from `validate()` throws. |
| Ownership ordering | ✅ | Existence is checked before ownership on update/close/delete — a missing or malformed id is 404 before the caller's identity is considered, so refusal codes can't be used to probe which ids exist. |
| Deadline auto-close | ✅ | GL-283. `closeIfExpired` in `gig.service.js` moves a gig whose `applicationsCloseDate` has passed to `closed` when it is read, instead of leaving `status: 'open'` while the countdown said otherwise. This resolved three disagreeing "is this gig open" signals on gig detail and made the deadline enforceable server-side rather than being a client-side label. Note it writes `closed`, **not** `filled` — a different rule from the positions-filled auto-close still waiting in Sprint 3. |
| Browse gigs | ✅ | `seeker/BrowseGigsScreen` — paginated infinite scroll with a single in-flight guard, pull-to-refresh, separate inline retry for a failed "load more", result count, empty and error states. GL-216/GL-241–244: a debounced search field, a `GigFilters` bottom sheet, and **all filtering moved onto the server**. One filter state is shared between the inline chips and the sheet, so the two can no longer disagree, and the result count now comes from a `total` computed on the same filtered query as the list. |
| Gig detail | ✅ | `shared/GigDetailScreen` — collapsing hero, status badge, detail rows, description, and a business block that routes to the public profile. Five primary-action states: owner → Edit; **already applied → status-dependent copy routing to the application** (GL-217/GL-246); not open → "Applications closed" (disabled, never hidden); guest → sign-in; seeker → Apply, which since GL-236 actually navigates. |
| Guest browsing | ✅ | Unauthenticated users get Browse + Gig detail. The other two seeker tabs swap to a sign-in gate. Implemented as local state in `RootNavigator`, not a fourth auth status. |
| My gigs | ✅ | `business/MyGigsScreen` — status filter, per-card action row (Edit / Applicants / Close), refetch on focus, empty and error states. The Applicants button is no longer disabled (GL-257) and navigates to `GigApplicants` scoped to that gig. |
| Post & edit a gig | ✅ | `PostGigScreen`, `EditGigScreen` share `components/gig/GigForm.js` — every field in contract §10.3, client-side validation, field-level server errors mapped back onto inputs. Edit also carries close and delete with confirmation dialogs. |
| Deadline urgency | ✅ | `formatDeadline` + `GigCard` render "Closes today / tomorrow / in N days" with an urgent treatment ≤ 3 days. Now backed by real enforcement rather than being cosmetic. |
| Saved gigs | ⬜ | Sprint 3. Field declared, no endpoint, no writer. |
| `filled` / `draft` statuses | ⬜ | Both are in the vocabulary and render correctly if present, but **no code path produces either**. `filled` waits on Sprint 3's positions-filled auto-close; nothing creates a draft. |
| Relevance ordering | ⬜ | Sprint 3. `sort` has three orders, none of them relevance. |

### E4 · Application & Hiring

| Feature | Status | Scope |
|---|---|---|
| Application model | ✅ | Unique compound index on `(gig, applicant)` — one application per seeker per gig, **permanently**; withdrawing does not free the slot. `viewedAt`, `decidedAt` and `completedAt` are always-present timestamps that start `null`. |
| Frozen profile snapshot | ✅ | `profileSnapshot` embeds name, headline (from bio), experience, education and the rating aggregate at submission time. Not a reference — a later profile edit can never change what a business already judged. This is what the applicant detail screen renders. |
| Status state machine | ✅ | `transitionApplicationStatus()` in `application.service.js` is the **only** code allowed to write `status`. Transitions are a data table, not conditionals. Actor kinds: `business` (the gig's poster specifically, checked by ownership), `applicant` (that seeker specifically), `system` (no HTTP actor at all — an authenticated request attempting a system-only move gets 403). Decided statuses have no outgoing entry, so nothing reopens them and status never moves backwards. GL-218 added `completed` and GL-249 renamed `TERMINAL_STATUSES` to `DECIDED_STATUSES`, because `hired` is decided but not terminal once completion exists. |
| The `completed` status | ✅ | GL-218/GL-248. `PATCH /applications/:id/complete`, business-only, `hired → completed`, stamping `completedAt`. **The business marks it**, because they hired and they know when the work finished; E5 only reads the result. This is the gate the whole rating flow hangs off. |
| Rejection reason codes | ✅ | Eight codes in `REJECTION_REASON_CODES`, seven business-selectable (`positions_filled` is system-only). Rejecting without a code, with the system-only code, or with a skill-trial code on a gig that carried no trial, all fail with 400. Now reachable — `PATCH /applications/:id/reject` (GL-253) is the caller the rules were written for. |
| Applicant count | ✅ | `adjustGigApplicantCount` is the single writer. `+1` on create, `-1` the moment an application leaves the live set, in the same operation as the status change. Moves within the live set never touch it. |
| Apply endpoint | ✅ | `POST /gigs/:gigId/applications`, seekers only, no accepted body. Returns the application plus `profileIncomplete` (no experience **and** no education) — a warning signal, never a block. Duplicate → 409 `APPLICATION_ALREADY_EXISTS`. Gig not open → 409 `GIG_CLOSED`. |
| Seeker read endpoints | ✅ | `GET /applications/mine` (seeker, own only, no id parameter exists), `GET /applications/:id` (either party, existence checked before the party check). Each carries a gig summary — never the full gig — which reads back `null` for a deleted gig rather than failing. |
| Business read endpoints | ✅ | GL-219/GL-252. `GET /gigs/:gigId/applications` (one gig's applicants) and `GET /applications/for-my-gigs` (every application across all of the caller's gigs) — the two modes the Applicants screen needs. Both business-only and scoped by gig ownership. `/for-my-gigs` is declared before `/:id` so the literal is never swallowed as an id, the same guard `/mine` already had. |
| Decision endpoints | ✅ | GL-253. `PATCH /applications/:id/view`, `/shortlist`, `/hire`, `/reject`, all business-only, all routed through the state machine. Ownership and the rejection rules are covered by `application.business-transitions.test.js` (GL-255). |
| Withdraw | ✅ | `PATCH /applications/:id/withdraw`, routed through the state machine like everything else. Withdrawing a `hired` application is refused by the transition table, not by a withdraw-specific check. The application stays visible to the business with its new status; it is never deleted or hidden. |
| Apply screen | ✅ | `seeker/ApplyScreen` — snapshot preview of what the business will see, thin-profile notice with a route to Profile, double-submit guard, and distinct messages for `GIG_CLOSED`, `APPLICATION_ALREADY_EXISTS` and `FORBIDDEN`. On success it replaces into the application detail. **Reachable since GL-236.** |
| My applications | ✅ | `seeker/MyApplicationsScreen` — live/decided filter, refetch on focus without flashing the loader, pull-to-refresh, two distinct empty states, and an entry point into Completed Gigs. |
| Application detail & tracker | ✅ | `seeker/ApplicationDetailScreen` — `ApplicationTracker` renders the transparency timeline; the rejection reason and note are shown **verbatim**, no softening or truncation. Withdraw sits behind a confirmation dialog and is offered only from `applied`/`viewed`/`shortlisted`. Now shows `completed` as a stage. |
| Applicants list | ✅ | `business/ApplicantsScreen` (GL-256) — a real screen in two modes: **scoped** to one gig when opened from a gig's action row, and **unscoped** across every gig when opened from the Applicants tab. `ApplicantRow` + `ApplicantStatusFilter` (live / decided, matching contract §11.2). |
| Applicant detail | ✅ | `business/ApplicantDetailScreen` (GL-258) — renders the **frozen snapshot**, not the live profile, and says so on screen. Opening it sets `viewed` (GL-259), which is the transparency promise the tracker exists to keep. |
| Shortlist / hire / reject / complete | ✅ | GL-221. `ApplicantActionRow` is status-dependent — a decided application offers no actions at all rather than a dead button. `RejectReasonSheet` collects a mandatory code, `HireConfirmSheet` confirms the irreversible one, and mark-complete sits on the hired state. Races are handled by refetching on refusal rather than by optimistic rollback. |
| Positions-filled auto-close | ⬜ | Sprint 3. `closed_filled` still has a system-only transition rule and **no caller anywhere**. Not to be confused with GL-283's deadline auto-close, which writes `closed` on the *gig*. |
| Skill Trial, resume PDF | ⬜ | Sprint 3. |

**Reachable today:** every transition in the table now has an HTTP path except `closed_filled`,
which remains system-only with no caller. At the end of Sprint 1 only the three `→ withdrawn` moves
were reachable.

### E5 · Community & Rating

| Feature | Status | Scope |
|---|---|---|
| Review model | ✅ | Unique index on `(application, direction)`. `author ≠ subject` enforced by a schema validator. `createdAt` only — **no `updatedAt`, no edit, no delete, no respond path anywhere**. Reviews are permanent; correcting one is a Sprint 4 dispute. |
| Rating aggregate schema | ✅ | `RATING_AGGREGATE_SHAPE` is exported from `review.model.js` and imported by `profile.model.js` and `application.model.js`, so the ownership boundary is expressed in code: Reviews owns the shape, Profile stores and displays it, neither computes the other's number. GL-264 added `distribution` (five star buckets) to the shape and to contract §6.10 **before** the computation was written, closing the old §7.7 by construction. |
| Create review | ✅ | `POST /applications/:applicationId/reviews`. Gated in order: application exists (404) → caller is a party (403) → status is `completed` (409 `APPLICATION_NOT_COMPLETED`) → **within 14 days of `completedAt`** (GL-269) → categories match the derived direction (400) → not a duplicate (409 `REVIEW_ALREADY_EXISTS`). `direction`, `author` and `subject` are all derived server-side and never accepted from the body. GL-268 moved the gate from `hired` to `completed`. |
| Aggregate computation | ✅ | GL-222. `recomputeRatingSummary` / `computeRatingAggregate` in `review.service.js` compute average, count, top categories and the five-bucket distribution in one pass; `setRatingSummary` in `profile.service.js` is the **single narrow writer** onto the profile, so E5 never reaches into E2's document directly. Covered by `review.rating-aggregate.test.js` and `profile.service.test.js`. Every rating summary in the app now shows real data. |
| Read reviews | ✅ (server) / ⬜ (client) | `GET /users/:userId/reviews`, paged 10/page, newest first, author name/photo populated **live from the profile** at read time — the opposite of the application's frozen snapshot, and deliberately so. **Still no client consumes it** (§7.6). |
| The caller's own reviews | ✅ | `GET /api/reviews/mine` (GL-270) + `reviewApi.getMyReviews` — the reviews the signed-in caller has written, each carrying its `application` id, so the completed-gigs screen can tell rated from unrated in one request rather than one per card. |
| Rating components | ✅ | `StarRating` (read + interactive), `CategoryChipGroup`, `RatingSummary`, `RatingBars`, `CompletedGigCard`. `ReviewCard` is built and **still referenced only by the dev gallery**. |
| Rating summary on profiles | ✅ | Rendered on the seeker profile, business profile and public profile, now with real aggregates and a populated "Rating breakdown". Shows "New to Gig Lanka" only when `reviewCount === 0`, which is no longer always. Its "See all N reviews" button is **still hardcoded `disabled` with no `onPress`** — §7.6. |
| Rate flow | ✅ | `shared/rate/` — `RateFlowNavigator` + `RateFlowProvider` + four steps (subject & stars → categories → written review → confirmation). Direction and subject are derived once in the provider from the application and the signed-in user, so the seeker and business sides can never disagree. Double-submit guard, draft preserved on failure, 20–1000 character validation. **Now reachable** via Completed Gigs. |
| Rating entry point | ✅ | GL-223/GL-271. `shared/CompletedGigsScreen` + `CompletedGigCard`, registered in `RootNavigator` and reached from both My Gigs and My Applications (GL-272). The card has three states — `awaiting` (shows "Nd left" and the only action), `rated` ("Rated ✓") and `closed` ("Rating closed", the 14-day window expired). Expired and rated cards deliberately offer **no** action rather than a dead button. |
| Reviews list screen | ⬜ | Sprint 3. Was Bineth's designated pull-forward; the pull-forward was not taken. |
| Inline rating on the gig detail business block | ⬜ | Sprint 3. GL-122 AC6 is still unmet — see §7.10. |
| Report / moderation | ⬜ | Sprint 3. |

### E6 · Admin & Moderation

| Feature | Status | Scope |
|---|---|---|
| Admin role | ✅ | Exists in the `User` enum and is honoured by `requireRole`. Admin accounts are never creatable through the API and have **no profile** — every profile endpoint 403s for them, and an admin's user id is never a valid public-profile target. |
| Admin navigation surface | ⬜ | **Nothing exists, and the fallthrough is wrong.** [`RootNavigator.js:32`](../app/src/navigation/RootNavigator.js) is `role === 'business' ? BusinessTabs : SeekerTabs`, so an admin signing in lands in the *seeker* tabs and hits a 403 wall, since admins have no profile. No `screens/admin/` directory, no admin branch, and the only `'admin'` string in `app/src` is a seeded mock account. §7.12. |
| Open reports list | ⬜ | Sprint 3 — **pulled forward from Sprint 4** so the report/complaint flow ships with a reader rather than writing into a queue nobody can open. Read-only; every action on a report stays Sprint 4. It is the row that has to build the admin surface above. |
| Admin screens & APIs | ⬜ | Sprint 4, split four ways. Disputes, moderation queue actions, account status. Nothing exists. |
| Leftover smoke-test route | ⚠️ | `GET /api/auth/admin-smoke-test` is **still mounted** ([`auth.routes.js:32`](../server/src/routes/auth.routes.js)) — leftover from Sprint 0's GL-60, named for the GL-209 budget and not reached. It leaks nothing (a fixed string behind an admin-only gate) but it should be deleted. §7.9. |

---

## 4. API surface

34 routes, up from 25 at the end of Sprint 1. Everything except the two public gig reads requires a
bearer token. The count includes two deliberate non-features: the leftover smoke-test route and the
always-403 `PUT /api/profiles/:userId`.

| Method | Path | Auth | Status |
|---|---|---|---|
| GET | `/api/health` | — | ✅ |
| POST | `/api/auth/register` | — | ✅ |
| POST | `/api/auth/login` | — | ✅ |
| POST | `/api/auth/refresh` | — | ✅ |
| POST | `/api/auth/logout` | access token | ✅ |
| GET | `/api/auth/me` | access token | ✅ |
| POST | `/api/auth/change-password` | access token | ✅ **new** — revokes other sessions; untested (§7.4) |
| GET | `/api/auth/admin-smoke-test` | admin | ⚠️ temporary, still not deleted |
| GET | `/api/profiles/me` | seeker/business | ✅ |
| PUT | `/api/profiles/me` | seeker/business | ✅ |
| GET | `/api/profiles/:userId` | seeker/business | ✅ |
| PUT | `/api/profiles/:userId` | any | ✅ always 403, by design |
| POST | `/api/uploads` | any | ✅ `avatars` folder only |
| POST | `/api/gigs` | business | ✅ |
| GET | `/api/gigs` | **public** | ✅ open only, 10/page, **filtered + sorted server-side** |
| GET | `/api/gigs/mine` | business | ✅ |
| GET | `/api/gigs/:id` | **public** (`optionalAuth`) | ✅ any status, + `viewerApplication`, + deadline auto-close |
| PUT | `/api/gigs/:id` | owner | ✅ |
| PATCH | `/api/gigs/:id/close` | owner | ✅ |
| DELETE | `/api/gigs/:id` | owner | ✅ hard delete, no cascade |
| GET | `/api/gigs/:gigId/applications` | owner (business) | ✅ **new** — one gig's applicants |
| POST | `/api/gigs/:gigId/applications` | seeker | ✅ |
| GET | `/api/applications/mine` | seeker | ✅ |
| GET | `/api/applications/for-my-gigs` | business | ✅ **new** — across all owned gigs |
| GET | `/api/applications/:id` | either party | ✅ |
| PATCH | `/api/applications/:id/withdraw` | applicant | ✅ |
| PATCH | `/api/applications/:id/view` | business | ✅ **new** |
| PATCH | `/api/applications/:id/shortlist` | business | ✅ **new** |
| PATCH | `/api/applications/:id/hire` | business | ✅ **new** |
| PATCH | `/api/applications/:id/reject` | business | ✅ **new** — mandatory reason code |
| PATCH | `/api/applications/:id/complete` | business | ✅ **new** — the review gate |
| POST | `/api/applications/:applicationId/reviews` | either party | ✅ gate moved to `completed` + 14-day window |
| GET | `/api/users/:userId/reviews` | any signed-in | ✅ server only — **still no client** |
| GET | `/api/reviews/mine` | any signed-in | ✅ **new** |

**Not built:** save/unsave a gig (`savedBy` stays declared and unwritten), positions-filled
auto-close (`closed_filled` has no caller), forgot/reset password, account deactivation, skill
trials, resume attachment, reporting and moderation, and everything admin. All Sprint 3 or 4.

---

## 5. App surface

28 screens plus the dev gallery.

| Route | Screen | Role | Status |
|---|---|---|---|
| `RoleSelect` | `auth/RoleSelectScreen` | guest | ✅ |
| `SignUp` | `auth/SignUpScreen` | guest | ✅ |
| `Login` | `auth/LoginScreen` | guest | ✅ |
| `Browse` (tab) | `seeker/BrowseGigsScreen` | seeker + guest | ✅ search, filters, sort |
| `My Applications` (tab) | `seeker/MyApplicationsScreen` | seeker | ✅ (guest → sign-in gate) |
| `Profile` (tab) | `seeker/ProfileScreen` | seeker | ✅ (guest → sign-in gate) |
| `My Gigs` (tab) | `business/MyGigsScreen` | business | ✅ |
| `Applicants` (tab) | `business/ApplicantsScreen` | business | ✅ **real** — unscoped mode |
| `Profile` (tab) | `business/ProfileScreen` | business | ✅ |
| `GigDetail` | `shared/GigDetailScreen` | both + guest | ✅ + already-applied state |
| `PublicProfile` | `shared/PublicProfileScreen` | both | ✅ |
| `EditProfile` | `shared/EditProfileScreen` | both | ✅ |
| `AccountSettings` | `shared/AccountSettingsScreen` | both | ✅ **new** |
| `ChangePassword` | `shared/ChangePasswordScreen` | both | ✅ **new** |
| `CompletedGigs` | `shared/CompletedGigsScreen` | both | ✅ **new** — the rating entry point |
| `ManageExperience` / `ExperienceForm` | `seeker/*` | seeker | ✅ |
| `ManageEducation` / `EducationForm` | `seeker/*` | seeker | ✅ |
| `ApplicationDetail` | `seeker/ApplicationDetailScreen` | seeker | ✅ |
| `Apply` | `seeker/ApplyScreen` | seeker | ✅ reachable since GL-236 |
| `PostGig` (modal) | `business/PostGigScreen` | business | ✅ |
| `EditGig` | `business/EditGigScreen` | business | ✅ |
| `GigApplicants` | `business/ApplicantsScreen` | business | ✅ **new** — scoped mode |
| `ApplicantDetail` | `business/ApplicantDetailScreen` | business | ✅ **new** — sets Viewed on open |
| `RateFlow` (4 steps) | `shared/rate/*` | both | ✅ **now reachable** |
| `ComponentDemo` | `dev/ComponentDemoScreen` | `__DEV__` only | ✅ |

---

## 6. Cross-cutting notes

- **The client never talks to Supabase.** Uploads go to `POST /api/uploads`; the app only ever
  holds the returned URL.
- **The API client layer is still split.** `api/index.js` resolves `authApi` between a mock and the
  real client, and re-exports `profileApi` / `uploadApi`. `gigApi`, `applicationApi` and `reviewApi`
  are imported directly by screens, bypassing `index.js`. Two conventions in one layer, unchanged
  by Sprint 2 and now spanning six modules rather than four.
- **Mocks:** only `api/mock/authApi.js` exists. It gained no change-password stub in GL-211, so on
  a default (mock) checkout the new screen cannot be exercised at all — see §7.3.
- **Screens never touch tokens or axios.** `client.js` attaches the header, refreshes once, and
  retries — every screen just calls its API module.
- **Every list screen refetches on focus** rather than passing data back through navigation, and
  only the first load blocks with a loader.
- **Express 5 makes `req.query` read-only.** `validateQuery` exists solely to work around this; the
  ordinary `validate()` middleware reassigns its target and would throw. Anyone adding a second
  query-validated route must use `validateQuery`, not `validate`.
- **Seed data:** `npm run seed` (in `server/`) creates three accounts (`seeker@`, `business@`,
  `admin@giglanka.test`, all `Password123!`), a spread of gigs covering every deadline-urgency
  bucket, and — since GL-251 — a **three-applicant demo scenario** rather than a single seeded hire,
  so the applicants list, the status filter and the decision actions all have something to show.

---

## 7. Gaps, dead ends and risks

Ranked by how much they affect a demo or Sprint 3.

### 7.1 ✅ Closed — the apply flow had no route into it
`GigDetailScreen`'s signed-in-seeker branch of `primaryAction` shipped in Sprint 1 with no
`onPress`, so no seeker could apply for the entire sprint. **GL-236** added
`onPress: () => navigation.navigate('Apply', { gigId })` and deleted the stale comment. This is
where GL-122 AC7 and GL-123 AC1 were actually met, both having closed as Done while unmet.

**One thread is still loose.** The four apply *failure* paths from GL-187 — the closed-gig race,
the duplicate application, the wrong-role refusal and the guest route — were signed off as
device-verified in Sprint 1 while the screen had no entry point, so none of them was reachable at
the time. Re-verifying them was named as a GL-209 sub-task and **no such sub-task was ever
created**. They remain unverified. See §7.9. **Ticketed for Sprint 3 as GL-294**, which requires an
attached artefact per path rather than a tick.

### 7.2 ✅ Closed — the rate flow had no entry point
**GL-223** built `CompletedGigsScreen` as the real entry point and **GL-268** moved the review gate
from `hired` to the `completed` status **GL-218** added. Reviewing is now demonstrable end to end
from the UI, in both directions, which it was not at any point in Sprint 1.

### 7.3 🔴 Open — `EXPO_PUBLIC_USE_MOCK` still defaults to the mock
[`app/src/constants/config.js:2`](../app/src/constants/config.js) is unchanged:
`process.env.EXPO_PUBLIC_USE_MOCK !== 'false'` treats anything other than the literal string
`"false"` — including leaving the variable unset — as "use the mock". Only `authApi` has a mock, so
with the default configuration you sign in against fake credentials, receive a fake token, and every
profile, gig, application and review call carries it to the real server and gets a 401. `app/.env`
must set `EXPO_PUBLIC_USE_MOCK=false` for the app to work at all.

**This was a named candidate on the GL-209 budget and was not reached.** Sprint 2 made it worse in
one respect: GL-211 added a change-password screen and the mock gained no stub for it, so that
screen is entirely inert on a default checkout. Now unowned — §7.9.

**Ticketed for Sprint 3 as GL-285**, off the cleanup budget. That story inverts the default and adds
the missing `changePassword` mock stub.

### 7.4 🔴 Open — no client-side tests, and change-password has no server tests either
`app/package.json` still has no `test` script, so CI's `npm test --if-present` remains a no-op.
There is not one test in `app/`. **Still Sprint 4** — Sprint 2 added no client-side test
infrastructure, by plan.

**New in Sprint 2, and not by plan:** `POST /api/auth/change-password` has **no automated
coverage**. Nothing under `server/tests/` references the route, `changePassword` or `newPassword`.
It is the only endpoint added in Sprint 2 with no test — every other one (the applicant endpoints,
the transitions, `/complete`, `/reviews/mine`, the search parameters, `optionalAuth`) got a suite.
GL-230 covered the refusal paths and the second-device logout as *device* verification only. Given
that the endpoint changes credentials and revokes sessions, this is the highest-value missing test
in the server suite. Unowned.

**Ticketed for Sprint 3 as GL-288**, off the cleanup budget — the suite plus a direct assertion of
the other-session revocation, which has only ever been checked by hand on two devices. The
client-side half (no `test` script in `app/`) stays Sprint 4 and is untouched by GL-288.

### 7.5 ✅ Closed — profiles and uploads had no integration tests
**GL-212 (GL-231/232/233).** Three suites: `profile.me.test.js` (own-profile read/update,
full-replace semantics, the four system-owned-field rejections, role-field enforcement both
directions), `profile.public.test.js` (the public shape asserted against its *complete* expected key
set, `PUT /profiles/:userId` always 403 including for the owner, and the Sprint-3 deactivation guard
pinned ahead of the field existing), and `upload.create.test.js` (401, the 5 MB limit, the closed
folder allow-list, the MIME/extension mismatch in both directions, a stubbed storage failure
surfacing as `502 STORAGE_UNAVAILABLE`, and the stored object key shape). Storage is stubbed at the
`@supabase/supabase-js` boundary via `jest.unstable_mockModule` — CI never reaches a real bucket.

### 7.6 🔴 Open — `GET /users/:userId/reviews` still has no client, and `ReviewCard` still has no caller
Unchanged from Sprint 1, and now more visible rather than less. `reviewApi.js` exposes
`submitReview` and `getMyReviews`; there is **no client for `GET /users/:userId/reviews`**.
`ReviewCard` is referenced only by `ComponentDemoScreen`. `RatingSummary`'s "See all N reviews"
button is still hardcoded `disabled` with no `onPress`, under a comment that still reads
*"No reviews list screen until Sprint 2"* — a comment that is now wrong on its own terms.

**Why it got worse:** GL-222 means `reviewCount` is now real. In Sprint 1 the button sat under an
always-empty summary, so nobody could reach a state where it mattered. Now a profile can say
"See all 7 reviews" on a button that does nothing. **The reviews list screen was Bineth's
designated pull-forward and the pull-forward was not taken**; it stays Sprint 3 and is first in
line. Until then the disabled button is the most likely thing a demo viewer will try to tap.

**Ticketed for Sprint 3 as GL-303** — the client method, `ReviewsScreen` built to the
`#reviews-section` frame, `ReviewCard`'s first real caller, and the `onPress` that finally makes the
button live. It also adds a `rating` query parameter to §12.2 so the frame's star tabs narrow the
query rather than the loaded page.

### 7.7 ✅ Closed — `RatingSummary` read a `distribution` field the contract did not define
**GL-222/GL-264 resolved it in the direction the component already assumed: the aggregate gained
`distribution`.** Five counts, computed in the same pass, added to `RATING_AGGREGATE_SHAPE` and to
contract §6.10. Because the shape is exported from `review.model.js` and imported by
`profile.model.js` and `application.model.js`, all three documents picked the field up together.
GL-264 ran *before* the computation was written, so the story never shipped the five-empty-bars
state it existed to prevent.

### 7.8 ✅ Closed — Browse filtering was client-side only
**GL-215 added the query parameters and GL-216 moved the client onto them.** Filtering now narrows
the query, not the pages already fetched, so a matching gig on page 4 is reachable without scrolling
to it. The quieter half is fixed too: the result count and the list are computed from the same
filtered query, so they can no longer disagree the moment a chip is selected — which is what GL-121
AC9 required and never actually had. GL-243 also collapsed the chips and the sheet onto one filter
state, so the two controls cannot drift apart.

### 7.9 🔴 Open, now owned — the five items named for GL-209 that it never reached

**All five are ticketed for Sprint 3, off the cleanup budget:** GL-285 takes items 2, 3 and 4;
GL-288 takes item 1 alongside the §7.4 test gap; GL-294 takes item 5. Ten points across three
owners. GL-286, Sprint 3's cleanup budget, names nothing in advance — that is the correction.

GL-209 closed Done with its 13 points fully spent on eleven sub-tasks, every one a mismatch found
during the sweep (see §2). These five were named for that budget in advance, in this document, and
were never ticketed. **All five verified still present at `be92b4d`. No sprint owns them.**

1. **`GET /api/auth/admin-smoke-test` is still mounted** —
   [`server/src/routes/auth.routes.js:32`](../server/src/routes/auth.routes.js). Sprint 0 leftover.
   Note the test suite still exercises it, so deleting the route means deleting those assertions too.
   **GL-288** — which requires the RBAC coverage those assertions carried to be re-expressed against
   a real endpoint rather than simply lost.
2. **`EXPO_PUBLIC_USE_MOCK` still defaults to the mock** —
   [`app/src/constants/config.js:2`](../app/src/constants/config.js). Full detail in §7.3. **GL-285.**
3. **The em-dash→hyphen copy regression is still in three rendered strings** — introduced by
   GL-208's blanket replacement, which changed user-facing copy and not only comments:
   [`ApplicationTracker.js:68`](../app/src/components/application/ApplicationTracker.js)
   (`"Closed … - the position was filled."`),
   [`GigForm.js:328`](../app/src/components/gig/GigForm.js)
   (`"Not required - this gig is remote."`), and
   [`EditGigScreen.js:283`](../app/src/screens/business/EditGigScreen.js) (the delete-confirmation
   body). The v3 design uses em-dashes deliberately. Cosmetic, but it wants deciding once rather
   than screen by screen. **GL-285.**
4. **The `canViewBusinessProfile` guard is still in place** —
   [`GigDetailScreen.js:182`](../app/src/screens/shared/GigDetailScreen.js) reads
   `navigation.getState().routeNames.includes('PublicProfile')`. `PublicProfile` is registered
   unconditionally in `RootNavigator`, so this is now permanently true and the branch behind it is
   dead. **GL-285** — which also has to settle the guest case, since the guest stack registers
   `GigDetail` but not `PublicProfile`.
5. **The four apply failure paths are still unverified** — see §7.1. **GL-294.**

**Why they were missed, and what to do differently.** The cleanup budget is explicitly
discovery-driven: sub-tasks are created during the sprint, one per mismatch as it is found. Naming
work for it in advance does not reserve any of it, and eleven real discoveries consumed all
thirteen points. Either ticket these separately outside the budget, or stop naming candidates for
it. This is recorded in `ROADMAP.md` under E1. **Sprint 3 does both: separate tickets for all five,
and nothing pre-named for GL-286.**

### 7.10 🔴 Open — the business-block rating is still unmet (GL-122 AC6)
[`GigBusinessBlock.js:14`](../app/src/components/gig/GigBusinessBlock.js) still carries its
`// No rating slot` comment and `gig.service.js` still sends no rating for the business, so the gig
detail business block shows no rating. Deferred deliberately — closing it costs work in two epics
and the information is one tap away on the public profile — and it pairs with the reviews list in
Sprint 3. Worth noting it is the **second** of three instances of the same pattern: something left
inert pending a later story (the Apply button was the first, `RatingSummary`'s disabled button is
the third).

**Ticketed for Sprint 3 as GL-304**, sequenced after GL-303 so a tapped-through rating has a real
destination. The only server change is one field on `getPublicIdentity` in `profile.service.js` —
`gig.service.js` already passes that shape straight through, so E3 is untouched.

### 7.11 Smaller items, unchanged
- `DELETE /api/gigs/:id` has no cascade; applications survive with a dangling `gig` reference and
  read back `gig: null`. Documented and handled, but it will look odd in the applications list.
- `Application.create` and `adjustGigApplicantCount` are two separate writes with no transaction.
  A crash between them leaves the count one low. Low impact, worth knowing.
- `draft` gig status is renderable but unproducible; `savedBy` and `skillTrialResults` are declared
  and never written. `filled` is no longer in that set: **GL-328 gives it a producer**,
  `markGigFilled` in `gig.service.js` — a system transition with no HTTP route, idempotent on an
  already-`filled` gig, refusing a `closed` or `draft` one. GL-283's deadline auto-close still
  writes `closed`, a different rule, and `closeIfExpired`'s `status === 'open'` guard keeps the two
  from fighting over a filled gig even with a past deadline. **GL-329 renders it** across My Gigs,
  gig detail and the "still waiting on you" prompt, and **GL-330's integration suite**
  (`gig.filled.test.js`) proves the write, the idempotency, the `closed` refusal, the browse
  exclusion, and both status-writing rules' guards, against `listMyGigs`'s sweep as well as
  `closeIfExpired`. The trigger — counting hires against `positions` and calling `markGigFilled` —
  is still open, owned by E4's positions-filled auto-close story and not yet ticketed.
  **Sprint 3 gives two of the remaining three items a writer: `savedBy` via GL-292,
  `skillTrialResults` via GL-297. `draft` still has no producer and no ticket.** Note
  `skillTrialResults` gains a writer but **not a renderer** — the profile-badge story is deferred to
  Sprint 4, so a passed trial is stored and published by the API and invisible in the app until
  then. Deliberate, and recorded in `ROADMAP.md`'s carried risks.
- `GIG_SORT_ORDERS` is no longer unused — GL-216 consumes it in `GigFilters`.

### 7.12 🔴 Open — an admin signing in lands in the seeker tabs
[`RootNavigator.js:32`](../app/src/navigation/RootNavigator.js) chooses between exactly two role
branches: `const RoleTabs = role === 'business' ? BusinessTabs : SeekerTabs;`. There is no third
branch, no `screens/admin/` directory, and no `'admin'` anywhere in `app/src` outside a seeded mock
account. An admin who signs in therefore gets the **seeker** experience, and because admins have no
profile every profile call behind those tabs 403s — so the Profile tab is a wall and Browse is the
only thing that works.

This has never been hit in practice: admin accounts are not creatable through the API, so the only
way to reach it is the seeded account or a hand-made database row. It is recorded because Sprint 3
now has to fix it. The pulled-forward open-reports list (E6) is the first screen an admin will ever
see, which makes this row's real scope "build the admin surface" — a third role branch, the
directory, the screen, and a decision about what an admin lands on — rather than "add one list".

**Ticketed for Sprint 3 as GL-306**, owner Bineth. It is not ticketed separately from the reports
list: they are the same story, and splitting them would have put two stories in `RootNavigator.js`
at the same line. Its criteria 1–5 cover the branch, the directory, the landing decision and a
reachable sign-out, and depend on nothing but the `admin` role — so they are built before the queue
API exists rather than waiting behind it.

---

## 8. What Sprint 3 has to unblock

**Sprint 3 is now planned: GL-284–GL-306, 23 stories, 119 points, plus 82 sub-tasks (GL-307–GL-388).**
The keys below were added when it was ticketed; the assessments themselves are unchanged and still
describe the code at `be92b4d`. **All seven were taken.** Two items 8–9 below were not on this list
and are; two ROADMAP capabilities that were never in this section were cut to Sprint 4, noted at the
end. Where planning found an assessment here to be wrong, the correction is stated inline rather
than by rewriting the original.

1. **Reviews list screen** (E5) — the endpoint has existed and been tested since Sprint 1 and has
   still never been called by the app. It is the cheapest real feature available: `ReviewCard` is
   built, `GET /users/:userId/reviews` is paged and tested, and the only new code is a client
   method, a screen, and an `onPress` on a button that already renders. It also removes the most
   visible dead control in the app (§7.6). Bineth's carried pull-forward. **→ GL-303.**
2. **The business-block rating** (E3 + E5) — GL-122 AC6, open since Sprint 1 (§7.10). Needs
   `gig.service.js` to send a rating and `RatingSummary` to gain a compact form. **→ GL-304.**
   Correction found at planning: `gig.service.js` needs **no** change. It already passes
   `getPublicIdentity`'s result through as `business`, so widening that one function in
   `profile.service.js` is the whole server side, and the work lands in E5 and E2, not E5 and E3.
3. **Saved gigs** (E3) — `savedBy` has been declared, privacy-tested and unwritten for two sprints.
   Needs endpoints and a writer; the privacy guarantees are already pinned by
   `gig.saved-privacy.test.js`. **→ GL-292 (API), GL-293 (tab, screen, star).** GL-292 extends that
   privacy suite so it asserts the guarantees **while the field is being written**, which is the case
   it has never been able to cover.
4. **Positions-filled auto-close** (E4) — `closed_filled` is the last transition in the table with
   no caller, and `filled` is the last gig status nothing produces. These are the same feature.
   **→ GL-291 (the gig-side write, E3) and GL-296 (the trigger and the sweep, E4).** Two rules the
   Application & Hiring brief §6 adds that this entry did not anticipate: `shortlisted` is **never**
   auto-closed — the transition table's omission is the enforcement, not an oversight — and **any**
   application carrying a submitted trial is spared whatever its status.
5. **Forgot / reset password and account deactivation** (E2) — the deactivation guard and its
   disabled control are both already in place, so the screen work is the missing half.
   **→ GL-289/GL-290 (recovery, behind GL-284's email provider) and GL-287 (deactivation).**
   Correction found at planning: deactivation is **not** only the screen half — `isActive` is not on
   the `User` schema at all, and the User & Profile brief §9 also requires a deactivated business's
   gigs to drop out of browse, which reaches into `buildOpenGigFilter`.
6. **Report / complaint flow + moderation queue API + the open-reports list** (E5 + E6) — these
   three are now one unit and should be planned together. The roadmap deliberately pulls E6's
   read-only open-reports list forward from Sprint 4 so the Report button ships with a reader
   instead of writing into a queue nobody can open for a sprint. Note the list is the app's **first
   admin surface** (§7.12), so it costs a role branch in `RootNavigator` and a `screens/admin/`
   directory as well as the screen. Read-only — every action on a report stays Sprint 4.
   **→ GL-301 (report API), GL-305 (report client), GL-302 (queue API), GL-306 (admin surface).**
   All four are Bineth's, so the chain is single-threaded; GL-306's navigation half is sequenced
   ahead of the queue API to keep it off the critical path. **Worth knowing before implementing
   any of them:** unlike every other story this sprint, these four have **no business-rules brief**
   — the Community & Rating brief covers ratings and reviews only, and reporting appears nowhere in
   it, in scope or out. The rules were agreed at Sprint 3 planning and written into GL-301, which is
   the specification of record until a brief exists.
7. **The five unowned cleanup items** (§7.9), and the change-password test gap (§7.4) — small,
   and the second one guards credential-changing behaviour. **→ GL-285, GL-288, GL-294**, ten points
   across three owners, all off the cleanup budget.

**Two things in Sprint 3 that this section did not anticipate**, both from `ROADMAP.md`'s Sprint 3
rows rather than from the code:

8. **The Skill Trial** (E4) — the largest feature in the project so far, and the one this document
   had no entry for. **→ GL-295 (attach to gig), GL-297 (submission and review API), GL-298 (seeker
   screen and the apply gate), GL-299 (business review screen).** Two things in the code have been
   waiting for it: `assertValidRejection` already guards the two trial rejection codes behind
   `gig.skillTrial`, and `skillTrialResultSchema` has been on the `Profile` model since Sprint 1.
   GL-297 also opens the `trials` and `resumes` upload folders, closing the promise in
   `upload.validator.js`'s comment.
9. **Optional resume PDF attachment** (E4) — **→ GL-300.**

**Not taken, and moved to Sprint 4:** Skill Trial badges on the seeker profile (E2) — GL-297 writes
`skillTrialResults` but nothing renders it this sprint — and relevance ordering (E3), which is not
in the Gig & Job Marketplace brief's closed sort vocabulary and needs that list extended before it
can be built at all.

---

## 9. Verification performed for this document

- `npm test` in `server/` — **26 suites, 322 tests, all passing** (`--runInBand`; the default
  parallel run hits concurrent `mongodb-memory-server` startup contention across suites, which is
  environmental, not a defect). Up from 22 suites / 295 tests mid-sprint and 14 / 143 at the end of
  Sprint 1. The suites added in Sprint 2 are `auth.optional`, `gig.search`,
  `gig.viewer-application`, `application.business-lists`, `application.business-transitions`,
  `application.complete`, `review.mine`, `review.rating-aggregate` and `profile.service`.
- No test run for `app/` — there is still nothing to run (§7.4).
- `server/tests/` grepped for change-password coverage: **none found** (§7.4).
- Every route, model, service, validator and middleware in `server/src` read.
- Every screen, navigator, component and API module in `app/src` read.
- Jira cross-checked for GL-209–GL-283: 15 stories and 60 sub-tasks, **all Done**, 67 points
  planned and delivered, sprint closed 23 August 2026. No issue exists above GL-283.
- Each of the five §7.9 items and each ⬜ claim in §3 grepped individually at `be92b4d` rather than
  carried forward from the Sprint 1 audit.
