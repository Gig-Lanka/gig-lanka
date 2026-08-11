import mongoose from 'mongoose';

const DIRECTIONS = ['seeker_to_business', 'business_to_seeker'];

const reviewSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
    },
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
