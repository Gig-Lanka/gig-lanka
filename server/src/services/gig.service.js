import mongoose from 'mongoose';
import { Gig } from '../models/gig.model.js';
import { Application } from '../models/application.model.js';
import { ApiError } from '../utils/ApiError.js';
import { getPublicIdentity, getPublicIdentities } from './profile.service.js';

const PAGE_SIZE = 10;

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;
const escapeRegExp = (value) => value.replace(REGEX_METACHARACTERS, '\\$&');

const SORT_SPECS = {
  newest: { createdAt: -1, _id: -1 },
  highest_pay: { payAmount: -1, _id: -1 },
};

// Builds the filter for the public listing only — status: 'open' is fixed
// here and never derived from `query`, so no combination of parameters can
// widen the result past open gigs. applicationsCloseDate is excluded here
// too: a gig whose deadline has passed but hasn't been read (and lazily
// closed, see closeIfExpired) since must still not appear as browsable.
// $not/$lt also matches a missing field, so gigs with no deadline pass through.
const buildOpenGigFilter = (query) => {
  const today = new Date().toISOString().slice(0, 10);
  const filter = { status: 'open', applicationsCloseDate: { $not: { $lt: today } } };

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

export const listOpenGigs = async (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const filter = buildOpenGigFilter(query);
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

  return { gigs, total, page, limit: PAGE_SIZE };
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
