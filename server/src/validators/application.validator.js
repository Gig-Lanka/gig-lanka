import Joi from 'joi';

// Apply has no accepted fields — status and appliedAt are set by the
// service and never taken from the client. An empty schema still routes
// the body through validate() so any fields a caller sends are stripped
// rather than silently reaching the service.
export const applyToGigSchema = Joi.object({});

// The four rejection rules — a missing code, a code that isn't
// business-selectable, an unrecognised code, and a trial code on a gig
// with no trial — all live in assertValidRejection (application.service.js)
// and stay there. This schema only shapes the body: strips anything else
// the caller sends, and never trims `note`, since it is stored exactly as
// written (§11.1).
export const rejectApplicationSchema = Joi.object({
  reasonCode: Joi.string(),
  note: Joi.string(),
});
