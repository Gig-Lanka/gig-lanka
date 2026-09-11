import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { Report } from '../../src/models/report.model.js';

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

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const validReportPayload = (overrides = {}) => ({
  targetType: 'user',
  targetId: new mongoose.Types.ObjectId().toString(),
  reasonCode: 'spam_or_scam',
  note: 'This account keeps messaging me asking for money upfront.',
  ...overrides,
});

describe('POST /api/reports', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).post('/api/reports').send(validReportPayload());

    expect(res.status).toBe(401);
  });

  it('rejects an admin with 403 — admins have no profile and are not participants', async () => {
    const adminToken = await createAdminAccessToken('report-admin@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validReportPayload());

    expect(res.status).toBe(403);
  });

  it('creates a report against a user', async () => {
    const reporter = await registerSeeker('report-user-reporter@example.com');
    const target = await registerSeeker('report-user-target@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: target.userId }));

    expect(res.status).toBe(201);
    expect(res.body.data.report).toMatchObject({
      reporter: reporter.userId,
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'spam_or_scam',
      status: 'open',
    });
  });

  it('creates a report against a gig, taking the reporter from the token rather than the body', async () => {
    const business = await registerBusiness('report-gig-business@example.com');
    const reporter = await registerSeeker('report-gig-reporter@example.com');
    const gig = await createGig(business.accessToken);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(
        validReportPayload({
          targetType: 'gig',
          targetId: gig.id,
          reasonCode: 'misleading_gig_details',
          // Must never be honoured — reporter always comes from the token.
          reporter: business.userId,
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data.report.reporter).toBe(reporter.userId);
    expect(res.body.data.report.targetType).toBe('gig');
    expect(res.body.data.report.targetId).toBe(gig.id);
  });

  it('returns 404 for an unknown user id, checked before self/duplicate logic', async () => {
    const reporter = await registerSeeker('report-unknown-user-reporter@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: new mongoose.Types.ObjectId().toString() }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for an unknown gig id', async () => {
    const reporter = await registerSeeker('report-unknown-gig-reporter@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'gig', targetId: new mongoose.Types.ObjectId().toString() }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404, not 400, for a malformed user id', async () => {
    const reporter = await registerSeeker('report-malformed-user-reporter@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: 'not-an-object-id' }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404, not 400, for a malformed gig id', async () => {
    const reporter = await registerSeeker('report-malformed-gig-reporter@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'gig', targetId: 'not-an-object-id' }));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses a user reporting themselves with 400', async () => {
    const reporter = await registerSeeker('report-self-reporter@example.com');

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: reporter.userId }));

    expect(res.status).toBe(400);
  });

  it('refuses a business reporting its own gig with 400', async () => {
    const business = await registerBusiness('report-own-gig-business@example.com');
    const gig = await createGig(business.accessToken);

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validReportPayload({ targetType: 'gig', targetId: gig.id }));

    expect(res.status).toBe(400);
  });

  it('returns 409 REPORT_ALREADY_EXISTS for a second open report against the same target, not a 500', async () => {
    const reporter = await registerSeeker('report-dup-reporter@example.com');
    const target = await registerSeeker('report-dup-target@example.com');
    const payload = validReportPayload({ targetType: 'user', targetId: target.userId });

    const first = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ ...payload, reasonCode: 'harassment_or_abuse', note: 'Still happening.' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('REPORT_ALREADY_EXISTS');
  });

  it('never surfaces on the reported user\'s public profile', async () => {
    const reporter = await registerSeeker('report-invisible-profile-reporter@example.com');
    const target = await registerSeeker('report-invisible-profile-target@example.com');

    const createRes = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: target.userId }));
    expect(createRes.status).toBe(201);

    const profileRes = await request(app)
      .get(`/api/profiles/${target.userId}`)
      .set('Authorization', `Bearer ${target.accessToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.profile).not.toHaveProperty('reports');
    expect(profileRes.body.data.profile).not.toHaveProperty('reportCount');
    expect(profileRes.body.data.profile).not.toHaveProperty('reported');
  });

  it('never surfaces on the reported gig\'s read', async () => {
    const business = await registerBusiness('report-invisible-gig-business@example.com');
    const reporter = await registerSeeker('report-invisible-gig-reporter@example.com');
    const gig = await createGig(business.accessToken);

    const createRes = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'gig', targetId: gig.id }));
    expect(createRes.status).toBe(201);

    const gigRes = await request(app).get(`/api/gigs/${gig.id}`);

    expect(gigRes.status).toBe(200);
    expect(gigRes.body.data.gig).toEqual(gig);
  });

  it('leaves the target document itself untouched', async () => {
    const reporter = await registerSeeker('report-untouched-reporter@example.com');
    const target = await registerSeeker('report-untouched-target@example.com');

    const before = await User.findById(target.userId).lean();

    const res = await request(app)
      .post('/api/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send(validReportPayload({ targetType: 'user', targetId: target.userId }));
    expect(res.status).toBe(201);

    const after = await User.findById(target.userId).lean();
    expect(after).toEqual(before);

    const reports = await Report.find({ targetId: target.userId });
    expect(reports).toHaveLength(1);
  });
});
