import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/user.model.js';

const validPassword = 'Password123!';

const validGigPayload = (overrides = {}) => ({
  title: 'Weekend event helper',
  description: 'Help set up and run a community weekend event, greeting guests.',
  category: 'event_help',
  payAmount: 2500,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 2,
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

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const deactivate = (userId) => User.updateOne({ _id: userId }, { isActive: false });

describe('GET /api/gigs — deactivated poster', () => {
  it('excludes a deactivated business\'s gig, with total matching the list', async () => {
    const business = await registerBusiness('gigfilter-deactivated-business@example.com');
    await createGig(business.accessToken, { title: 'From a deactivated business' });

    const stillActive = await registerBusiness('gigfilter-active-business@example.com');
    await createGig(stillActive.accessToken, { title: 'From an active business' });

    await deactivate(business.userId);

    const res = await request(app).get('/api/gigs');

    expect(res.status).toBe(200);
    const titles = res.body.data.gigs.map((gig) => gig.title);
    expect(titles).toEqual(['From an active business']);
    expect(res.body.data.total).toBe(1);
  });

  it('keeps a gig visible for a poster who is still active', async () => {
    const business = await registerBusiness('gigfilter-active-only-business@example.com');
    await createGig(business.accessToken, { title: 'Still open' });

    const res = await request(app).get('/api/gigs');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});

describe('GET /api/gigs/:id — deactivated poster', () => {
  it('still resolves a deactivated business\'s gig by direct link', async () => {
    const business = await registerBusiness('gigdirect-deactivated-business@example.com');
    const gig = await createGig(business.accessToken, { title: 'Still reachable by id' });

    await deactivate(business.userId);

    const res = await request(app).get(`/api/gigs/${gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.id).toBe(gig.id);
  });
});

describe('POST /api/gigs/:gigId/applications — deactivated poster', () => {
  it('refuses an application to a deactivated business\'s gig with 409 GIG_CLOSED', async () => {
    const business = await registerBusiness('gigapply-deactivated-business@example.com');
    const gig = await createGig(business.accessToken, { title: 'No longer applicable' });

    const seeker = await registerSeeker('gigapply-deactivated-seeker@example.com');

    await deactivate(business.userId);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });

  it('still accepts an application to a gig whose poster is active', async () => {
    const business = await registerBusiness('gigapply-active-business@example.com');
    const gig = await createGig(business.accessToken, { title: 'Still applicable' });

    const seeker = await registerSeeker('gigapply-active-seeker@example.com');

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});

    expect(res.status).toBe(201);
  });
});
