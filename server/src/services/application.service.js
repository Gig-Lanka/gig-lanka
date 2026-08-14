import { ApiError } from '../utils/ApiError.js';

// Source status -> the statuses it may move to, and nothing else. Modeled as
// data, not a chain of conditionals, so Sprint 2's hiring flow and Sprint 3's
// auto-close rule can extend it safely. Terminal statuses (Hired, Rejected,
// Withdrawn, Closed – position filled) have no entry here, so any move out
// of one of them falls straight through to the 409 below — nothing reopens
// a terminal application, and status never moves backwards.
const PERMITTED_TRANSITIONS = {
  applied: ['viewed', 'rejected', 'withdrawn', 'closed_filled'],
  viewed: ['shortlisted', 'rejected', 'withdrawn', 'closed_filled'],
  shortlisted: ['hired', 'rejected', 'withdrawn'],
};

// The single code path allowed to change an application's status — nothing
// else in this sprint or the next two writes the status field. Pure with
// respect to HTTP: takes the application, the target status, the acting
// user and a reason, and throws ApiError; it never touches req or res, so
// GL-110's endpoints and later hiring/auto-close callers can use it directly.
//
// `actor` and `reason` are accepted now so this signature doesn't change
// again — GL-180 wires in the actor restrictions, the reason-code
// requirements and the viewedAt/decidedAt timestamp rules on top of the
// structural move validation done here.
export const transitionApplicationStatus = async (application, targetStatus, _actor, _reason) => {
  const currentStatus = application.status;
  const permittedTargets = PERMITTED_TRANSITIONS[currentStatus] || [];

  if (!permittedTargets.includes(targetStatus)) {
    throw new ApiError(
      409,
      'INVALID_APPLICATION_TRANSITION',
      `Cannot move an application from "${currentStatus}" to "${targetStatus}".`,
    );
  }

  application.status = targetStatus;
  await application.save();

  return application;
};
