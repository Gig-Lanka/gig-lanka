import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';

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

const postGigAsBusiness = async (business, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${business.accessToken}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

describe('POST /api/gigs/:gigId/applications', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).post(`/api/gigs/${new mongoose.Types.ObjectId()}/applications`);

    expect(res.status).toBe(401);
  });

  it('rejects a business token with 403', async () => {
    const business = await registerBusiness('apply-business-caller@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('creates an application for a seeker, with server-set status/appliedAt and a profile snapshot', async () => {
    const business = await registerBusiness('apply-happy-business@example.com');
    const seeker = await registerSeeker('apply-happy-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({
        name: 'Nimal Perera',
        bio: 'Second-year student, free weekday evenings and weekends.',
        workExperience: [
          {
            roleTitle: 'Barista',
            employer: 'Cafe Kandy',
            startDate: '2025-06-01',
            endDate: '2025-12-31',
            ongoing: false,
            description: 'Weekend shifts making coffee and handling the till.',
          },
        ],
        education: [],
      });

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      // status and appliedAt must never be honoured — they're server-set.
      .send({ status: 'hired', appliedAt: '2020-01-01T00:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.data.application.status).toBe('applied');
    expect(res.body.data.application.gig).toBe(gig.id);
    expect(res.body.data.application.applicant).toBe(seeker.userId);
    expect(res.body.data.application.profileSnapshot.name).toBe('Nimal Perera');
    expect(res.body.data.application.profileSnapshot.headline).toBe(
      'Second-year student, free weekday evenings and weekends.',
    );
    expect(res.body.data.application.profileSnapshot.experience).toHaveLength(1);
    expect(res.body.data.profileIncomplete).toBe(false);
  });

  it('flags profileIncomplete when the applicant has no experience or education, without blocking the application', async () => {
    const business = await registerBusiness('apply-empty-business@example.com');
    const seeker = await registerSeeker('apply-empty-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.profileIncomplete).toBe(true);
  });

  it('increments the gig applicant count on creation', async () => {
    const business = await registerBusiness('apply-count-business@example.com');
    const seeker = await registerSeeker('apply-count-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    const updated = await Gig.findById(gig.id);
    expect(updated.applicantCount).toBe(1);
  });

  it('returns 409 GIG_CLOSED, naming the specific code, for a gig that is not open', async () => {
    const business = await registerBusiness('apply-closed-business@example.com');
    const seeker = await registerSeeker('apply-closed-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    await request(app)
      .patch(`/api/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });

  it('returns 409, not 500, for a duplicate application to the same gig', async () => {
    const business = await registerBusiness('apply-dup-business@example.com');
    const seeker = await registerSeeker('apply-dup-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const first = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('APPLICATION_ALREADY_EXISTS');

    const updated = await Gig.findById(gig.id);
    expect(updated.applicantCount).toBe(1);
  });

  it('returns 404 for a gig that does not exist', async () => {
    const seeker = await registerSeeker('apply-missing-gig-seeker@example.com');

    const res = await request(app)
      .post(`/api/gigs/${new mongoose.Types.ObjectId()}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(404);
  });
});
