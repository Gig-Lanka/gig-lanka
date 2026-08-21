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

describe('GET /api/gigs/:gigId/applications', () => {
  it('rejects a guest with 401', async () => {
    const business = await registerBusiness('gigapps-401-business@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app).get(`/api/gigs/${gig.id}/applications`);
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const business = await registerBusiness('gigapps-seeker-business@example.com');
    const seeker = await registerSeeker('gigapps-seeker-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a gig that does not exist', async () => {
    const business = await registerBusiness('gigapps-missing-business@example.com');

    const res = await request(app)
      .get('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1/applications')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404, not 403, for a bad id even from a business that would be refused on a real one', async () => {
    // The point of checking existence before ownership: a non-owning
    // business cannot use the status code to learn which gig ids are real.
    const other = await registerBusiness('gigapps-existence-other@example.com');

    const res = await request(app)
      .get('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1/applications')
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('gigapps-wrong-owner@example.com');
    const other = await registerBusiness('gigapps-wrong-other@example.com');
    const gig = await createGigDoc(owner.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns every application to the gig, newest first, gig as the bare reference id (no summary)', async () => {
    const business = await registerBusiness('gigapps-order-business@example.com');
    const seekerA = await registerSeeker('gigapps-order-seeker-a@example.com');
    const seekerB = await registerSeeker('gigapps-order-seeker-b@example.com');
    const gig = await createGigDoc(business.userId);
    const first = await createApplicationDoc(gig.id, seekerA.userId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createApplicationDoc(gig.id, seekerB.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(2);
    expect(res.body.data.applications[0].id).toBe(second.id);
    expect(res.body.data.applications[1].id).toBe(first.id);
    // The caller already supplied the gig id in the URL, so this list never
    // attaches a §11.6 summary the way for-my-gigs does — but `gig` itself
    // is still the plain reference id from §11.1, not omitted.
    expect(res.body.data.applications[0].gig).toBe(gig.id);
    expect(res.body.data.applications[0]).toHaveProperty('profileSnapshot');
  });

  it('never returns an application to a different gig', async () => {
    const business = await registerBusiness('gigapps-scope-business@example.com');
    const seeker = await registerSeeker('gigapps-scope-seeker@example.com');
    const gigA = await createGigDoc(business.userId, { title: 'Gig A' });
    const gigB = await createGigDoc(business.userId, { title: 'Gig B' });
    await createApplicationDoc(gigA.id, seeker.userId);

    const res = await request(app)
      .get(`/api/gigs/${gigB.id}/applications`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toEqual([]);
  });

  it('narrows to the requested status', async () => {
    const business = await registerBusiness('gigapps-filter-business@example.com');
    const seekerA = await registerSeeker('gigapps-filter-seeker-a@example.com');
    const seekerB = await registerSeeker('gigapps-filter-seeker-b@example.com');
    const gig = await createGigDoc(business.userId);
    const shortlisted = await createApplicationDoc(gig.id, seekerA.userId, {
      status: 'shortlisted',
    });
    await createApplicationDoc(gig.id, seekerB.userId, { status: 'applied' });

    const res = await request(app)
      .get(`/api/gigs/${gig.id}/applications`)
      .query({ status: 'shortlisted' })
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].id).toBe(shortlisted.id);
  });

  it('returns 400 VALIDATION_ERROR for an unrecognised status value', async () => {
    const business = await registerBusiness('gigapps-badfilter-business@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}/applications`)
      .query({ status: 'not_a_real_status' })
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors[0].field).toBe('status');
  });
});

describe('GET /api/applications/for-my-gigs', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/applications/for-my-gigs');
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seeker = await registerSeeker('formygigs-seeker-seeker@example.com');

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns an empty list for a business with no gigs', async () => {
    const business = await registerBusiness('formygigs-empty-business@example.com');

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toEqual([]);
  });

  it('returns every application across the caller’s own gigs, each with a gig summary', async () => {
    const business = await registerBusiness('formygigs-order-business@example.com');
    const seekerA = await registerSeeker('formygigs-order-seeker-a@example.com');
    const seekerB = await registerSeeker('formygigs-order-seeker-b@example.com');
    const gigA = await createGigDoc(business.userId, { title: 'First posting' });
    const gigB = await createGigDoc(business.userId, { title: 'Second posting' });
    const first = await createApplicationDoc(gigA.id, seekerA.userId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createApplicationDoc(gigB.id, seekerB.userId);

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(2);
    expect(res.body.data.applications[0].id).toBe(second.id);
    expect(res.body.data.applications[0].gig.id).toBe(gigB.id);
    expect(res.body.data.applications[0].gig.title).toBe('Second posting');
    expect(res.body.data.applications[1].id).toBe(first.id);
    expect(res.body.data.applications[1].gig.title).toBe('First posting');
  });

  it('never returns another business’s applications', async () => {
    const business = await registerBusiness('formygigs-scope-business@example.com');
    const otherBusiness = await registerBusiness('formygigs-scope-other-business@example.com');
    const seeker = await registerSeeker('formygigs-scope-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const otherGig = await createGigDoc(otherBusiness.userId);
    await createApplicationDoc(gig.id, seeker.userId);
    await createApplicationDoc(otherGig.id, seeker.userId);

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].gig.id).toBe(gig.id);
  });

  it('narrows to the requested status', async () => {
    const business = await registerBusiness('formygigs-filter-business@example.com');
    const seekerA = await registerSeeker('formygigs-filter-seeker-a@example.com');
    const seekerB = await registerSeeker('formygigs-filter-seeker-b@example.com');
    const gig = await createGigDoc(business.userId);
    const hired = await createApplicationDoc(gig.id, seekerA.userId, {
      status: 'hired',
      decidedAt: new Date(),
    });
    await createApplicationDoc(gig.id, seekerB.userId, { status: 'applied' });

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .query({ status: 'hired' })
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].id).toBe(hired.id);
  });

  it('returns 400 VALIDATION_ERROR for an unrecognised status value', async () => {
    const business = await registerBusiness('formygigs-badfilter-business@example.com');

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .query({ status: 'not_a_real_status' })
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors[0].field).toBe('status');
  });
});
