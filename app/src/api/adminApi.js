// Admin account client - GL-453 (docs/api-contract.md §14). The only place
// screens talk to the network for admin actions on an account; `client`
// handles auth headers the same way it does for reports (see ./client.js).
// Every endpoint here is admin-only - the server 403s any other role.

import client from './client';

/**
 * `PATCH /api/admin/users/:id/suspend` - suspend an account (§14.2). No
 * body. Signs the user out of every device and hides their gigs; nothing is
 * deleted. An admin target comes back 403 `FORBIDDEN`, an unknown id 404
 * `NOT_FOUND`, and an account that's already suspended 409
 * `ACCOUNT_ALREADY_SUSPENDED`. Returns `{ userId, status, suspendedAt }`.
 */
async function suspendUser(userId) {
  const response = await client.patch(`/admin/users/${userId}/suspend`);
  return response.data.data;
}

/**
 * `PATCH /api/admin/users/:id/reinstate` - lift a suspension (§14.3). No
 * body. An unknown id comes back 404 `NOT_FOUND`, and an account that isn't
 * suspended 409 `ACCOUNT_NOT_SUSPENDED`. Returns `{ userId, status }`.
 */
async function reinstateUser(userId) {
  const response = await client.patch(`/admin/users/${userId}/reinstate`);
  return response.data.data;
}

export default {
  suspendUser,
  reinstateUser,
};
