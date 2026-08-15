import { ApiError } from '../utils/ApiError.js';
import { Review } from '../models/review.model.js';
import { getApplicationWithParties } from './application.service.js';
import {
  SEEKER_TO_BUSINESS_CATEGORIES,
  BUSINESS_TO_SEEKER_CATEGORIES,
} from '../validators/review.validator.js';

const CATEGORIES_BY_DIRECTION = {
  seeker_to_business: SEEKER_TO_BUSINESS_CATEGORIES,
  business_to_seeker: BUSINESS_TO_SEEKER_CATEGORIES,
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
// created against an application that reached Hired, by one of the two
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

  if (application.status !== 'hired') {
    throw new ApiError(
      409,
      'APPLICATION_NOT_HIRED',
      'A review requires a completed hire — this application has not reached Hired.',
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
