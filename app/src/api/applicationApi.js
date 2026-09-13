// Application client - E4. The only place screens talk to the network for
// applications, seeker or business side; screens never import axios or
// touch a token, `client` handles auth headers the same way it does for
// gigs (see ./client.js). GL-188 added the list endpoint, GL-190 the
// single-read endpoint, GL-191 withdraw (docs/api-contract.md §11.10). This
// adds apply (§11.7) for GL-185's ApplyScreen; wiring the submit button to
// it is GL-186's job.
//
// GL-254 doubles this module with the business side (§11.12-§11.17): the
// two applicant lists (GL-252) and the four status transitions (GL-253),
// grouped below the seeker calls rather than interleaved with them.

import client from './client';

async function getMyApplications() {
  const response = await client.get('/applications/mine');
  return response.data.data;
}

/**
 * `POST /api/gigs/:gigId/applications` - apply to a gig (§11.7). Every field
 * except `skillTrialSubmission` is stripped server-side, whatever the
 * client sends. `skillTrialSubmission` is optional - GL-357: the seeker's
 * skill trial response, `{ textResponse, fileUrl }`, assembled by
 * SkillTrialScreen and carried here through Apply's navigation params, sent
 * in the same request rather than through a submission endpoint of its own.
 * Resolves to `{ application, profileIncomplete }` - `profileIncomplete`
 * mirrors the same no-experience-and-no-education check the apply screen
 * runs beforehand, computed again server-side at the moment of submission.
 */
async function apply(gigId, skillTrialSubmission) {
  const response = await client.post(`/gigs/${gigId}/applications`, {
    skillTrialSubmission,
  });
  return response.data.data;
}

async function getApplication(id) {
  const response = await client.get(`/applications/${id}`);
  return response.data.data;
}

async function withdrawApplication(id) {
  const response = await client.patch(`/applications/${id}/withdraw`);
  return response.data.data;
}

/**
 * `PATCH /api/applications/:id/complete` - mark a hired application complete
 * (§11.11). Business-only, and only from `hired`. No request body:
 * completion takes no reason.
 */
async function completeApplication(id) {
  const response = await client.patch(`/applications/${id}/complete`);
  return response.data.data;
}

// --- Business-side calls (§11.12-§11.17) -----------------------------

// Comma-joins a `status` value the same way gigApi's listGigs joins its
// multi-value filters, so the wire shape matches the server's shared
// status-filter parsing whether the caller passes one status or several.
function statusParams(status) {
  if (!status) return undefined;
  const joined = Array.isArray(status) ? status.join(',') : status;
  return joined ? { status: joined } : undefined;
}

/**
 * `GET /api/gigs/:gigId/applications` - every application to one gig, to
 * the business that posted it (§11.12). `status` is optional: a single
 * value or an array of values to filter to.
 */
async function getGigApplications(gigId, { status } = {}) {
  const response = await client.get(`/gigs/${gigId}/applications`, {
    params: statusParams(status),
  });
  return response.data.data;
}

/**
 * `GET /api/applications/for-my-gigs` - every application across all of the
 * signed-in business's gigs, each with a gig summary (§11.13). `status` is
 * optional, same rules as `getGigApplications`.
 */
async function getApplicationsForMyGigs({ status } = {}) {
  const response = await client.get('/applications/for-my-gigs', {
    params: statusParams(status),
  });
  return response.data.data;
}

/**
 * `PATCH /api/applications/:id/view` - move an application from `applied`
 * to `viewed` (§11.14). No request body. Called on an application already
 * past `applied` this returns 409, and the caller is expected to swallow
 * that quietly - GL-220 calls it on every open, and opening an applicant
 * twice is not an error a business should ever see.
 */
async function viewApplication(id) {
  const response = await client.patch(`/applications/${id}/view`);
  return response.data.data;
}

/**
 * `PATCH /api/applications/:id/shortlist` - move a viewed application to
 * `shortlisted` (§11.15). No request body.
 */
async function shortlistApplication(id) {
  const response = await client.patch(`/applications/${id}/shortlist`);
  return response.data.data;
}

/**
 * `PATCH /api/applications/:id/hire` - move a shortlisted application to
 * `hired` (§11.16). No request body.
 */
async function hireApplication(id) {
  const response = await client.patch(`/applications/${id}/hire`);
  return response.data.data;
}

/**
 * `PATCH /api/applications/:id/reject` - move an application to `rejected`
 * (§11.17). `reasonCode` is required, one of the seven business-selectable
 * codes (§6.8); `note` is optional, up to 300 characters, sent exactly as
 * written - never trimmed here, since the server stores it verbatim.
 */
async function rejectApplication(id, { reasonCode, note } = {}) {
  const response = await client.patch(`/applications/${id}/reject`, { reasonCode, note });
  return response.data.data;
}

export default {
  getMyApplications,
  getApplication,
  withdrawApplication,
  completeApplication,
  apply,
  getGigApplications,
  getApplicationsForMyGigs,
  viewApplication,
  shortlistApplication,
  hireApplication,
  rejectApplication,
};
