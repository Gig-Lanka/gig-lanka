// Profile client - GL-145. The single place the E2 profile screens talk to
// the network: no screen imports Axios and no screen ever sees a token,
// because `client.js` attaches, refreshes and retries on its own.
//
// Each call unwraps the envelope down to the profile document itself
// (`data.profile` in docs/api-contract.md §8), so callers work with the
// profile and never with the response shape. Errors propagate untouched -
// an axios rejection already carries `error.response.status` and
// `error.response.data.error`, which is what the screens render.

import client from './client';

/**
 * `GET /api/profiles/me` - the signed-in user's own full profile (§8.1).
 * The server creates the profile lazily, so this never 404s for a seeker or
 * a business; an admin token gets a 403.
 */
async function getMyProfile() {
  const response = await client.get('/profiles/me');
  return response.data.data.profile;
}

/**
 * `PUT /api/profiles/me` - replaces the profile in full (§8.4). A field left
 * out of `profile` is cleared, not preserved, so callers send the whole
 * document rather than a patch. The body is passed straight through: which
 * fields a role may send is the form's business, and the server rejects the
 * rest with a `VALIDATION_ERROR` naming each offending field.
 */
async function updateMyProfile(profile) {
  const response = await client.put('/profiles/me', profile);
  return response.data.data.profile;
}

/**
 * `GET /api/profiles/:userId` - another person's public profile (§8.2).
 * `userId` is the **user's** id, not the profile's. A missing, admin-owned
 * or deactivated target all answer with the same 404 by design.
 */
async function getPublicProfile(userId) {
  const response = await client.get(`/profiles/${encodeURIComponent(userId)}`);
  return response.data.data.profile;
}

export default {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
};
