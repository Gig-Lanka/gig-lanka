import request from 'supertest';
import mongoose from 'mongoose';
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

const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy, applicantCount: 1 });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('PATCH /api/applications/:id/withdraw', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch(
      `/api/applications/${new mongoose.Types.ObjectId()}/withdraw`,
    );
    expect(res.status).toBe(401);
  });

  it('rejects a business token with 403', async () => {
    const business = await registerBusiness('withdraw-business-caller@example.com');
    const seeker = await registerSeeker('withdraw-business-caller-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/withdraw`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a seeker who is not the applicant with 403', async () => {
    const business = await registerBusiness('withdraw-stranger-business@example.com');
    const owner = await registerSeeker('withdraw-stranger-owner@example.com');
    const stranger = await registerSeeker('withdraw-stranger-stranger@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, owner.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/withdraw`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    const seeker = await registerSeeker('withdraw-missing-seeker@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/withdraw`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(404);
  });

  it.each(['applied', 'viewed', 'shortlisted'])(
    'withdraws a %s application, decrements the live count, stays visible to the business',
    async (status) => {
      const business = await registerBusiness(`withdraw-ok-${status}-business@example.com`);
      const seeker = await registerSeeker(`withdraw-ok-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, { status });

      const res = await request(app)
        .patch(`/api/applications/${application.id}/withdraw`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe('withdrawn');

      const updatedGig = await Gig.findById(gig.id);
      expect(updatedGig.applicantCount).toBe(0);

      const businessView = await request(app)
        .get(`/api/applications/${application.id}`)
        .set('Authorization', `Bearer ${business.accessToken}`);
      expect(businessView.status).toBe(200);
      expect(businessView.body.data.application.status).toBe('withdrawn');
    },
  );

  it('returns 409 for a hired application — hiring is terminal', async () => {
    const business = await registerBusiness('withdraw-hired-business@example.com');
    const seeker = await registerSeeker('withdraw-hired-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'hired',
      decidedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/withdraw`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');

    const updatedGig = await Gig.findById(gig.id);
    expect(updatedGig.applicantCount).toBe(1);
  });

  it('returns 409 for an application that is already withdrawn', async () => {
    const business = await registerBusiness('withdraw-twice-business@example.com');
    const seeker = await registerSeeker('withdraw-twice-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'withdrawn',
      decidedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/withdraw`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
  });

  it('prevents re-applying to the same gig after withdrawing', async () => {
    const business = await registerBusiness('withdraw-reapply-business@example.com');
    const seeker = await registerSeeker('withdraw-reapply-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    await request(app)
      .patch(`/api/applications/${application.id}/withdraw`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    const reapply = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(reapply.status).toBe(409);
    expect(reapply.body.error.code).toBe('APPLICATION_ALREADY_EXISTS');
  });
});
