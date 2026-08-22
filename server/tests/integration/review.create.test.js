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

const createApplication = async (businessId, seekerId, status, overrides = {}) => {
  const gig = await Gig.create({ ...validGigPayload, postedBy: businessId });

  const application = await Application.create({
    gig: gig._id,
    applicant: seekerId,
    profileSnapshot: buildSnapshot(),
    status,
    ...overrides,
  });

  return { gig, application };
};

const validReviewPayload = (overrides = {}) => ({
  rating: 5,
  text: 'Paid on time and communicated clearly throughout the gig.',
  ...overrides,
});

describe('POST /api/applications/:applicationId/reviews', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app)
      .post('/api/applications/64f1a2b3c4d5e6f7a8b9c0d1/reviews')
      .send(validReviewPayload());

    expect(res.status).toBe(401);
  });

  it('returns 404 for an application that does not exist', async () => {
    const seeker = await registerSeeker('missing-app-seeker@example.com');

    const res = await request(app)
      .post(`/api/applications/${new mongoose.Types.ObjectId()}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload());

    expect(res.status).toBe(404);
  });

  it('returns 403 for a signed-in user who is not a party to the application', async () => {
    const business = await registerBusiness('party-business@example.com');
    const seeker = await registerSeeker('party-seeker@example.com');
    const stranger = await registerSeeker('party-stranger@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send(validReviewPayload());

    expect(res.status).toBe(403);
  });

  it('returns 409 naming the gate when the application has not reached Completed', async () => {
    const business = await registerBusiness('not-completed-business@example.com');
    const seeker = await registerSeeker('not-completed-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'shortlisted');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPLICATION_NOT_COMPLETED');
    expect(res.body.error.message.toLowerCase()).toContain('complete');
  });

  it('returns 409 naming the gate when the application has only reached Hired', async () => {
    const business = await registerBusiness('hired-only-business@example.com');
    const seeker = await registerSeeker('hired-only-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'hired');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPLICATION_NOT_COMPLETED');
  });

  it('creates a seeker-authored review of the business, deriving direction/author/subject server-side', async () => {
    const business = await registerBusiness('seeker-review-business@example.com');
    const seeker = await registerSeeker('seeker-review-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(
        validReviewPayload({
          categories: ['fair_payment', 'communication'],
          // These must never be honoured — direction/author/subject are derived.
          direction: 'business_to_seeker',
          author: seeker.userId,
          subject: seeker.userId,
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data.review.direction).toBe('seeker_to_business');
    expect(res.body.data.review.author).toBe(seeker.userId);
    expect(res.body.data.review.subject).toBe(business.userId);
    expect(res.body.data.review.categories).toEqual(['fair_payment', 'communication']);
  });

  it('creates a business-authored review of the seeker', async () => {
    const business = await registerBusiness('business-review-business@example.com');
    const seeker = await registerSeeker('business-review-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validReviewPayload({ categories: ['work_quality', 'punctuality'] }));

    expect(res.status).toBe(201);
    expect(res.body.data.review.direction).toBe('business_to_seeker');
    expect(res.body.data.review.author).toBe(business.userId);
    expect(res.body.data.review.subject).toBe(seeker.userId);
  });

  it('returns 400 naming the field when a category belongs to the other direction', async () => {
    const business = await registerBusiness('mismatch-business@example.com');
    const seeker = await registerSeeker('mismatch-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload({ categories: ['work_quality'] }));

    expect(res.status).toBe(400);
    expect(res.body.error.errors[0].field).toBe('categories');
  });

  it('returns 409, not a duplicate document, for a second review in the same direction', async () => {
    const business = await registerBusiness('dup-business@example.com');
    const seeker = await registerSeeker('dup-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const first = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload({ text: 'A different, but still valid, twenty-plus char review.' }));

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('REVIEW_ALREADY_EXISTS');
  });

  it('rejects a rating outside 1-5 with 400', async () => {
    const business = await registerBusiness('rating-business@example.com');
    const seeker = await registerSeeker('rating-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload({ rating: 6 }));

    expect(res.status).toBe(400);
  });

  it('rejects whitespace-only text with 400', async () => {
    const business = await registerBusiness('whitespace-business@example.com');
    const seeker = await registerSeeker('whitespace-seeker@example.com');
    const { application } = await createApplication(business.userId, seeker.userId, 'completed');

    const res = await request(app)
      .post(`/api/applications/${application.id}/reviews`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send(validReviewPayload({ text: '                         ' }));

    expect(res.status).toBe(400);
  });
});
