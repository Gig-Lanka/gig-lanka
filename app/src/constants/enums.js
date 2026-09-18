function freezeList(items) {
  return Object.freeze(items.map((item) => Object.freeze(item)));
}

export const GIG_CATEGORIES = freezeList([
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'event_help', label: 'Event help' },
  { value: 'retail', label: 'Retail' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'admin_data_entry', label: 'Admin & data entry' },
  { value: 'creative', label: 'Creative' },
  { value: 'tech', label: 'Tech' },
  { value: 'other', label: 'Other' },
]);

export const PAY_TYPES = freezeList([
  { value: 'per_hour', label: 'Per hour' },
  { value: 'per_day', label: 'Per day' },
  { value: 'fixed_price', label: 'Fixed price' },
]);

export const SCHEDULE_TAGS = freezeList([
  { value: 'weekday_mornings', label: 'Weekday mornings' },
  { value: 'weekday_evenings', label: 'Weekday evenings' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'flexible_hours', label: 'Flexible hours' },
]);

export const COMMITMENT_LENGTHS = freezeList([
  { value: 'one_off', label: 'One-off' },
  { value: 'under_a_week', label: 'Under a week' },
  { value: 'one_to_four_weeks', label: '1-4 weeks' },
  { value: 'ongoing', label: 'Ongoing' },
]);

export const GIG_STATUSES = freezeList([
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'filled', label: 'Filled' },
]);

export const GIG_SORT_ORDERS = freezeList([
  { value: 'newest', label: 'Newest' },
  { value: 'highest_pay', label: 'Highest pay' },
  { value: 'starting_soon', label: 'Starting soon' },
]);

// No 'required' value: product decided a skill trial is never mandatory to
// apply, only ever absent or optional. See GL-341's PR / Jira note.
export const SKILL_TRIAL_REQUIREMENTS = freezeList([
  { value: 'none', label: 'No trial' },
  { value: 'optional', label: 'Optional' },
]);

export const SKILL_TRIAL_SUBMISSION_TYPES = freezeList([
  { value: 'text', label: 'Text' },
  { value: 'file', label: 'File' },
  { value: 'text_and_file', label: 'Text and file' },
]);

// 1-2 hours is a hard ceiling - the brief caps trial effort at two hours to
// protect the seeker, so no fourth value may be added here.
export const SKILL_TRIAL_EFFORT_ESTIMATES = freezeList([
  { value: 'under_30_minutes', label: 'Under 30 minutes' },
  { value: '30_to_60_minutes', label: '30-60 minutes' },
  { value: '1_to_2_hours', label: '1-2 hours' },
]);

// The brief's closed five-value trial-result vocabulary (GL-297 §4/§8),
// mirrored from server/src/models/application.model.js. `submitted` and
// `skipped` are set by the applicant's own action at apply time;
// `passed`/`not_passed` are set only by the business, once, through the
// trial review endpoint. This is a result, not a status - it never joins
// APPLICATION_STATUSES below.
export const SKILL_TRIAL_RESULTS = freezeList([
  { value: 'not_submitted', label: 'Not submitted' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'passed', label: 'Passed' },
  { value: 'not_passed', label: 'Not passed' },
  { value: 'skipped', label: 'Skipped' },
]);

// `terminal` marks the five §11.2 calls "decided" - hired, completed,
// rejected, withdrawn and closed_filled - and drives isLiveApplication
// (ApplicationStatusFilter.js), which the tracker also consumes. `hired`
// keeps `terminal: true` even though §11.3 now gives it one outgoing move
// (to completed): flipping it to false would make PATH_ORDER.indexOf('hired')
// return -1, and buildSteps would then render every step of a hired
// application as not reached - an empty tracker on hire.
export const APPLICATION_STATUSES = freezeList([
  { value: 'applied', label: 'Applied', terminal: false },
  { value: 'viewed', label: 'Viewed', terminal: false },
  { value: 'shortlisted', label: 'Shortlisted', terminal: false },
  { value: 'hired', label: 'Hired', terminal: true },
  { value: 'completed', label: 'Completed', terminal: true },
  { value: 'rejected', label: 'Rejected', terminal: true },
  { value: 'withdrawn', label: 'Withdrawn', terminal: true },
  { value: 'closed_filled', label: 'Closed – position filled', terminal: true },
]);

export const REJECTION_REASONS = freezeList([
  { value: 'schedule_mismatch', label: 'Schedule did not match', systemOnly: false },
  { value: 'location_too_far', label: 'Location too far', systemOnly: false },
  { value: 'skill_trial_not_passed', label: 'Skill trial not passed', systemOnly: false },
  { value: 'skill_trial_not_attempted', label: 'Skill trial not attempted', systemOnly: false },
  {
    value: 'looking_for_more_experience',
    label: 'Looking for more relevant experience',
    systemOnly: false,
  },
  {
    value: 'another_applicant_closer_fit',
    label: 'Another applicant was a closer fit',
    systemOnly: false,
  },
  { value: 'role_no_longer_needed', label: 'Role no longer needed', systemOnly: false },
  { value: 'positions_filled', label: 'Positions filled', systemOnly: true },
]);

// Reporting has no business-rules brief — these were agreed at Sprint 3
// planning with the product owner. Mirrored from server/src/models/report.model.js,
// the deliberate duplication every other vocabulary here uses. NOT derived from
// REJECTION_REASONS: the shape is similar but the vocabulary is unrelated, and
// sharing them would couple two closed lists that change for different reasons.
export const REPORT_REASONS = freezeList([
  { value: 'spam_or_scam', label: 'Spam or scam' },
  { value: 'misleading_gig_details', label: 'Misleading gig details' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'harassment_or_abuse', label: 'Harassment or abuse' },
  { value: 'unsafe_working_conditions', label: 'Unsafe working conditions' },
  { value: 'other', label: 'Other' },
]);

// `open` is the only status this sprint produces. `resolved` and `dismissed`
// are declared for Sprint 4 (the moderation actions) and have no writer yet.
export const REPORT_STATUSES = freezeList([
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]);

export const BUSINESS_REVIEW_CATEGORIES = freezeList([
  { value: 'fair_payment', label: 'Fair payment' },
  { value: 'clear_job_description', label: 'Clear job description' },
  { value: 'communication', label: 'Communication' },
  { value: 'respectful_treatment', label: 'Respectful treatment' },
  { value: 'payment_on_time', label: 'Payment on time' },
  { value: 'safe_working_environment', label: 'Safe working environment' },
]);

export const YOUTH_WORKER_REVIEW_CATEGORIES = freezeList([
  { value: 'work_quality', label: 'Work quality' },
  { value: 'punctuality', label: 'Punctuality' },
  { value: 'communication', label: 'Communication' },
  { value: 'professionalism', label: 'Professionalism' },
  { value: 'reliability', label: 'Reliability' },
  { value: 'ability_to_follow_instructions', label: 'Ability to follow instructions' },
]);
