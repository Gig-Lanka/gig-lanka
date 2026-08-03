# Gig Lanka — Target Project Structure

**Purpose:** the agreed shape of the repository. Feed this to an agent working a sub-task so it puts files in the right place, and use it as the team reference so four people don't invent four layouts.

**Read this with:** `gig-lanka-sprint0-handover.md` (project context, tickets, decisions).

---

## How to read the annotations

| Tag | Meaning |
|---|---|
| `[S0 · GL-8]` | Created in Sprint 0 by ticket GL-8 |
| `[S1]` `[S2]` `[S3]` `[S4]` | Planned for that sprint — **not yet ticketed**, name is indicative |
| *(no tag)* | Structural directory, no file of its own |

**Anything tagged `[S1]`–`[S4]` does not exist yet.** Do not create it early. It is here so nobody designs a folder layout that can't accommodate it later.

---

## Repository root

```
gig-lanka/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                          [S0 · GL-50]  lint + test on PRs to develop/main
│   └── pull_request_template.md            [S0 · GL-24]
│
├── .husky/
│   └── pre-commit                          [S0 · GL-49]  lint-staged on staged files only
│
├── docs/
│   ├── api-contract.md                     [S0 · GL-36, GL-37]  THE contract — read before any endpoint
│   └── gig-lanka.postman_collection.json   [S0 · GL-39]
│
├── app/                                    Expo React Native client
├── server/                                 Express + MongoDB API
│
├── .gitignore                              [S0 · GL-22]
├── .prettierrc                             [S0 · GL-48]  single shared config, both halves
├── package.json                            [S0 · GL-49]  root only — husky + lint-staged
└── README.md                               [S0 · GL-21]  project, layout, how to run each side
```

Rubric deliverables (SRS, diagrams, test plan, report) are **not** in this repo by decision — Lahiru manages those separately.

---

## `server/` — Express + MongoDB API

```
server/
├── src/
│   ├── config/
│   │   ├── env.js                          [S0 · GL-30]  ONLY file that reads process.env
│   │   └── db.js                           [S0 · GL-32]  Mongoose connect + graceful shutdown
│   │
│   ├── models/
│   │   ├── user.model.js                   [S0 · GL-33]  email, passwordHash, role enum
│   │   ├── refreshToken.model.js           [S0 · GL-34]  token, user ref, expiresAt + TTL index
│   │   ├── profile.model.js                [S1]  seeker + business profile data
│   │   ├── gig.model.js                    [S1]
│   │   ├── application.model.js            [S1]  incl. status state machine
│   │   ├── review.model.js                 [S1]
│   │   ├── skillTrial.model.js             [S3]
│   │   └── report.model.js                 [S3]  complaints feeding the moderation queue
│   │
│   ├── routes/
│   │   ├── index.js                        [S0 · GL-28]  mounts all routers under /api
│   │   ├── health.routes.js                [S0 · GL-28]
│   │   ├── auth.routes.js                  [S0 · GL-56..GL-59]
│   │   ├── profile.routes.js               [S1]
│   │   ├── gig.routes.js                   [S1]
│   │   ├── application.routes.js           [S1]
│   │   ├── review.routes.js                [S2]
│   │   ├── skillTrial.routes.js            [S3]
│   │   └── admin.routes.js                 [S4]
│   │
│   ├── controllers/                        one per route file, same basename
│   │   └── auth.controller.js              [S0 · GL-56..GL-59]  thin — no business logic
│   │
│   ├── services/                           business logic lives here, reusable + testable
│   │   ├── auth.service.js                 [S0 · GL-56, GL-57]  hashing, credential comparison
│   │   └── token.service.js                [S0 · GL-58]  sign, verify, persist, revoke
│   │
│   ├── validators/                         one per route file, same basename
│   │   └── auth.validator.js               [S0 · GL-60]  Joi schemas
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js              [S0 · GL-61, GL-62]  requireAuth + requireRole
│   │   ├── error.middleware.js             [S0 · GL-29]  central handler, registered LAST
│   │   ├── notFound.middleware.js          [S0 · GL-29]  JSON 404, not Express HTML
│   │   ├── validate.middleware.js          [S0 · GL-60]  runs a Joi schema, returns 400
│   │   └── upload.middleware.js            [S1]  multer, for avatars / trial submissions
│   │
│   ├── utils/
│   │   ├── asyncHandler.js                 [S0 · GL-29]  wraps async handlers → error middleware
│   │   ├── ApiError.js                     [S0 · GL-29]  thrown by services, caught centrally
│   │   └── response.js                     [S0 · GL-36]  success/error envelope helpers
│   │
│   ├── app.js                              [S0 · GL-27]  Express assembly — exported, no listen()
│   └── server.js                           [S0 · GL-27]  imports app, binds port, connects DB
│
├── scripts/
│   └── seed.js                             [S0 · GL-35]  idempotent, one user per role
│
├── tests/
│   ├── setup.js                            [S0 · GL-64]  in-memory Mongo, reset between tests
│   ├── helpers/
│   │   └── auth.helper.js                  [S0 · GL-64]  build tokens/users for tests
│   └── auth/
│       ├── register.test.js                [S0 · GL-65]
│       ├── login.test.js                   [S0 · GL-65]
│       ├── token.test.js                   [S0 · GL-66]
│       └── rbac.test.js                    [S0 · GL-67]
│
├── .env.example                            [S0 · GL-30]  every var, dummy values, committed
├── .eslintrc.js                            [S0 · GL-48]  Node target
├── package.json                            [S0 · GL-26]
└── README.md                               [S0 · GL-21]  setup, seed creds, schema + RBAC conventions
```

### Server layering rules

Requests flow **route → validate → middleware → controller → service → model**. Never skip inward.

| Layer | Does | Never does |
|---|---|---|
| `routes/` | Declares paths, attaches middleware and one controller method | Contains logic |
| `middleware/` | Auth, role checks, validation, error handling | Talks to models directly (except `requireAuth` loading the user) |
| `controllers/` | Reads `req`, calls a service, sends the response | Contains business logic, queries models, uses try/catch |
| `services/` | Business logic, model queries, token work | Touches `req` or `res` |
| `models/` | Schema, indexes, instance methods, `toJSON` transforms | Contains request-shaped logic |

**Controllers must not contain `try/catch`.** Wrap them in `asyncHandler` and throw `ApiError` from services — `error.middleware.js` catches everything.

**Every response goes through the envelope helpers in `utils/response.js`.** The React Native client is built against that shape; a hand-rolled response breaks it silently.

---

## `app/` — Expo React Native client

```
app/
├── src/
│   ├── api/
│   │   ├── client.js                       [S0 · GL-74, GL-75]  Axios + interceptors + refresh queue
│   │   ├── index.js                        [S0 · GL-39]  resolves mock vs real from USE_MOCK flag
│   │   ├── authApi.js                      [S0 · GL-74]  real implementation
│   │   ├── mock/
│   │   │   └── authApi.js                  [S0 · GL-38]  same signatures, fake data, FAKES FAILURES TOO
│   │   ├── profileApi.js                   [S1]
│   │   ├── gigApi.js                       [S1]
│   │   ├── applicationApi.js               [S1]
│   │   ├── reviewApi.js                    [S2]
│   │   └── adminApi.js                     [S4]
│   │
│   ├── components/
│   │   ├── ui/                             shared kit — owned by GL-14, used by everyone
│   │   │   ├── Button.js                   [S0 · GL-53]
│   │   │   ├── TextInput.js                [S0 · GL-53]
│   │   │   ├── Card.js                     [S0 · GL-54]
│   │   │   ├── Screen.js                   [S0 · GL-54]  safe area + padding wrapper
│   │   │   ├── EmptyState.js               [S0 · GL-54]
│   │   │   ├── Loader.js                   [S0 · GL-54]
│   │   │   └── index.js                    [S0 · GL-54]  barrel export
│   │   ├── profile/                        [S1]  feature-specific, owned by that epic
│   │   ├── gig/                            [S1]  GigCard, GigFilters
│   │   ├── application/                    [S1]  StatusBadge, ApplicantRow
│   │   └── review/                         [S1]  StarRating, ReviewCard
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── RoleSelectScreen.js         [S0 · GL-68]
│   │   │   ├── SignUpScreen.js             [S0 · GL-69]
│   │   │   └── LoginScreen.js              [S0 · GL-70]
│   │   ├── seeker/
│   │   │   ├── BrowseScreen.js             [S0 · GL-78 placeholder] → [S2 real]
│   │   │   ├── MyApplicationsScreen.js     [S0 · GL-78 placeholder] → [S2 real]
│   │   │   └── SeekerProfileScreen.js      [S0 · GL-78 placeholder] → [S1 real]
│   │   ├── business/
│   │   │   ├── MyGigsScreen.js             [S0 · GL-79 placeholder] → [S1 real]
│   │   │   ├── ApplicantsScreen.js         [S0 · GL-79 placeholder] → [S2 real]
│   │   │   └── BusinessProfileScreen.js    [S0 · GL-79 placeholder] → [S1 real]
│   │   ├── shared/                         [S1]  GigDetail, PublicProfile — both roles
│   │   ├── admin/                          [S4]
│   │   └── dev/
│   │       └── ComponentDemoScreen.js      [S0 · GL-55]  dev only, excluded from prod nav
│   │
│   ├── navigation/
│   │   ├── RootNavigator.js                [S0 · GL-77]  conditional render, NOT navigation
│   │   ├── AuthStack.js                    [S0 · GL-77]
│   │   ├── SeekerTabs.js                   [S0 · GL-78]
│   │   ├── BusinessTabs.js                 [S0 · GL-79]
│   │   └── AdminStack.js                   [S4]
│   │
│   ├── store/
│   │   ├── AuthContext.js                  [S0 · GL-72]  single source of truth for session
│   │   └── secureStorage.js                [S0 · GL-73]  expo-secure-store wrapper
│   │
│   ├── hooks/
│   │   ├── useAuth.js                      [S0 · GL-72]  consumes AuthContext
│   │   └── useDebounce.js                  [S2]  for gig search
│   │
│   ├── constants/
│   │   ├── config.js                       [S0 · GL-47]  ONLY file reading EXPO_PUBLIC_* vars
│   │   └── enums.js                        [S1]  roles, application statuses, gig states
│   │
│   └── utils/
│       ├── validation.js                   [S0 · GL-69]  client-side form rules
│       └── format.js                       [S1]  dates, currency
│
├── assets/                                 icons, splash, fonts
├── App.js                                  [S0 · GL-43]  providers + RootNavigator, nothing else
├── global.css                              [S0 · GL-44]  Tailwind directives
├── tailwind.config.js                      [S0 · GL-44, GL-52]  content globs + design tokens
├── babel.config.js                         [S0 · GL-44]  NativeWind preset
├── metro.config.js                         [S0 · GL-44]  NativeWind wrapper
├── app.json                                [S0 · GL-43]  Expo config
├── .env.example                            [S0 · GL-47]
├── .eslintrc.js                            [S0 · GL-48]  React + hooks, rules-of-hooks as error
├── package.json                            [S0 · GL-43]
└── README.md                               [S0 · GL-47]  beginner-level setup guide
```

### Client layering rules

| Layer | Does | Never does |
|---|---|---|
| `screens/` | Composes components, calls hooks and api functions, handles UI state | Talks to Axios directly, reads tokens, uses `StyleSheet` |
| `components/ui/` | Presentational only — props in, JSX out | API calls, navigation, business logic |
| `components/<feature>/` | Feature-specific presentation | API calls |
| `navigation/` | Route structure, reads auth status from context | Reads tokens from secure storage |
| `store/` | Session state and secure token access | Renders UI |
| `api/` | HTTP calls, token attachment, refresh | Renders UI or navigates |

**No screen ever sees a token.** `client.js` attaches it, refreshes it, and retries. If a screen needs to know about tokens, the interceptor is wrong.

**All styling is NativeWind `className`.** No `StyleSheet.create` anywhere. Colours come from token names (`bg-primary`), never raw hex.

**Feature components belong to the epic that needs them.** `StarRating` is Bineth's, `GigCard` is Anupa's. Only `components/ui/` is shared — if you need something added there, ask rather than fork.

---

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Server layer files | `<resource>.<layer>.js` | `auth.controller.js`, `gig.service.js` |
| Models | `<entity>.model.js`, singular | `user.model.js` |
| React components | PascalCase, one per file | `Button.js`, `GigCard.js` |
| Screens | PascalCase + `Screen` suffix | `LoginScreen.js` |
| Navigators | PascalCase + `Navigator` / `Stack` / `Tabs` | `RootNavigator.js`, `SeekerTabs.js` |
| Hooks | camelCase, `use` prefix | `useAuth.js` |
| API modules | camelCase + `Api` suffix | `gigApi.js` |
| Test files | mirror source path, `.test.js` | `tests/auth/login.test.js` |
| Branches | `feature/<short-description>` | `feature/jwt-login` |
| Commits | include the Jira key | `GL-57 add login endpoint` |

Routes are plural, lowercase, hyphenated: `/api/gigs`, `/api/skill-trials`.

---

## Rules for an agent implementing a sub-task

1. **Read `docs/api-contract.md` first** if the task touches an endpoint or an API call. The response envelope is fixed and both sides depend on it.
2. **Put files exactly where this document says.** If the task seems to need a location not listed here, that is a signal to ask, not to invent.
3. **Respect the ticket's `Out of scope` section.** It exists because someone else owns that work, and duplicate implementations in a four-person monorepo are expensive to unpick.
4. **Stay inside your lane's directories.** Cross-lane edits need the owner's review.
5. **Do not create `[S1]`–`[S4]` files early.** Empty scaffolding rots and confuses the person who eventually owns it.
6. **JavaScript only. No TypeScript.**
7. **Never commit secrets.** `.env` is gitignored; `.env.example` gets the dummy values.
8. Install React Native packages with `npx expo install`, not `npm install`, so versions match the SDK.
