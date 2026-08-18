# Gig Lanka — Roadmap

Feature-level plan across all sprints. Tickets live in Jira; this is the map.
Updated at the end of every sprint. Last updated: 17 August 2026, Sprint 2 planned.

## Velocity

| Sprint | Planned | Delivered | Days | Notes |
|---|---|---|---|---|
| 0 | 61 | 80 | 7 | 18-pt design block (GL-82–GL-100) added on the final day and completed in-sprint, plus one standalone task. No spillover. Lahiru 37, Sayuni 33, Anupa 6, Bineth 3 |
| 1 | 115 | 120 | | 24 labelled stories, all Done, no spillover. Lahiru 36, Anupa 27, Sayuni 26, Bineth 26 = 115; the remaining 5 are GL-207, an unpointed cleanup story added at the close of the sprint. Points are relative size only — the 1 pt ≈ 1.5 h scale is dropped |
| 2 | 67 | | | GL-209–GL-223, 15 stories. Deliberately small: a viva sits at the end of it and two sprints follow. Lahiru 31 (13 of it the cleanup budget), Anupa 13, Sayuni 12, Bineth 11 |
| 3 | | | | |
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
| App-wide cleanup pass — design and behaviour mismatches | 2 | 📋 GL-209 |
| Transactional email provider | 3 | ⬜ |
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

## E2 · User & Profile Management — Sayuni
| Capability | Sprint | Status |
|---|---|---|
| JWT auth, RBAC, session persistence, auth screens | 0 | ✅ |
| Profile model & profile API — own read/update, public read | 1 | ✅ |
| My profile & edit profile, seeker and business | 1 | ✅ |
| Work experience & education management | 1 | ✅ |
| Profile photo upload | 1 | ✅ |
| Public profile view — seeker and business | 1 | ✅ |
| Account settings & change password | 2 | 📋 GL-210, GL-211 |
| Optional authentication middleware — for partially public endpoints | 2 | 📋 GL-213 |
| Profile & upload integration tests | 2 | 📋 GL-212 |
| Forgot password & reset password | 3 | ⬜ |
| Account deactivation | 3 | ⬜ |
| Skill Trial badges on seeker profile | 3 | ⬜ |

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
| Apply action wired on gig detail | 2 | 📋 GL-214 |
| Search, filter, sort, categories | 2 | 📋 GL-215, GL-216 |
| Already-applied state on gig detail | 2 | 📋 GL-217 |
| Saved gigs | 3 | ⬜ moved from 2 |
| Gig moves to Filled, driven by hiring | 3 | ⬜ |
| Relevance ordering | 3 | ⬜ |

> **GL-214 is the first story of Sprint 2 and it is one line of code.** The Apply button on gig
> detail shipped with no `onPress`, so no seeker could apply for the whole of Sprint 1 — which
> means no applications, nothing for an applicant list to show, and nothing for the rating gate to
> fire on. It closes GL-122 AC7 and GL-123 AC1, both of which were marked met and were not.

## E4 · Application & Hiring — Lahiru
| Capability | Sprint | Status |
|---|---|---|
| Application model & status state machine | 1 | ✅ |
| Apply & withdraw API — one application per gig, frozen profile snapshot | 1 | ✅ |
| Apply screen | 1 | ✅ |
| My applications & application detail with the transparency tracker | 1 | ✅ |
| Mark a hire complete — the `completed` status and its transition | 2 | 📋 GL-218 |
| Applicant list & applicant detail — Viewed set on open | 2 | 📋 GL-219, GL-220 |
| Shortlist, hire, and reject with mandatory reason codes | 2 | 📋 GL-219, GL-221 |
| Positions-filled auto-close rules | 3 | ⬜ moved from 2 |
| Skill Trial — attach to gig, submit, mark pass/fail | 3 | ⬜ |
| Optional resume PDF attachment | 3 | ⬜ |

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
| Aggregate ratings computed onto profiles | 2 | 📋 GL-222 |
| Rating entry point — completed gigs screen, the gate on `completed`, 14-day window | 2 | 📋 GL-223 |
| Reviews list screen | 3 | ⬜ moved from 2 — designated pull-forward |
| Inline rating on the gig detail business block | 3 | ⬜ closes GL-122 AC6 |
| Report / complaint flow | 3 | ⬜ |
| Moderation queue API | 3 | ⬜ |

> **The reviews list screen is Bineth's designated pull-forward.** If GL-222 and GL-223 clear
> early, it is the work to bring back from Sprint 3 — the endpoint and `ReviewCard` already exist
> and have never been consumed. It is not committed to Sprint 2, so the sprint does not depend on it.

> **The inline business-block rating was deferred deliberately.** GL-122 AC6 is unmet: the gig
> detail business block shows no rating, because `GET /api/gigs/:id` never sends one and
> `RatingSummary` has no compact form. Closing it costs work in two epics, and the information is
> already one tap away on the public profile — so it pairs with the reviews list in Sprint 3.

## E6 · Admin & Moderation — split four ways
| Capability | Sprint | Status |
|---|---|---|
| Admin screens: disputes, moderation queue, account status | 4 | ⬜ |

---

## Out of scope for the whole project
In-app chat · push notifications · geolocation/maps · Sinhala/Tamil localisation ·
in-app payments · separate admin web panel · business verification · cover letters,
screening questions and years-of-experience fields anywhere

## Carried risks

- **A business that never marks a hire complete leaves both sides unable to review, permanently.**
  Only the business can mark completion, so if they never do, neither party gets their review.
  Nobody gains an advantage — each loses one — but the seeker is the one who did the work. Accepted
  for Sprint 2 and recorded rather than solved; disputes are the Sprint 4 admin story.
- **Sprint 2's goal is a chain, not four parallel tracks.** E5's entry point needs E4's `completed`
  status and its applicant endpoints, so GL-223 waits on GL-218 and GL-219. Bineth starts on the
  aggregate, which is unblocked, and the integration lands late in the sprint by construction.
- **The cleanup story is the unbounded part.** Thirteen points is a guess at something not yet
  swept. If the app has thirty mismatches rather than ten, that is what overruns, competing with
  the loop for the same days.
- **Two Sprint 1 seams closed as Done while their acceptance criteria were unmet** — the Apply
  button (GL-122 AC7, GL-123 AC1) and the business-block rating (GL-122 AC6). Both arose the same
  way: a story shipped with explicit licence to leave something inert until a later story landed,
  and the later story read that inertness as pre-existing context. Watch for it wherever a ticket
  says "until X lands".
- Per-assignee Jira reports still render Sayuni as Unassigned. Data is correct; the widget cannot
  resolve her. Check Project settings → Access before re-diagnosing.
- Sub-tasks in this project **can** carry story points, but none ever has. Points stay on stories
  only for Sprint 2 so velocity remains comparable across sprints; whether the board rolls sub-task
  points up is untested and should be checked after Sprint 2 closes, from a clean sprint boundary.
