import mongoose from 'mongoose';
import { RATING_AGGREGATE_SHAPE } from './review.model.js';

export const APPLICATION_STATUSES = [
  'applied',
  'viewed',
  'shortlisted',
  'hired',
  'completed',
  'rejected',
  'withdrawn',
  'closed_filled',
];

// The seven business-selectable codes plus `positions_filled`, which is
// system-only — see GL-180 for who may set which.
export const REJECTION_REASON_CODES = [
  'schedule_mismatch',
  'location_too_far',
  'skill_trial_not_passed',
  'skill_trial_not_attempted',
  'looking_for_more_experience',
  'another_applicant_closer_fit',
  'role_no_longer_needed',
  'positions_filled',
];

// The brief's closed five-value trial-result vocabulary (GL-297 §4/§8),
// mirrored in app/src/constants/enums.js as a frozen labelled list.
// `submitted` and `skipped` are set by the applicant's own action at apply
// time; `passed`/`not_passed` are set only by the business, once, through
// the trial review endpoint. The review is a result, not a status — these
// values never join APPLICATION_STATUSES or TRANSITION_RULES.
export const SKILL_TRIAL_RESULTS = [
  'not_submitted',
  'submitted',
  'passed',
  'not_passed',
  'skipped',
];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const snapshotWorkExperienceSchema = new mongoose.Schema(
  {
    roleTitle: { type: String, trim: true, required: true },
    employer: { type: String, trim: true, required: true },
    startDate: { type: String, match: DATE_ONLY_PATTERN },
    endDate: { type: String, match: DATE_ONLY_PATTERN },
    ongoing: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const snapshotEducationSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true, required: true },
    qualification: { type: String, trim: true, required: true },
    startDate: { type: String, match: DATE_ONLY_PATTERN },
    endDate: { type: String, match: DATE_ONLY_PATTERN },
  },
  { _id: false },
);

// name/headline/experience/education/rating, embedded copies taken at
// submission — never a reference, so a later profile edit can't reach back
// and change what a business already judged.
const profileSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    headline: { type: String, trim: true },
    experience: { type: [snapshotWorkExperienceSchema], default: [] },
    education: { type: [snapshotEducationSchema], default: [] },
    rating: RATING_AGGREGATE_SHAPE,
  },
  { _id: false },
);

// Belongs to the application, not the gig — editing a gig's trial after
// applications exist does not change what anyone already submitted
// (GL-297 §4). Content validation against the gig's submissionType and the
// apply-time / review-time writers are other sub-tasks; this only shapes
// the field.
const skillTrialSubmissionSchema = new mongoose.Schema(
  {
    textResponse: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    submittedAt: { type: Date },
    result: { type: String, enum: SKILL_TRIAL_RESULTS },
    // Free text up to 300 characters, shown to the seeker verbatim —
    // deliberately not trimmed so it is stored exactly as written, the same
    // rule as rejectionNote below.
    resultNote: { type: String, maxlength: 300 },
    reviewedAt: { type: Date },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    gig: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gig',
      required: true,
      index: true,
    },
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    profileSnapshot: {
      type: profileSnapshotSchema,
      required: true,
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'applied',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
    viewedAt: {
      type: Date,
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    // The moment the business marked the work finished. `decidedAt` cannot
    // carry it — that one is already occupied by the hire and guarded against
    // being overwritten — so completion needs a stamp of its own. Set once,
    // the first time `completed` is reached, and never cleared afterwards.
    completedAt: {
      type: Date,
      default: null,
    },
    rejectionReasonCode: {
      type: String,
      enum: REJECTION_REASON_CODES,
    },
    // Free text up to 300 characters, shown to the applicant verbatim —
    // deliberately not trimmed so it is stored exactly as written.
    rejectionNote: {
      type: String,
      maxlength: 300,
    },
    // Optional: an application to a gig with no trial stores nothing (stays
    // undefined) rather than an empty object.
    skillTrialSubmission: {
      type: skillTrialSubmissionSchema,
      required: false,
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

// One application per seeker per gig, permanently — withdrawing does not
// free the slot. Gig and applicant are also indexed separately: the
// applicant list queries by gig, My Applications queries by applicant.
applicationSchema.index({ gig: 1, applicant: 1 }, { unique: true });

export const Application = mongoose.model('Application', applicationSchema);
