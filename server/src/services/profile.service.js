import mongoose from 'mongoose';
import { Profile } from '../models/profile.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { removeFile } from './storage.service.js';

const NAME_MAX_LENGTH = 60;

// Full-replace semantics, matching PUT /api/gigs/:id: a field left out of the
// body is cleared, not preserved. Each field is listed with the value that
// clears it, so an omitted list empties rather than becoming undefined.
const SHARED_FIELDS = { name: undefined, photo: undefined, bio: undefined, city: undefined };
const SEEKER_FIELDS = { skills: [], workExperience: [], education: [] };
const BUSINESS_FIELDS = { category: undefined };

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

// Criterion 10. The role comes from the user requireAuth loaded from the
// database, never from the token. Rejecting rather than ignoring, so a client
// that sends the wrong role's field learns it did instead of silently losing it.
const assertFieldsMatchRole = (role, body) => {
  const wrongRoleFields = role === 'seeker' ? BUSINESS_FIELDS : SEEKER_FIELDS;

  const offending = Object.keys(wrongRoleFields).filter((field) => body[field] !== undefined);

  if (offending.length > 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      offending.map((field) => ({
        field,
        message: `is not a field on a ${role} profile`,
      })),
    );
  }
};

export const updateMyProfile = async (user, body) => {
  assertFieldsMatchRole(user.role, body);

  const profile = await getOrCreateProfile(user);
  const roleFields = user.role === 'seeker' ? SEEKER_FIELDS : BUSINESS_FIELDS;
  const previousPhoto = profile.photo;

  Object.entries({ ...SHARED_FIELDS, ...roleFields }).forEach(([field, cleared]) => {
    profile[field] = body[field] === undefined ? cleared : body[field];
  });

  await profile.save();

  // GL-114 criteria 10/11: a replaced or removed photo leaves no orphan in
  // storage. This runs after the save above, not before — the new value is
  // already durable by the time the old object is deleted, so a storage
  // hiccup here can't leave the profile pointing at nothing. Best-effort:
  // cleanup failing must not turn an already-successful profile update into
  // a failed request, but it's still logged so an orphaned object isn't
  // silently unrecoverable.
  if (previousPhoto && previousPhoto !== profile.photo) {
    try {
      await removeFile(previousPhoto);
    } catch (err) {
      console.error('Failed to delete previous profile photo from storage:', err);
    }
  }

  return profile.toJSON();
};

// Criteria 11 and 12. Built as a whitelist rather than by deleting private
// fields from the full profile: a field added to the schema later — a contact
// number, an account status — is absent here until someone deliberately lists
// it, instead of leaking the day it lands. Email never appears because it lives
// on User and is never read into this shape.
const PUBLIC_SHARED_FIELDS = ['photo', 'name', 'city', 'bio'];
const PUBLIC_SEEKER_FIELDS = ['skills', 'workExperience', 'education', 'skillTrialResults'];
const PUBLIC_BUSINESS_FIELDS = ['category'];

const toPublicProfile = (user, profile) => {
  const json = profile.toJSON();
  const roleFields = user.role === 'seeker' ? PUBLIC_SEEKER_FIELDS : PUBLIC_BUSINESS_FIELDS;

  const publicProfile = {
    userId: user._id.toString(),
    ratingSummary: json.ratingSummary,
  };

  [...PUBLIC_SHARED_FIELDS, ...roleFields].forEach((field) => {
    publicProfile[field] = json[field];
  });

  return publicProfile;
};

export const getPublicProfile = async (userId) => {
  // Every rejection below is the same 404. Which ids exist, which belong to an
  // admin and which have been deactivated are all not public information.
  const profileNotFound = () => new ApiError(404, 'NOT_FOUND', 'Profile not found.');

  if (!mongoose.isValidObjectId(userId)) {
    throw profileNotFound();
  }

  // Read lean so the isActive check below sees the stored document rather than
  // only the paths the schema declares today — a hydrated document hides fields
  // the schema has not caught up with, which would silently disable that guard.
  const user = await User.findById(userId).lean();

  // Admins have no profile (criterion 7), so there is nothing to show for one
  // and nothing may be created for one either.
  if (!user || user.role === 'admin') {
    throw profileNotFound();
  }

  // Criterion 13, written before the flag exists: isActive arrives in Sprint 3,
  // so only an explicit false hides a profile and accounts stored without the
  // field stay visible. The 404 is identical to a missing profile on purpose —
  // a deactivated account must not be distinguishable from one that never was.
  if (user.isActive === false) {
    throw profileNotFound();
  }

  const profile = await getOrCreateProfile(user);

  return toPublicProfile(user, profile);
};

// The single writer of Profile.ratingSummary (GL-222/GL-265) — called only by
// review.service.js after it recomputes a subject's aggregate from their
// reviews. Narrow by design: this sets ratingSummary alone, never a general
// profile write. Goes through getOrCreateProfile rather than a plain
// updateOne so a subject who has never read their own profile still gets one
// created here — otherwise the aggregate would silently not persist, and a
// later lazy read would create a fresh, zeroed profile that looks like it was
// never reviewed.
export const setRatingSummary = async (userId, ratingSummary) => {
  const user = await User.findById(userId);

  if (!user) return;

  const profile = await getOrCreateProfile(user);
  profile.ratingSummary = ratingSummary;
  await profile.save();
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

// Batched sibling of getPublicIdentity, for a caller that needs several
// people's identities at once (GL-371: an admin report page's reporters,
// user targets and gig-poster businesses) — one query for the whole set
// instead of one per id. Same contract per id as the single-id version,
// including the no-profile-yet fallback to nulls; returned as a Map keyed by
// the string id so a caller can look up a raw ObjectId reference either way.
export const getPublicIdentities = async (userIds) => {
  const uniqueIds = [...new Set(userIds.map((id) => id.toString()))];

  if (uniqueIds.length === 0) return new Map();

  const profiles = await Profile.find({ user: { $in: uniqueIds } })
    .select('user name photo')
    .lean();
  const byUserId = new Map(profiles.map((profile) => [profile.user.toString(), profile]));

  return new Map(
    uniqueIds.map((id) => [
      id,
      {
        id,
        name: byUserId.get(id)?.name ?? null,
        photo: byUserId.get(id)?.photo ?? null,
      },
    ]),
  );
};
