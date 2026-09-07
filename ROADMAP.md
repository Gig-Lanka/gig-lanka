# Gig Lanka — Roadmap

Feature-level plan across all sprints. Tickets live in Jira; this is the map.
Updated at the end of every sprint. Last updated: 6 September 2026, Sprint 3 planned (GL-284–GL-306).

## Velocity

| Sprint | Planned | Delivered | Days | Notes |
|---|---|---|---|---|
| 0 | 61 | 80 | 7 | 18-pt design block (GL-82–GL-100) added on the final day and completed in-sprint, plus one standalone task. No spillover. Lahiru 37, Sayuni 33, Anupa 6, Bineth 3 |
| 1 | 115 | 120 | | 24 labelled stories, all Done, no spillover. Lahiru 36, Anupa 27, Sayuni 26, Bineth 26 = 115; the remaining 5 are GL-207, an unpointed cleanup story added at the close of the sprint. Points are relative size only — the 1 pt ≈ 1.5 h scale is dropped |
| 2 | 67 | 67 | 6 | 17–23 August. GL-209–GL-223, 15 stories, all Done, plus 60 sub-tasks, all Done. No spillover, nothing added mid-sprint, nothing pulled forward. Lahiru 31 (13 of it the cleanup budget), Anupa 13, Sayuni 12, Bineth 11. Sprint goal — "close the hire-and-rate loop and complete an app-wide design cleanup" — met |
| 3 | 119 | | 10 | GL-284–GL-306, 23 stories, plus 82 sub-tasks. Lahiru 56 (13 of it the cleanup budget), Bineth 29, Anupa 23, Sayuni 21. Sprint goal — "close two loops end to end: a filed report reaches the app's first admin surface, and a skill trial runs from gig to pass/fail". 13 of the 15 planned Sprint 3 capabilities taken; Skill Trial badges (E2) and relevance ordering (E3) moved to 4 |
| 4 | | | | |

## Status key
✅ done · 🔨 in progress · 📋 ticketed, not started · ⬜ planned, not ticketed

---

## E1 · Platform & Foundations — Lahiru
| Capability | Sprint | Status |
|---|---|---|
| Repo, CI, Expo + NativeWind, Express + Mongo, deploy | 0 | ✅ |
| Design tokens, component rebuild, auth shell, auth restyle | 0 | ✅ |
| Shared kit extension for the v3 screens — chips, badges, avatars, sheets, screen header | 1 | ✅ |
| Shared formatting utilities & domain enums — currency, relative time, closed vocabularies | 1 | ✅ |
| Supabase storage & upload service | 1 | ✅ |
| App-wide cleanup pass — design and behaviour mismatches | 2 | ✅ budget spent, five named items not reached |
| Transactional email provider | 3 | 📋 GL-284 |
| App-wide leftovers — mock default, em-dash copy, dead profile guard | 3 | 📋 GL-285 — §7.9 items 2–4, ticketed off the budget |
| App-wide cleanup pass — design and behaviour mismatches | 3 | 📋 GL-286 — 13-pt budget again, nothing pre-named |
| Empty, loading and error states swept across every feature screen | 4 | ⬜ |
| E2E test setup | 4 | ⬜ |
| Release build (EAS) | 4 | ⬜ |
| Bug bash & demo hardening | 4 | ⬜ |

> **Supabase is storage only.** Files go to a Supabase bucket, the returned URL is stored in
> Mongo. MongoDB Atlas remains the database and auth remains self-built JWT. This narrows the
> "not Supabase" line in handover §17 rather than reopening it.

> **The cleanup story is a fixed 13-point budget, not a scoped piece of work.** Its sub-tasks are
> created by Lahiru during the sprint, one per mismatch as it is found, and assigned to whichever
> member owns the screen — the only story in the project whose sub-tasks do not inherit their
> parent's assignee.

> **What the 13 points actually bought, and what they did not.** GL-209 closed with eleven
> sub-tasks: tab-bar, spinner, date-picker and dropdown colours; heading, nav-bar and profile-scroll
> spacing; clipped filter chips; the profile black-screen artefact; the docs update; and GL-283,
> which made a gig's deadline close it server-side instead of leaving three disagreeing "is this
> open" signals on gig detail. That is the budget working as designed — mismatches found during the
> sprint, fixed in the sprint. But it means the budget was fully consumed by what the sweep turned
> up, and **the five items `docs/feature-inventory.md` had named for GL-209 in advance were never
> reached**: the leftover `admin-smoke-test` route, the `EXPO_PUBLIC_USE_MOCK` default, the
> em-dash→hyphen copy regression, the `canViewBusinessProfile` guard, and device re-verification of
> the four apply failure paths. All five are still in the code, still open, and now **unowned** —
> no sprint claims them. They are listed in feature-inventory §7.9. Naming candidates for a
> discovery-driven budget did not survive contact with actual discovery; next sprint, ticket them
> separately or do not name them.

> **Sprint 3 took the first option: all five are ticketed separately, off the budget.** GL-285
> carries the `EXPO_PUBLIC_USE_MOCK` default, the em-dash copy regression and the dead
> `canViewBusinessProfile` guard; GL-288 carries the `admin-smoke-test` route deletion alongside the
> change-password test gap (§7.4); GL-294 carries device re-verification of the four apply failure
> paths. Ten points, three owners, none of it on GL-286. **GL-286 names nothing in advance** — that
> is the whole correction.

## E2 · User & Profile Management — Sayuni
| Capability | Sprint | Status |
|---|---|---|
| JWT auth, RBAC, session persistence, auth screens | 0 | ✅ |
| Profile model & profile API — own read/update, public read | 1 | ✅ |
| My profile & edit profile, seeker and business | 1 | ✅ |
| Work experience & education management | 1 | ✅ |
| Profile photo upload | 1 | ✅ |
| Public profile view — seeker and business | 1 | ✅ |
| Account settings & change password | 2 | ✅ |
| Optional authentication middleware — for partially public endpoints | 2 | ✅ |
| Profile & upload integration tests | 2 | ✅ |
| Forgot password & reset password | 3 | 📋 GL-289 (API), GL-290 (screens) |
| Account deactivation | 3 | 📋 GL-287 |
| Change-password tests & smoke-test route deletion | 3 | 📋 GL-288 — §7.4 and §7.9 item 1, ticketed off the budget |
| Skill Trial badges on seeker profile | 4 | ⬜ moved from 3 — the trial writes `skillTrialResults` in Sprint 3, nothing renders it until 4 |

> Corrected against the feature brief: **business verification is not in scope anywhere.** The
> Sprint 0 draft roadmap listed it at Sprint 2. Trust is signalled through the rating summary only.

> Profiles and uploads were the only two API components with no test coverage at the end of
> Sprint 1. The public-profile whitelist and the role-field rejection rules are where a privacy
> regression fails silently, which is why GL-212 exists as its own story rather than as a chore.

## E3 · Gig & Job Marketplace — Anupa
| Capability | Sprint | Status |
|---|---|---|
| Gig model & gig API — create, read, list, update, close, delete | 1 | ✅ |
| My gigs list | 1 | ✅ |
| Post a gig | 1 | ✅ |
| Edit & close a gig | 1 | ✅ |
| Browse gigs | 1 | ✅ |
| Gig detail | 1 | ✅ |
| Deadline countdown & urgency states | 1 | ✅ shipped early, planned for 2 |
| Apply action wired on gig detail | 2 | ✅ |
| Search, filter, sort, categories | 2 | ✅ |
| Already-applied state on gig detail | 2 | ✅ |
| Deadline auto-close — a past `applicationsCloseDate` closes the gig server-side | 2 | ✅ unplanned, arrived via GL-283 |
| Saved gigs | 3 | 📋 GL-292 (API), GL-293 (tab, screen, star) |
| Gig moves to Filled, driven by hiring | 3 | 📋 GL-291 — the gig-side write; E4's GL-296 is the trigger |
| Relevance ordering | 4 | ⬜ moved from 3 — not in the marketplace brief's closed sort vocabulary (§3, §7); needs that list extended before it can be built |

> **GL-214 was the first story of Sprint 2 and it was one line of code.** The Apply button on gig
> detail shipped with no `onPress`, so no seeker could apply for the whole of Sprint 1 — which
> meant no applications, nothing for an applicant list to show, and nothing for the rating gate to
> fire on. It closed GL-122 AC7 and GL-123 AC1, both of which were marked met and were not.
> Shipped as GL-236. The four apply *failure* paths behind it were signed off as device-verified
> in Sprint 1 while the screen had no entry point, so none was actually reachable at the time;
> re-verifying them was named for the GL-209 budget and never happened. Still outstanding.

## E4 · Application & Hiring — Lahiru
| Capability | Sprint | Status |
|---|---|---|
| Application model & status state machine | 1 | ✅ |
| Apply & withdraw API — one application per gig, frozen profile snapshot | 1 | ✅ |
| Apply screen | 1 | ✅ |
| My applications & application detail with the transparency tracker | 1 | ✅ |
| Mark a hire complete — the `completed` status and its transition | 2 | ✅ |
| Applicant list & applicant detail — Viewed set on open | 2 | ✅ |
| Shortlist, hire, and reject with mandatory reason codes | 2 | ✅ |
| Positions-filled auto-close rules | 3 | 📋 GL-296 — calls E3's GL-291 |
| Skill Trial — attach to gig, submit, mark pass/fail | 3 | 📋 GL-295 (attach), GL-297 (API), GL-298 (seeker), GL-299 (business) |
| Optional resume PDF attachment | 3 | 📋 GL-300 |
| Re-verify the four apply failure paths | 3 | 📋 GL-294 — §7.9 item 5, ticketed off the budget |

> **Marking a hire complete sits here, not in E5.** Nothing owned it before: the Application brief
> ends at `Hired` and the Community brief begins at "a completed gig". It changes an application's
> status and this epic owns that object, so it cannot sit with E5 under the epic-ownership rule.
> **The business marks it complete** — they hired, they know when the work finished. E5 only reads
> the result.

> **Shortlisting stays mandatory on the path to hiring.** It was briefly considered for Sprint 3
> and moved back: if hiring could bypass shortlisting, businesses would, and a seeker would never
> learn they were shortlisted — which is the visibility this epic exists to provide. It also means
> the tracker demos a stage that actually lights up.

## E5 · Community & Rating — Bineth
| Capability | Sprint | Status |
|---|---|---|
| Review model & rating aggregate schema | 1 | ✅ |
| Star rating & review components | 1 | ✅ |
| Rating summary block on profiles | 1 | ✅ |
| Review submission API gated on a hired application | 1 | ✅ |
| Rate business & rate worker screens — role-specific categories | 1 | ✅ |
| Aggregate ratings computed onto profiles | 2 | ✅ |
| Rating entry point — completed gigs screen, the gate on `completed`, 14-day window | 2 | ✅ |
| Reviews list screen | 3 | 📋 GL-303 — moved from 2, pull-forward not taken, first in line |
| Inline rating on the gig detail business block | 3 | 📋 GL-304 — closes GL-122 AC6 |
| Report / complaint flow | 3 | 📋 GL-301 (API), GL-305 (client) — its reader ships in the same sprint, see E6 |
| Moderation queue API | 3 | 📋 GL-302 |

> **The reviews list screen was Bineth's designated pull-forward, and it was not pulled forward.**
> GL-222 and GL-223 both cleared and the screen was never started — no ticket for it exists. So it
> stays Sprint 3 and the situation is unchanged: `GET /users/:userId/reviews` still has no client,
> `ReviewCard` is still referenced only by the dev gallery, and the "See all N reviews" button is
> still hardcoded `disabled` with no `onPress`. That button is now visibly wrong rather than
> quietly wrong — GL-222 means the count beside it is real. It is first in line for Sprint 3.

> **The inline business-block rating was deferred deliberately.** GL-122 AC6 is unmet: the gig
> detail business block shows no rating, because `GET /api/gigs/:id` never sends one and
> `RatingSummary` has no compact form. Closing it costs work in two epics, and the information is
> already one tap away on the public profile — so it pairs with the reviews list in Sprint 3.

## E6 · Admin & Moderation — split four ways
| Capability | Sprint | Status |
|---|---|---|
| Open reports list — read-only, admin-gated; the first admin surface in the app | 3 | 📋 GL-306 — pulled forward from 4; owner Bineth |
| Admin screens: disputes, moderation queue actions, account status | 4 | ⬜ |

> **The open-reports list is pulled forward to Sprint 3 so the report flow ships with a reader.**
> E5 puts the report/complaint flow and the moderation queue API in Sprint 3. Left alone, that
> would ship a Report button whose reports land in a queue nobody can open for a whole sprint — a
> safety-shaped feature that visibly does nothing, and the fifth instance of the pattern already
> recorded under carried risks. Pulling one read-only screen forward is the cheapest way to avoid
> it: the queue API is being written in the same sprint anyway, and the `admin` role already exists
> in the `User` enum and is already honoured by `requireRole`.

> **Scope it as the first admin surface, not as one screen.** There is no admin path in the app
> today: `RootNavigator.js:32` reads `role === 'business' ? BusinessTabs : SeekerTabs`, so an admin
> signing in lands in the seeker tabs and hits a 403 wall, because admins have no profile. There is
> no `screens/admin/` directory and no admin branch anywhere. So this row buys four things — a third
> role branch in `RootNavigator`, the `screens/admin/` directory, the reports list itself, and a
> decision about what an admin sees on landing. Still small, but point it as a surface, not a list.

> **Read-only means read-only.** No resolve, dismiss, suspend or any other action on this screen.
> Every action on a report is dispute handling, which stays Sprint 4 with the rest of E6. The one
> thing Sprint 3 must guarantee is that a filed report is visible to somebody.

> **E6 is split four ways and this row still needs an owner**, assigned at Sprint 3 planning. It is
> an admin screen, so it sits in E6 under the epic-ownership rule even though the queue it reads
> belongs to E5.

> **Owner assigned at Sprint 3 planning: Bineth**, for GL-306 specifically — GL-6 itself still has
> no standing assignee. He also owns both halves of E5's report work, so the whole report-to-admin
> chain (GL-301 → GL-302 → GL-306) is one person's and runs serially. The mitigation is in the
> ticket: the navigation half of the admin surface — the third role branch, `screens/admin/`, the
> landing decision and sign-out — depends on nothing but the `admin` role and is built first, so
> only the list's data binding waits on the queue API.

---

## Out of scope for the whole project
In-app chat · push notifications · geolocation/maps · Sinhala/Tamil localisation ·
in-app payments · separate admin web panel · business verification · cover letters,
screening questions and years-of-experience fields anywhere

## Carried risks

- **A business that never marks a hire complete leaves both sides unable to review, permanently.**
  Now live rather than theoretical: GL-218 shipped `completed` and only the business can set it, so
  if they never do, neither party gets their review. GL-223 narrowed the exposure at one end by
  adding a 14-day window *after* completion, but nothing bounds the wait *for* completion. Nobody
  gains an advantage — each loses one — but the seeker is the one who did the work. Still recorded
  rather than solved; disputes are the Sprint 4 admin story.
- **Sprint 2's goal was a chain, not four parallel tracks, and the chain held.** E5's entry point
  needed E4's `completed` status and its applicant endpoints, so GL-223 waited on GL-218 and
  GL-219. Bineth started on the aggregate, which was unblocked, and the integration landed late in
  the sprint by construction. No spillover — but this worked in a 6-day sprint and should not be
  read as evidence that a longer dependency chain would.
- **Sprint 3 runs a longer chain than that warning was written about, across three people.** The
  skill trial is GL-295 → GL-297 → {GL-298, GL-299, GL-300}: three deep, and the first link is
  Anupa's file territory even though the story is Lahiru's. The report loop is GL-301 → GL-302 →
  GL-306, three deep and **entirely Bineth's**, so none of it can run in parallel. Ten days is what
  makes both survivable; in a six-day sprint neither would be. Both mitigations are written into the
  tickets rather than left to memory — GL-295 goes early in Lahiru's order, and GL-306's navigation
  half is built before the queue API exists.
- **The skill trial is one capability spread over four stories and three epics' worth of files.**
  ROADMAP and the Application & Hiring brief both put it wholly in E4, but GL-295 edits `gig.model`,
  `gig.validator` and `GigForm`, and GL-297 writes into `Profile` through a narrow service boundary.
  The epic-ownership rule held — every story is Lahiru's — at the cost of concentrating 30 of the
  sprint's 119 points on one member. Watch it: if the trial slips, it takes E4 with it.
- **The cleanup story was the unbounded part, and it did fill up.** Thirteen points bought eleven
  sub-tasks, every one of them a mismatch found during the sweep. It did not overrun and it did not
  compete with the loop for days. What it did do is consume the whole budget on discoveries, so the
  items named for it in advance were never reached — see the E1 note. The budget mechanism works;
  pre-naming work for it does not.
- **Two Sprint 1 seams closed as Done while their acceptance criteria were unmet** — the Apply
  button (GL-122 AC7, GL-123 AC1) and the business-block rating (GL-122 AC6). Both arose the same
  way: a story shipped with explicit licence to leave something inert until a later story landed,
  and the later story read that inertness as pre-existing context. Watch for it wherever a ticket
  says "until X lands". **GL-236 closed the first. The second is still open** — `GigBusinessBlock`
  still carries its "No rating slot" comment and `GET /api/gigs/:id` still sends no rating — and it
  is still Sprint 3. Sprint 2 added a third instance of the same pattern: `RatingSummary`'s "See all
  N reviews" button, left `disabled` for a reviews list screen that did not arrive.
  **Sprint 3 breaks the pattern deliberately for the first time.** The report/complaint flow would
  have been the fifth instance — a Report button writing into a queue with no reader until Sprint 4
  — so E6's open-reports list is pulled forward to ship alongside it. The rule this establishes: a
  feature that writes something a human is supposed to act on does not ship before the screen that
  shows it. That is narrower than "no inert code" and is the part worth holding to.
  **Both open instances are ticketed for Sprint 3** — GL-304 closes GL-122 AC6, GL-303 closes the
  disabled "See all N reviews" button — and GL-301/GL-306 keep the report flow from becoming a
  fourth. **One new instance is accepted deliberately, with eyes open:** GL-297 writes
  `skillTrialResults` onto the seeker's profile and the story that renders those badges is deferred
  to Sprint 4, so a passed trial is stored and public in the API but invisible in the app until then.
  It is display, not an action queue, so it does not violate the rule above — but it is the same
  shape and it is recorded here rather than discovered later.
- Per-assignee Jira reports still render Sayuni as Unassigned. Data is correct; the widget cannot
  resolve her. Check Project settings → Access before re-diagnosing.
- Sub-tasks in this project **can** carry story points, but none ever has — checked at the Sprint 2
  boundary and still true across all 60 of its sub-tasks. Points stayed on stories, so velocity
  remains comparable across sprints and Sprint 2's delivered 67 is the story-level sum exactly.
  Whether the board would roll sub-task points up is therefore **still untested**; it needs a sprint
  that deliberately points a sub-task, and doing that will break comparability with Sprints 0–2.
