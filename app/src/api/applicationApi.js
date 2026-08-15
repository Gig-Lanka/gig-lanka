// Application client — E4. The only place seeker screens talk to the
// network for applications; screens never import axios or touch a token,
// `client` handles auth headers the same way it does for gigs (see
// ./client.js). GL-188 added the list endpoint; this adds the single-read
// endpoint GL-190 needs (docs/api-contract.md §11.9). GL-123 and GL-191
// still owe it apply and withdraw.

import client from './client';

async function getMyApplications() {
  const response = await client.get('/applications/mine');
  return response.data.data;
}

async function getApplication(id) {
  const response = await client.get(`/applications/${id}`);
  return response.data.data;
}

export default {
  getMyApplications,
  getApplication,
};
