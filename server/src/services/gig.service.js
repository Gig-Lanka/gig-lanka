import mongoose from 'mongoose';
import { Gig } from '../models/gig.model.js';
import { ApiError } from '../utils/ApiError.js';
import { getPublicIdentity } from './profile.service.js';

const PAGE_SIZE = 10;

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

const findOwnedGig = async (id, userId) => {
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
  const filter = { status: 'open' };

  const [gigs, total] = await Promise.all([
    Gig.find(filter)
      .sort({ createdAt: -1, _id: -1 })
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

  const gigJson = gig.toJSON();
  // Name and photo come from the poster's profile, not the User record —
  // User holds credentials and a role, the profile holds what everyone else
  // sees. A business that has not filled in a profile yet reads back as nulls.
  const business = await getPublicIdentity(gigJson.postedBy);

  return { gig: gigJson, business };
};

export const listMyGigs = async (userId) => {
  const gigs = await Gig.find({ postedBy: userId }).sort({ createdAt: -1, _id: -1 });

  return { gigs };
};

export const updateGig = async (id, body, userId) => {
  const gig = await findOwnedGig(id, userId);

  UPDATABLE_FIELDS.forEach((field) => {
    gig[field] = body[field];
  });

  await gig.save();

  return gig.toJSON();
};

export const closeGig = async (id, userId) => {
  const gig = await findOwnedGig(id, userId);

  gig.status = 'closed';
  await gig.save({ validateModifiedOnly: true });

  return gig.toJSON();
};

export const deleteGig = async (id, userId) => {
  const gig = await findOwnedGig(id, userId);

  await gig.deleteOne();
};
