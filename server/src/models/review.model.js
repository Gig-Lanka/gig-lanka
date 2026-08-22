import mongoose from 'mongoose';

const DIRECTIONS = ['seeker_to_business', 'business_to_seeker'];

// Rating aggregate shape that lands on a profile (GL-141 declares the field;
// GL-222 fixes its shape). An average, a count, a short list of common
// categories, and a star-by-star histogram (GL-264) — keyed 1 to 5, each
// count defaulting to zero so RatingBars never renders against a missing key.
//
// Ownership boundary, stated in both directions so neither epic computes the
// other's number: this component owns the aggregate and is the only writer
// (computed in Sprint 2, from this collection). User & Profile stores it on
// the profile document and displays it, but never writes it.
export const RATING_AGGREGATE_SHAPE = {
  averageRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  topCategories: { type: [String], default: [] },
  distribution: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 },
  },
};

const reviewSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
    // Reference only — no author name or photo is copied onto the review.
    // The reviews list populates from the profile at read time, so a name
    // change is reflected everywhere instead of frozen into old reviews.
    // (The opposite of the application's frozen snapshot, and for the
    // opposite reason: an application records what was true then, a review
    // shows who someone is now.)
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator: function (value) {
          return !this.author || !value.equals(this.author);
        },
        message: 'Author and subject cannot be the same user',
      },
    },
    direction: {
      type: String,
      enum: DIRECTIONS,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number between 1 and 5',
      },
    },
    categories: {
      type: [String],
      default: [],
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 1000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

reviewSchema.index({ application: 1, direction: 1 }, { unique: true });

export const Review = mongoose.model('Review', reviewSchema);
