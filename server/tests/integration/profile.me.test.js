import request from 'supertest';
import jwt from 'jsonwebtoken';
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

  return res.body.data.accessToken;
};

const registerBusiness = async (email) => {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'business',
  });

  return res.body.data.accessToken;
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

describe('GET /api/profiles/me', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/profiles/me');

    expect(res.status).toBe(401);
  });

  it('rejects an admin with 403', async () => {
    const adminToken = await createAdminAccessToken('profile-me-admin@example.com');

    const res = await request(app)
      .get('/api/profiles/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
  });

  it('lazily creates a profile on first read, defaulting the name from the email local part', async () => {
    const token = await registerSeeker('lazy.create@example.com');

    const res = await request(app).get('/api/profiles/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.name).toBe('lazy.create');
  });
});

describe('PUT /api/profiles/me', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).put('/api/profiles/me').send({ name: 'Anyone' });

    expect(res.status).toBe(401);
  });

  it('clears an omitted field instead of preserving it (full-replace semantics)', async () => {
    const token = await registerSeeker('full-replace@example.com');

    await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Full Profile',
        photo: 'https://example.com/photo.jpg',
        bio: 'A short bio',
        city: 'Colombo',
        skills: ['cooking'],
        workExperience: [{ roleTitle: 'Waiter', employer: 'Cafe Lanka' }],
        education: [{ institution: 'City College', qualification: 'Diploma' }],
      });

    const res = await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Full Profile' });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.photo).toBeUndefined();
    expect(res.body.data.profile.bio).toBeUndefined();
    expect(res.body.data.profile.city).toBeUndefined();
    expect(res.body.data.profile.skills).toEqual([]);
    expect(res.body.data.profile.workExperience).toEqual([]);
    expect(res.body.data.profile.education).toEqual([]);
  });

  describe('rejects system-owned fields', () => {
    it.each([
      ['ratingSummary', { totalReviews: 5, averageRating: 4.2 }],
      ['skillTrialResults', [{ skill: 'cooking', passed: true }]],
      ['role', 'business'],
      ['email', 'new@example.com'],
    ])('rejects %s with 400 naming the field', async (field, value) => {
      const token = await registerSeeker(`system-owned-${field}@example.com`);

      const res = await request(app)
        .put('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User', [field]: value });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });

  describe("rejects the other role's fields", () => {
    it('rejects a seeker sending category with 400 naming the field', async () => {
      const token = await registerSeeker('role-seeker-category@example.com');

      const res = await request(app)
        .put('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User', category: 'cleaning' });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'category' })]),
      );
    });

    it.each([
      ['skills', ['cooking']],
      ['workExperience', [{ roleTitle: 'Waiter', employer: 'Cafe Lanka' }]],
      ['education', [{ institution: 'City College', qualification: 'Diploma' }]],
    ])('rejects a business sending %s with 400 naming the field', async (field, value) => {
      const token = await registerBusiness(`role-business-${field}@example.com`);

      const res = await request(app)
        .put('/api/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User', [field]: value });

      expect(res.status).toBe(400);
      expect(res.body.error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });
});
