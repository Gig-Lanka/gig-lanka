import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { Report } from '../../src/models/report.model.js';
import { Profile } from '../../src/models/profile.model.js';
import { Gig } from '../../src/models/gig.model.js';

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

const setProfileName = async (accessToken, name) =>
  request(app).put('/api/profiles/me').set('Authorization', `Bearer ${accessToken}`).send({ name });

const registerSeeker = async (email, name) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'seeker' });

  const account = { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
  if (name) await setProfileName(account.accessToken, name);

  return account;
};

const registerBusiness = async (email, name) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role: 'business' });

  const account = { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
  if (name) await setProfileName(account.accessToken, name);

  return account;
};

const createGig = async (accessToken, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
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

  // GL-443: status now selects open or closed, and nothing else — a raw
  // internal status like `resolved` is refused rather than passed to Mongo.
  it('refuses any status other than open or closed with 400', async () => {
    const admin = await createAdmin('admin-queue-status-admin@example.com');

    const res = await request(app)
      .get('/api/admin/reports')
      .query({ status: 'resolved' })
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('carries the reason code, note, filed-at time, and reporter and user-target identities', async () => {
    const admin = await createAdmin('admin-queue-context-admin@example.com');
    const reporter = await registerSeeker(
      'admin-queue-context-reporter@example.com',
      'Reporting Reya',
    );
    const target = await registerSeeker('admin-queue-context-target@example.com', 'Targeted Tom');

    await createOpenReport(reporter.userId, target.userId, {
      reasonCode: 'harassment_or_abuse',
      note: 'Sent repeated abusive messages after I declined the gig.',
    });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    const [report] = res.body.data.reports;
    expect(report).toMatchObject({
      reasonCode: 'harassment_or_abuse',
      note: 'Sent repeated abusive messages after I declined the gig.',
      targetType: 'user',
    });
    expect(report.createdAt).toBeDefined();
    expect(report.reporter).toMatchObject({ id: reporter.userId, name: 'Reporting Reya' });
    expect(report.target).toMatchObject({ id: target.userId, name: 'Targeted Tom' });
  });

  it("carries a gig target's id, title and the posting business's identity", async () => {
    const admin = await createAdmin('admin-queue-gig-admin@example.com');
    const reporter = await registerSeeker('admin-queue-gig-reporter@example.com');
    const business = await registerBusiness(
      'admin-queue-gig-business@example.com',
      'Colombo Events Co',
    );
    const gig = await createGig(business.accessToken);

    await createOpenReport(reporter.userId, gig.id, {
      targetType: 'gig',
      reasonCode: 'misleading_gig_details',
    });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    const [report] = res.body.data.reports;
    expect(report.targetType).toBe('gig');
    expect(report.target).toMatchObject({
      id: gig.id,
      title: gig.title,
      business: { id: business.userId, name: 'Colombo Events Co' },
    });
  });

  it('reads an untouched user target as not suspended, and an untouched gig and its business as not taken down or suspended', async () => {
    const admin = await createAdmin('admin-queue-state-default-admin@example.com');
    const reporter = await registerSeeker('admin-queue-state-default-reporter@example.com');
    const target = await registerSeeker('admin-queue-state-default-target@example.com');
    const business = await registerBusiness('admin-queue-state-default-business@example.com');
    const gig = await createGig(business.accessToken);

    await createOpenReport(reporter.userId, target.userId);
    await createOpenReport(reporter.userId, gig.id, { targetType: 'gig' });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    const userReport = res.body.data.reports.find((report) => report.targetType === 'user');
    const gigReport = res.body.data.reports.find((report) => report.targetType === 'gig');
    expect(userReport.target.suspended).toBe(false);
    expect(gigReport.target.takenDown).toBe(false);
    expect(gigReport.target.business.suspended).toBe(false);
  });

  it('carries suspended on a user target an admin has suspended, and drops it once reinstated', async () => {
    const admin = await createAdmin('admin-queue-suspended-admin@example.com');
    const reporter = await registerSeeker('admin-queue-suspended-reporter@example.com');
    const target = await registerSeeker('admin-queue-suspended-target@example.com');

    await createOpenReport(reporter.userId, target.userId);

    await request(app)
      .patch(`/api/admin/users/${target.userId}/suspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    const suspendedRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(suspendedRes.body.data.reports[0].target).toMatchObject({
      id: target.userId,
      suspended: true,
    });

    await request(app)
      .patch(`/api/admin/users/${target.userId}/reinstate`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    const reinstatedRes = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(reinstatedRes.body.data.reports[0].target.suspended).toBe(false);
  });

  it('does not read a self-deactivated user target as suspended', async () => {
    const admin = await createAdmin('admin-queue-deactivated-admin@example.com');
    const reporter = await registerSeeker('admin-queue-deactivated-reporter@example.com');
    const target = await registerSeeker('admin-queue-deactivated-target@example.com');

    await createOpenReport(reporter.userId, target.userId);
    await User.updateOne({ _id: target.userId }, { isActive: false });

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.body.data.reports[0].target.suspended).toBe(false);
  });

  it("carries suspended on a gig target's business once that business is suspended", async () => {
    const admin = await createAdmin('admin-queue-suspended-business-admin@example.com');
    const reporter = await registerSeeker('admin-queue-suspended-business-reporter@example.com');
    const business = await registerBusiness('admin-queue-suspended-business@example.com');
    const gig = await createGig(business.accessToken);

    await createOpenReport(reporter.userId, gig.id, { targetType: 'gig' });

    await request(app)
      .patch(`/api/admin/users/${business.userId}/suspend`)
      .set('Authorization', `Bearer ${admin.accessToken}`);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.body.data.reports[0].target).toMatchObject({
      id: gig.id,
      takenDown: false,
      business: { id: business.userId, suspended: true },
    });
  });

  it('carries takenDown on a gig an admin has taken down, but not on one its business closed', async () => {
    const admin = await createAdmin('admin-queue-taken-down-admin@example.com');
    const reporter = await registerSeeker('admin-queue-taken-down-reporter@example.com');
    const business = await registerBusiness('admin-queue-taken-down-business@example.com');
    const takenDownGig = await createGig(business.accessToken, { title: 'Taken down gig' });
    const selfClosedGig = await createGig(business.accessToken, { title: 'Self-closed gig' });

    await createOpenReport(reporter.userId, takenDownGig.id, { targetType: 'gig' });
    await createOpenReport(reporter.userId, selfClosedGig.id, { targetType: 'gig' });

    await request(app)
      .patch(`/api/admin/gigs/${takenDownGig.id}/close`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    await request(app)
      .patch(`/api/gigs/${selfClosedGig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    const byTargetId = new Map(res.body.data.reports.map((report) => [report.targetId, report]));
    expect(byTargetId.get(takenDownGig.id).target.takenDown).toBe(true);
    expect(byTargetId.get(selfClosedGig.id).target.takenDown).toBe(false);
  });

  it('still returns a report whose gig target has since been hard-deleted, with a null target summary', async () => {
    const admin = await createAdmin('admin-queue-deleted-gig-admin@example.com');
    const reporter = await registerSeeker('admin-queue-deleted-gig-reporter@example.com');
    const business = await registerBusiness('admin-queue-deleted-gig-business@example.com');
    const gig = await createGig(business.accessToken);

    await createOpenReport(reporter.userId, gig.id, { targetType: 'gig' });

    await request(app)
      .delete(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    const [report] = res.body.data.reports;
    expect(report.targetId).toBe(gig.id);
    expect(report.target).toBeNull();
  });

  it('resolves a full page of mixed target types with a bounded, constant number of queries', async () => {
    const admin = await createAdmin('admin-queue-batch-admin@example.com');
    const reporter = await registerSeeker('admin-queue-batch-reporter@example.com');
    const business = await registerBusiness('admin-queue-batch-business@example.com');
    const gig = await createGig(business.accessToken);

    const userTargets = [];
    for (let i = 0; i < 9; i += 1) {
      userTargets.push(await registerSeeker(`admin-queue-batch-target-${i}@example.com`));
    }
    for (const target of userTargets) {
      await createOpenReport(reporter.userId, target.userId);
    }
    await createOpenReport(reporter.userId, gig.id, { targetType: 'gig' });

    const profileFindSpy = jest.spyOn(Profile, 'find');
    const gigFindSpy = jest.spyOn(Gig, 'find');
    const userFindSpy = jest.spyOn(User, 'find');

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(10);
    // One batched Profile.find for reporters, one for user targets, one more
    // inside gig.service.js for the gig's posting business — a fixed number
    // regardless of how many of the ten rows are which type, never one query
    // per row. Suspension state for every target account and gig business is
    // one more User.find (GL-455).
    expect(profileFindSpy).toHaveBeenCalledTimes(3);
    expect(gigFindSpy).toHaveBeenCalledTimes(1);
    expect(userFindSpy).toHaveBeenCalledTimes(1);

    profileFindSpy.mockRestore();
    gigFindSpy.mockRestore();
    userFindSpy.mockRestore();
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
