import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';
import { Gig } from '../src/models/gig.model.js';

const SEED_PASSWORD = 'Password123!';

const seedUsers = [
  { email: 'seeker@giglanka.test', role: 'seeker' },
  { email: 'business@giglanka.test', role: 'business' },
  { email: 'admin@giglanka.test', role: 'admin' },
];

const daysFromNow = (days) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// Spans every category/pay type/schedule/commitment combo isn't the goal —
// the deadline spread is. GL-121's urgency states key off days-to-close
// (today, tomorrow, <=3 days = urgent; otherwise not; no date = no badge),
// so each bucket needs at least one gig or that screen has nothing to show.
const seedGigs = (businessId) => [
  {
    title: 'Math & Science Tutoring for O/Levels',
    description: 'Tutor two O/Level students in maths and science twice a week after school.',
    category: 'tutoring',
    payAmount: 1500,
    payType: 'per_hour',
    city: 'Colombo',
    area: 'Nugegoda',
    schedule: ['weekday_evenings'],
    commitment: 'ongoing',
    positions: 1,
    applicationsCloseDate: daysFromNow(0),
  },
  {
    title: 'Weekend Food Delivery Rider',
    description: 'Deliver food orders by bike across the city on Saturday and Sunday shifts.',
    category: 'delivery',
    payAmount: 3000,
    payType: 'per_day',
    city: 'Kandy',
    schedule: ['weekends'],
    commitment: 'under_a_week',
    positions: 3,
    applicationsCloseDate: daysFromNow(1),
  },
  {
    title: 'Wedding Event Setup Crew',
    description: 'Help set up decorations and seating the morning of a weekend wedding.',
    category: 'event_help',
    payAmount: 5000,
    payType: 'fixed_price',
    city: 'Galle',
    schedule: ['weekends', 'flexible_hours'],
    commitment: 'one_off',
    positions: 4,
    applicationsCloseDate: daysFromNow(3),
  },
  {
    title: 'Retail Store Assistant',
    description: 'Stock shelves and assist customers on weekday mornings at a clothing store.',
    category: 'retail',
    payAmount: 800,
    payType: 'per_hour',
    city: 'Colombo',
    area: 'Wellawatte',
    schedule: ['weekday_mornings'],
    commitment: 'one_to_four_weeks',
    positions: 2,
    applicationsCloseDate: daysFromNow(14),
  },
  {
    title: 'Hotel Front Desk Helper',
    description: 'Greet guests and assist the front desk team during evening and weekend shifts.',
    category: 'hospitality',
    payAmount: 2800,
    payType: 'per_day',
    city: 'Negombo',
    schedule: ['weekday_evenings', 'weekends'],
    commitment: 'ongoing',
    positions: 1,
  },
  {
    title: 'Remote Data Entry Clerk',
    description: 'Enter survey responses into a spreadsheet on your own schedule, fully remote.',
    category: 'admin_data_entry',
    payAmount: 600,
    payType: 'per_hour',
    remote: true,
    schedule: ['flexible_hours'],
    commitment: 'under_a_week',
    positions: 5,
    applicationsCloseDate: daysFromNow(2),
  },
  {
    title: 'Social Media Content Creator',
    description: 'Plan and shoot short-form video content for a small business over a month.',
    category: 'creative',
    payAmount: 12000,
    payType: 'fixed_price',
    city: 'Colombo',
    schedule: ['flexible_hours'],
    commitment: 'one_to_four_weeks',
    positions: 1,
    applicationsCloseDate: daysFromNow(30),
  },
  {
    title: 'Junior Web Dev Support (Remote)',
    description: 'Fix small bugs and build minor features for a web app, part time, fully remote.',
    category: 'tech',
    payAmount: 2000,
    payType: 'per_hour',
    remote: true,
    schedule: ['weekday_mornings', 'weekday_evenings'],
    commitment: 'ongoing',
    positions: 2,
    applicationsCloseDate: daysFromNow(7),
  },
].map((gig) => ({ ...gig, postedBy: businessId }));

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

  for (const gig of seedGigs(seededUsers.business._id)) {
    await Gig.findOneAndUpdate(
      { title: gig.title, postedBy: gig.postedBy },
      { $setOnInsert: gig },
      { upsert: true, returnDocument: 'after' },
    );
    console.log(`Seeded gig: ${gig.title}`);
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
