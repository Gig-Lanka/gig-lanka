import Joi from 'joi';

// Apply has no accepted fields — status and appliedAt are set by the
// service and never taken from the client. An empty schema still routes
// the body through validate() so any fields a caller sends are stripped
// rather than silently reaching the service.
export const applyToGigSchema = Joi.object({});
