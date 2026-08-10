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
| 3 | `SavedGigsScreen.js` | `#saved-gigs` | 2 | — |
| 4 | `SavedGigsScreen.js — empty` | `#saved-gigs-empty` | 2 | — |
| 5 | `GigDetailScreen.js` | `#gig-detail` | 1 | GL-122 |
| 6 | `MyGigsScreen.js` | `#my-gigs` | 1 | GL-118 |
| 7 | `PostGigScreen.js — GigForm, top` | `#post-gig` | 1 | GL-119 |
| 8 | `EditGigScreen.js — GigForm, lower` | `#edit-gig` | 1 | GL-120 |

Frames 7 and 8 are the **same form** at two scroll positions. `GigForm` is built once in GL-119;
GL-120 reuses it with pre-filled values and the applicants warning.

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
| 11 | `ForgotPasswordScreen.js — pre-login` | `#forgot-password` | 3 | — |
| 12 | `ResetPasswordScreen.js — from emailed link` | `#reset-password` | 3 | — |

Frame 7 is drawn **scrolled down**, so the gradient hero and the rating summary above it are not
visible in it. Frame 8 shows that region. Read them together.

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
| 8 | `ReviewsSectionScreen.js` | `#reviews-section` | 2 | — |

Frame 7 is a **component**, not a screen — it renders inside Sayuni's profile screens.
Frames 2–6 are five steps of one flow and belong to a single story.

## `gig-lanka-application-hiring-v3.html` — E4, Lahiru

| # | Frame label | Anchor | Sprint | Story |
|---|---|---|---|---|
| 1 | `ApplyScreen.js — required trial not yet submitted` | `#apply` | 1 | GL-123 |
| 2 | `SkillTrialScreen.js — seeker submission` | `#skill-trial` | 3 | — |
| 3 | `MyApplicationsScreen.js` | `#my-applications` | 1 | GL-124 |
| 4 | `ApplicationDetailScreen.js — rejected, at top` | `#application-detail` | 1 | GL-124 |
| 5 | `WithdrawConfirm.js — over a live application, scrolled` | `#withdraw-confirm` | 1 | GL-124 |
| 6 | `ApplicantsScreen.js — list for one gig` | `#applicants` | 2 | — |
| 7 | `ApplicantDetailScreen.js — opening this sets Viewed` | `#applicant-detail` | 2 | — |
| 8 | `TrialReviewScreen.js — mark passed or not passed` | `#trial-review` | 3 | — |
| 9 | `RejectReasonSheet.js — reason code is mandatory` | `#reject-reason` | 2 | — |
| 10 | `HireConfirmSheet.js — the hire that fills the gig` | `#hire-confirm` | 2 | — |

Frame 1 is drawn with a **required skill trial attached**, which is Sprint 3 work. GL-123 builds
the Apply screen without the trial block; it slots in above the submit action later. Frame 4 shows
the **rejected** state, which cannot occur until hiring ships in Sprint 2 — the tracker handles
every status and the rejected state is verified against seeded data.

---

Frames with no story key are unticketed and appear in `ROADMAP.md` as planned lines.
