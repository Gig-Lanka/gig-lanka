import Joi from 'joi';

// `skillTrialSubmission` is the only accepted field — status, appliedAt and
// the profile snapshot stay server-derived and are stripped (stripUnknown,
// validate.middleware.js) if a caller sends them. Content validation against
// the gig's submissionType (text length, file requirement per type) is a
// sibling sub-task's concern; this only shapes the two client-settable
// fields — `result`, `submittedAt` etc. are server-derived and stripped the
// same way if sent here.
export const applyToGigSchema = Joi.object({
  skillTrialSubmission: Joi.object({
    textResponse: Joi.string(),
    fileUrl: Joi.string(),
  }).optional(),
});

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
