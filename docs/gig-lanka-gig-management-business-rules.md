G I G L A N K A · S E - 2 8 · C O N T E X T   B R I E F

# Gig & Job Marketplace Business Rules

What the component does, and the rules it must hold to

Purpose. This is a functional brief, not a build guide. It describes the behaviour, vocabulary, permissions and business rules of the gig marketplace with no implementation detail — attach it as context when asking for help on this domain.

| PRODUCT | GigLanka - youth employment & gig marketplace |
|:---|:---|
| COMPONENT | Gig & Job Marketplace (Gig Management) |
| PRIMARY PERSONA | "The Side-Hustler Student" |
| USER ROLES | Youth job seeker · Local business |
| SPRINT | S1 |
| CONTAINS CODE | No — business flow only |

Companion documents: the Developer 2 Implementation Guide (build detail) and the gig marketplace screen mockups.

---

# 1. Scope

This component owns the gig object end to end — creating it, editing it, listing it, searching and filtering it, saving it, and closing it. It stops at the moment someone taps Apply.

| Concern | Owner |
|:---|:---|
| Gig create, edit, browse, search, filter, save, close, delete | This component |
| Applying to a gig, applicant lists, hire/reject | Application & Hiring |
| Business and seeker profile data | User & Profile |
| Ratings shown on the business block | Community & Rating |
| Tab and stack navigation | User & Profile |

Two hand-off points leave this component and are owned elsewhere: Apply to a gig (from the gig detail screen) and View applicants (from the business's own gig list).

---

# 2. Who it is built for

"The Side-Hustler Student" — a university or vocational student looking for flexible part-time gigs around their class schedule to cover personal expenses. Tech-comfortable, juggling multiple priorities, wants quick low-commitment work such as tutoring, deliveries or event help. Frustrated by rigid job platforms designed for full-time careers.

Every rule in this document traces back to one of those pressures:

| Persona pressure | Rule it produced |
|:---|:---|
| Work must fit around a class timetable | Schedule is a multi-select field, mandatory on every gig, and a filter that sits on the browse screen rather than behind the filter sheet |
| Wants low-commitment work | Commitment length is a required, filterable field |
| Juggling priorities | Saving a gig is one tap on the card with no navigation, and saved gigs get their own screen |
| Needs to cover expenses | Pay is the loudest element on every card. A gig cannot be posted with "negotiable" pay — the amount is a required number |
| Tech-comfortable | Live search as you type, pull to refresh, endless scroll. No search button |
| Frustrated by rigid platforms | No CV upload, no cover letter, no years-of-experience field anywhere |
| Distrusts informal job ads | Every gig shows a status, a deadline countdown, how many people have applied, and how many positions exist |

---

# 3. The gig object

| Field | Required | Rule |
|:---|:---|:---|
| Title | Yes | Up to 80 characters |
| Description | Yes | Between 20 and 2000 characters |
| Category | Yes | One value from the category list |
| Pay amount | Yes | A number greater than zero. Free text is not accepted |
| Pay type | Yes | Per hour, per day, or fixed price |
| City | Yes, unless remote | Free text |
| Area | No | Free text, e.g. a suburb |
| Can be done remotely | No | Off by default. When on, the city is not required |
| Schedule | Yes | One or more schedule tags — never empty |
| Commitment | Yes | One value from the commitment list |
| Positions | Yes | Whole number, at least 1. Defaults to 1 |
| Start date | No | Format YYYY-MM-DD |
| Applications close | No | Format YYYY-MM-DD, and cannot be a past date |
| Status | Set by system | Defaults to open on creation |
| Posted by | Set by system | The business that created it |
| Applicants so far | Set by system | Maintained by the hiring component |
| Saved by | Private | Never shown to anyone — see §6 |

## Fixed vocabulary

These lists are closed. Nothing outside them can be selected or stored.

| List | Values |
|:---|:---|
| Category | Tutoring · Delivery · Event help · Retail · Hospitality · Admin & data entry · Creative · Tech · Other |
| Pay type | Per hour · Per day · Fixed price |
| Schedule | Weekday mornings · Weekday evenings · Weekends · Flexible hours |
| Commitment | One-off · Under a week · 1-4 weeks · Ongoing |
| Status | Draft · Open · Closed · Filled |
| Sort order | Newest · Highest pay · Starting soon |

---

# 4. Gig lifecycle

| Status | Appears in browse | Can be saved | Can be applied to | Meaning |
|:---|:---|:---|:---|:---|
| Draft | No | No | No | Written but not published |
| Open | Yes | Yes | Yes | Live and accepting applications |
| Filled | No | No | No | All positions taken |
| Closed | No | No | No | The business stopped it early |

A gig is created as open. The business can close it at any time. Closing removes it from search and blocks new applications — people who already applied are unaffected, and the business can still see and process them.

Deleting a gig is permanent and cannot be undone.

---

# 5. Who can do what

| Action | Who |
|:---|:---|
| Browse, search and filter gigs | Anyone, signed in or not |
| View a single gig | Anyone |
| Save or unsave a gig | Seekers only |
| View own saved gigs | Seekers only |
| Post a gig | Businesses only |
| Edit a gig, change its status, delete it | Only the business that posted it |
| View own posted gigs | Businesses only |

Attempting to save or apply to a gig that is not open is rejected with a "gig closed" error rather than a generic failure, so the app can explain why.

---

# 6. Saving a gig

Saving is deliberately lightweight: a star on the gig card, one tap, no navigation away from the list. The star fills immediately and quietly reverts if the save fails.

Who saved a gig is never revealed. The list of savers is stripped from every response. A seeker only ever learns whether they themselves have saved a gig, and a business never learns who saved theirs — only how many people applied.

The saved list refreshes each time the screen is opened, so a gig unsaved from somewhere else in the app does not linger here.

---

# 7. Finding a gig

Search runs over the title and description, live as the user types, with a short pause before it fires. There is no search button.

Filters available: category (one), schedule (any number — a gig matches if it carries any selected tag), commitment (one), city (exact match, case-insensitive), minimum pay (inclusive), and sort order.

Sort options: newest first (the default), highest pay first, or starting soon.

Layout rule: schedule tags sit on the browse screen itself, always visible and one tap away. Everything else lives inside a filter sheet. The filter button shows a count of how many filters are active, and a "clear all" action appears whenever any are set.

Results load ten at a time and continue loading as the user scrolls. The list shows how many gigs match. When nothing matches, the empty state offers to clear the filters rather than leaving a dead screen.

---

# 8. How things are displayed

| Element | Rule |
|:---|:---|
| Pay | Rs 2,500/hr, Rs 4,500/day, or Rs 18,000 for a fixed price. Always the most prominent thing on a card |
| Location | Remote when the gig is remote, otherwise Area, City |
| Posted | Just now · 20m ago · 3h ago · 5d ago · then a plain date |
| Deadline | Past → Applications closed. Today → Closes today. Tomorrow → Closes tomorrow. Within 3 days → Closes in N days. Beyond that → Closes 16 Aug |

The first four deadline states are treated as urgent and shown in a warning colour; the last is neutral. A gig with no visible closing date reads like the informal ads this audience already distrusts, so the countdown is never hidden.

---

# 9. Screens

| Screen | Audience | Purpose |
|:---|:---|:---|
| Browse gigs | Seeker | Search, filter and scroll the open gigs. Save from the card |
| Saved gigs | Seeker | Gigs parked to decide on later. Unsave from here |
| Gig detail | Both | Everything about one gig, plus the Apply action |
| My gigs | Business | Everything posted, filtered by status, with per-gig actions |
| Post a gig | Business | Create a new gig |
| Edit gig | Business | Change or delete an existing gig |

**Gig detail**
Shows the title, pay, status badge, deadline banner, the business that posted it, a placeholder for that business's rating, the full description, and a detail list: category, schedule, commitment, location, start date, positions, and applicants so far.

The primary action is Apply for this gig. When the gig is not open, the button reads Applications closed and is disabled.

**My gigs**
Each gig shows its status badge and applicant count, with three actions beneath it: Edit, Applicants (n), and Close — the last only on open gigs, and behind a confirmation that explains existing applicants are unaffected. A Post a gig button is always reachable, and the empty state points at it.

**Post and edit**
Both use the same form. When editing a gig that already has applicants, the screen says so plainly — changing the hours or the pay underneath people who have already applied is not fair to them. Deleting requires a confirmation.

---

# 10. Journeys

**Seeker** — opens Browse → taps the schedule tags that fit their timetable → narrows by category or minimum pay if needed → stars anything promising → opens a gig → reads the detail → taps Apply, which hands over to the hiring component. Anything starred can be picked up later from Saved gigs.

**Business** — opens My gigs → taps Post a gig → fills the form → lands on the new gig's detail page → returns later to My gigs → checks Applicants, which hands over to the hiring component → edits the gig or closes it once the positions are filled.

---

# 11. Rules worth restating

1. Pay is always a number. No "negotiable", no ranges, no free text.
2. Every gig carries at least one schedule tag, because that is the first thing the audience filters by.
3. A deadline can never be set in the past.
4. Only the business that posted a gig can touch it.
5. Closing is not deleting. Closing hides the gig and stops new applications; existing applicants are unaffected.
6. Who saved a gig is private.
7. Browse works without an account. Saving, posting and applying do not.
