# Gig Lanka · SE-28 · Context Brief

# Application & Hiring Management — Business Rules

**What the component does, and the rules it must hold to**

> **Purpose.** This is a functional brief, not a build guide. It describes the behaviour, vocabulary, permissions and business rules of application and hiring management with no implementation detail — attach it as context when asking for help on this component.

| | |
|---|---|
| **PRODUCT** | Gig Lanka — youth employment & gig marketplace |
| **COMPONENT** | Application & Hiring Management (including Skill Trial) |
| **PRIMARY PERSONAS** | "The Unemployed Graduate" (applicant side) · "The Café Owner" (hiring side) |
| **USER ROLES** | Youth job seeker · Local business · Admin (dispute only) |
| **SPRINT** | S2 |
| **CONTAINS CODE** | No — business flow only |

*Companion documents: the Gig & Job Marketplace business rules (upstream component) and the application & hiring screen mockups.*

---

## 1. Scope

This component owns the application object end to end — submitting it, tracking it, reviewing it, deciding it, and explaining the decision. It begins at the moment someone taps **Apply** and ends when an application reaches a terminal status.

It also owns the **Skill Trial** in full: attaching a trial to a gig, the seeker's submission, and the pass/fail result.

| Concern | Owner |
|---|---|
| Applying, withdrawing, application status, applicant lists, hire and reject, rejection feedback | This component |
| Skill Trial — attaching, submitting, marking, expiry | This component |
| The gig object, browse, search, filter, save, gig status | Gig & Job Marketplace |
| Seeker and business profile data, experience and education | User & Profile |
| Ratings and reviews exchanged after a completed gig | Community & Rating |
| Tab and stack navigation | User & Profile |

Four hand-off points cross this component's edge:

| Hand-off | Direction | Rule |
|---|---|---|
| Apply for this gig (gig detail screen) | In, from Marketplace | Marketplace renders the button; this component owns everything after the tap |
| Applicants (n) (My Gigs screen) | In, from Marketplace | Marketplace renders the entry point and the public applicant count |
| Gig moves to Filled | Out, to Marketplace | Raised by this component when hires reach the gig's position count — see §6 |
| A hire is recorded | Out, to Community & Rating | A Hired application is the only thing that unlocks a review between the two parties |

> **The public applicant count** shown on every gig card belongs to the Marketplace but is maintained here. It counts live applications only — `Applied`, `Viewed`, `Shortlisted` and `Hired`. Withdrawn and rejected applications drop out of it.

---

## 2. Who it is built for

This is the only component with two primary personas, because an application has two ends and the rules that protect one can hurt the other. Every rule below traces back to a pressure on one side or the other.

### Applicant side — "The Unemployed Graduate"

A recent graduate with a qualification but no work history, applying widely and hearing nothing back. Willing to prove ability but has nothing on paper to prove it with. The cost of applying is emotional, not just clerical.

| Persona pressure | Rule it produced |
|---|---|
| No work history to point at | The Skill Trial exists, and a passed trial is displayed on the profile as evidence that outlives the application |
| Applies and is never answered | Silence is not a valid outcome. Every terminal decision carries a reason code, and no application can be closed without one |
| Never knows if a human looked | `Viewed` is a real recorded status with a timestamp, set automatically and impossible for a business to suppress |
| Exhausted by rigid application forms | The profile is the resume. No cover letter, no screening questionnaire, no years-of-experience field |
| Afraid of wasting effort on unpaid tasks | Trial effort is capped at two hours, stated before the seeker opens the task, and the task cannot be real deliverable work |
| Changes their mind or finds other work | Withdrawal is available at any point before a hire, with no penalty and no explanation required |

### Hiring side — "The Café Owner"

A small business owner who currently hires through word of mouth, has no HR function, and cannot spend an afternoon screening. She needs to judge trustworthiness quickly without conducting a full interview.

| Persona pressure | Rule it produced |
|---|---|
| No time to screen applicants | The applicant list sorts by trial result and rating, and every decision is reachable in two taps from the list |
| Word-of-mouth hires are unreliable | The applicant card carries rating and completed-gig count before she opens anything |
| Claims on a profile are not proof | She can attach a Skill Trial to a gig and decide herself whether it is required or optional |
| Does not want to write individual rejections | Reason codes are one tap from a fixed list; the free-text note is always optional |
| Sometimes hires more than one person | The gig's position count governs hiring, and the fill rule in §6 is driven by it |
| Wants to keep good applicants warm | `Shortlisted` is a real status the applicant can see, not an internal flag |

---

## 3. The application object

| Field | Required | Rule |
|---|---|---|
| Gig | *System* | The gig applied to. Must be `Open` at the moment of applying |
| Applicant | *System* | The signed-in seeker |
| Profile snapshot | *System* | Name, headline, experience, education and rating as they stood when the application was submitted. Frozen — later profile edits never rewrite an existing application |
| Resume attachment | No | One optional PDF, up to 5 MB. The profile is the resume; this is an extra, never a substitute |
| Skill trial submission | Yes, when the gig's trial is required | See §4. Optional trials may be skipped without affecting whether the application is accepted |
| Status | *System* | Defaults to `Applied` on submission |
| Applied at | *System* | Set once, never changes |
| Viewed at | *System* | Set the first time the business opens the applicant detail. Once set it can never be cleared |
| Decided at | *System* | Set when the application reaches a terminal status |
| Rejection reason code | Yes, when rejected | One value from the closed list in §10. An application cannot be rejected without one |
| Rejection note | No | Free text up to 300 characters, shown to the applicant exactly as written |

There is no cover letter field, no availability form, no screening questions and no years-of-experience field anywhere in this component.

### Fixed vocabulary

These lists are closed. Nothing outside them can be selected or stored.

| List | Values |
|---|---|
| Application status | Applied · Viewed · Shortlisted · Hired · Rejected · Withdrawn · Closed – position filled |
| Trial requirement | None · Optional · Required |
| Trial submission type | Text · File · Text and file |
| Trial effort estimate | Under 30 minutes · 30–60 minutes · 1–2 hours |
| Trial result | Not submitted · Submitted · Passed · Not passed · Skipped |
| Applicant list sort | Newest · Highest rated · Trial passed first |
| Rejection reason codes | See §10 — seven business-selectable codes plus one system-only code |

---

## 4. The Skill Trial

The Skill Trial is the component's answer to a graduate with no work history. Rather than asking for evidence of past work, the business sets a small task and judges the work directly.

A trial is attached to a **gig**, not to an individual applicant. Attaching it is the assignment — there is no separate step where a business sends a task to a chosen person. Every seeker who opens that gig sees the same task on the same terms.

### What the business sets, at post or edit time

| Field | Required | Rule |
|---|---|---|
| Trial requirement | Yes | One of None, Optional or Required. Defaults to None |
| Task title | Yes, if a trial is attached | Up to 80 characters |
| Task brief | Yes, if a trial is attached | Between 20 and 1,000 characters |
| Submission type | Yes, if a trial is attached | Text, file, or both |
| Effort estimate | Yes, if a trial is attached | One value from the closed list. Two hours is the ceiling and cannot be exceeded |

### What the seeker submits

| Field | Rule |
|---|---|
| Text response | Between 20 and 2,000 characters, when the submission type allows text |
| File response | One file, PDF / PNG / JPG, up to 5 MB, when the submission type allows a file |
| Submitted at | *System* — set on submission |
| Result | *System* — Submitted until the business marks it Passed or Not passed |
| Result note | Optional free text up to 300 characters from the business, shown to the seeker |

### Rules the trial holds to

- A trial is unpaid, so it must be a **sample of skill** and not deliverable work the business would otherwise pay for. The business confirms this when attaching one.
- The effort estimate is shown before the seeker opens the task, so nobody discovers the size of the task after committing to it.
- A **required** trial must be submitted for the application to be accepted at all — the Apply action is blocked until it is.
- An **optional** trial may be skipped. Skipping is recorded as `Skipped` and never counts against the applicant on its own, but the business can see the difference between skipped and passed.
- A trial can only be marked once. Pass and fail are final for that application.
- A trial submission belongs to the application. Editing a gig's trial after applications exist does not change what anyone already submitted.
- Trials cannot be added to or removed from a gig once it has applicants — the terms cannot change underneath people who already accepted them.

> **Where the result lives.** A **passed** trial is shown on the seeker's public profile as a badge carrying the gig's category and the month, so it keeps earning after the application is over. A **not passed**, **skipped** or unmarked trial is never shown publicly — it is visible only to the seeker and to the business that set it.

---

## 5. Application lifecycle

| Status | Seeker can withdraw | Business can act | Meaning |
|---|---|---|---|
| `Applied` | Yes | Yes | Submitted, not opened yet |
| `Viewed` | Yes | Yes | The business has opened it |
| `Shortlisted` | Yes | Yes | Under real consideration |
| `Hired` | No | No | Hired for the gig. Terminal |
| `Rejected` | No | No | Declined, with a reason code. Terminal |
| `Withdrawn` | No | No | The seeker pulled out. Terminal |
| `Closed – position filled` | No | No | Auto-closed when the gig filled. Terminal — see §6 |

### Permitted transitions

- `Applied → Viewed → Shortlisted → Hired` or `Rejected`
- `Applied` or `Viewed → Rejected` directly — shortlisting is not a compulsory step
- `Applied`, `Viewed` or `Shortlisted → Withdrawn`, by the seeker only
- `Applied → Closed – position filled`, by the system only

Status never moves backwards. A shortlisted applicant cannot be returned to `Viewed`, and the four terminal statuses cannot be reopened. Correcting a mistaken decision is a dispute, handled by Admin, not an in-app action.

### Applying more than once

A seeker holds at most one application per gig, ever. Withdrawing does not free the slot — once withdrawn, that gig is finished for them. This is deliberate: without it, withdrawal becomes a way to reset a bad first impression, and the business's applicant list stops being trustworthy.

A withdrawn application stays visible to the business as `Withdrawn` rather than disappearing, so nobody is left waiting on a person who has already left.

---

## 6. When the gig fills

When the number of hires reaches the gig's position count, this component raises the `Filled` status change to the Marketplace, which removes the gig from browse and blocks new applications.

What happens to everyone still waiting is graded by how much they invested. Mass auto-rejection is exactly the silence this component exists to end, so it is applied only where it is the honest answer.

| Applications at | What happens | Why |
|---|---|---|
| `Applied` | Auto-closed with the system reason **Positions filled**, at the moment the gig fills | Nobody opened them, so "positions filled" is the truest reason available — and it arrives the same minute instead of never |
| `Viewed` | Auto-closed with the system reason **Positions filled**, at the moment the gig fills | They were looked at but never advanced. The gig genuinely filling is the honest reason, and it reaches them immediately |
| `Shortlisted` | **Never auto-closed.** The business must action each one individually with a real reason code | They were genuinely in contention |
| Any application with a submitted trial | **Never auto-closed**, whatever its status | They did the work. Work earns an answer from a person |

### Two rules that make this hold

- **Positions filled is system-set only.** It does not appear in the business's reason-code list and cannot be chosen manually. Without this rule it becomes the one-tap escape hatch that hollows out every other code.
- **The applicant-facing wording is `Closed – position filled`, not `Rejected`.** Different words, because it is not a judgement on the person, and their application history should not read as though it were.

Until every remaining `Shortlisted` application and every application carrying a trial submission has been actioned, the gig carries a visible **"n applicants still waiting on you"** prompt on My Gigs. It does not expire and it does not dismiss.

### Closing a gig early, and deadlines passing

Closing a gig is not a decision about anybody. Per the Marketplace rules, existing applicants are unaffected — so every live application still has to be hired or rejected with a reason code. The same is true when the applications-close date passes: nothing is auto-rejected, and the seeker's tracker states plainly that the business has not responded rather than showing an empty space.

---

## 7. Who can do what

| Action | Who |
|---|---|
| Apply to a gig | Signed-in seekers only, and only while the gig is `Open` |
| View own applications | Seekers, their own only |
| Withdraw an application | The applicant only, before `Hired` |
| Submit a skill trial | The applicant only, as part of applying |
| Attach or configure a skill trial | Only the business that posted the gig, and only before it has applicants |
| View the applicant list for a gig | Only the business that posted that gig |
| Change an application's status, hire, or reject | Only the business that posted that gig |
| Mark a trial passed or not passed | Only the business that posted that gig |
| View any application | Admin, read-only, and only in the course of a dispute |

Guests cannot apply. Tapping Apply while signed out routes to sign-in and returns to the gig afterwards, with nothing lost.

Attempting to apply to a gig that is not open is rejected with a specific **"gig closed"** error rather than a generic failure, so the app can explain what happened — matching the Marketplace rule for saving.

---

## 8. Applying

- Applying is a single screen. It shows what the business will see — the profile snapshot — so the seeker is never guessing what they submitted.
- If the gig carries a trial, the task appears on that same screen with its effort estimate, above the submit action.
- The submit action is disabled, with the reason stated, while a required trial is unsubmitted.
- A seeker whose profile has no experience or education entries is warned before applying, and offered a route to fill it in — but is never blocked. An empty profile plus a passed trial is a valid application, and blocking it would defeat the point of the trial.
- On success the seeker lands on the application's own detail screen showing the tracker at step one, not back on the gig.

---

## 9. Reviewing and hiring

- Opening an applicant sets `Viewed` automatically and permanently. There is no way for a business to review someone invisibly.
- The applicant list can be filtered by status and by trial result, and sorted by newest, highest rated, or trial passed first.
- Shortlisting and rejecting are reachable from the list without opening the applicant. Hiring is not — it always requires opening the applicant first.
- A business cannot hire more people than the gig has positions. When the last position is taken, §6 applies.
- Hiring is confirmed behind a dialogue that states the count, because it is terminal and it changes the gig.
- Once an application reaches `Hired`, everything afterwards — completion, ratings, reviews — belongs to the Community & Rating component.

---

## 10. Rejection feedback

Rejection without a reason is the failure this component was built to fix. A reason code is therefore mandatory on every rejection, and the free-text note is always optional — the aim is to make the honest answer the fastest one to give.

| Reason code | Available to |
|---|---|
| Schedule did not match | Business |
| Location too far | Business |
| Skill trial not passed | Business |
| Skill trial not attempted | Business |
| Looking for more relevant experience | Business |
| Another applicant was a closer fit | Business |
| Role no longer needed | Business |
| Positions filled | **System only** — never selectable by a business |

- The code and the note are both shown to the applicant, verbatim, on their application detail screen.
- The two trial-related codes are only offered when the gig actually carried a trial.
- Rejecting several applicants at once is allowed, but each still carries a code — a bulk action applies one shared code, it does not skip the requirement.

---

## 11. Privacy

- A seeker never sees who else applied, their names, their profiles or their trial results. The public applicant **count** is visible on the gig; the identities are not.
- A business sees the applicants to its own gigs and nothing else. It never learns where else a seeker has applied, how many gigs they applied to, or how often they were rejected.
- A not-passed or skipped trial is never public. Only passed trials reach the profile.
- Rejection reason codes are visible to the applicant they concern and to nobody else. They are not aggregated onto anyone's profile.
- The profile snapshot is a copy taken at submission. A business cannot watch a seeker's live profile through an application.

---

## 12. How things are displayed

| Element | Rule |
|---|---|
| Transparency bar | A four-step tracker — Applied · Viewed · Shortlisted · Decision — filled to the current position, with one plain-language line beneath it. It never shows a step that has not genuinely happened |
| Status badge | `Applied` and `Viewed` neutral · `Shortlisted` positive · `Hired` strong positive · `Rejected`, `Withdrawn` and `Closed – position filled` muted grey, never alarm red |
| Timestamps | Just now · 20m ago · 3h ago · 5d ago · then a plain date — matching the Marketplace convention |
| No response yet | Where a business has not acted, the tracker says so in words. Blank space is never used to mean "nothing has happened" |
| Trial badge | Trial passed · Trial submitted · Trial skipped, shown on the applicant row so the business can sort by it at a glance |
| Decision block | On a rejected application, the reason code is the most prominent element, with the optional note directly beneath it |
| Effort estimate | Always displayed next to the trial task title, before the task is opened |

---

## 13. Screens

| Screen | Audience | Purpose |
|---|---|---|
| Apply | Seeker | Profile snapshot, optional resume attachment, the trial task if one exists, and submit |
| Skill trial | Seeker | The task brief, effort estimate, and the text or file submission |
| My applications | Seeker | Every application with its status badge and tracker, filterable by status |
| Application detail | Seeker | Full tracker, gig summary, what was submitted, the decision and its reason, and Withdraw |
| Applicants | Business | The applicant list for one gig, with filter, sort, and Shortlist / Reject from the row |
| Applicant detail | Business | Profile snapshot, rating, completed-gig count, resume if attached, trial submission, and all decision actions |
| Trial review | Business | The submission, with Passed / Not passed and an optional note |

### Application detail (seeker)

The tracker sits at the top and is the reason the screen exists. Beneath it: the gig it belongs to, when it was submitted, when it was viewed, what was submitted including the trial, and — once decided — the outcome with its reason code and note. Withdraw is available while the application is live and is confirmed behind a dialogue that states it cannot be undone and the gig cannot be applied to again.

### Applicant detail (business)

Rating and completed-gig count sit above the fold, because they are what a time-poor business judges on first. The trial submission follows, then experience and education from the snapshot. The actions are Shortlist, Hire and Reject; Hire states the remaining position count, and Reject opens the reason-code list.

---

## 14. Journeys

**Seeker** — opens a gig from Browse → taps Apply → reviews what the business will see → completes the trial if there is one, or skips it if it is optional → submits → lands on the application detail with the tracker at step one → returns later from My applications to watch it move → receives a decision with a reason, or withdraws if something better came along.

**Business** — attaches a trial when posting a gig and decides whether it is required → returns to My gigs → taps Applicants → sorts by trial passed → opens a promising applicant, which records Viewed → reviews the trial and marks it → shortlists two, rejects the rest with reason codes → hires → the gig moves to Filled, the applications that never advanced close themselves with Positions filled, and the shortlisted pair plus anyone who did the trial are answered by hand.

---

## 15. Rules worth restating

1. No application ends in silence. Every terminal outcome carries a reason the applicant can read.
2. `Viewed` is recorded automatically and cannot be suppressed. If a business looked, the applicant knows.
3. The profile is the resume. A PDF may be attached on top, but never instead.
4. A Skill Trial is attached to a gig, not to a person, and every applicant to that gig sees the same task on the same terms.
5. Trials are capped at two hours of effort and must be a sample of skill, never deliverable work.
6. Passed trials are public. Failed and skipped trials are not.
7. Only applications that never advanced may be closed automatically. Anyone who was shortlisted, or who submitted a trial, gets an answer from a person.
8. "Positions filled" is set by the system and can never be chosen by a business.
9. One application per seeker per gig, permanently. Withdrawing does not buy a second attempt.
10. Only the business that posted a gig can see or act on its applicants.
11. Closing a gig decides nothing. Every live application still needs a hire or a reason.
