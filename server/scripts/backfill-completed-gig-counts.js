import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Profile } from '../src/models/profile.model.js';
import { User } from '../src/models/user.model.js';
import { computeRatingAggregate } from '../src/services/review.service.js';
import { setRatingSummary } from '../src/services/profile.service.js';

// GL-448: one-off. GL-447 added `completedGigCount` to the rating aggregate,
// but a profile only picks it up the next time its aggregate is recomputed —
// a review about the user, or a hire of theirs being marked complete. This
// recomputes every existing profile's aggregate once, through the same
// computeRatingAggregate the app uses and written through setRatingSummary,
// the single writer, so the backfill and the live recompute can never
// disagree. Not a migration: nothing runs this on boot.
//
// Only profiles are touched. Application snapshots (profileSnapshot.rating)
// are frozen at submission by design and are not backfilled.
//
// Safe to run more than once: a profile whose stored aggregate already
// matches the recomputed one is left alone, so a second run reports every
// profile unchanged. Run from server/ with MONGODB_URI pointing at the target
// database:
//
//   node scripts/backfill-completed-gig-counts.js

const STAR_VALUES = [1, 2, 3, 4, 5];

// A stored aggregate and a computed one, reduced to the same plain shape so
// they compare field by field. A profile written before GL-447 has no
// `completedGigCount` in the database at all, which reads as a difference —
// exactly the profiles this script exists to update.
const normalize = (aggregate) => ({
  averageRating: aggregate?.averageRating,
  reviewCount: aggregate?.reviewCount,
  topCategories: aggregate?.topCategories ?? [],
  distribution: STAR_VALUES.map((star) => aggregate?.distribution?.[star]),
  completedGigCount: aggregate?.completedGigCount,
});

const isSameAggregate = (stored, computed) =>
  JSON.stringify(normalize(stored)) === JSON.stringify(normalize(computed));

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const profiles = await Profile.find().select('user ratingSummary').lean();
  const users = await User.find({ _id: { $in: profiles.map((profile) => profile.user) } })
    .select('role')
    .lean();
  const roleByUserId = new Map(users.map((user) => [user._id.toString(), user.role]));

  let updated = 0;
  let unchanged = 0;
  const failed = [];

  for (const profile of profiles) {
    const userId = profile.user.toString();

    try {
      const role = roleByUserId.get(userId);
      if (!role) {
        throw new Error('no user record for this profile');
      }

      const ratingSummary = await computeRatingAggregate(userId, role);

      if (isSameAggregate(profile.ratingSummary, ratingSummary)) {
        unchanged += 1;
        continue;
      }

      await setRatingSummary(userId, ratingSummary);
      updated += 1;
      console.log(
        `  updated ${userId} (${role}): completedGigCount ${ratingSummary.completedGigCount}`,
      );
    } catch (err) {
      failed.push({ userId, message: err.message });
    }
  }

  console.log(`Profiles scanned:   ${profiles.length}`);
  console.log(`Profiles updated:   ${updated}`);
  console.log(`Profiles unchanged: ${unchanged}`);
  console.log(`Profiles failed:    ${failed.length}`);
  for (const { userId, message } of failed) {
    console.log(`  failed ${userId}: ${message}`);
  }

  await mongoose.connection.close();

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
