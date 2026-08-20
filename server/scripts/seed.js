import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';
import { Gig } from '../src/models/gig.model.js';
import { Application } from '../src/models/application.model.js';
import {
  transitionApplicationStatus,
  adjustGigApplicantCount,
} from '../src/services/application.service.js';

const SEED_PASSWORD = 'Password123!';

const seedUsers = [
  { email: 'seeker@giglanka.test', role: 'seeker' },
  { email: 'business@giglanka.test', role: 'business' },
  { email: 'admin@giglanka.test', role: 'admin' },
];

// The two supporting applicants for the three-applicant demo scenario
// (GL-218/GL-251) - seeker@giglanka.test plays the first one itself, so the
// documented demo login is the "shortlisted, but someone else got it" case:
// the state the transparency tracker exists to show, and the one a viva
// audience should see.
const seedExtraApplicants = [
  { email: 'seeker2@giglanka.test', role: 'seeker' },
  { email: 'seeker3@giglanka.test', role: 'seeker' },
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
const seedGigs = (businessId) =>
  [
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
      description:
        'Fix small bugs and build minor features for a web app, part time, fully remote.',
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

// GL-218/GL-251: the gig behind the demo scenario. Mandatory shortlisting
// doesn't by itself produce the informative case - a business hiring one of
// three shortlists only the person it hires - so three applicants are
// seeded deliberately to show "shortlisted, but someone else got it", which
// is exactly what the transparency tracker exists to show.
const seedDemoGig = (businessId) => ({
  title: 'Weekend Cafe Shift (seeded demo)',
  description:
    'Three applicants seeded on purpose: two shortlisted, one of those hired and completed, ' +
    'the third rejected after being viewed - so the applicant tracker has every state to show.',
  category: 'hospitality',
  payAmount: 1000,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 1,
  postedBy: businessId,
});

const seedApplicantSnapshot = (overrides = {}) => ({
  name: 'Seeded Seeker',
  headline: 'Reliable weekend help, available evenings.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
  ...overrides,
});

// Finds the (gig, applicant) application if a previous run already created
// it - the script is idempotent, same as the rest of it - or creates it
// fresh at `applied`, incrementing the gig's live applicantCount exactly
// once, the same +1 `applyToGig` gives a real application. Without this,
// three seeded applications with one later rejected (§11.5's -1 on leaving
// the live set) would run the count negative on every fresh seed.
const findOrCreateApplication = async (gigId, applicantId, profileSnapshot) => {
  const existing = await Application.findOne({ gig: gigId, applicant: applicantId });
  if (existing) return existing;

  const application = await Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot,
  });
  await adjustGigApplicantCount(gigId, 1);
  return application;
};

// Drives `application` through `chain` via transitionApplicationStatus -
// never by writing `status` directly - stopping once it's already at
// `finalStatus` so re-running the seed doesn't replay transitions a
// terminal/decided status has no outgoing move for. `reason` applies only
// to the last step of the chain, mirroring how rejection is the only
// transition that takes one.
const advanceApplication = async (application, chain, finalStatus, actor, reason) => {
  if (application.status === finalStatus) return application;

  let current = application;
  for (const [index, targetStatus] of chain.entries()) {
    const isLastStep = index === chain.length - 1;
    current = await transitionApplicationStatus(
      current,
      targetStatus,
      actor,
      isLastStep ? reason : undefined,
    );
  }
  return current;
};

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

  const extraApplicants = [];
  for (const { email, role } of seedExtraApplicants) {
    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, role, passwordHash } },
      { upsert: true, returnDocument: 'after' },
    );
    extraApplicants.push(user);
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

  const demoGig = await Gig.findOneAndUpdate(
    { title: 'Weekend Cafe Shift (seeded demo)', postedBy: seededUsers.business._id },
    { $setOnInsert: seedDemoGig(seededUsers.business._id) },
    { upsert: true, returnDocument: 'after' },
  );
  console.log(`Seeded demo gig: ${demoGig.title} (id ${demoGig.id})`);

  const businessActor = { id: seededUsers.business._id.toString(), role: 'business' };
  const [shortlistedOnlyApplicant, hiredApplicant, rejectedApplicant] = [
    seededUsers.seeker,
    ...extraApplicants,
  ];

  // Shortlisted, and left there - the "someone else got it" state. Two
  // applicants reach shortlisted; only one of the two goes on to be hired.
  let shortlistedOnly = await findOrCreateApplication(
    demoGig._id,
    shortlistedOnlyApplicant._id,
    seedApplicantSnapshot({
      name: 'Nadeesha Silva',
      headline: 'Available every weekend, previous cafe experience.',
    }),
  );
  shortlistedOnly = await advanceApplication(
    shortlistedOnly,
    ['viewed', 'shortlisted'],
    'shortlisted',
    businessActor,
  );
  console.log(
    `Seeded shortlisted (not hired) application: ${shortlistedOnlyApplicant.email} (id ${shortlistedOnly.id})`,
  );

  // Shortlisted, hired, then marked complete. completedAt is stamped by
  // transitionApplicationStatus at the moment this runs, never set here
  // directly - so it's always relative to when the seed runs, not pinned to
  // a fixed date that would already have closed GL-223's 14-day rating
  // window before the demo starts.
  let completed = await findOrCreateApplication(
    demoGig._id,
    hiredApplicant._id,
    seedApplicantSnapshot({
      name: 'Ruwan Jayasuriya',
      headline: 'Weekend availability, two years of hospitality experience.',
    }),
  );
  completed = await advanceApplication(
    completed,
    ['viewed', 'shortlisted', 'hired', 'completed'],
    'completed',
    businessActor,
  );
  console.log(`Seeded completed application: ${hiredApplicant.email} (id ${completed.id})`);

  // Rejected straight from viewed - never shortlisted - with a reason code
  // and a note, so the rejected state in the tracker has real data to show.
  let rejected = await findOrCreateApplication(
    demoGig._id,
    rejectedApplicant._id,
    seedApplicantSnapshot({
      name: 'Tharindu Wickramasinghe',
      headline: 'Looking for weekend shifts, flexible on hours.',
    }),
  );
  rejected = await advanceApplication(rejected, ['viewed', 'rejected'], 'rejected', businessActor, {
    code: 'another_applicant_closer_fit',
    note: 'Went with another applicant who was a closer fit for the shift pattern.',
  });
  console.log(`Seeded rejected application: ${rejectedApplicant.email} (id ${rejected.id})`);

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
