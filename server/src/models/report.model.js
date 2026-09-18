import mongoose from 'mongoose';

// A report targets a user or a gig — nothing else. Reviews, applications and
// messages are deliberately out and none is added here: reviews in particular
// are permanent, with no edit, delete or respond path anywhere by design, and
// correcting one is a Sprint 4 dispute rather than a report.
export const REPORT_TARGET_TYPES = ['user', 'gig'];

// The closed reason list, agreed at Sprint 3 planning with the product owner
// (no business-rules brief covers reporting). Mirrored as a frozen labelled
// list in app/src/constants/enums.js, the deliberate duplication every other
// vocabulary in this project uses. NOT shared with REJECTION_REASON_CODES —
// the shape is similar but the vocabulary is unrelated, and coupling two
// closed lists would make each one harder to change on its own.
export const REPORT_REASON_CODES = [
  'spam_or_scam',
  'misleading_gig_details',
  'inappropriate_content',
  'harassment_or_abuse',
  'unsafe_working_conditions',
  'other',
];

// The wider status vocabulary is declared now so Sprint 4 (resolve, dismiss)
// has it, but this sprint ships no code path that writes anything other than
// `open` — the same discipline `savedBy` was declared under.
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

const reportSchema = new mongoose.Schema(
  {
    // Always taken from the token, never accepted from the request body —
    // the way `postedBy` on a gig and `author` on a review already are.
    // Visible only to an admin; the reported party is never told who filed.
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
    },
    // A raw id, not a ref: the collection it points at depends on targetType.
    // Existence is checked in the service before anything else, so a bad id
    // is a 404 and refusal codes cannot be used to probe which ids exist.
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    reasonCode: {
      type: String,
      enum: REPORT_REASON_CODES,
      required: true,
    },
    // Optional free text up to 300 characters, matching the rejection-note
    // limit. Deliberately not trimmed so it is stored exactly as written and
    // later shown to an admin verbatim.
    note: {
      type: String,
      maxlength: 300,
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open',
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

// One open report per reporter per target. This index is unique outright —
// NOT partial on status. Sprint 4 adds resolve and dismiss; a partial index
// (unique only while status is `open`) would then quietly allow a second
// report once the first was resolved. That may turn out to be the right
// rule, but it is a Sprint 4 decision and this sprint must not pre-empt it.
// A duplicate is translated by the service into 409 REPORT_ALREADY_EXISTS
// rather than surfacing as a Mongo duplicate-key 500.
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

// Reports are permanent records of what someone said. Like reviews, there is
// no edit and no delete path — not this sprint and not planned.
export const Report = mongoose.model('Report', reportSchema);
