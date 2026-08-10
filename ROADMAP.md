# Gig Lanka — Roadmap

Feature-level plan across all sprints. Tickets live in Jira; this is the map.
Updated at the end of every sprint. Last updated: 10 August 2026, end of Sprint 0.

## Velocity

| Sprint | Planned | Delivered | Days | Notes |
|---|---|---|---|---|
| 0 | 61 | 80 | 7 | 18-pt design block (GL-82–GL-100) added on the final day and completed in-sprint, plus one standalone task. No spillover. Lahiru 37, Sayuni 33, Anupa 6, Bineth 3 |
| 1 | 106 | | | Points are relative size only — the 1 pt ≈ 1.5 h scale is dropped. No per-member targets |
| 2 | | | | |
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
| Shared kit extension for the v3 screens — chips, badges, avatars, sheets, screen header | 1 | 📋 |
| Shared formatting utilities & domain enums — currency, relative time, closed vocabularies | 1 | 📋 |
| Supabase storage & upload service | 1 | 📋 |
| Transactional email provider | 3 | ⬜ |
| Empty, loading and error states swept across every feature screen | 4 | ⬜ |
| E2E test setup | 4 | ⬜ |
| Release build (EAS) | 4 | ⬜ |
| Bug bash & demo hardening | 4 | ⬜ |

> **Supabase is storage only.** Files go to a Supabase bucket, the returned URL is stored in
> Mongo. MongoDB Atlas remains the database and auth remains self-built JWT. This narrows the
> "not Supabase" line in handover §17 rather than reopening it.

## E2 · User & Profile Management — Sayuni
| Capability | Sprint | Status |
|---|---|---|
| JWT auth, RBAC, session persistence, auth screens | 0 | ✅ |
| Profile model & profile API — own read/update, public read | 1 | 📋 |
| My profile & edit profile, seeker and business | 1 | 📋 |
| Work experience & education management | 1 | 📋 |
| Profile photo upload | 1 | 📋 |
| Public profile view — seeker and business | 1 | 📋 |
| Account settings & change password | 2 | ⬜ |
| Forgot password & reset password | 3 | ⬜ |
| Account deactivation | 3 | ⬜ |
| Skill Trial badges on seeker profile | 3 | ⬜ |

> Corrected against the feature brief: **business verification is not in scope anywhere.** The
> Sprint 0 draft roadmap listed it at Sprint 2. Trust is signalled through the rating summary only.

## E3 · Gig & Job Marketplace — Anupa
| Capability | Sprint | Status |
|---|---|---|
| Gig model & gig API — create, read, list, update, close, delete | 1 | 📋 |
| My gigs list | 1 | 📋 |
| Post a gig | 1 | 📋 |
| Edit & close a gig | 1 | 📋 |
| Browse gigs | 1 | 📋 |
| Gig detail | 1 | 📋 |
| Search, filter, sort, categories | 2 | ⬜ |
| Saved gigs | 2 | ⬜ |
| Deadline countdown & urgency states | 2 | ⬜ |
| Gig moves to Filled, driven by hiring | 3 | ⬜ |
| Relevance ordering | 3 | ⬜ |

## E4 · Application & Hiring — Lahiru
| Capability | Sprint | Status |
|---|---|---|
| Application model & status state machine | 1 | 📋 |
| Apply & withdraw API — one application per gig, frozen profile snapshot | 1 | 📋 |
| Apply screen | 1 | 📋 |
| My applications & application detail with the transparency tracker | 1 | 📋 |
| Applicant list & applicant detail — Viewed set on open | 2 | ⬜ |
| Shortlist, hire, and reject with mandatory reason codes | 2 | ⬜ |
| Positions-filled auto-close rules | 2 | ⬜ |
| Skill Trial — attach to gig, submit, mark pass/fail | 3 | ⬜ |
| Optional resume PDF attachment | 3 | ⬜ |

## E5 · Community & Rating — Bineth
| Capability | Sprint | Status |
|---|---|---|
| Review model & rating aggregate schema | 1 | 📋 |
| Star rating & review components | 1 | 📋 |
| Rating summary block on profiles | 1 | 📋 |
| Review submission API gated on a Hired application | 1 | 📋 |
| Rate business & rate worker screens — role-specific categories | 1 | 📋 |
| Mark a hire complete — the gate that unlocks reviewing | 2 | ⬜ |
| Aggregate ratings computed onto profiles | 2 | ⬜ |
| Reviews list screen | 2 | ⬜ |
| Report / complaint flow | 3 | ⬜ |
| Moderation queue API | 3 | ⬜ |

> Gap found while writing this: **nothing currently owns marking a hire complete.** The Application
> brief hands off at `Hired`; the Community brief starts at "completed gig". It is placed here, at
> Sprint 2, alongside hiring itself.

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
- **Anupa and Bineth carry 50 points between them in Sprint 1, against 9 delivered in Sprint 0.**
  The total is not the risk; those two are. Their demo-critical stories are sequenced first.
- **The shared kit extension is Sprint 1's first domino** — most screen work is blocked on it.
  It must land on day one or two, and it sits with the owner of two epics.
- **E4 is now downstream of E2 and E3.** The apply flow needs the gig model, the profile model,
  and the gig detail screen. A slip by Anupa or Sayuni becomes a slip by Lahiru.
- **E5 has no in-app route to a completed hire until Sprint 2**, so review submission is verified
  against seeded data this sprint.
- Per-assignee Jira reports still render Sayuni as Unassigned. Data is correct; the widget cannot
  resolve her. Check Project settings → Access before re-diagnosing.
