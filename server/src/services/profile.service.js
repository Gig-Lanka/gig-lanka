import { Profile } from '../models/profile.model.js';

// The name and photo any other feature embeds when it shows who someone is —
// a gig's business block, and later an application or review author. This is
// the only shape other components should read a profile through, so when the
// public identity changes it changes in one place instead of in every caller.
//
// Read-only and non-creating on purpose: callers include public, unauthenticated
// endpoints (GET /api/gigs/:id), and a public read must never write. A user with
// no profile yet returns nulls rather than being lazily created here.
//
// userId is trusted to be a valid ObjectId — callers that take an id from a
// request validate it at that boundary and 404 there, the way gig.service does.
export const getPublicIdentity = async (userId) => {
  const profile = await Profile.findOne({ user: userId }).select('name photo').lean();

  return {
    id: userId.toString(),
    name: profile?.name ?? null,
    photo: profile?.photo ?? null,
  };
};
