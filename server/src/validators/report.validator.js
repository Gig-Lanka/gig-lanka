import Joi from 'joi';
import { REPORT_TARGET_TYPES, REPORT_REASON_CODES } from '../models/report.model.js';

// The closed vocabularies live on the model — the Mongoose enum's source of
// truth — and are imported here rather than redeclared, unlike
// review.validator.js's category lists: those aren't exported anywhere else
// for this schema to read from, report.model.js already is.
//
// targetId is left as a plain required string, not validated as an ObjectId
// shape here: a malformed id must 404 (criterion 7), and only the service
// knows whether an id is malformed vs. merely unknown — rejecting it here
// would turn that into a 400 instead.
export const createReportSchema = Joi.object({
  targetType: Joi.string()
    .valid(...REPORT_TARGET_TYPES)
    .required(),
  targetId: Joi.string().required(),
  reasonCode: Joi.string()
    .valid(...REPORT_REASON_CODES)
    .required(),
  note: Joi.string().trim().max(300).allow('').optional(),
});
