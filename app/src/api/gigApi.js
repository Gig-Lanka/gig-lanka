// Gig client - GL-107. The only place E3 screens talk to the network for
// gigs; screens never import axios or touch a token, `client` handles auth
// headers the same way it does for auth (see ./client.js).
// Covers all seven gig endpoints E3 needs this sprint (docs/api-contract.md
// §10.3–10.9).

import client from './client';

async function createGig(payload) {
  const response = await client.post('/gigs', payload);
  return response.data.data;
}

// Every multi-value parameter (schedule, category, payType, commitment) goes
// over the wire comma-separated, per the contract §10.4 - joining an array
// here is what keeps this client and the server's Joi schema agreeing on one
// shape rather than each guessing (comma-separated vs. repeated keys).
async function listGigs(params = {}) {
  const query = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      query[key] = value.join(',');
    } else {
      query[key] = value;
    }
  });

  const response = await client.get('/gigs', {
    params: Object.keys(query).length ? query : undefined,
  });
  return response.data.data;
}

async function getGig(id) {
  const response = await client.get(`/gigs/${id}`);
  return response.data.data;
}

async function getMyGigs() {
  const response = await client.get('/gigs/mine');
  return response.data.data;
}

async function updateGig(id, payload) {
  const response = await client.put(`/gigs/${id}`, payload);
  return response.data.data;
}

async function closeGig(id) {
  const response = await client.patch(`/gigs/${id}/close`);
  return response.data.data;
}

async function deleteGig(id) {
  const response = await client.delete(`/gigs/${id}`);
  return response.data.data;
}

// Saved tab's list, §10.12. No pagination and no status filter: it returns
// the caller's saved gigs at any status, newest-saved first, in full - same
// shape as getMyGigs.
async function getSavedGigs() {
  const response = await client.get('/gigs/saved');
  return response.data.data;
}

// §10.10 - a PUT/DELETE pair, not a single toggle, precisely so the star's
// optimistic double-tap has something safe to retry against: each call has
// one fixed outcome no matter the gig's starting state. 409 GIG_CLOSED is
// the one failure useSavedToggle doesn't revert silently - the caller reads
// it off error.response.
async function saveGig(id) {
  const response = await client.put(`/gigs/${id}/save`);
  return response.data.data;
}

// §10.11 - deliberately not gated by gig status, unlike save: a seeker can
// always remove a gig from their own saved list.
async function unsaveGig(id) {
  const response = await client.delete(`/gigs/${id}/save`);
  return response.data.data;
}

export default {
  createGig,
  listGigs,
  getGig,
  getMyGigs,
  updateGig,
  closeGig,
  deleteGig,
  getSavedGigs,
  saveGig,
  unsaveGig,
};
