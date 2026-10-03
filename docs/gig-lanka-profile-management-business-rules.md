G I G L A N K A · S E - 2 8 · C O N T E X T   B R I E F

# User & Profile Management Business Rules

What the component does, and the rules it must hold to

Purpose. This is a functional brief, not a build guide. It describes the behaviour, vocabulary, permissions and business rules of user accounts and profiles, for both job seekers and businesses, with no implementation detail — attach it as context when asking for help on this domain.

| PRODUCT | GigLanka - youth employment & gig marketplace |
|:---|:---|
| COMPONENT | User & Profile Management |
| PRIMARY PERSONAS | "The Side-Hustler Student" (seeker) & the independent business owner |
| USER ROLES | Youth job seeker · Local business (admin accounts exist on the model but have no profile) |
| SCOPE | Everything remaining in User & Profile Management after Sprint 0 — not boxed to a single sprint |
| CONTAINS CODE | No — business flow only |

Companion documents: the auth screen mockups (v2), and the Developer 2 Implementation Guide for the adjacent Gig & Job Marketplace

---

# 1. Scope

This component owns two things: the account itself (credentials, password, account status), and the profile content that represents a seeker or a business to everyone else on the platform (photo, bio, work & education history, skills). It stops where those things become someone else's concern — computing a rating, or recording a Skill Trial.

Everything in this brief assumes an authenticated session. There is no profile management before a user has registered and logged in — that boundary belongs to Auth (Sprint 0), and nothing here is reachable anonymously, unlike gig browse.

| Concern | Owner |
|:---|:---|
| Account credentials, password change, forgot/reset password, account status | This component |
| Profile content: photo, bio, location, skills, work & education history | This component |
| Ratings shown on a profile (the computation and the number) | Community & Rating |
| Skill Trial results shown on a profile (the outcome itself) | Application & Hiring |
| Skill Trial results shown on a profile (displaying it) | This component |
| Login, registration, tokens, role selection | Auth (Sprint 0) |

Two hand-off points feed this component from elsewhere and must render correctly here without this component owning their logic: the Skill Trial badge on a seeker's profile, and the rating summary on any profile.

---

# 2. Who it is built for

Two audiences with different pressures. "The Side-Hustler Student" has thin or no formal work history and needs another way to be trusted. The business owner has no time to screen and needs to judge trust fast, from the profile alone, before ever messaging.

| Persona pressure | Rule it produced |
|:---|:---|
| Little or no formal work history | Skill Trial results are a first-class, visible block on the seeker profile — not buried |
| Wants to be found for the right kind of work | Skills are stored as a structured tag list, not a paragraph, so they read at a glance |
| Business has no time to screen | Rating summary sits at the top of a profile, before the bio |
| Business needs to judge trust without a full interview | A seeker's work & education history and Skill Trial results are visible on their public profile, not gated behind an application |
| Both are wary of oversharing to strangers | Contact details are never shown on a public profile — see §6 |
| Everyone eventually forgets a password | Password reset is fully self-service; no account should require manual intervention to unlock |

---

# 3. The account object

The account is the existing User record — email, a hashed password, and a role — set up during registration (Sprint 0). Of the fields already on that model, only the password can ever change afterwards. One new field is needed for this scope: an account-status flag, to support deactivation.

| Field | On the model? | Rule |
|:---|:---|:---|
| email | Yes | Set once at registration, stored lowercase and trimmed. Fixed for the account's lifetime — this component never changes it |
| passwordHash | Yes | Never stored or transmitted as plaintext. Changing it always requires the current password |
| role | Yes | seeker, business, or admin. Set once at registration, permanent. Admin accounts have no profile — everything from §4 onward applies to seeker and business only |
| isActive (new) | No - needs adding | Boolean, defaults to true. Set to false on self-deactivation; see §9 |
| createdAt / updatedAt | Yes (timestamps) | createdAt is shown on the account settings screen. updatedAt is never surfaced to the user |

---

# 4. The profile object — shared fields

Every profile, seeker or business, is built from the same base before either role adds its own.

| Field | Required | Rule |
|:---|:---|:---|
| Photo | No | A single image. Uploading a new one replaces the old one — no gallery, no history |
| Display name / business name | Yes | Up to 60 characters. Pre-filled from registration, editable after |
| Bio / description | No | Up to 500 characters, free text |
| City | No | Free text. No maps, no geolocation — this is a label, not a coordinate |

---

# 5. Seeker-specific profile fields

| Field | Required | Rule |
|:---|:---|:---|
| Skills | No | A free-text tag list. A seeker can add or remove tags at any time |
| Work experience | No | Repeatable entries: role title, employer, start date, end date (or "ongoing"), description |
| Education | No | Repeatable entries: institution, qualification / field of study, start date, end date |
| Skill Trial results | Set by system | Read-only here. Written by Application & Hiring when a business marks a trial pass/fail |
| Rating summary | Set by system | Read-only here. Average and count, computed and owned by Community & Rating |

Work and education entries can be added, edited and deleted freely — there is no limit on how many a seeker keeps, and no approval step. This is self-reported history, not a verified record.

---

# 6. Business-specific profile fields

| Field | Required | Rule |
|:---|:---|:---|
| Category / industry | No | Free text, e.g. "Café", "Retail" |
| Rating summary | Set by system | Read-only here, same as the seeker rating summary — owned by Community & Rating |

There is no verification concept for businesses in this scope. Every business profile is treated the same way, with trust signalled only through its rating.

---

# 7. Who can do what

| Action | Who |
|:---|:---|
| View own profile, in edit mode | Self only |
| View another user's public profile | Anyone signed in |
| Edit profile content (photo, bio, skills, experience, education) | Self only |
| Change password | Self only, with current password |
| Request a password reset | Anyone with access to the account's email — no sign-in required |
| Deactivate own account | Self only |

Attempting to edit a profile that is not your own is rejected outright — there is no partial-edit or "suggest a change" path between users.

---

# 8. Passwords and account access

Two separate paths change a password: a signed-in user changing it deliberately, and a locked-out user recovering it. Both end the same way — every other active session is signed out.

| Flow | Rule |
|:---|:---|
| Change password | Requires the current password. New password must meet the same strength rule enforced at registration. All other refresh tokens for the account are revoked immediately afterwards |
| Forgot password | User submits their email. If it matches an account, a one-time reset link is sent — the response never reveals whether the email exists |
| Reset link | Expires after a fixed window. Can only be used once. Using it sets a new password and revokes every existing refresh token for the account |

Email address and account role are never editable from any of these flows — changing either is out of scope for this component.

---

# 9. Deactivating an account

Deactivation is self-service and immediate. A deactivated account disappears from browse and search on both sides — a deactivated seeker no longer appears to businesses, and a deactivated business's gigs stop appearing to seekers. It cannot be used to log in again while deactivated. Existing gigs, applications and ratings tied to the account are left untouched, not deleted.

---

# 10. Screens

| Screen | Audience | Purpose |
|:---|:---|:---|
| My profile | Both | View own profile the way others see it; entry point into editing |
| Edit profile | Both | Update photo, bio, city, and role-specific fields |
| Manage experience | Seeker | Add, edit and delete work experience entries |
| Manage education | Seeker | Add, edit and delete education entries |
| Public profile | Both | View another user's profile — a business viewing an applicant, or a seeker viewing a business |
| Account settings | Both | Email and role shown read-only; links into change password and deactivate |
| Change password | Both | Update password, current password required |
| Forgot password | Both | Request a reset email from the login screen |
| Reset password | Both | Set a new password from an emailed link |

**Public profile**
Shows the photo, name, city, bio, and rating summary, plus — for a seeker — Skill Trial badges, work & education history and skills list. Contact details are never shown here. There is no edit affordance anywhere on this screen when viewing someone else's profile.

**Edit profile**
One form per role, pre-filled with the current values. Saving updates the profile immediately; there is no draft or review step. Work and education entries are managed on their own screens rather than inline, since they are repeatable and can grow long.

---

# 11. Journeys

**Seeker** — opens My profile → taps Edit → uploads a photo, writes a bio → opens Manage experience → adds a work entry → opens Manage education → adds an education entry → saves → the profile now shows everything a business will see before ever messaging

**Business** — opens My profile → edits business name, category and bio → saves → the profile is immediately what seekers see when browsing that business's gigs, with its rating summary (once one exists) doing the talking

**Forgotten password** — user can't log in → taps Forgot password on the login screen → enters their email → receives a reset link → sets a new password → every device they were previously logged in on is signed out and must log in again

---

# 12. Rules worth restating

1. Email is fixed at registration — this component never changes it, and there is no change-email flow.
2. Role is permanent, same as decided at sign-up — this component never changes it.
3. Ratings are never computed or stored here — only displayed, owned entirely by Community & Rating.
4. There is no business verification in this scope — trust is signalled only through the rating summary.
5. Skill Trial outcomes are written by Application & Hiring — this component only displays them.
6. A password change always requires the current password, with no exceptions.
7. A password reset — via the forgot-password flow or a deliberate change — always revokes every other active session.
8. A profile photo replaces the previous one on upload. There is no photo history or gallery.
9. Deactivating an account never deletes its gigs, applications, or ratings — those stay exactly as they are.
10. No user can view another user's profile in edit mode, or edit a profile that isn't their own.
