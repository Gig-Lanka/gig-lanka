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

// `terminal` follows §11.2/§11.3: hired, rejected, withdrawn and
// closed_filled have no outgoing transition and can never be reopened.
export const APPLICATION_STATUSES = freezeList([
  { value: 'applied', label: 'Applied', terminal: false },
  { value: 'viewed', label: 'Viewed', terminal: false },
  { value: 'shortlisted', label: 'Shortlisted', terminal: false },
  { value: 'hired', label: 'Hired', terminal: true },
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
