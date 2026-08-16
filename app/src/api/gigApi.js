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

async function listGigs({ page } = {}) {
  const response = await client.get('/gigs', { params: page ? { page } : undefined });
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

export default {
  createGig,
  listGigs,
  getGig,
  getMyGigs,
  updateGig,
  closeGig,
  deleteGig,
};
