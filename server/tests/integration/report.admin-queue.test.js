import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { Report } from '../../src/models/report.model.js';

const validPassword = 'Password123!';

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
// direct-database approach auth.rbac.test.js already uses.
const createAdmin = async (email) => {
  const admin = await User.create({
    email,
    passwordHash: 'not-a-real-hash',
    role: 'admin',
  });

  const accessToken = jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

  return { accessToken, userId: admin.id };
};

const createOpenReport = (reporterId, targetId, overrides = {}) =>
  Report.create({
    reporter: reporterId,
    targetType: 'user',
    targetId,
    reasonCode: 'spam_or_scam',
    status: 'open',
    ...overrides,
  });

describe('GET /api/admin/reports', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/admin/reports');

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seeker = await registerSeeker('admin-queue-seeker@example.com');

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a business with 403', async () => {
    const business = await registerBusiness('admin-queue-business@example.com');

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('lets an admin read a page of open reports', async () => {
    const admin = await createAdmin('admin-queue-admin@example.com');
    const reporter = await registerSeeker('admin-queue-reporter@example.com');
    const target = await registerSeeker('admin-queue-target@example.com');

    await createOpenReport(reporter.userId, target.userId);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data).toMatchObject({ total: 1, page: 1, limit: 10 });
  });

  it('returns open reports newest first, paginated ten per page, with total across pages', async () => {
    const admin = await createAdmin('admin-queue-paging-admin@example.com');
    const reporter = await registerSeeker('admin-queue-paging-reporter@example.com');

    const targets = [];
    for (let i = 0; i < 11; i += 1) {
      targets.push(await registerSeeker(`admin-queue-paging-target-${i}@example.com`));
    }

    for (const target of targets) {
      await createOpenReport(reporter.userId, target.userId);
    }

    const pageOne = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data.reports).toHaveLength(10);
    expect(pageOne.body.data).toMatchObject({ total: 11, page: 1, limit: 10 });

    const pageTwo = await request(app)
      .get('/api/admin/reports')
      .query({ page: 2 })
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data.reports).toHaveLength(1);
    expect(pageTwo.body.data).toMatchObject({ total: 11, page: 2, limit: 10 });

    // Newest first: the last report created is the first row on page one.
    expect(pageOne.body.data.reports[0].targetId).toBe(targets[10].userId);
  });

  it('falls back to page 1 for a malformed or missing page parameter', async () => {
    const admin = await createAdmin('admin-queue-malformed-admin@example.com');
    const reporter = await registerSeeker('admin-queue-malformed-reporter@example.com');
    const target = await registerSeeker('admin-queue-malformed-target@example.com');

    await createOpenReport(reporter.userId, target.userId);

    const res = await request(app)
      .get('/api/admin/reports')
      .query({ page: 'not-a-number' })
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
  });

  it('cannot be widened past status: open by any request parameter', async () => {
    const admin = await createAdmin('admin-queue-status-admin@example.com');
    const reporter = await registerSeeker('admin-queue-status-reporter@example.com');
    const openTarget = await registerSeeker('admin-queue-status-open-target@example.com');
    const resolvedTarget = await registerSeeker('admin-queue-status-resolved-target@example.com');

    await createOpenReport(reporter.userId, openTarget.userId);
    await createOpenReport(reporter.userId, resolvedTarget.userId, { status: 'resolved' });

    const res = await request(app)
      .get('/api/admin/reports')
      .query({ status: 'resolved' })
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0].targetId).toBe(openTarget.userId);
  });

  it('mounts no write verb on the admin reports route', async () => {
    const admin = await createAdmin('admin-queue-write-admin@example.com');

    const verbs = ['post', 'put', 'patch', 'delete'];

    for (const verb of verbs) {
      const res = await request(app)
        [verb]('/api/admin/reports')
        .set('Authorization', `Bearer ${admin.accessToken}`);

      expect([404, 405]).toContain(res.status);
    }
  });
});
