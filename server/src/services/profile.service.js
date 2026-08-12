import { Profile } from '../models/profile.model.js';

const NAME_MAX_LENGTH = 60;

// Name is required on a profile but nothing captures one at registration yet,
// so a lazily created profile falls back to the email's local part — always
// present, recognisably theirs, and obvious to edit. Sliced to the schema's
// limit because a local part may legally be longer than the name field allows.
// Once registration takes a name this becomes the fallback for accounts that
// predate it, not the usual path.
const nameFromEmail = (email) => email.split('@')[0].slice(0, NAME_MAX_LENGTH);

// Criterion 6: a signed-in user can never be without a profile. Creating it
// here rather than at registration means accounts made before profiles existed
// are covered by the same path, instead of 404ing forever.
const getOrCreateProfile = async (user) => {
  const existing = await Profile.findOne({ user: user._id });

  if (existing) return existing;

  try {
    return await Profile.create({ user: user._id, name: nameFromEmail(user.email) });
  } catch (err) {
    // Two concurrent first reads race to create the same profile; the unique
    // index on `user` settles it. The loser reads back the winner's document.
    if (err.code === 11000) {
      return Profile.findOne({ user: user._id });
    }
    throw err;
  }
};

export const getMyProfile = async (user) => {
  const profile = await getOrCreateProfile(user);

  return profile.toJSON();
};

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
