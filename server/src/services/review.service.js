import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { Review } from '../models/review.model.js';
import { getApplicationWithParties } from './application.service.js';
import { getPublicIdentity, setRatingSummary } from './profile.service.js';
import {
  SEEKER_TO_BUSINESS_CATEGORIES,
  BUSINESS_TO_SEEKER_CATEGORIES,
} from '../validators/review.validator.js';

const CATEGORIES_BY_DIRECTION = {
  seeker_to_business: SEEKER_TO_BUSINESS_CATEGORIES,
  business_to_seeker: BUSINESS_TO_SEEKER_CATEGORIES,
};

const PAGE_SIZE = 10;
const STAR_VALUES = [1, 2, 3, 4, 5];
const TOP_CATEGORIES_LIMIT = 3;
const zeroedDistribution = () =>
  STAR_VALUES.reduce((distribution, star) => ({ ...distribution, [star]: 0 }), {});
const ZEROED_RATING_AGGREGATE = {
  averageRating: 0,
  reviewCount: 0,
  topCategories: [],
  distribution: zeroedDistribution(),
};

// One decimal place, rounded half up: 4.25 becomes 4.3, never 4.2. Every
// rating is a whole number, so the only place a fraction appears at all is
// this division — stating the rule here is what keeps it a decision instead
// of whatever the float happens to land on.
const roundToOneDecimal = (value) => Math.round(value * 10) / 10;

// Count of reviews at each star value, 1 to 5. Always all five keys, so the
// five counts sum to reviewCount even when a star value was never selected.
const computeDistribution = (reviews) => {
  const distribution = zeroedDistribution();

  reviews.forEach((review) => {
    distribution[review.rating] += 1;
  });

  return distribution;
};

// The most frequently selected categories, capped at TOP_CATEGORIES_LIMIT.
// Ties are broken alphabetically by category value, never by insertion order
// or Mongo's return order — either would make the same profile render a
// different order on two consecutive loads.
const computeTopCategories = (reviews) => {
  const counts = new Map();

  reviews.forEach((review) => {
    review.categories.forEach((category) => {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort(([categoryA, countA], [categoryB, countB]) => {
      return countB - countA || categoryA.localeCompare(categoryB);
    })
    .slice(0, TOP_CATEGORIES_LIMIT)
    .map(([category]) => category);
};

// The full aggregate for one user, recomputed from every review about them —
// never adjusted incrementally, since a running counter drifts silently and
// can't be repaired without a migration, while a recomputation is correct
// every time and this collection is small. Filtered on `subject`, never
// `author`: a user's aggregate counts reviews about them, not reviews they
// wrote, and the two never mix.
export const computeRatingAggregate = async (subjectId) => {
  const reviews = await Review.find({ subject: subjectId }).select('rating categories').lean();

  if (reviews.length === 0) {
    return ZEROED_RATING_AGGREGATE;
  }

  const sum = reviews.reduce((total, review) => total + review.rating, 0);

  return {
    averageRating: roundToOneDecimal(sum / reviews.length),
    reviewCount: reviews.length,
    topCategories: computeTopCategories(reviews),
    distribution: computeDistribution(reviews),
  };
};

// Criterion 11: the review is the fact, the aggregate is derived from it, so
// a failure here must never fail the review creation that already succeeded
// and was reported to the user — the same best-effort, log-and-continue
// pattern GL-114 used for deleting a replaced profile photo.
const recomputeRatingSummary = async (subjectId) => {
  try {
    const ratingSummary = await computeRatingAggregate(subjectId);
    await setRatingSummary(subjectId, ratingSummary);
  } catch (err) {
    console.error(`Failed to recompute rating summary for user ${subjectId}:`, err);
  }
};

const assertCategoriesMatchDirection = (categories, direction) => {
  const allowed = CATEGORIES_BY_DIRECTION[direction];
  const mismatched = categories.find((category) => !allowed.includes(category));

  if (mismatched) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [
      { field: 'categories', message: `"${mismatched}" is not a valid category for this review` },
    ]);
  }
};

// The single gate that makes a rating worth reading: a review can only be
// created against an application that reached Completed, by one of the two
// people who were actually party to it. Direction, author and subject are
// all derived here from the application and the caller — never accepted
// from the request body — so nobody can attach a review to a gig they
// didn't work, or a person they didn't work with.
export const createReview = async (applicationId, actor, body) => {
  const { application, applicantId, businessId } = await getApplicationWithParties(applicationId);

  const isApplicant = actor.role === 'seeker' && applicantId === actor.id.toString();
  const isBusiness = actor.role === 'business' && businessId === actor.id.toString();

  if (!isApplicant && !isBusiness) {
    throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }

  const reviewableStatuses = new Set(['completed', 'hired']);

  if (!reviewableStatuses.has(application.status)) {
    throw new ApiError(
      409,
      'APPLICATION_NOT_COMPLETED',
      'A review requires a completed gig — this application has not reached Completed.',
    );
  }

  const direction = isApplicant ? 'seeker_to_business' : 'business_to_seeker';
  const author = isApplicant ? applicantId : businessId;
  const subject = isApplicant ? businessId : applicantId;
  const categories = body.categories || [];

  assertCategoriesMatchDirection(categories, direction);

  try {
    const review = await Review.create({
      application: application._id,
      author,
      subject,
      direction,
      rating: body.rating,
      categories,
      text: body.text,
    });

    await recomputeRatingSummary(subject);

    return review.toJSON();
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(
        409,
        'REVIEW_ALREADY_EXISTS',
        'You have already reviewed this application.',
      );
    }
    throw err;
  }
};

// The reviews written about a user, newest first. Deliberately doesn't check
// that the user still exists or is active — a deactivated user's reviews are
// unaffected by deactivation (they're read through the subject id on the
// review, not through the user record), so there's nothing to gate on here.
export const listUserReviews = async (userId, query) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(404, 'NOT_FOUND', 'User not found.');
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const filter = { subject: userId };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE),
    Review.countDocuments(filter),
  ]);

  // Author name and photo come from the profile at read time, not a frozen
  // copy on the review — the opposite of an application's snapshot, and for
  // the opposite reason: this shows who someone is now, not who they were
  // when the review was written.
  const reviewsWithAuthor = await Promise.all(
    reviews.map(async (review) => {
      const { author, ...reviewJson } = review.toJSON();
      return { ...reviewJson, author: await getPublicIdentity(author) };
    }),
  );

  return { reviews: reviewsWithAuthor, total, page, limit: PAGE_SIZE };
};
