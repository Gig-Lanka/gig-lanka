import mongoose from 'mongoose';
import { Gig } from '../models/gig.model.js';
import { Application } from '../models/application.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { getPublicIdentity, getPublicIdentities } from './profile.service.js';

const PAGE_SIZE = 10;

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;
const escapeRegExp = (value) => value.replace(REGEX_METACHARACTERS, '\\$&');

const SORT_SPECS = {
  newest: { createdAt: -1, _id: -1 },
  highest_pay: { payAmount: -1, _id: -1 },
};

// GL-316: gigs posted by a deactivated business narrow out of the public
// listing (User & Profile brief §9). A $nin of deactivated poster ids rather
// than a $lookup — listByStartingSoon below runs its own aggregation, and a
// $lookup here would have to be kept in step with it forever. $nin against
// an empty array excludes nothing, so this is safe to apply unconditionally.
const getDeactivatedPosterIds = () => User.find({ isActive: false }).distinct('_id');

// Builds the filter for the public listing only — status: 'open' is fixed
// here and never derived from `query`, so no combination of parameters can
// widen the result past open gigs. applicationsCloseDate is excluded here
// too: a gig whose deadline has passed but hasn't been read (and lazily
// closed, see closeIfExpired) since must still not appear as browsable.
// $not/$lt also matches a missing field, so gigs with no deadline pass through.
const buildOpenGigFilter = async (query) => {
  const today = new Date().toISOString().slice(0, 10);
  const deactivatedPosterIds = await getDeactivatedPosterIds();
  const filter = {
    status: 'open',
    applicationsCloseDate: { $not: { $lt: today } },
    postedBy: { $nin: deactivatedPosterIds },
  };

  if (query.q) {
    // Metacharacters must be escaped before building the RegExp: an
    // unescaped `(` throws (crashing the request) and `.*` turns the match
    // into an unanchored full scan.
    const pattern = new RegExp(escapeRegExp(query.q), 'i');
    filter.$or = [{ title: pattern }, { description: pattern }];
  }

  // $in gives OR-within-field for both a scalar field (category, payType,
  // commitment) and an array field (schedule, where it matches a gig
  // carrying any of the requested tags).
  if (query.category) filter.category = { $in: query.category };
  if (query.schedule) filter.schedule = { $in: query.schedule };
  if (query.payType) filter.payType = { $in: query.payType };
  if (query.commitment) filter.commitment = { $in: query.commitment };

  if (typeof query.remote === 'boolean') filter.remote = query.remote;

  if (query.city) {
    filter.city = new RegExp(`^${escapeRegExp(query.city)}$`, 'i');
  }

  if (typeof query.minPay === 'number') {
    filter.payAmount = { $gte: query.minPay };
  }

  return filter;
};

// startDate is optional and stored as a plain string, so Mongo's normal
// ascending sort treats every undated gig as `null` and puts it first. This
// resolves the order (undated last) via aggregation, but only to pick the
// page's ids — the actual documents are still hydrated through Gig.find so
// the schema's toJSON transform and `savedBy`'s select:false keep applying,
// the same as every other read path.
const listByStartingSoon = async (filter, page) => {
  const idRows = await Gig.aggregate([
    { $match: filter },
    {
      $addFields: {
        _hasStartDate: { $cond: [{ $ifNull: ['$startDate', false] }, 0, 1] },
      },
    },
    { $sort: { _hasStartDate: 1, startDate: 1, _id: 1 } },
    { $skip: (page - 1) * PAGE_SIZE },
    { $limit: PAGE_SIZE },
    { $project: { _id: 1 } },
  ]);

  const orderedIds = idRows.map((row) => row._id);
  const gigs = await Gig.find({ _id: { $in: orderedIds } });
  const gigById = new Map(gigs.map((gig) => [gig._id.toString(), gig]));

  return orderedIds.map((id) => gigById.get(id.toString())).filter(Boolean);
};

const UPDATABLE_FIELDS = [
  'title',
  'description',
  'category',
  'payAmount',
  'payType',
  'remote',
  'city',
  'area',
  'schedule',
  'commitment',
  'positions',
  'startDate',
  'applicationsCloseDate',
];

// GL-283: nothing else ever moves a gig from 'open' to 'closed' on its own -
// the only other writer is the business's manual PATCH .../close. Without
// this, `status` can say 'open' indefinitely after applicationsCloseDate has
// passed, while anything computing off the date directly (the deadline
// banner) disagrees with it. Called wherever a single gig is read or written,
// so status is corrected before anyone - client or another server code path -
// reads it. Mirrors the 'system' actor pattern planned for positions-filled
// auto-close: a status change with no HTTP caller behind it.
const closeIfExpired = async (gig) => {
  const today = new Date().toISOString().slice(0, 10);
  if (gig.status === 'open' && gig.applicationsCloseDate && gig.applicationsCloseDate < today) {
    gig.status = 'closed';
    await gig.save({ validateModifiedOnly: true });
  }
  return gig;
};

// Exported so other components needing the same existence-then-ownership
// check on a gig can reuse it rather than growing a second copy — GL-252's
// applicant list is the first caller outside this file.
export const findOwnedGig = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const gig = await Gig.findById(id);

  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  if (gig.postedBy.toString() !== userId.toString()) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }

  return gig;
};

export const createGig = async (body, postedBy) => {
  const gig = await Gig.create({ ...body, postedBy });
  return gig.toJSON();
};

// GL-333: batched viewerSaved for a whole page, not a lookup per card. One
// query against the page's own ids rather than ten (or PAGE_SIZE) — the
// same shape as the page's `total`, which is computed from the filtered
// query rather than by re-deriving it per row. A guest, a business or an
// admin gets an empty set for free (no query at all) since none of them can
// have saved anything the caller needs to know about. select('_id') keeps
// savedBy itself out of the result even though it's the match condition.
const getSavedGigIdSet = async (gigs, user) => {
  if (!user || user.role !== 'seeker' || gigs.length === 0) {
    return new Set();
  }

  const savedGigs = await Gig.find({
    _id: { $in: gigs.map((gig) => gig._id) },
    savedBy: user.id,
  }).select('_id');

  return new Set(savedGigs.map((gig) => gig.id));
};

export const listOpenGigs = async (query, user) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const filter = await buildOpenGigFilter(query);
  const sort = query.sort ?? 'newest';

  const [gigs, total] = await Promise.all([
    sort === 'starting_soon'
      ? listByStartingSoon(filter, page)
      : Gig.find(filter)
          .sort(SORT_SPECS[sort] ?? SORT_SPECS.newest)
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE),
    Gig.countDocuments(filter),
  ]);

  const savedGigIds = await getSavedGigIdSet(gigs, user);
  // toJSON()'s `id` is still the raw ObjectId at this point (the schema
  // transform runs before JSON.stringify ever stringifies it on the wire),
  // so it must be stringified here to compare against the string ids in
  // savedGigIds — comparing the ObjectId instance directly would silently
  // always miss.
  const gigsJson = gigs.map((gig) => {
    const gigJson = gig.toJSON();
    gigJson.viewerSaved = savedGigIds.has(gigJson.id.toString());
    return gigJson;
  });

  return { gigs: gigsJson, total, page, limit: PAGE_SIZE };
};

export const getGigById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const gig = await Gig.findById(id);

  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  await closeIfExpired(gig);

  const gigJson = gig.toJSON();
  // Name and photo come from the poster's profile, not the User record —
  // User holds credentials and a role, the profile holds what everyone else
  // sees. A business that has not filled in a profile yet reads back as nulls.
  const business = await getPublicIdentity(gigJson.postedBy);

  return { gig: gigJson, business };
};

export const listMyGigs = async (userId) => {
  // Unpaginated and every status, so a single updateMany sweep of this
  // business's own expired-but-still-open gigs before the read is cheaper
  // and simpler than closing each one individually as closeIfExpired does
  // for a single gig - and it keeps every card's badge, deadline and action
  // row reading the same corrected status the list already returns.
  const today = new Date().toISOString().slice(0, 10);
  await Gig.updateMany(
    { postedBy: userId, status: 'open', applicationsCloseDate: { $lt: today } },
    { $set: { status: 'closed' } },
  );

  const gigs = await Gig.find({ postedBy: userId }).sort({ createdAt: -1, _id: -1 });

  return { gigs };
};

// GL-332. Same bulk-correction shape as listMyGigs above, but matched
// against savedBy instead of postedBy — a saved gig whose deadline has
// quietly passed must read back 'closed' here too, not just on the poster's
// own list. Status is otherwise left untouched: a saved gig that closed,
// filled, or whose poster deactivated stays in the list with its real
// status rather than disappearing, so no status filter is applied to the
// find() below.
//
// Sort key is updatedAt, not a dedicated "saved at" timestamp — savedBy is
// a plain id array with select:false and no per-save time, and $addToSet /
// $pull both go through Gig.updateOne, which (schema `timestamps: true`)
// bumps this same gig's updatedAt as a side effect. That makes it the only
// available proxy for "newest-saved first" without a model change, which is
// out of this sub-task's scope.
export const listSavedGigs = async (userId) => {
  const today = new Date().toISOString().slice(0, 10);
  await Gig.updateMany(
    { savedBy: userId, status: 'open', applicationsCloseDate: { $lt: today } },
    { $set: { status: 'closed' } },
  );

  const gigs = await Gig.find({ savedBy: userId }).sort({ updatedAt: -1, _id: -1 });

  return { gigs };
};

// skillTrial is deliberately not in UPDATABLE_FIELDS: that list is a blind
// full-replace, and a client that never renders the trial section (an older
// build, or GL-343's EditGigScreen disabling it once the gig has applicants)
// would omit the key and wipe an existing trial by omission. Presence of the
// key on the body is instead what counts as "the caller wants to change it" -
// checked against Application's existence, not `applicantCount`, since that
// count falls when applicants withdraw or are rejected and a business could
// otherwise wait everyone out and edit a trial whose terms someone already
// applied under. `{ requirement: 'none' }` is how a caller removes a trial;
// storing that literally would leave `gig.skillTrial` truthy, so it is
// normalised to unset instead, matching GL-341's "no trial stores nothing" rule.
export const updateGig = async (id, body, userId) => {
  const gig = await findOwnedGig(id, userId);

  const isChangingSkillTrial = Object.prototype.hasOwnProperty.call(body, 'skillTrial');

  if (isChangingSkillTrial) {
    const hasEverHadApplicant = await Application.exists({ gig: gig._id });
    if (hasEverHadApplicant) {
      throw new ApiError(
        409,
        'GIG_HAS_APPLICANTS',
        'This gig already has applicants, so its skill trial terms cannot change underneath people who already accepted them.',
      );
    }
  }

  UPDATABLE_FIELDS.forEach((field) => {
    gig[field] = body[field];
  });

  if (isChangingSkillTrial) {
    gig.skillTrial = body.skillTrial?.requirement === 'none' ? undefined : body.skillTrial;
  }

  await gig.save();

  return gig.toJSON();
};

export const closeGig = async (id, userId) => {
  const gig = await findOwnedGig(id, userId);

  gig.status = 'closed';
  await gig.save({ validateModifiedOnly: true });

  return gig.toJSON();
};

// filled has been in the status vocabulary since Sprint 1 (docs/feature-inventory.md
// §7.11) with no producer - this is it. E4's positions-filled auto-close is the
// only intended caller, raising this once hires reach the gig's position count;
// there is deliberately no route here, since a business filling their own gig by
// hand isn't a feature in any brief and the only legitimate cause is a hire. Takes
// no HTTP actor, mirroring closeIfExpired's system-actor pattern. Idempotent so a
// duplicate trigger from E4 is harmless. Refuses 'closed' and 'draft': a business
// who closed a gig early made a decision that a later hire must not silently
// overwrite, and this is not GL-283's deadline auto-close, which writes 'closed'
// on an unrelated rule.
export const markGigFilled = async (gigId) => {
  if (!mongoose.isValidObjectId(gigId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const gig = await Gig.findById(gigId);

  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  if (gig.status === 'filled') {
    return gig.toJSON();
  }

  if (gig.status === 'closed' || gig.status === 'draft') {
    throw new ApiError(
      409,
      'GIG_NOT_FILLABLE',
      'This gig is closed or still a draft and cannot be marked filled.',
    );
  }

  gig.status = 'filled';
  await gig.save({ validateModifiedOnly: true });

  return gig.toJSON();
};

export const deleteGig = async (id, userId) => {
  const gig = await findOwnedGig(id, userId);

  await gig.deleteOne();
};

// GL-331. $addToSet rather than read-modify-write: saving an already-saved
// gig is then a no-op at the database level, not just a no-op the client
// happens not to notice, so two quick taps racing each other can't produce
// two entries either. Gated through assertGigIsOpen — the same "not open"
// error apply already surfaces — so a closed, filled or deadline-expired
// gig is refused before savedBy is touched. applicantCount is never part of
// this write: saving is not applying.
export const saveGig = async (id, userId) => {
  await assertGigIsOpen(id);

  await Gig.updateOne({ _id: id }, { $addToSet: { savedBy: userId } });
};

// Deliberately not gated by assertGigIsOpen: a seeker must always be able to
// remove something from their own saved list regardless of what happened to
// the gig afterwards (closed, filled, deleted). $pull is idempotent on its
// own, so unsaving something never saved — or unsaving twice — just matches
// zero array entries and still succeeds. matchedCount distinguishes "gig
// doesn't exist" (404) from "gig exists but wasn't saved" (silent success).
export const unsaveGig = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const result = await Gig.updateOne({ _id: id }, { $pull: { savedBy: userId } });

  if (result.matchedCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }
};

// GL-333: "have I saved this?" mirrors getViewerApplication's shape exactly
// — false for a guest, a business or an admin, computed behind the same
// optionalAuth already mounted on GET /api/gigs/:id. Answered with an
// existence check rather than a read: savedBy is never selected, so there
// is no array to discard here, only a match to test.
export const getViewerSaved = async (gigId, user) => {
  if (!user || user.role !== 'seeker') {
    return false;
  }

  return Boolean(await Gig.exists({ _id: gigId, savedBy: user.id }));
};

// Applying and saving both act on a gig that must still be open. GL-110
// (apply) and Sprint 2's save endpoint call this before writing anything,
// so the "not open" case always surfaces as GIG_CLOSED instead of a generic
// failure the client can't explain to the user.
export const assertGigIsOpen = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const gig = await Gig.findById(id);

  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  await closeIfExpired(gig);

  if (gig.status !== 'open') {
    throw new ApiError(409, 'GIG_CLOSED', 'This gig is no longer open.');
  }

  // GL-316 criterion 7: a deactivated business's gig still resolves by direct
  // link (GET /api/gigs/:id), but applying to it is refused the same way a
  // closed gig is — the existing code, not a new one, so the client's
  // existing message still explains it.
  const poster = await User.findById(gig.postedBy).select('isActive').lean();

  if (poster?.isActive === false) {
    throw new ApiError(409, 'GIG_CLOSED', 'This gig is no longer open.');
  }

  return gig;
};

// GL-371: the trimmed gig context an admin report needs — id, title and the
// posting business's identity — never the full gig. This is "the gig's own
// service" a report reads a gig target through, so report.service.js never
// imports the Gig model directly. Batched for a whole page of reports (one
// query for the gigs, one for their posters' identities) rather than one
// lookup per row. A gig that's since been hard-deleted is simply absent from
// the returned map; the caller reads that as the target having vanished.
export const getGigSummariesByIds = async (gigIds) => {
  const uniqueIds = [...new Set(gigIds.map((id) => id.toString()))];

  if (uniqueIds.length === 0) return new Map();

  const gigs = await Gig.find({ _id: { $in: uniqueIds } }).select('title postedBy').lean();
  const businesses = await getPublicIdentities(gigs.map((gig) => gig.postedBy));

  return new Map(
    gigs.map((gig) => [
      gig._id.toString(),
      {
        id: gig._id.toString(),
        title: gig.title,
        business: businesses.get(gig.postedBy.toString()),
      },
    ]),
  );
};
