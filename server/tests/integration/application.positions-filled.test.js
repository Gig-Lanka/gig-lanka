import request from 'supertest';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';

const validPassword = 'Password123!';

const validGigPayload = (overrides = {}) => ({
  title: 'Weekend cafe shift',
  description: 'Help run the counter and serve customers during weekend shifts.',
  category: 'hospitality',
  payAmount: 1000,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 1,
  ...overrides,
});

const buildSnapshot = (overrides = {}) => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
  ...overrides,
});

const registerBusiness = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'business' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const registerSeeker = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'seeker' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

// applicantCount is supplied explicitly per test rather than derived, the
// same convention application.business-transitions.test.js uses — there is
// no apply-and-drive-through-every-transition path available here, since
// these fixtures seed specific statuses directly.
const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(), postedBy, applicantCount: 0, ...overrides });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('positions-filled: hiring the last position', () => {
  // The mixed fixture the sub-task asks for — one applied, one viewed, one
  // shortlisted, one applied-with-a-trial, plus the shortlisted application
  // that actually gets hired to trigger the fill — so all four rows of the
  // §6 table, the over-hire trigger, applicantCount and the still-waiting
  // count are asserted together against one gig rather than one rule at a
  // time in isolation.
  it('fills the gig, sweeps applied/viewed with positions_filled, spares shortlisted and a trial-carrying application, and gets applicantCount and the still-waiting count right', async () => {
    const business = await registerBusiness('posfilled-mix-business@example.com');
    const appliedSeeker = await registerSeeker('posfilled-mix-applied@example.com');
    const viewedSeeker = await registerSeeker('posfilled-mix-viewed@example.com');
    const sparedSeeker = await registerSeeker('posfilled-mix-spared@example.com');
    const trialSeeker = await registerSeeker('posfilled-mix-trial@example.com');
    const hireSeeker = await registerSeeker('posfilled-mix-hire@example.com');

    const gig = await createGigDoc(business.userId, { positions: 1, applicantCount: 5 });

    const appliedApp = await createApplicationDoc(gig.id, appliedSeeker.userId, {
      status: 'applied',
    });
    const viewedApp = await createApplicationDoc(gig.id, viewedSeeker.userId, {
      status: 'viewed',
      viewedAt: new Date(),
    });
    const sparedShortlisted = await createApplicationDoc(gig.id, sparedSeeker.userId, {
      status: 'shortlisted',
    });
    const trialApp = await createApplicationDoc(gig.id, trialSeeker.userId, {
      status: 'applied',
      skillTrialSubmission: { result: 'submitted', submittedAt: new Date() },
    });
    const toHireApp = await createApplicationDoc(gig.id, hireSeeker.userId, {
      status: 'shortlisted',
    });

    const hireRes = await request(app)
      .patch(`/api/applications/${toHireApp.id}/hire`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(hireRes.status).toBe(200);
    expect(hireRes.body.data.application.status).toBe('hired');

    const [
      reloadedApplied,
      reloadedViewed,
      reloadedShortlisted,
      reloadedTrial,
      reloadedHired,
      reloadedGig,
    ] = await Promise.all([
      Application.findById(appliedApp.id),
      Application.findById(viewedApp.id),
      Application.findById(sparedShortlisted.id),
      Application.findById(trialApp.id),
      Application.findById(toHireApp.id),
      Gig.findById(gig.id),
    ]);

    // The four rows of the §6 table, asserted as a whole.
    expect(reloadedApplied.status).toBe('closed_filled');
    expect(reloadedApplied.rejectionReasonCode).toBe('positions_filled');
    expect(reloadedViewed.status).toBe('closed_filled');
    expect(reloadedViewed.rejectionReasonCode).toBe('positions_filled');
    expect(reloadedShortlisted.status).toBe('shortlisted');
    expect(reloadedTrial.status).toBe('applied');
    expect(reloadedHired.status).toBe('hired');

    // Hiring the last position fills the gig.
    expect(reloadedGig.status).toBe('filled');

    // 5 live applications at the start, minus the 2 swept out of the live set.
    expect(reloadedGig.applicantCount).toBe(3);

    // Still-waiting count: the spared shortlisted application plus the
    // unreviewed trial submission — surfaced only on the business's My Gigs
    // read.
    const myGigsRes = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    const gigRow = myGigsRes.body.data.gigs.find((g) => g.id === gig.id);
    expect(gigRow.waitingOnYouCount).toBe(2);
  });

  it('sweeps nothing on a partially-filled gig — the trigger is the last position, not any hire', async () => {
    const business = await registerBusiness('posfilled-partial-business@example.com');
    const appliedSeeker = await registerSeeker('posfilled-partial-applied@example.com');
    const viewedSeeker = await registerSeeker('posfilled-partial-viewed@example.com');
    const hireSeeker = await registerSeeker('posfilled-partial-hire@example.com');

    const gig = await createGigDoc(business.userId, { positions: 2, applicantCount: 3 });

    const appliedApp = await createApplicationDoc(gig.id, appliedSeeker.userId, {
      status: 'applied',
    });
    const viewedApp = await createApplicationDoc(gig.id, viewedSeeker.userId, {
      status: 'viewed',
      viewedAt: new Date(),
    });
    const toHireApp = await createApplicationDoc(gig.id, hireSeeker.userId, {
      status: 'shortlisted',
    });

    const hireRes = await request(app)
      .patch(`/api/applications/${toHireApp.id}/hire`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(hireRes.status).toBe(200);

    const [reloadedApplied, reloadedViewed, reloadedGig] = await Promise.all([
      Application.findById(appliedApp.id),
      Application.findById(viewedApp.id),
      Gig.findById(gig.id),
    ]);

    expect(reloadedApplied.status).toBe('applied');
    expect(reloadedViewed.status).toBe('viewed');
    expect(reloadedGig.status).toBe('open');
    expect(reloadedGig.applicantCount).toBe(3);
  });

  it('refuses a hire once every position is already taken, naming the position count, with 409', async () => {
    const business = await registerBusiness('posfilled-overhire-business@example.com');
    const heldSeeker = await registerSeeker('posfilled-overhire-held@example.com');
    const extraSeeker = await registerSeeker('posfilled-overhire-extra@example.com');

    const gig = await createGigDoc(business.userId, { positions: 1, applicantCount: 2 });

    await createApplicationDoc(gig.id, heldSeeker.userId, { status: 'hired' });
    const extraApp = await createApplicationDoc(gig.id, extraSeeker.userId, {
      status: 'shortlisted',
    });

    const res = await request(app)
      .patch(`/api/applications/${extraApp.id}/hire`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_POSITIONS_FILLED');
    expect(res.body.error.message).toContain('1');

    const reloaded = await Application.findById(extraApp.id);
    expect(reloaded.status).toBe('shortlisted');
  });
});

describe('positions-filled: closing early and a deadline passing are not this rule', () => {
  it('does not sweep any application when a business closes the gig early', async () => {
    const business = await registerBusiness('posfilled-close-business@example.com');
    const appliedSeeker = await registerSeeker('posfilled-close-applied@example.com');
    const viewedSeeker = await registerSeeker('posfilled-close-viewed@example.com');
    const shortlistedSeeker = await registerSeeker('posfilled-close-shortlisted@example.com');

    const gig = await createGigDoc(business.userId, { positions: 1, applicantCount: 3 });

    const appliedApp = await createApplicationDoc(gig.id, appliedSeeker.userId, {
      status: 'applied',
    });
    const viewedApp = await createApplicationDoc(gig.id, viewedSeeker.userId, {
      status: 'viewed',
      viewedAt: new Date(),
    });
    const shortlistedApp = await createApplicationDoc(gig.id, shortlistedSeeker.userId, {
      status: 'shortlisted',
    });

    const closeRes = await request(app)
      .patch(`/api/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.gig.status).toBe('closed');

    const [reloadedApplied, reloadedViewed, reloadedShortlisted] = await Promise.all([
      Application.findById(appliedApp.id),
      Application.findById(viewedApp.id),
      Application.findById(shortlistedApp.id),
    ]);

    expect(reloadedApplied.status).toBe('applied');
    expect(reloadedViewed.status).toBe('viewed');
    expect(reloadedShortlisted.status).toBe('shortlisted');
  });

  it('does not sweep any application when a deadline passes and closeIfExpired fires', async () => {
    const business = await registerBusiness('posfilled-expiry-business@example.com');
    const appliedSeeker = await registerSeeker('posfilled-expiry-applied@example.com');
    const viewedSeeker = await registerSeeker('posfilled-expiry-viewed@example.com');
    const shortlistedSeeker = await registerSeeker('posfilled-expiry-shortlisted@example.com');

    const gig = await createGigDoc(business.userId, { positions: 1, applicantCount: 3 });

    const appliedApp = await createApplicationDoc(gig.id, appliedSeeker.userId, {
      status: 'applied',
    });
    const viewedApp = await createApplicationDoc(gig.id, viewedSeeker.userId, {
      status: 'viewed',
      viewedAt: new Date(),
    });
    const shortlistedApp = await createApplicationDoc(gig.id, shortlistedSeeker.userId, {
      status: 'shortlisted',
    });

    // The model's isNotPastDate validator only runs on save(), so a direct
    // updateOne is how an already-open gig ends up carrying a passed
    // deadline — the same technique gig.filled.test.js uses.
    await Gig.updateOne({ _id: gig.id }, { $set: { applicationsCloseDate: '2000-01-01' } });

    const readRes = await request(app).get(`/api/gigs/${gig.id}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.data.gig.status).toBe('closed');

    const [reloadedApplied, reloadedViewed, reloadedShortlisted] = await Promise.all([
      Application.findById(appliedApp.id),
      Application.findById(viewedApp.id),
      Application.findById(shortlistedApp.id),
    ]);

    expect(reloadedApplied.status).toBe('applied');
    expect(reloadedViewed.status).toBe('viewed');
    expect(reloadedShortlisted.status).toBe('shortlisted');
  });
});
