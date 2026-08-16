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

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isNotPastDate = (value) => {
  if (!value) return true;
  const today = new Date().toISOString().slice(0, 10);
  return value >= today;
};

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
