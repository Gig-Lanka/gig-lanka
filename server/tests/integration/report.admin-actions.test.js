import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
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

const setProfileName = async (accessToken, name) =>
  request(app).put('/api/profiles/me').set('Authorization', `Bearer ${accessToken}`).send({ name });

const register = async (email, role, name) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: validPassword, role });

  const account = { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
  if (name) await setProfileName(account.accessToken, name);

  return account;
};

const registerSeeker = (email, name) => register(email, 'seeker', name);
const registerBusiness = (email, name) => register(email, 'business', name);

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
  const admin = await User.create({ email, passwordHash: 'not-a-real-hash', role: 'admin' });

  const accessToken = jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

  return { accessToken, userId: admin.id };
};

const postReport = (accessToken, targetId, targetType = 'user') =>
  request(app).post('/api/reports').set('Authorization', `Bearer ${accessToken}`).send({
    targetType,
    targetId,
    reasonCode: 'spam_or_scam',
    note: 'Asked me for money upfront.',
  });

const closeReport = (accessToken, reportId, action, body = { note: 'Handled.' }) => {
  const req = request(app).patch(`/api/admin/reports/${reportId}/${action}`);
  if (accessToken) req.set('Authorization', `Bearer ${accessToken}`);
  return req.send(body);
};

const readQueue = (accessToken, query = {}) =>
  request(app).get('/api/admin/reports').query(query).set('Authorization', `Bearer ${accessToken}`);

// One admin, one reporter and one fresh open report against a user target —
// the starting point for most cases below.
const setUpOpenReport = async (prefix) => {
  const admin = await createAdmin(`${prefix}-admin@example.com`);
  const reporter = await registerSeeker(`${prefix}-reporter@example.com`, 'Reporting Reya');
  const target = await registerSeeker(`${prefix}-target@example.com`, 'Targeted Tharindu');

  const res = await postReport(reporter.accessToken, target.userId);

  return { admin, reporter, target, reportId: res.body.data.report.id };
};

const ACTIONS = [
  ['resolve', 'resolved'],
  ['dismiss', 'dismissed'],
];

describe('PATCH /api/admin/reports/:id/resolve and /dismiss', () => {
  describe.each(ACTIONS)('%s', (action, closedStatus) => {
    it(`lets an admin ${action} an open report and returns it in the admin shape`, async () => {
      const { admin, reporter, target, reportId } = await setUpOpenReport(`actions-${action}-ok`);
      const note = '  Spoke to both sides; recorded here verbatim.  ';

      const before = Date.now();
      const res = await closeReport(admin.accessToken, reportId, action, { note });

      expect(res.status).toBe(200);
      expect(res.body.data.report).toMatchObject({
        id: reportId,
        status: closedStatus,
        resolutionNote: note,
        closedBy: admin.userId,
        targetType: 'user',
        targetId: target.userId,
        reasonCode: 'spam_or_scam',
        note: 'Asked me for money upfront.',
        reporter: { id: reporter.userId, name: 'Reporting Reya' },
        target: { id: target.userId, name: 'Targeted Tharindu' },
      });
      expect(new Date(res.body.data.report.closedAt).getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );

      const stored = await Report.findById(reportId);
      expect(stored.status).toBe(closedStatus);
      expect(stored.resolutionNote).toBe(note);
      expect(stored.closedBy.toString()).toBe(admin.userId);
      expect(stored.closedAt).toBeInstanceOf(Date);
    });

    it('ignores status, closedBy and closedAt sent in the body', async () => {
      const { admin, reportId } = await setUpOpenReport(`actions-${action}-strip`);
      const someoneElse = new mongoose.Types.ObjectId().toString();

      const res = await closeReport(admin.accessToken, reportId, action, {
        note: 'Handled.',
        status: 'open',
        closedBy: someoneElse,
        closedAt: '2000-01-01T00:00:00.000Z',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.report.status).toBe(closedStatus);
      expect(res.body.data.report.closedBy).toBe(admin.userId);
      expect(res.body.data.report.closedAt).not.toBe('2000-01-01T00:00:00.000Z');
    });

    it('returns a gig target as { id, title, business } in the admin shape', async () => {
      const admin = await createAdmin(`actions-${action}-gig-admin@example.com`);
      const business = await registerBusiness(
        `actions-${action}-gig-business@example.com`,
        'Colombo Events Co.',
      );
      const reporter = await registerSeeker(`actions-${action}-gig-reporter@example.com`);
      const gig = await createGig(business.accessToken);
      const posted = await postReport(reporter.accessToken, gig.id, 'gig');

      const res = await closeReport(admin.accessToken, posted.body.data.report.id, action);

      expect(res.status).toBe(200);
      expect(res.body.data.report.target).toEqual({
        id: gig.id,
        title: gig.title,
        business: { id: business.userId, name: 'Colombo Events Co.', photo: null },
      });
    });

    it('rejects a guest with 401', async () => {
      const { reportId } = await setUpOpenReport(`actions-${action}-guest`);

      const res = await closeReport(null, reportId, action);

      expect(res.status).toBe(401);
      expect((await Report.findById(reportId)).status).toBe('open');
    });

    it.each([
      ['seeker', registerSeeker],
      ['business', registerBusiness],
    ])('rejects a %s with 403', async (role, registerCaller) => {
      const { reportId } = await setUpOpenReport(`actions-${action}-${role}`);
      const caller = await registerCaller(`actions-${action}-${role}-caller@example.com`);

      const res = await closeReport(caller.accessToken, reportId, action);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect((await Report.findById(reportId)).status).toBe('open');
    });

    it('returns 404 NOT_FOUND for an unknown id', async () => {
      const admin = await createAdmin(`actions-${action}-unknown-admin@example.com`);

      const res = await closeReport(admin.accessToken, new mongoose.Types.ObjectId(), action);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NOT_FOUND, not 400, for a malformed id', async () => {
      const admin = await createAdmin(`actions-${action}-malformed-admin@example.com`);

      const res = await closeReport(admin.accessToken, 'not-an-id', action);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it.each([
      ['missing', {}],
      ['empty', { note: '' }],
      ['whitespace-only', { note: '   \n\t ' }],
      ['over 300 characters', { note: 'a'.repeat(301) }],
    ])('returns 400 VALIDATION_ERROR naming note when the note is %s', async (label, body) => {
      const { admin, reportId } = await setUpOpenReport(
        `actions-${action}-note-${label.replace(/\W+/g, '-')}`,
      );

      const res = await closeReport(admin.accessToken, reportId, action, body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.errors.map((error) => error.field)).toEqual(['note']);
      expect((await Report.findById(reportId)).status).toBe('open');
    });

    it('accepts a note of exactly 300 characters', async () => {
      const { admin, reportId } = await setUpOpenReport(`actions-${action}-note-300`);

      const res = await closeReport(admin.accessToken, reportId, action, { note: 'a'.repeat(300) });

      expect(res.status).toBe(200);
      expect(res.body.data.report.resolutionNote).toHaveLength(300);
    });

    it.each(ACTIONS)(
      'returns 409 REPORT_ALREADY_CLOSED when the report was already closed by %s, leaving it untouched',
      async (firstAction, firstStatus) => {
        const { admin, reportId } = await setUpOpenReport(`actions-${action}-after-${firstAction}`);
        await closeReport(admin.accessToken, reportId, firstAction, { note: 'First decision.' });
        const afterFirst = await Report.findById(reportId);

        const res = await closeReport(admin.accessToken, reportId, action, {
          note: 'Second decision.',
        });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('REPORT_ALREADY_CLOSED');

        const stored = await Report.findById(reportId);
        expect(stored.status).toBe(firstStatus);
        expect(stored.resolutionNote).toBe('First decision.');
        expect(stored.closedAt.getTime()).toBe(afterFirst.closedAt.getTime());
      },
    );
  });

  it('lets exactly one of two admins racing to close the same report succeed', async () => {
    const { admin, reportId } = await setUpOpenReport('actions-race');
    const otherAdmin = await createAdmin('actions-race-other-admin@example.com');

    const results = await Promise.all([
      closeReport(admin.accessToken, reportId, 'resolve', { note: 'Resolved it.' }),
      closeReport(otherAdmin.accessToken, reportId, 'dismiss', { note: 'Dismissed it.' }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const loser = results.find((res) => res.status === 409);
    expect(loser.body.error.code).toBe('REPORT_ALREADY_CLOSED');

    const winner = results.find((res) => res.status === 200);
    const stored = await Report.findById(reportId);
    expect(stored.status).toBe(winner.body.data.report.status);
    expect(stored.resolutionNote).toBe(winner.body.data.report.resolutionNote);
  });
});

describe('the admin queue after closing', () => {
  it('drops a closed report from the open queue and lists it in the closed queue', async () => {
    const { admin, reportId } = await setUpOpenReport('queue-move');

    await closeReport(admin.accessToken, reportId, 'resolve', { note: 'Handled.' });

    const open = await readQueue(admin.accessToken);
    expect(open.status).toBe(200);
    expect(open.body.data.reports.map((report) => report.id)).not.toContain(reportId);
    expect(open.body.data.total).toBe(0);

    const closed = await readQueue(admin.accessToken, { status: 'closed' });
    expect(closed.status).toBe(200);
    expect(closed.body.data).toMatchObject({ total: 1, page: 1, limit: 10 });
    expect(closed.body.data.reports[0]).toMatchObject({
      id: reportId,
      status: 'resolved',
      resolutionNote: 'Handled.',
      closedBy: admin.userId,
    });
    expect(closed.body.data.reports[0].closedAt).toBeDefined();
  });

  it('never lists an open report in the closed queue', async () => {
    const { admin, reportId } = await setUpOpenReport('queue-open-only');

    const closed = await readQueue(admin.accessToken, { status: 'closed' });

    expect(closed.status).toBe(200);
    expect(closed.body.data.reports.map((report) => report.id)).not.toContain(reportId);
    expect(closed.body.data.total).toBe(0);
  });

  it('orders the closed queue most recently closed first, not by when reports were filed', async () => {
    const admin = await createAdmin('queue-order-admin@example.com');
    const reporter = await registerSeeker('queue-order-reporter@example.com');
    const targets = await Promise.all(
      [0, 1, 2].map((i) => registerSeeker(`queue-order-target-${i}@example.com`)),
    );

    // Filed in order 0, 1, 2 …
    const reportIds = [];
    for (const target of targets) {
      const res = await postReport(reporter.accessToken, target.userId);
      reportIds.push(res.body.data.report.id);
    }

    // … closed in order 1, 2, 0, so the closed order differs from the filed order.
    for (const [index, action] of [
      [1, 'resolve'],
      [2, 'dismiss'],
      [0, 'resolve'],
    ]) {
      await closeReport(admin.accessToken, reportIds[index], action, { note: `Closed ${index}.` });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const closed = await readQueue(admin.accessToken, { status: 'closed' });

    expect(closed.body.data.reports.map((report) => report.id)).toEqual([
      reportIds[0],
      reportIds[2],
      reportIds[1],
    ]);
    expect(closed.body.data.reports.map((report) => report.status)).toEqual([
      'resolved',
      'dismissed',
      'resolved',
    ]);
  });

  it('pages the closed queue ten at a time, like the open queue', async () => {
    const admin = await createAdmin('queue-page-admin@example.com');
    const reporter = await registerSeeker('queue-page-reporter@example.com');
    const now = Date.now();

    // Written directly: eleven closed reports with distinct closedAt values.
    await Report.insertMany(
      Array.from({ length: 11 }, (_, i) => ({
        reporter: reporter.userId,
        targetType: 'user',
        targetId: new mongoose.Types.ObjectId(),
        reasonCode: 'other',
        status: i % 2 ? 'dismissed' : 'resolved',
        resolutionNote: `Closed ${i}.`,
        closedAt: new Date(now - i * 1000),
        closedBy: admin.userId,
      })),
    );

    const pageOne = await readQueue(admin.accessToken, { status: 'closed' });
    const pageTwo = await readQueue(admin.accessToken, { status: 'closed', page: 2 });

    expect(pageOne.body.data).toMatchObject({ total: 11, page: 1, limit: 10 });
    expect(pageOne.body.data.reports).toHaveLength(10);
    expect(pageOne.body.data.reports[0].resolutionNote).toBe('Closed 0.');
    expect(pageTwo.body.data).toMatchObject({ total: 11, page: 2, limit: 10 });
    expect(pageTwo.body.data.reports).toHaveLength(1);
    expect(pageTwo.body.data.reports[0].resolutionNote).toBe('Closed 10.');
  });
});

describe('re-reporting after a report is closed', () => {
  it.each(ACTIONS)(
    'accepts a new report against the same target once the earlier one was closed by %s',
    async (action) => {
      const { admin, reporter, target, reportId } = await setUpOpenReport(`rereport-${action}`);
      await closeReport(admin.accessToken, reportId, action);

      const res = await postReport(reporter.accessToken, target.userId);

      expect(res.status).toBe(201);
      expect(res.body.data.report.status).toBe('open');
      expect(res.body.data.report.id).not.toBe(reportId);
    },
  );

  it('still refuses a second open report with 409 REPORT_ALREADY_EXISTS', async () => {
    const { reporter, target } = await setUpOpenReport('rereport-while-open');

    const res = await postReport(reporter.accessToken, target.userId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_EXISTS');
  });

  it('refuses a third report while the re-report is itself still open', async () => {
    const { admin, reporter, target, reportId } = await setUpOpenReport('rereport-third');
    await closeReport(admin.accessToken, reportId, 'resolve');
    await postReport(reporter.accessToken, target.userId);

    const res = await postReport(reporter.accessToken, target.userId);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_EXISTS');
  });
});
