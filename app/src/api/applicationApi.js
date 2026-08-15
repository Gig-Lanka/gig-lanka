// Application client — E4. The only place seeker screens talk to the
// network for applications; screens never import axios or touch a token,
// `client` handles auth headers the same way it does for gigs (see
// ./client.js). GL-188 added the list endpoint, GL-190 the single-read
// endpoint. This adds withdraw (docs/api-contract.md §11.10). GL-123 still
// owes it apply.

import client from './client';

async function getMyApplications() {
  const response = await client.get('/applications/mine');
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

export default {
  getMyApplications,
  getApplication,
  withdrawApplication,
};
