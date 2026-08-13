import mongoose from 'mongoose';
import { RATING_AGGREGATE_SHAPE } from './review.model.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const workExperienceSchema = new mongoose.Schema({
  roleTitle: { type: String, trim: true, required: true },
  employer: { type: String, trim: true, required: true },
  startDate: { type: String, match: DATE_ONLY_PATTERN },
  endDate: { type: String, match: DATE_ONLY_PATTERN },
  ongoing: { type: Boolean, default: false },
  description: { type: String, trim: true, maxlength: 1000 },
});

const educationSchema = new mongoose.Schema({
  institution: { type: String, trim: true, required: true },
  qualification: { type: String, trim: true, required: true },
  startDate: { type: String, match: DATE_ONLY_PATTERN },
  endDate: { type: String, match: DATE_ONLY_PATTERN },
});

// Skill Trial badges shown on a profile. Application & Hiring owns computing
// and writing these results (Sprint 3) — this component only displays them.
const skillTrialResultSchema = new mongoose.Schema({
  skill: { type: String, trim: true },
  passed: { type: Boolean },
  completedAt: { type: Date },
});

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    // Shared
    photo: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    city: {
      type: String,
      trim: true,
    },

    // Seeker-specific
    skills: {
      type: [String],
      default: [],
    },
    workExperience: {
      type: [workExperienceSchema],
      default: [],
    },
    education: {
      type: [educationSchema],
      default: [],
    },

    // Business-specific
    category: {
      type: String,
      trim: true,
    },

    // System-set, read-only. Owned and written by other components — never
    // set by anything in User & Profile. See RATING_AGGREGATE_SHAPE for the
    // ownership boundary with Community & Rating; skillTrialResultSchema
    // above for the one with Application & Hiring.
    ratingSummary: RATING_AGGREGATE_SHAPE,
    skillTrialResults: {
      type: [skillTrialResultSchema],
      default: [],
    },
  },
  {
    timestamps: true,
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

export const Profile = mongoose.model('Profile', profileSchema);
