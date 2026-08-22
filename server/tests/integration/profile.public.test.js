import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';

const validPassword = 'Password123!';

const registerSeeker = async (email) => {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'seeker',
  });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const registerBusiness = async (email) => {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'business',
  });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

// Admin accounts are never created through public registration (it rejects
// role: "admin"), only via direct database access — see server/README.md.
const createAdminAccessToken = async (email) => {
  const admin = await User.create({
    email,
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });

  return jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
};

const EXPECTED_SEEKER_KEYS = [
  'userId',
  'ratingSummary',
  'photo',
  'name',
  'city',
  'bio',
  'skills',
  'workExperience',
  'education',
  'skillTrialResults',
].sort();

const EXPECTED_BUSINESS_KEYS = ['userId', 'ratingSummary', 'photo', 'name', 'city', 'bio', 'category'].sort();

describe('GET /api/profiles/:userId', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/profiles/64f1a2b3c4d5e6f7a8b9c0d1');

    expect(res.status).toBe(401);
  });

  it('rejects an admin caller with 403', async () => {
    const seeker = await registerSeeker('public-admin-caller-subject@example.com');
    const adminToken = await createAdminAccessToken('public-admin-caller@example.com');

    const res = await request(app)
      .get(`/api/profiles/${seeker.userId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a userId that does not exist', async () => {
    const viewer = await registerSeeker('public-missing-viewer@example.com');

    const res = await request(app)
      .get('/api/profiles/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns exactly the expected key set for a seeker subject, with private fields absent', async () => {
    const subject = await registerSeeker('public-seeker-subject@example.com');
    const viewer = await registerBusiness('public-seeker-viewer@example.com');

    await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${subject.accessToken}`)
      .send({
        name: 'Seeker Subject',
        photo: 'https://example.com/photo.jpg',
        bio: 'A short bio',
        city: 'Colombo',
        skills: ['cooking'],
        workExperience: [{ roleTitle: 'Waiter', employer: 'Cafe Lanka' }],
        education: [{ institution: 'City College', qualification: 'Diploma' }],
      });

    const res = await request(app)
      .get(`/api/profiles/${subject.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    const profile = res.body.data.profile;

    expect(Object.keys(profile).sort()).toEqual(EXPECTED_SEEKER_KEYS);
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('role');
    expect(profile).not.toHaveProperty('isActive');
    expect(profile.category).toBeUndefined();
  });

  it('returns exactly the expected key set for a business subject, with private fields absent', async () => {
    const subject = await registerBusiness('public-business-subject@example.com');
    const viewer = await registerSeeker('public-business-viewer@example.com');

    await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${subject.accessToken}`)
      .send({
        name: 'Business Subject',
        photo: 'https://example.com/photo.jpg',
        bio: 'A short bio',
        city: 'Colombo',
        category: 'catering',
      });

    const res = await request(app)
      .get(`/api/profiles/${subject.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    const profile = res.body.data.profile;

    expect(Object.keys(profile).sort()).toEqual(EXPECTED_BUSINESS_KEYS);
    expect(profile).not.toHaveProperty('email');
    expect(profile).not.toHaveProperty('role');
    expect(profile).not.toHaveProperty('isActive');
    expect(profile.skills).toBeUndefined();
    expect(profile.workExperience).toBeUndefined();
    expect(profile.education).toBeUndefined();
    expect(profile.skillTrialResults).toBeUndefined();
  });

  // Sprint 3 deactivation guard, pinned before the feature exists: getPublicProfile
  // must answer 404 — identical to a userId that was never registered — once a
  // user record has isActive === false. Named "deactivation guard" so the Sprint 3
  // story that adds isActive to the User schema can find this test.
  describe('deactivation guard (isActive: false)', () => {
    it('answers 404 for a deactivated account, identical to a profile that never existed', async () => {
      const subject = await registerSeeker('public-deactivated-subject@example.com');
      const viewer = await registerBusiness('public-deactivated-viewer@example.com');

      // isActive is not on the User schema until Sprint 3. A normal Mongoose
      // save/updateOne in strict mode would silently drop it, so it is written
      // through the native driver collection to bypass schema stripping —
      // exercising the guard against the raw stored document, the way a
      // Sprint 3 migration would actually set it.
      await User.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(subject.userId) },
        { $set: { isActive: false } },
      );

      const res = await request(app)
        .get(`/api/profiles/${subject.userId}`)
        .set('Authorization', `Bearer ${viewer.accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('PUT /api/profiles/:userId', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app)
      .put('/api/profiles/64f1a2b3c4d5e6f7a8b9c0d1')
      .send({ name: 'Anyone' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for the profile owner themself', async () => {
    const owner = await registerSeeker('public-put-owner@example.com');

    const res = await request(app)
      .put(`/api/profiles/${owner.userId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Trying to self-edit' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for a caller who is not the owner', async () => {
    const subject = await registerSeeker('public-put-subject@example.com');
    const intruder = await registerBusiness('public-put-intruder@example.com');

    const res = await request(app)
      .put(`/api/profiles/${subject.userId}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send({ name: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('returns 403 for an admin caller', async () => {
    const subject = await registerSeeker('public-put-admin-subject@example.com');
    const adminToken = await createAdminAccessToken('public-put-admin@example.com');

    const res = await request(app)
      .put(`/api/profiles/${subject.userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin edit attempt' });

    expect(res.status).toBe(403);
  });
});
