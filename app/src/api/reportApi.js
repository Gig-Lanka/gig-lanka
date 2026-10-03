// Report client - E6/GL-305 (docs/api-contract.md §13). The only place
// screens talk to the network for reports; screens never import axios or
// touch a token, `client` handles auth headers the same way it does for
// gigs and applications (see ./client.js). Covers the reporter's endpoints
// (§13.2-13.3) and the admin queue, resolve and dismiss.

import client from './client';

/**
 * `POST /api/reports` - file a report against a user or a gig (§13.2).
 * `targetType` is exactly `'user'` or `'gig'` on the wire - the display-level
 * distinction between a business and an individual profile (ReportSheet's
 * own `targetType` prop) doesn't exist server-side, both are just `'user'`.
 * `note` is optional, up to 300 characters, sent exactly as written - the
 * server stores it verbatim, the same rule `rejectApplication`'s `note`
 * follows.
 */
async function createReport({ targetType, targetId, reasonCode, note }) {
  const response = await client.post('/reports', { targetType, targetId, reasonCode, note });
  return response.data.data;
}

/**
 * `GET /api/reports/mine` - every report the signed-in caller has filed,
 * newest first, each with a `target` summary (§13.3). No screen renders
 * this yet - GL-305's roadmap has no "my reports" screen this sprint - but
 * the endpoint exists, so the client module is complete.
 */
async function getMyReports() {
  const response = await client.get('/reports/mine');
  return response.data.data;
}

/**
 * `GET /api/admin/reports` - the moderation queue (GL-370, §13.4).
 * Admin-only (the server 403s any other role), ten per page. `status` is
 * `'open'` (the default - newest filed first) or `'closed'` (resolved and
 * dismissed together, most recently closed first, each row also carrying
 * `status`, `resolutionNote`, `closedAt` and `closedBy`). Each report
 * carries a resolved `reporter` identity and `target` summary, with
 * `target` coming back `null` when the reported gig or user is gone.
 */
async function getOpenReports(page, status = 'open') {
  const response = await client.get('/admin/reports', { params: { page, status } });
  return response.data.data;
}

/**
 * `PATCH /api/admin/reports/:id/resolve` - close an open report as resolved
 * (GL-442). `note` is required, 1-300 characters with at least one
 * non-space character, and stored verbatim as the report's resolution note.
 * A report that's no longer open comes back 409 `REPORT_ALREADY_CLOSED`.
 * Returns `{ report }` in the same shape as a closed queue row.
 */
async function resolveReport(id, note) {
  const response = await client.patch(`/admin/reports/${id}/resolve`, { note });
  return response.data.data;
}

/**
 * `PATCH /api/admin/reports/:id/dismiss` - close an open report as
 * dismissed (GL-442). Same `note` rules, 409 and response as
 * `resolveReport`.
 */
async function dismissReport(id, note) {
  const response = await client.patch(`/admin/reports/${id}/dismiss`, { note });
  return response.data.data;
}

export default {
  createReport,
  getMyReports,
  getOpenReports,
  resolveReport,
  dismissReport,
};
