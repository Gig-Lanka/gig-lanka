// Application client — E4. The only place seeker screens talk to the
// network for applications; screens never import axios or touch a token,
// `client` handles auth headers the same way it does for gigs (see
// ./client.js). Starts with the one endpoint GL-188 needs
// (docs/api-contract.md §11.8); GL-123, GL-190 and GL-191 extend it with
// apply, read-one and withdraw.

import client from './client';

async function getMyApplications() {
  const response = await client.get('/applications/mine');
  return response.data.data;
}

export default {
  getMyApplications,
};
