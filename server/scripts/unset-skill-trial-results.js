import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { Profile } from '../src/models/profile.model.js';

// GL-431: one-off. GL-430 removed `skillTrialResults` from the Profile
// schema, but a trial passed before that removal was deployed already wrote
// the field onto a document, and Mongoose leaves fields it no longer
// declares untouched on existing documents. This $unsets it from every
// profile that still carries it. Not a migration: nothing runs this on
// boot.
//
// Runs through Profile.collection (the native driver), not the Profile
// model — the field no longer exists on the schema, so a Mongoose write
// would never see it to unset.
//
// Safe to run more than once: the filter only matches documents that still
// have the key, so a second run matches and changes nothing. Run from
// server/ with MONGODB_URI pointing at the target database:
//
//   node scripts/unset-skill-trial-results.js

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log(`Connected to database: ${mongoose.connection.name}`);

  const result = await Profile.collection.updateMany(
    { skillTrialResults: { $exists: true } },
    { $unset: { skillTrialResults: '' } },
  );

  console.log(`Profiles matched:  ${result.matchedCount}`);
  console.log(`Profiles updated:  ${result.modifiedCount}`);

  await mongoose.connection.close();
};

run().catch(async (err) => {
  console.error('Unset failed:', err.message);
  await mongoose.connection.close();
  process.exit(1);
});
