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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const Report = mongoose.model('Report', reportSchema);
