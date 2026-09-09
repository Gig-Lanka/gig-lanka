import mongoose from 'mongoose';

// GL-301 reporting vocabulary. Mirrored — deliberately, not shared — in
// app/src/constants/enums.js as REPORT_REASONS. Do NOT reuse
// REJECTION_REASON_CODES: the shape is similar on purpose but the two closed
// lists are unrelated, and coupling a moderation vocabulary to a hiring one
// would make every future change to either one a change to both.
export const REPORT_REASON_CODES = [
  'spam_or_scam',
  'misleading_gig_details',
  'inappropriate_content',
  'harassment_or_abuse',
  'unsafe_working_conditions',
  'other',
];

// A report targets a user or a gig. Reviews, applications and messages are
// deliberately not reportable and no fourth value is ever added here.
export const REPORT_TARGET_TYPES = ['user', 'gig'];

// The full status vocabulary. `open` is the only value any code path writes
// this sprint — creation sets it and nothing else touches it. `resolved` and
// `dismissed` are declared now purely so Sprint 4's resolve/dismiss actions
// have somewhere to land; shipping the enum without a writer is the same
// discipline gig.savedBy was declared under.
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

const reportSchema = new mongoose.Schema(
  {
    // Always taken from the authenticated token, never from the request body —
    // the same rule gig.postedBy and review.author already follow. Visible only
    // to an admin; the reported party is never told who filed.
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
    },
    // A User id when targetType is `user`, a Gig id when `gig`. Left as a bare
    // ObjectId with no ref: existence is checked in the service before the
    // report is written, and there is no populate path on this model.
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
    // limit. Stored exactly as written and shown verbatim later — not trimmed.
    note: {
      type: String,
      maxlength: 300,
    },
    // Always `open` on creation. Sprint 3 ships no path that writes any other
    // value — see REPORT_STATUSES above for why the wider enum exists anyway.
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'open',
    },
  },
  {
    // Reports are permanent records of what someone said. Like reviews, there
    // is no edit and no delete path — not this sprint and not planned — so the
    // document only ever carries a createdAt.
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

// One open report per reporter per target. This index is unique OUTRIGHT — not
// a partial index filtered on `status: 'open'`. Sprint 4 adds resolve and
// dismiss; a partial index would then silently let the same reporter file a
// second report against the same target once the first was resolved. That may
// turn out to be the desired rule, but it is a Sprint 4 decision and this
// sprint must not pre-empt it. If Sprint 4 wants repeat reports after
// resolution, this is the line that has to change.
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });

export const Report = mongoose.model('Report', reportSchema);
