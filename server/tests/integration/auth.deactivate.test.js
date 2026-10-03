import request from 'supertest';
import app from '../../src/app.js';
import { User } from '../../src/models/user.model.js';
import { RefreshToken } from '../../src/models/refreshToken.model.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';
import { Review } from '../../src/models/review.model.js';

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

const buildSnapshot = () => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
});

const registerSeeker = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'seeker' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const registerBusiness = async (email) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'business' });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const deactivate = (accessToken) =>
  request(app).post('/api/auth/deactivate').set('Authorization', `Bearer ${accessToken}`);

describe('isActive defaults to true', () => {
  it('is true on a newly registered user in the database, and never in the response', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'deactivate-flag-default@example.com',
      password: validPassword,
      role: 'seeker',
    });

    expect(res.body.data.user).not.toHaveProperty('isActive');

    const stored = await User.findById(res.body.data.user.id).lean();
    expect(stored.isActive).toBe(true);
  });
});

describe('POST /api/auth/deactivate', () => {
  it('sets isActive to false for the caller only', async () => {
    const caller = await registerSeeker('deactivate-caller@example.com');
    const other = await registerSeeker('deactivate-bystander@example.com');

    const res = await deactivate(caller.accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });

    const callerUser = await User.findById(caller.userId).lean();
    const otherUser = await User.findById(other.userId).lean();
    expect(callerUser.isActive).toBe(false);
    expect(otherUser.isActive).toBe(true);
  });

  it('revokes every refresh token belonging to the user, and none for anyone else', async () => {
    const email = 'deactivate-multi-session@example.com';
    const first = await registerSeeker(email);
    const secondLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: validPassword });

    const other = await registerSeeker('deactivate-other-session@example.com');

    expect(await RefreshToken.countDocuments({ user: first.userId })).toBe(2);

    await deactivate(first.accessToken);

    expect(await RefreshToken.countDocuments({ user: first.userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ user: other.userId })).toBe(1);

    void secondLogin;
  });

  it('rejects a guest with 401', async () => {
    const res = await request(app).post('/api/auth/deactivate');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/login — deactivated account', () => {
  it('refuses correct credentials with 403 ACCOUNT_DEACTIVATED', async () => {
    const email = 'deactivate-login@example.com';
    const user = await registerSeeker(email);
    await deactivate(user.accessToken);

    const res = await request(app).post('/api/auth/login').send({ email, password: validPassword });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});

describe('requireAuth — deactivated account', () => {
  it('refuses a still-valid access token with 401 once the account is deactivated', async () => {
    const user = await registerSeeker('deactivate-live-token@example.com');
    const staleAccessToken = user.accessToken;

    await deactivate(user.accessToken);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staleAccessToken}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/gigs — deactivated business', () => {
  it('drops the gig from the listing (and its total) while GET /api/gigs/:id still resolves', async () => {
    const business = await registerBusiness('deactivate-business-listing@example.com');
    const gig = await createGig(business.accessToken, { title: 'Should disappear from browse' });

    const stillActive = await registerBusiness('deactivate-business-listing-active@example.com');
    await createGig(stillActive.accessToken, { title: 'Should stay visible' });

    await deactivate(business.accessToken);

    const listRes = await request(app).get('/api/gigs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.gigs.map((g) => g.title)).toEqual(['Should stay visible']);
    expect(listRes.body.data.total).toBe(1);

    const directRes = await request(app).get(`/api/gigs/${gig.id}`);
    expect(directRes.status).toBe(200);
    expect(directRes.body.data.gig.id).toBe(gig.id);
  });
});

describe('POST /api/gigs/:gigId/applications — deactivated business', () => {
  it('refuses an application with 409 GIG_CLOSED', async () => {
    const business = await registerBusiness('deactivate-business-apply@example.com');
    const gig = await createGig(business.accessToken, { title: 'No longer applicable' });
    const seeker = await registerSeeker('deactivate-apply-seeker@example.com');

    await deactivate(business.accessToken);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });
});

describe('GET /api/users/:userId/reviews — deactivated user', () => {
  it('still serves a deactivated user\'s reviews — deactivation never deletes them', async () => {
    const business = await registerBusiness('deactivate-review-business@example.com');
    const seeker = await registerSeeker('deactivate-review-seeker@example.com');
    const caller = await registerSeeker('deactivate-review-caller@example.com');

    const gig = await Gig.create({ ...validGigPayload(), postedBy: business.userId });
    const application = await Application.create({
      gig: gig._id,
      applicant: seeker.userId,
      profileSnapshot: buildSnapshot(),
      status: 'completed',
      completedAt: new Date(),
    });
    await Review.create({
      application: application._id,
      author: business.userId,
      subject: seeker.userId,
      direction: 'business_to_seeker',
      rating: 4,
      text: 'A perfectly fine review, written before the subject deactivated.',
    });

    await deactivate(seeker.accessToken);

    const res = await request(app)
      .get(`/api/users/${seeker.userId}/reviews`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
