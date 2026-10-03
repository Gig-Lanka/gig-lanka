import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { RefreshToken } from '../../src/models/refreshToken.model.js';
import { getSentEmails, clearSentEmails } from '../../src/services/email.service.js';

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

// Admin accounts are never created through public registration — the same
// direct-database approach admin.gig-takedown.test.js and auth.rbac.test.js
// already use.
const createAdmin = async (email) => {
  const admin = await User.create({ email, passwordHash: 'not-a-real-hash', role: 'admin' });
  const accessToken = jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

  return { accessToken, userId: admin.id };
};

const createGig = async (accessToken, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const suspend = (userId, adminToken) =>
  request(app)
    .patch(`/api/admin/users/${userId}/suspend`)
    .set('Authorization', `Bearer ${adminToken}`);

const reinstate = (userId, adminToken) =>
  request(app)
    .patch(`/api/admin/users/${userId}/reinstate`)
    .set('Authorization', `Bearer ${adminToken}`);

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

const forgotPassword = (email) => request(app).post('/api/auth/forgot-password').send({ email });

const deactivateSelf = (accessToken) =>
  request(app).post('/api/auth/deactivate').set('Authorization', `Bearer ${accessToken}`);

describe('PATCH /api/admin/users/:id/suspend — role-based access', () => {
  it('rejects a guest with 401', async () => {
    const target = await registerSeeker('suspend-rbac-guest-target@example.com');

    const res = await request(app).patch(`/api/admin/users/${target.userId}/suspend`);

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const target = await registerSeeker('suspend-rbac-seeker-target@example.com');
    const seeker = await registerSeeker('suspend-rbac-seeker-caller@example.com');

    const res = await suspend(target.userId, seeker.accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a business with 403', async () => {
    const target = await registerSeeker('suspend-rbac-business-target@example.com');
    const business = await registerBusiness('suspend-rbac-business-caller@example.com');

    const res = await suspend(target.userId, business.accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows an admin with 200', async () => {
    const target = await registerBusiness('suspend-rbac-admin-target@example.com');
    const admin = await createAdmin('suspend-rbac-admin-caller@example.com');

    const res = await suspend(target.userId, admin.accessToken);

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/users/:id/reinstate — role-based access', () => {
  it('rejects a guest with 401', async () => {
    const target = await registerSeeker('reinstate-rbac-guest-target@example.com');

    const res = await request(app).patch(`/api/admin/users/${target.userId}/reinstate`);

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const target = await registerSeeker('reinstate-rbac-seeker-target@example.com');
    const seeker = await registerSeeker('reinstate-rbac-seeker-caller@example.com');

    const res = await reinstate(target.userId, seeker.accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a business with 403', async () => {
    const target = await registerSeeker('reinstate-rbac-business-target@example.com');
    const business = await registerBusiness('reinstate-rbac-business-caller@example.com');

    const res = await reinstate(target.userId, business.accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows an admin with 200', async () => {
    const target = await registerBusiness('reinstate-rbac-admin-target@example.com');
    const admin = await createAdmin('reinstate-rbac-admin-caller@example.com');
    await suspend(target.userId, admin.accessToken);

    const res = await reinstate(target.userId, admin.accessToken);

    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/users/:id/suspend — refusals', () => {
  it('returns 404 for an id that does not exist', async () => {
    const admin = await createAdmin('suspend-404-unknown-admin@example.com');

    const res = await suspend('64f1a2b3c4d5e6f7a8b9c0d4', admin.accessToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a malformed id', async () => {
    const admin = await createAdmin('suspend-404-malformed-admin@example.com');

    const res = await suspend('not-an-id', admin.accessToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when the target is an admin — admins cannot suspend admins', async () => {
    const actingAdmin = await createAdmin('suspend-403-acting-admin@example.com');
    const targetAdmin = await createAdmin('suspend-403-target-admin@example.com');

    const res = await suspend(targetAdmin.userId, actingAdmin.accessToken);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 ACCOUNT_ALREADY_SUSPENDED for an already-suspended account', async () => {
    const target = await registerBusiness('suspend-409-already-target@example.com');
    const admin = await createAdmin('suspend-409-already-admin@example.com');
    await suspend(target.userId, admin.accessToken);

    const res = await suspend(target.userId, admin.accessToken);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_ALREADY_SUSPENDED');
  });

  it('allows suspending an account that has already deactivated itself', async () => {
    const target = await registerBusiness('suspend-self-deactivated-target@example.com');
    const admin = await createAdmin('suspend-self-deactivated-admin@example.com');
    await deactivateSelf(target.accessToken);

    const res = await suspend(target.userId, admin.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('suspended');
  });
});

describe('PATCH /api/admin/users/:id/reinstate — refusals', () => {
  it('returns 404 for an id that does not exist', async () => {
    const admin = await createAdmin('reinstate-404-unknown-admin@example.com');

    const res = await reinstate('64f1a2b3c4d5e6f7a8b9c0d4', admin.accessToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a malformed id', async () => {
    const admin = await createAdmin('reinstate-404-malformed-admin@example.com');

    const res = await reinstate('not-an-id', admin.accessToken);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 ACCOUNT_NOT_SUSPENDED for an account that is not suspended', async () => {
    const target = await registerBusiness('reinstate-409-not-suspended-target@example.com');
    const admin = await createAdmin('reinstate-409-not-suspended-admin@example.com');

    const res = await reinstate(target.userId, admin.accessToken);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_SUSPENDED');
  });
});

describe('PATCH /api/admin/users/:id/suspend — effect', () => {
  it('sets suspendedAt in the database and returns it in the response, without touching isActive', async () => {
    const target = await registerBusiness('suspend-effect-target@example.com');
    const admin = await createAdmin('suspend-effect-admin@example.com');

    const res = await suspend(target.userId, admin.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      userId: target.userId,
      status: 'suspended',
      suspendedAt: expect.any(String),
    });

    const stored = await User.findById(target.userId).lean();
    expect(stored.suspendedAt).toBeTruthy();
    expect(stored.isActive).toBe(true);
  });

  it('revokes every refresh token for the suspended user, and none for anyone else', async () => {
    const email = 'suspend-effect-sessions@example.com';
    const target = await registerBusiness(email);
    await login(email, validPassword);
    const bystander = await registerSeeker('suspend-effect-bystander@example.com');
    const admin = await createAdmin('suspend-effect-sessions-admin@example.com');

    expect(await RefreshToken.countDocuments({ user: target.userId })).toBe(2);

    await suspend(target.userId, admin.accessToken);

    expect(await RefreshToken.countDocuments({ user: target.userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ user: bystander.userId })).toBe(1);
  });
});

describe('POST /api/auth/login — suspended account', () => {
  it('refuses correct credentials with 403 ACCOUNT_SUSPENDED', async () => {
    const email = 'login-suspended@example.com';
    const target = await registerSeeker(email);
    const admin = await createAdmin('login-suspended-admin@example.com');
    await suspend(target.userId, admin.accessToken);

    const res = await login(email, validPassword);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.error.message).toBe('Your account has been suspended by Gig Lanka.');
  });

  it('still refuses a wrong password with 401 INVALID_CREDENTIALS, not 403', async () => {
    const email = 'login-suspended-wrong-password@example.com';
    const target = await registerSeeker(email);
    const admin = await createAdmin('login-suspended-wrong-password-admin@example.com');
    await suspend(target.userId, admin.accessToken);

    const res = await login(email, 'WrongPassword123!');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('requireAuth — suspended account', () => {
  it('refuses a still-valid access token with 401 once the account is suspended', async () => {
    const target = await registerSeeker('requireauth-suspended@example.com');
    const admin = await createAdmin('requireauth-suspended-admin@example.com');
    const staleAccessToken = target.accessToken;

    await suspend(target.userId, admin.accessToken);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${staleAccessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('GET /api/gigs — suspended business', () => {
  it('drops the gig from the listing (and its total) while GET /api/gigs/:id still resolves', async () => {
    const business = await registerBusiness('suspend-business-listing@example.com');
    const gig = await createGig(business.accessToken, { title: 'Should disappear from browse' });

    const stillActive = await registerBusiness('suspend-business-listing-active@example.com');
    await createGig(stillActive.accessToken, { title: 'Should stay visible' });

    const admin = await createAdmin('suspend-business-listing-admin@example.com');
    await suspend(business.userId, admin.accessToken);

    const listRes = await request(app).get('/api/gigs');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.gigs.map((g) => g.title)).toEqual(['Should stay visible']);
    expect(listRes.body.data.total).toBe(1);

    const directRes = await request(app).get(`/api/gigs/${gig.id}`);
    expect(directRes.status).toBe(200);
    expect(directRes.body.data.gig.id).toBe(gig.id);
  });
});

describe('POST /api/gigs/:gigId/applications — suspended business', () => {
  it('refuses an application with 409 GIG_CLOSED', async () => {
    const business = await registerBusiness('suspend-business-apply@example.com');
    const gig = await createGig(business.accessToken, { title: 'No longer applicable' });
    const seeker = await registerSeeker('suspend-apply-seeker@example.com');

    const admin = await createAdmin('suspend-business-apply-admin@example.com');
    await suspend(business.userId, admin.accessToken);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });
});

describe('GET /api/profiles/:userId — suspended user', () => {
  it('answers 404 for a suspended account, identical to a profile that never existed', async () => {
    const subject = await registerSeeker('suspend-profile-subject@example.com');
    const viewer = await registerBusiness('suspend-profile-viewer@example.com');
    const admin = await createAdmin('suspend-profile-admin@example.com');
    await suspend(subject.userId, admin.accessToken);

    const res = await request(app)
      .get(`/api/profiles/${subject.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/forgot-password — suspended account', () => {
  beforeEach(() => clearSentEmails());

  it('returns the same 200 response as a known and an unknown address, and sends no email', async () => {
    const email = 'forgot-suspended@example.com';
    const target = await registerSeeker(email);
    const admin = await createAdmin('forgot-suspended-admin@example.com');
    await suspend(target.userId, admin.accessToken);

    await registerSeeker('forgot-suspended-unrelated-known@example.com');
    const knownRes = await forgotPassword('forgot-suspended-unrelated-known@example.com');
    const suspendedRes = await forgotPassword(email);
    const unknownRes = await forgotPassword('forgot-suspended-unknown@example.com');

    expect(suspendedRes.status).toBe(200);
    expect(suspendedRes.body).toEqual(unknownRes.body);
    expect(suspendedRes.body).toEqual(knownRes.body);

    const sent = getSentEmails();
    expect(sent.some((message) => message.to === email)).toBe(false);
  });
});

describe('PATCH /api/admin/users/:id/reinstate — effect', () => {
  it('clears suspendedAt and restores sign-in, browse and the profile', async () => {
    const email = 'reinstate-effect@example.com';
    const business = await registerBusiness(email);
    const gig = await createGig(business.accessToken, { title: 'Comes back after reinstatement' });
    const viewer = await registerSeeker('reinstate-effect-viewer@example.com');
    const admin = await createAdmin('reinstate-effect-admin@example.com');

    await suspend(business.userId, admin.accessToken);

    const res = await reinstate(business.userId, admin.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ userId: business.userId, status: 'active' });

    const stored = await User.findById(business.userId).lean();
    expect(stored.suspendedAt).toBeNull();

    const loginRes = await login(email, validPassword);
    expect(loginRes.status).toBe(200);

    const listRes = await request(app).get('/api/gigs');
    expect(listRes.body.data.gigs.map((g) => g.id)).toContain(gig.id);

    const profileRes = await request(app)
      .get(`/api/profiles/${business.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(profileRes.status).toBe(200);
  });

  it('leaves a self-deactivated account deactivated — reinstating only undoes the suspension', async () => {
    const email = 'reinstate-self-deactivated@example.com';
    const target = await registerSeeker(email);
    const admin = await createAdmin('reinstate-self-deactivated-admin@example.com');

    await deactivateSelf(target.accessToken);
    await suspend(target.userId, admin.accessToken);
    await reinstate(target.userId, admin.accessToken);

    const stored = await User.findById(target.userId).lean();
    expect(stored.suspendedAt).toBeNull();
    expect(stored.isActive).toBe(false);

    const res = await login(email, validPassword);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});
