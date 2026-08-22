// Review client - GL-203/GL-111. The only place the rating flow talks to
// the network for reviews; screens never import axios or touch a token,
// `client` handles auth headers the same way it does for gigs and
// applications (see ./client.js). Covers the endpoint this sprint needs
// (docs/api-contract.md §12.1) - reading reviews back (§12.2) is Sprint 2's
// reviews list screen.

import client from './client';

/**
 * `POST /api/applications/:applicationId/reviews` - submit a rating for the
 * other party to a hired application (§12.1). `direction`, `author` and
 * `subject` are never sent: the server derives all three from the
 * application and the caller's identity, so the payload only ever carries
 * what the flow actually collected.
 */
async function submitReview(applicationId, { rating, categories, text }) {
  const response = await client.post(`/applications/${applicationId}/reviews`, {
    rating,
    categories,
    text,
  });
  return response.data.data;
}

/**
 * `GET /api/reviews/mine` (§12) - the reviews the signed-in caller has
 * written, each carrying its `application` id. Lets a screen answer "have I
 * already rated this application?" in one request instead of one per card;
 * a review the other party wrote back never appears here, since this is
 * filtered on authorship, not on the application.
 */
async function getMyReviews() {
  const response = await client.get('/reviews/mine');
  return response.data.data;
}

export default {
  submitReview,
  getMyReviews,
};
