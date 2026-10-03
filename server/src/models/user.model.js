import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['seeker', 'business', 'admin'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.passwordHash;
        delete ret.isActive;
        delete ret.suspendedAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const User = mongoose.model('User', userSchema);

// The one blocked-account rule: true when the owner deactivated themself or
// Gig Lanka suspended them. Every access exclusion goes through this instead
// of testing isActive on its own, so a third reason can't be missed in one
// place.
export const isBlocked = (user) => user.isActive === false || Boolean(user.suspendedAt);
