import mongoose from 'mongoose';

const GIG_CATEGORIES = [
  'tutoring',
  'delivery',
  'event_help',
  'retail',
  'hospitality',
  'admin_data_entry',
  'creative',
  'tech',
  'other',
];

const PAY_TYPES = ['per_hour', 'per_day', 'fixed_price'];

const SCHEDULE_TAGS = ['weekday_mornings', 'weekday_evenings', 'weekends', 'flexible_hours'];

const COMMITMENT_LENGTHS = ['one_off', 'under_a_week', 'one_to_four_weeks', 'ongoing'];

const GIG_STATUSES = ['draft', 'open', 'closed', 'filled'];

// No 'required' value: product decided a skill trial is never mandatory to
// apply, only ever absent or optional. See GL-341's PR / Jira note.
const SKILL_TRIAL_REQUIREMENTS = ['none', 'optional'];

const SKILL_TRIAL_SUBMISSION_TYPES = ['text', 'file', 'text_and_file'];

const SKILL_TRIAL_EFFORT_ESTIMATES = ['under_30_minutes', '30_to_60_minutes', '1_to_2_hours'];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isNotPastDate = (value) => {
  if (!value) return true;
  const today = new Date().toISOString().slice(0, 10);
  return value >= today;
};

const skillTrialSchema = new mongoose.Schema(
  {
    requirement: {
      type: String,
      enum: SKILL_TRIAL_REQUIREMENTS,
      default: 'none',
    },
    taskTitle: {
      type: String,
      trim: true,
      maxlength: 80,
      required: function () {
        return this.requirement !== 'none';
      },
    },
    taskBrief: {
      type: String,
      trim: true,
      minlength: 20,
      maxlength: 1000,
      required: function () {
        return this.requirement !== 'none';
      },
    },
    submissionType: {
      type: String,
      enum: SKILL_TRIAL_SUBMISSION_TYPES,
      required: function () {
        return this.requirement !== 'none';
      },
    },
    effortEstimate: {
      type: String,
      enum: SKILL_TRIAL_EFFORT_ESTIMATES,
      required: function () {
        return this.requirement !== 'none';
      },
    },
  },
  { _id: false },
);

// When requirement is 'none' the other four fields are not just optional but
// forbidden, per Application & Hiring brief §4 - a trial that isn't required
// shouldn't silently carry leftover task details.
// Mongoose 9 dropped callback-style ("next") pre hooks - middleware must be
// synchronous or return a promise, so this takes no `next` argument.
skillTrialSchema.pre('validate', function () {
  if (this.requirement === 'none') {
    const disallowedField = ['taskTitle', 'taskBrief', 'submissionType', 'effortEstimate'].find(
      (field) => this[field] !== undefined,
    );
    if (disallowedField) {
      this.invalidate(
        disallowedField,
        `${disallowedField} must not be set when requirement is "none"`,
      );
    }
  }
});

const gigSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: GIG_CATEGORIES,
      required: true,
    },
    payAmount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => typeof value === 'number' && value > 0,
        message: 'Pay amount must be a number greater than zero',
      },
    },
    payType: {
      type: String,
      enum: PAY_TYPES,
      required: true,
    },
    city: {
      type: String,
      trim: true,
      required: function () {
        return !this.remote;
      },
    },
    area: {
      type: String,
      trim: true,
    },
    remote: {
      type: Boolean,
      default: false,
    },
    schedule: {
      type: [String],
      enum: SCHEDULE_TAGS,
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'Schedule must include at least one value',
      },
    },
    commitment: {
      type: String,
      enum: COMMITMENT_LENGTHS,
      required: true,
    },
    positions: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Positions must be a whole number',
      },
    },
    startDate: {
      type: String,
      match: DATE_ONLY_PATTERN,
    },
    applicationsCloseDate: {
      type: String,
      match: DATE_ONLY_PATTERN,
      validate: {
        validator: isNotPastDate,
        message: 'Applications close date cannot be in the past',
      },
    },
    status: {
      type: String,
      enum: GIG_STATUSES,
      default: 'open',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    applicantCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Optional: a gig with no trial stores nothing (stays undefined) rather
    // than an empty object, so `gig.skillTrial` reads falsy - see the guard
    // in application.service.js's assertValidRejection.
    skillTrial: {
      type: skillTrialSchema,
      required: false,
    },
    // Sprint 2 (saving a gig) writes user ids here. Declared now, guarded now:
    // `select: false` keeps it out of every default query, and the toJSON
    // transform deletes it as a second line of defense, so it structurally
    // cannot leak into a response — not even to the gig's owner — once
    // saving actually starts writing to it.
    savedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.savedBy;
        return ret;
      },
    },
  },
);

gigSchema.index({ status: 1, createdAt: -1 });

export const Gig = mongoose.model('Gig', gigSchema);
