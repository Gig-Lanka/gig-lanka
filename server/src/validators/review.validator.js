import Joi from 'joi';

// The two category sets from docs/api-contract.md §6.9. Which set applies to
// a given review is decided server-side from the application (review.service.js),
// never by the client — this schema only rejects a category that isn't a real
// value at all; the direction-specific mismatch check happens in the service,
// where the direction is actually known.
export const SEEKER_TO_BUSINESS_CATEGORIES = [
  'fair_payment',
  'clear_job_description',
  'communication',
  'respectful_treatment',
  'payment_on_time',
  'safe_working_environment',
];

export const BUSINESS_TO_SEEKER_CATEGORIES = [
  'work_quality',
  'punctuality',
  'communication',
  'professionalism',
  'reliability',
  'ability_to_follow_instructions',
];

const ALL_REVIEW_CATEGORIES = [
  ...new Set([...SEEKER_TO_BUSINESS_CATEGORIES, ...BUSINESS_TO_SEEKER_CATEGORIES]),
];

export const createReviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  text: Joi.string().trim().min(20).max(1000).required(),
  categories: Joi.array()
    .items(Joi.string().valid(...ALL_REVIEW_CATEGORIES))
    .default([]),
});

// §12.2's `page` and `rating` query params. `page` stays `Joi.any()`, same as
// listGigsQuerySchema — malformed or missing values fall back to `1` in the
// service, not here. `rating`, once present, narrows the query server-side
// (GL-373) so it must be a real star value or rejected outright, the same as
// GL-215/GL-216 did for Browse's filters.
export const listUserReviewsQuerySchema = Joi.object({
  page: Joi.any().optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
});
