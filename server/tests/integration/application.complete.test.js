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

// Hired applications are seeded directly rather than driven through the
// endpoint, because there is no hire endpoint yet — GL-219/GL-220/GL-221 own
// the business-side controls. decidedAt comes with them, since a real hire
// would have stamped it.
const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

const createHiredApplication = async (gigId, applicantId, overrides = {}) =>
  createApplicationDoc(gigId, applicantId, {
    status: 'hired',
    decidedAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  });

describe('PATCH /api/applications/:id/complete', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch(
      `/api/applications/${new mongoose.Types.ObjectId()}/complete`,
    );

    expect(res.status).toBe(401);
  });

  it('rejects the applicant themselves with 403', async () => {
    const business = await registerBusiness('complete-applicant-business@example.com');
    const seeker = await registerSeeker('complete-applicant-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('hired');
    expect(reloaded.completedAt).toBeNull();
  });

  it('rejects a seeker who is not the applicant with 403', async () => {
    const business = await registerBusiness('complete-stranger-business@example.com');
    const owner = await registerSeeker('complete-stranger-owner@example.com');
    const stranger = await registerSeeker('complete-stranger-stranger@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, owner.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('complete-wrong-owner@example.com');
    const other = await registerBusiness('complete-wrong-other@example.com');
    const seeker = await registerSeeker('complete-wrong-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('hired');
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('complete-missing-business@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('completes a hired application for the business that posted the gig', async () => {
    const business = await registerBusiness('complete-ok-business@example.com');
    const seeker = await registerSeeker('complete-ok-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('completed');
    expect(res.body.data.application.completedAt).not.toBeNull();
    expect(res.body.data.application.gig.id).toBe(gig.id);

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('completed');
    expect(reloaded.completedAt).toBeInstanceOf(Date);
  });

  it('leaves the gig applicant count untouched across hire -> complete', async () => {
    const business = await registerBusiness('complete-count-business@example.com');
    const seeker = await registerSeeker('complete-count-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const updatedGig = await Gig.findById(gig.id);
    expect(updatedGig.applicantCount).toBe(1);
  });

  it('stamps completedAt once and a second call neither succeeds nor moves it', async () => {
    const business = await registerBusiness('complete-once-business@example.com');
    const seeker = await registerSeeker('complete-once-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    const first = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(first.status).toBe(200);
    const firstCompletedAt = first.body.data.application.completedAt;

    const second = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.completedAt.toISOString()).toBe(firstCompletedAt);
  });

  it('takes no reason — a body sent with the request is not stored', async () => {
    const business = await registerBusiness('complete-noreason-business@example.com');
    const seeker = await registerSeeker('complete-noreason-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createHiredApplication(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/complete`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch', reasonNote: 'Work finished early.' });

    expect(res.status).toBe(200);

    const reloaded = await Application.findById(application.id);
    expect(reloaded.rejectionReasonCode).toBeUndefined();
    expect(reloaded.rejectionNote).toBeUndefined();
  });

  it.each(['applied', 'viewed', 'shortlisted', 'rejected', 'withdrawn', 'closed_filled'])(
    'returns 409 naming both statuses for a %s application',
    async (status) => {
      const business = await registerBusiness(`complete-409-${status}-business@example.com`);
      const seeker = await registerSeeker(`complete-409-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, { status });

      const res = await request(app)
        .patch(`/api/applications/${application.id}/complete`)
        .set('Authorization', `Bearer ${business.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
      expect(res.body.error.message).toContain(status);
      expect(res.body.error.message).toContain('completed');

      const reloaded = await Application.findById(application.id);
      expect(reloaded.status).toBe(status);
      expect(reloaded.completedAt).toBeNull();
    },
  );
});
