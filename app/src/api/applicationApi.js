// Application client - E4. The only place seeker screens talk to the
// network for applications; screens never import axios or touch a token,
// `client` handles auth headers the same way it does for gigs (see
// ./client.js). GL-188 added the list endpoint, GL-190 the single-read
// endpoint, GL-191 withdraw (docs/api-contract.md §11.10). This adds apply
// (§11.7) for GL-185's ApplyScreen; wiring the submit button to it is
// GL-186's job.

import client from './client';

async function getMyApplications() {
  const response = await client.get('/applications/mine');
  return response.data.data;
}

/**
 * `POST /api/gigs/:gigId/applications` - apply to a gig (§11.7). No request
 * body: the endpoint strips every field the client might send. Resolves to
 * `{ application, profileIncomplete }` - `profileIncomplete` mirrors the
 * same no-experience-and-no-education check the apply screen runs
 * beforehand, computed again server-side at the moment of submission.
 */
async function apply(gigId) {
  const response = await client.post(`/gigs/${gigId}/applications`);
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

export default {
  getMyApplications,
  getApplication,
  withdrawApplication,
  completeApplication,
  apply,
};
