import mongoose from 'mongoose';
import { Gig } from '../models/gig.model.js';
import { ApiError } from '../utils/ApiError.js';

const PAGE_SIZE = 10;

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

  const gig = await Gig.findById(id).populate('postedBy', 'name photo');

  if (!gig) {
    throw new ApiError(404, 'NOT_FOUND', 'Gig not found.');
  }

  const gigJson = gig.toJSON();
  const business = {
    id: gigJson.postedBy.id,
    name: gigJson.postedBy.name ?? null,
    photo: gigJson.postedBy.photo ?? null,
  };
  gigJson.postedBy = business.id;

  return { gig: gigJson, business };
};
