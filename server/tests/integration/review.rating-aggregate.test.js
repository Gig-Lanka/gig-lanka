import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';

const validPassword = 'Password123!';

const validGigPayload = {
  title: 'Weekend cafe shift',
  description: 'Help run the counter and serve customers during weekend shifts.',
  category: 'hospitality',
  payAmount: 1000,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 1,
};

const buildSnapshot = () => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
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

const createCompletedApplication = async (businessId, seekerId) => {
  const gig = await Gig.create({ ...validGigPayload, postedBy: businessId });

  return Application.create({
    gig: gig._id,
    applicant: seekerId,
    profileSnapshot: buildSnapshot(),
    status: 'completed',
    completedAt: new Date(),
  });
};

// A fresh business, hired against a fresh seeker on their own gig, so every
// case in this file starts from an independent (application, business,
// seeker) triple — no two reviews here share an application or a subject
// unless a test deliberately wants that overlap.
const seedHire = async (businessEmail, seekerEmail) => {
  const business = await registerBusiness(businessEmail);
  const seeker = await registerSeeker(seekerEmail);
  const application = await createCompletedApplication(business.userId, seeker.userId);

  return { business, seeker, application };
};

const postReview = async (applicationId, accessToken, body) =>
  request(app)
    .post(`/api/applications/${applicationId}/reviews`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ text: 'Paid on time and communicated clearly throughout the gig.', ...body });

const getProfile = async (userId, accessToken) =>
  request(app).get(`/api/profiles/${userId}`).set('Authorization', `Bearer ${accessToken}`);

const getMyProfile = async (accessToken) =>
  request(app).get('/api/profiles/me').set('Authorization', `Bearer ${accessToken}`);

const ZEROED_AGGREGATE = {
  averageRating: 0,
  reviewCount: 0,
  topCategories: [],
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  completedGigCount: 0,
};

describe('rating aggregate computed from reviews', () => {
  it('computes the full aggregate from a single review', async () => {
    const { business, seeker, application } = await seedHire(
      'single-review-business@example.com',
      'single-review-seeker@example.com',
    );

    const reviewRes = await postReview(application.id, seeker.accessToken, {
      rating: 5,
      categories: ['fair_payment', 'communication'],
    });
    expect(reviewRes.status).toBe(201);

    const profileRes = await getProfile(business.userId, seeker.accessToken);

    expect(profileRes.body.data.profile.ratingSummary).toEqual({
      averageRating: 5,
      reviewCount: 1,
      // Both categories tie at a count of one, so the documented tie-break
      // (alphabetical) is what orders them, not submission order.
      topCategories: ['communication', 'fair_payment'],
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      // The application the review is written against is itself completed,
      // on a gig this business posted.
      completedGigCount: 1,
    });
  });

  it('keeps a zeroed aggregate for a user with no reviews', async () => {
    const seeker = await registerSeeker('no-reviews-seeker@example.com');

    const profileRes = await getMyProfile(seeker.accessToken);

    // The empty state RatingSummary renders ("New to Gig Lanka") is driven by
    // this exact zeroed shape, never by a real average of zero.
    expect(profileRes.body.data.profile.ratingSummary).toEqual(ZEROED_AGGREGATE);
  });

  it('rounds a mean that lands exactly halfway to the next tenth up, not down', async () => {
    const business = await registerBusiness('rounding-business@example.com');

    // Four separate seekers, each with their own gig and hire, so each can
    // post one seeker_to_business review of the same business: ratings
    // 4, 4, 4, 5 sum to 17, and 17 / 4 = 4.25 exactly — the one mean in this
    // rating range guaranteed to land on the boundary the documented
    // round-half-up rule exists to settle, rather than on whatever a float
    // happens to produce.
    const ratings = [4, 4, 4, 5];
    for (const [index, rating] of ratings.entries()) {
      const seeker = await registerSeeker(`rounding-seeker-${index}@example.com`);
      const application = await createCompletedApplication(business.userId, seeker.userId);

      const res = await postReview(application.id, seeker.accessToken, { rating });
      expect(res.status).toBe(201);
    }

    const profileRes = await getProfile(business.userId, business.accessToken);

    expect(profileRes.body.data.profile.ratingSummary.averageRating).toBe(4.3);
    expect(profileRes.body.data.profile.ratingSummary.reviewCount).toBe(4);
  });

  it('distributes one review into each star bucket, summing to the count', async () => {
    const business = await registerBusiness('distribution-business@example.com');

    // One seeker per star value, 1 through 5, so every bucket is hit exactly
    // once — the shape that proves the five counts sum to reviewCount rather
    // than five independently-plausible numbers.
    const ratings = [1, 2, 3, 4, 5];
    for (const [index, rating] of ratings.entries()) {
      const seeker = await registerSeeker(`distribution-seeker-${index}@example.com`);
      const application = await createCompletedApplication(business.userId, seeker.userId);

      const res = await postReview(application.id, seeker.accessToken, { rating });
      expect(res.status).toBe(201);
    }

    const profileRes = await getProfile(business.userId, business.accessToken);
    const { reviewCount, distribution } = profileRes.body.data.profile.ratingSummary;

    expect(distribution).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
    expect(reviewCount).toBe(5);
    expect(Object.values(distribution).reduce((sum, count) => sum + count, 0)).toBe(reviewCount);
  });

  it('breaks a top-categories tie alphabetically, as documented', async () => {
    const business = await registerBusiness('tie-break-business@example.com');

    // fair_payment and communication both land at count 2; clear_job_description
    // and respectful_treatment both land at count 1. Nothing about insertion
    // order or Mongo's return order should decide the winner within either
    // tied pair — only categoryA.localeCompare(categoryB) does, so the
    // expected order is fixed regardless of which review is posted first.
    const reviewCategories = [
      ['fair_payment', 'communication'],
      ['fair_payment'],
      ['communication'],
      ['clear_job_description', 'respectful_treatment'],
    ];

    for (const [index, categories] of reviewCategories.entries()) {
      const seeker = await registerSeeker(`tie-break-seeker-${index}@example.com`);
      const application = await createCompletedApplication(business.userId, seeker.userId);

      const res = await postReview(application.id, seeker.accessToken, { rating: 4, categories });
      expect(res.status).toBe(201);
    }

    const profileRes = await getProfile(business.userId, business.accessToken);

    expect(profileRes.body.data.profile.ratingSummary.topCategories).toEqual([
      'communication',
      'fair_payment',
      'clear_job_description',
    ]);
  });

  it('never mixes a review written by a user into their own aggregate as subject', async () => {
    const { business, seeker, application } = await seedHire(
      'both-directions-business@example.com',
      'both-directions-seeker@example.com',
    );

    // Same application, both directions: the seeker rates the business, and
    // the business rates the seeker back. Each is subject on exactly one of
    // the two reviews and author on the other — the case that mixing subject
    // and author would corrupt in both directions at once.
    const seekerReview = await postReview(application.id, seeker.accessToken, { rating: 5 });
    expect(seekerReview.status).toBe(201);

    const businessReview = await postReview(application.id, business.accessToken, { rating: 3 });
    expect(businessReview.status).toBe(201);

    const businessProfile = await getProfile(business.userId, seeker.accessToken);
    expect(businessProfile.body.data.profile.ratingSummary).toMatchObject({
      averageRating: 5,
      reviewCount: 1,
    });

    const seekerProfile = await getProfile(seeker.userId, business.accessToken);
    expect(seekerProfile.body.data.profile.ratingSummary).toMatchObject({
      averageRating: 3,
      reviewCount: 1,
    });
  });
});

// GL-447: completed gigs are counted from applications, not reviews. Hires
// are seeded directly at `hired` and then marked complete through the real
// endpoint, so the recompute under test is the one completeApplication makes.
const createApplicationAt = async (gigId, applicantId, status) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    status,
    ...(status === 'hired' ? { decidedAt: new Date() } : {}),
    ...(status === 'completed' ? { decidedAt: new Date(), completedAt: new Date() } : {}),
  });

const createGig = async (businessId) => Gig.create({ ...validGigPayload, postedBy: businessId });

const completeHire = async (applicationId, accessToken) =>
  request(app)
    .patch(`/api/applications/${applicationId}/complete`)
    .set('Authorization', `Bearer ${accessToken}`);

const completedGigCountOf = async (userId, accessToken) => {
  const res = await getProfile(userId, accessToken);
  return res.body.data.profile.ratingSummary.completedGigCount;
};

describe('completedGigCount in the rating aggregate', () => {
  it("counts a seeker's own completed applications, and nothing else", async () => {
    const business = await registerBusiness('count-seeker-business@example.com');
    const seeker = await registerSeeker('count-seeker-seeker@example.com');

    // One earlier completed gig, plus a withdrawn, a rejected and a
    // still-hired application — only completed ones count.
    await createApplicationAt((await createGig(business.userId))._id, seeker.userId, 'completed');
    await createApplicationAt((await createGig(business.userId))._id, seeker.userId, 'withdrawn');
    await createApplicationAt((await createGig(business.userId))._id, seeker.userId, 'rejected');
    await createApplicationAt((await createGig(business.userId))._id, seeker.userId, 'hired');
    const hire = await createApplicationAt(
      (await createGig(business.userId))._id,
      seeker.userId,
      'hired',
    );

    const res = await completeHire(hire.id, business.accessToken);
    expect(res.status).toBe(200);

    expect(await completedGigCountOf(seeker.userId, business.accessToken)).toBe(2);
  });

  it("counts a business's completed applications across the gigs it posted, and nothing else", async () => {
    const business = await registerBusiness('count-business-business@example.com');
    const otherBusiness = await registerBusiness('count-business-other@example.com');
    const seekers = await Promise.all(
      [0, 1, 2, 3, 4, 5].map((index) =>
        registerSeeker(`count-business-seeker-${index}@example.com`),
      ),
    );

    const gigA = await createGig(business.userId);
    const gigB = await createGig(business.userId);
    const otherGig = await createGig(otherBusiness.userId);

    await createApplicationAt(gigA._id, seekers[0].userId, 'completed');
    await createApplicationAt(gigA._id, seekers[1].userId, 'withdrawn');
    await createApplicationAt(gigA._id, seekers[2].userId, 'rejected');
    await createApplicationAt(gigB._id, seekers[3].userId, 'hired');
    // Completed, but on another business's gig — never this business's.
    await createApplicationAt(otherGig._id, seekers[4].userId, 'completed');
    const hire = await createApplicationAt(gigB._id, seekers[5].userId, 'hired');

    const res = await completeHire(hire.id, business.accessToken);
    expect(res.status).toBe(200);

    expect(await completedGigCountOf(business.userId, business.accessToken)).toBe(2);
  });

  it('carries the count for a user with no reviews, beside zeroed review fields', async () => {
    const business = await registerBusiness('count-no-reviews-business@example.com');
    const seeker = await registerSeeker('count-no-reviews-seeker@example.com');
    const hire = await createApplicationAt(
      (await createGig(business.userId))._id,
      seeker.userId,
      'hired',
    );

    const res = await completeHire(hire.id, business.accessToken);
    expect(res.status).toBe(200);

    const seekerRes = await getMyProfile(seeker.accessToken);
    expect(seekerRes.body.data.profile.ratingSummary).toEqual({
      ...ZEROED_AGGREGATE,
      completedGigCount: 1,
    });

    const businessRes = await getMyProfile(business.accessToken);
    expect(businessRes.body.data.profile.ratingSummary).toEqual({
      ...ZEROED_AGGREGATE,
      completedGigCount: 1,
    });
  });

  it('recomputes both parties when a hire is marked complete', async () => {
    const business = await registerBusiness('count-both-business@example.com');
    const seeker = await registerSeeker('count-both-seeker@example.com');
    const hire = await createApplicationAt(
      (await createGig(business.userId))._id,
      seeker.userId,
      'hired',
    );

    expect(await completedGigCountOf(seeker.userId, business.accessToken)).toBe(0);
    expect(await completedGigCountOf(business.userId, business.accessToken)).toBe(0);

    const res = await completeHire(hire.id, business.accessToken);
    expect(res.status).toBe(200);

    expect(await completedGigCountOf(seeker.userId, business.accessToken)).toBe(1);
    expect(await completedGigCountOf(business.userId, business.accessToken)).toBe(1);
  });

  it('never fails the completion when a recompute fails', async () => {
    const business = await registerBusiness('count-failure-business@example.com');
    const seeker = await registerSeeker('count-failure-seeker@example.com');
    const hire = await createApplicationAt(
      (await createGig(business.userId))._id,
      seeker.userId,
      'hired',
    );

    // The same genuine save() failure review.create.test.js uses: a profile
    // written straight through the driver, missing its required `name`, so
    // setRatingSummary's save rejects for the business.
    await mongoose.connection
      .collection('profiles')
      .insertOne({ user: new mongoose.Types.ObjectId(business.userId) });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await completeHire(hire.id, business.accessToken);

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('completed');
    expect((await Application.findById(hire.id)).status).toBe('completed');

    // One party failing never blocks the other.
    expect(await completedGigCountOf(seeker.userId, seeker.accessToken)).toBe(1);
  });
});
