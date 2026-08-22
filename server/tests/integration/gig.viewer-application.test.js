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

const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('GET /api/gigs/:id — viewerApplication', () => {
  it('is unchanged for a guest: no viewerApplication key drives behaviour, and the field is null', async () => {
    const business = await registerBusiness('viewer-app-guest-business@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app).get(`/api/gigs/${gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.id).toBe(gig.id.toString());
    expect(res.body.data.business).toBeDefined();
    expect(res.body.data.viewerApplication).toBeNull();
  });

  it('is null for a business viewing the gig', async () => {
    const owner = await registerBusiness('viewer-app-business-owner@example.com');
    const otherBusiness = await registerBusiness('viewer-app-business-other@example.com');
    const gig = await createGigDoc(owner.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${otherBusiness.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.viewerApplication).toBeNull();
  });

  it('is null for a signed-in seeker who never applied', async () => {
    const business = await registerBusiness('viewer-app-never-applied-business@example.com');
    const seeker = await registerSeeker('viewer-app-never-applied-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.viewerApplication).toBeNull();
  });

  it.each(['applied', 'viewed', 'shortlisted', 'hired', 'completed', 'rejected', 'withdrawn'])(
    'carries { id, status } for a seeker with a %s application',
    async (status) => {
      const business = await registerBusiness(`viewer-app-${status}-business@example.com`);
      const seeker = await registerSeeker(`viewer-app-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, { status });

      const res = await request(app)
        .get(`/api/gigs/${gig.id}`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerApplication).toEqual({
        id: application.id.toString(),
        status,
      });
    },
  );

  it('keeps only { id, status } — no snapshot, rejection reason or timestamps leak in', async () => {
    const business = await registerBusiness('viewer-app-shape-business@example.com');
    const seeker = await registerSeeker('viewer-app-shape-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    await createApplicationDoc(gig.id, seeker.userId, {
      status: 'rejected',
      rejectionReasonCode: 'looking_for_more_experience',
      rejectionNote: 'Looking for more experience.',
      decidedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.viewerApplication).sort()).toEqual(['id', 'status']);
  });

  it('is treated as a guest when the access token is expired or invalid', async () => {
    const business = await registerBusiness('viewer-app-bad-token-business@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(200);
    expect(res.body.data.viewerApplication).toBeNull();
  });
});
