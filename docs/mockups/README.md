# Mockup index

Four v3 files, 38 frames, one file per feature component. Every frame belongs to exactly one
story. **Find your frame here before you build anything** — several frames in each file belong
to a later sprint and must not be built early.

Frames are identified by the exact text of their `.frame-label`, which is unique within a file.
To find one: search the file for the label string, or use the anchor id on its `.frame-wrap`.

A frame shows **one 390 × 844 viewport, not a whole screen.** Anything below the fold is
specified in the ticket, not drawn here. Where a label says "scroll at top" or "scrolled down",
the rest of that screen exists only in the ticket's acceptance criteria.

| File | Owner | Frames | Sprint 1 |
|---|---|---|---|
| `gig-lanka-gig-marketplace-v3.html` | Anupa | 8 | 5 |
| `gig-lanka-user-profile-v3.html` | Sayuni | 12 | 8 |
| `gig-lanka-community-rating-v3.html` | Bineth | 8 | 6 |
| `gig-lanka-application-hiring-v3.html` | Lahiru | 10 | 4 |

Style is shared across all four: identical `:root` token block, identical status bar, tab bar and
frame chrome. The tokens are the source for GL-101; nothing else should read raw hex out of
these files.

---

## `gig-lanka-gig-marketplace-v3.html` — E3, Anupa

| # | Frame label | Anchor | Sprint | Story |
|---|---|---|---|---|
| 1 | `BrowseGigsScreen.js` | `#browse-gigs` | 1 | GL-121 |
| 2 | `GigFilters.js — filter sheet` | `#gig-filters` | 2 | — |
| 3 | `SavedGigsScreen.js` | `#saved-gigs` | 3 | GL-293 |
| 4 | `SavedGigsScreen.js — empty` | `#saved-gigs-empty` | 3 | GL-293 |
| 5 | `GigDetailScreen.js` | `#gig-detail` | 1 | GL-122 |
| 6 | `MyGigsScreen.js` | `#my-gigs` | 1 | GL-118 |
| 7 | `PostGigScreen.js — GigForm, top` | `#post-gig` | 1 | GL-119 |
| 8 | `EditGigScreen.js — GigForm, lower` | `#edit-gig` | 1 | GL-120 |

Frames 7 and 8 are the **same form** at two scroll positions. `GigForm` is built once in GL-119;
GL-120 reuses it with pre-filled values and the applicants warning. GL-295 adds a Skill trial
section to that same shared form in Sprint 3 — it is not drawn in either frame.

Frames 3 and 4 **were labelled Sprint 2 and that was stale**: the work slipped and was never
ticketed. Corrected to Sprint 3 at Sprint 3 planning. Read their tab bar carefully — it shows
**four** seeker tabs, one more than `SeekerTabs.js` has today.

## `gig-lanka-user-profile-v3.html` — E2, Sayuni

| # | Frame label | Anchor | Sprint | Story |
|---|---|---|---|---|
| 1 | `MyProfileScreen.js — seeker, scroll at top` | `#my-profile-seeker` | 1 | GL-112 |
| 2 | `EditProfileScreen.js — seeker` | `#edit-profile-seeker` | 1 | GL-112 |
| 3 | `ManageExperienceScreen.js` | `#manage-experience` | 1 | GL-113 |
| 4 | `ManageEducationScreen.js` | `#manage-education` | 1 | GL-113 |
| 5 | `MyProfileScreen.js — business, scroll at top` | `#my-profile-business` | 1 | GL-112 |
| 6 | `EditProfileScreen.js — business` | `#edit-profile-business` | 1 | GL-112 |
| 7 | `PublicProfileScreen.js — seeker, scrolled down` | `#public-profile-seeker` | 1 | GL-117 |
| 8 | `PublicProfileScreen.js — business, scroll at top` | `#public-profile-business` | 1 | GL-117 |
| 9 | `AccountSettingsScreen.js` | `#account-settings` | 2 | — |
| 10 | `ChangePasswordScreen.js` | `#change-password` | 2 | — |
| 11 | `ForgotPasswordScreen.js — pre-login` | `#forgot-password` | 3 | GL-290 |
| 12 | `ResetPasswordScreen.js — from emailed link` | `#reset-password` | 3 | GL-290 |

Frame 7 is drawn **scrolled down**, so the gradient hero and the rating summary above it are not
visible in it. Frame 8 shows that region. Read them together.

Frame 11's note — that reaching it from the still-dark Login screen will flash dark to white — was
checked at Sprint 3 planning and is **still accurate**. GL-290 resolves it by building both 11 and
12 inside `AuthShell`: the frames are the content spec, `AuthShell` is the chrome. Frame 12's notice
copy is inherited from change-password and is **wrong** for a reset, which revokes every session
rather than every other one; GL-290 corrects it.

## `gig-lanka-community-rating-v3.html` — E5, Bineth

| # | Frame label | Anchor | Sprint | Story |
|---|---|---|---|---|
| 1 | `CompletedGigsScreen.js — rating prompts` | `#completed-gigs` | 2 | — |
| 2 | `RateBusinessScreen.js — worker rates business` | `#rate-business` | 1 | GL-125 |
| 3 | `RateWorkerScreen.js — business rates worker, nothing picked` | `#rate-worker` | 1 | GL-125 |
| 4 | `RatingCategoriesScreen.js` | `#rating-categories` | 1 | GL-125 |
| 5 | `WrittenReviewScreen.js` | `#written-review` | 1 | GL-125 |
| 6 | `RatingConfirmationScreen.js` | `#rating-confirmation` | 1 | GL-125 |
| 7 | `ProfileRatingSummary.js — on worker profile` | `#rating-summary` | 1 | GL-116 |
| 8 | `ReviewsSectionScreen.js` | `#reviews-section` | 3 | GL-303 |

Frame 7 is a **component**, not a screen — it renders inside Sayuni's profile screens.
Frames 2–6 are five steps of one flow and belong to a single story.

Frame 8 **was labelled Sprint 2 and that was stale**: it was Bineth's designated pull-forward, the
pull-forward was not taken, and no ticket ever existed. Corrected to Sprint 3 at Sprint 3 planning.
Its star-filter tabs must narrow the **query**, not the loaded page — GL-303 adds a `rating`
parameter to `GET /users/:userId/reviews` for exactly that. Frame 7 also gains a compact variant in
Sprint 3 (GL-304) for the gig detail business block; that variant is not drawn.

## `gig-lanka-application-hiring-v3.html` — E4, Lahiru

| # | Frame label | Anchor | Sprint | Story |
|---|---|---|---|---|
| 1 | `ApplyScreen.js — required trial not yet submitted` | `#apply` | 1 | GL-123 |
| 2 | `SkillTrialScreen.js — seeker submission` | `#skill-trial` | 3 | GL-298 |
| 3 | `MyApplicationsScreen.js` | `#my-applications` | 1 | GL-124 |
| 4 | `ApplicationDetailScreen.js — rejected, at top` | `#application-detail` | 1 | GL-124 |
| 5 | `WithdrawConfirm.js — over a live application, scrolled` | `#withdraw-confirm` | 1 | GL-124 |
| 6 | `ApplicantsScreen.js — list for one gig` | `#applicants` | 2 | — |
| 7 | `ApplicantDetailScreen.js — opening this sets Viewed` | `#applicant-detail` | 2 | — |
| 8 | `TrialReviewScreen.js — mark passed or not passed` | `#trial-review` | 3 | GL-299 |
| 9 | `RejectReasonSheet.js — reason code is mandatory` | `#reject-reason` | 2 | — |
| 10 | `HireConfirmSheet.js — the hire that fills the gig` | `#hire-confirm` | 2 | — |

Frame 1 is drawn with a **required skill trial attached**, which is Sprint 3 work. GL-123 built
the Apply screen without the trial block; **GL-298 slots it in above the submit action**, which is
the "later" that note meant. The frame's Resume (optional) block below the snapshot is **GL-300**.
The frame stays keyed to GL-123 because that is the story that built the screen. Frame 4 shows
the **rejected** state, which cannot occur until hiring ships in Sprint 2 — the tracker handles
every status and the rejected state is verified against seeded data.

---

Frames with no story key are unticketed and appear in `ROADMAP.md` as planned lines.

**Two Sprint 3 stories have no frame at all** and specify their layout in the ticket instead: the
report/complaint sheet (GL-305) and the admin open-reports list (GL-306). Both carry an acceptance
criterion requiring the design to follow the existing design system — the tokens in
`app/tailwind.config.js`, the components in `app/src/components/ui/`, and the patterns comparable
screens already use — and to introduce no new visual conventions.
