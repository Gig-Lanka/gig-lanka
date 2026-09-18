// Report client - E6/GL-305 (docs/api-contract.md §13). The only place
// screens talk to the network for reports; screens never import axios or
// touch a token, `client` handles auth headers the same way it does for
// gigs and applications (see ./client.js). Covers both endpoints §13.2-13.3
// define this sprint.

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
 * `GET /api/admin/reports` - the open-reports moderation queue (GL-370).
 * Admin-only (the server 403s any other role), open reports only, newest
 * first, ten per page - `page` is the only parameter this endpoint reads.
 * Each report carries a resolved `reporter` identity and `target` summary,
 * with `target` coming back `null` when the reported gig or user is gone.
 */
async function getOpenReports(page) {
  const response = await client.get('/admin/reports', { params: { page } });
  return response.data.data;
}

export default {
  createReport,
  getMyReports,
  getOpenReports,
};
