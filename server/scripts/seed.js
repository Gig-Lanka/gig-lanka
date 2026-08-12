import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';

const SEED_PASSWORD = 'Password123!';

const seedUsers = [
  { email: 'seeker@giglanka.test', role: 'seeker' },
  { email: 'business@giglanka.test', role: 'business' },
  { email: 'admin@giglanka.test', role: 'admin' },
];

// application.model.js arrives in GL-109. Until then this is a local
// stand-in so the review flow (GL-111, GL-125) has a Hired application to
// test against before hiring exists in the app — see GL-194. It writes to
// the same 'applications' collection and field names the real model will
// use, so nothing here has to be reshaped once GL-109 lands.
const seedApplicationSchema = new mongoose.Schema(
  {
    gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
    seeker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, required: true },
  },
  { timestamps: true, collection: 'applications' },
);
const SeedApplication = mongoose.model('SeedApplication', seedApplicationSchema);

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  const seededUsers = {};
  for (const { email, role } of seedUsers) {
    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, role, passwordHash } },
      { upsert: true, returnDocument: 'after' },
    );
    seededUsers[role] = user;
    console.log(`Seeded ${role}: ${email}`);
  }

  // Status is set directly here — swap this line for the GL-179 transition
  // function once it's merged, the 'status' field it writes doesn't change.
  // 'gig' is a placeholder id: gig.model.js (GL-158) isn't merged here yet,
  // and nothing in this sprint resolves through it.
  await SeedApplication.findOneAndUpdate(
    { seeker: seededUsers.seeker._id, business: seededUsers.business._id, status: 'hired' },
    { $setOnInsert: { gig: new mongoose.Types.ObjectId() } },
    { upsert: true, returnDocument: 'after' },
  );
  console.log('Seeded hired application: seeker <-> business');

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
