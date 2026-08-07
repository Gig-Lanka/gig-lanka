import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';

const validPassword = 'Password123!';

const registerSeeker = async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: 'rbac-seeker@example.com',
    password: validPassword,
    role: 'seeker',
  });

  return res.body.data.accessToken;
};

// Admin accounts are never created through public registration (it rejects role: "admin"),
// only via direct database access — see server/README.md.
const createAdminAccessToken = async () => {
  const admin = await User.create({
    email: 'rbac-admin@example.com',
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });

  return jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
};

describe('GET /api/auth/admin-smoke-test — role-based access', () => {
  it('refuses a seeker token with 403', async () => {
    const seekerToken = await registerSeeker();

    const res = await request(app)
      .get('/api/auth/admin-smoke-test')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });

  it('allows an admin token with 200', async () => {
    const adminToken = await createAdminAccessToken();

    const res = await request(app)
      .get('/api/auth/admin-smoke-test')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
