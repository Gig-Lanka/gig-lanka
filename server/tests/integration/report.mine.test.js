import request from 'supertest';
import app from '../../src/app.js';

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

const postReport = async (accessToken, body) =>
  request(app).post('/api/reports').set('Authorization', `Bearer ${accessToken}`).send(body);

describe('GET /api/reports/mine', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/reports/mine');

    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty list for a caller who has filed no reports', async () => {
    const seeker = await registerSeeker('mine-empty-seeker@example.com');

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toEqual([]);
  });

  it("returns only the caller's own reports, each carrying its reason code, note and target summary", async () => {
    const reporter = await registerSeeker('mine-reporter@example.com');
    const target = await registerSeeker('mine-target@example.com');

    await postReport(reporter.accessToken, {
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'harassment_or_abuse',
      note: 'Sent repeated abusive messages after I declined the gig.',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0]).toMatchObject({
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'harassment_or_abuse',
      note: 'Sent repeated abusive messages after I declined the gig.',
      status: 'open',
    });
    expect(res.body.data.reports[0].target).toMatchObject({ id: target.userId });
    expect(res.body.data.reports[0].createdAt).toBeDefined();
  });

  it('attaches a gig summary when the target is a gig', async () => {
    const business = await registerBusiness('mine-gig-business@example.com');
    const reporter = await registerSeeker('mine-gig-reporter@example.com');
    const gig = await createGig(business.accessToken);

    await postReport(reporter.accessToken, {
      targetType: 'gig',
      targetId: gig.id,
      reasonCode: 'misleading_gig_details',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0].target).toMatchObject({
      id: gig.id,
      title: gig.title,
      city: gig.city,
      status: gig.status,
    });
  });

  it("does not return another reporter's report of the same target, and carries no count of other reports", async () => {
    const reporterOne = await registerSeeker('mine-other-reporter-one@example.com');
    const reporterTwo = await registerSeeker('mine-other-reporter-two@example.com');
    const target = await registerSeeker('mine-other-target@example.com');

    await postReport(reporterOne.accessToken, {
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'spam_or_scam',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${reporterTwo.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toEqual([]);
  });

  it("never carries anything about who else reported the same target", async () => {
    const reporterOne = await registerSeeker('mine-no-leak-reporter-one@example.com');
    const reporterTwo = await registerSeeker('mine-no-leak-reporter-two@example.com');
    const target = await registerSeeker('mine-no-leak-target@example.com');

    await postReport(reporterOne.accessToken, {
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'spam_or_scam',
    });
    await postReport(reporterTwo.accessToken, {
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'other',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${reporterOne.accessToken}`);

    expect(res.body.data.reports).toHaveLength(1);
    const [report] = res.body.data.reports;
    expect(report).not.toHaveProperty('reportCount');
    expect(report).not.toHaveProperty('otherReports');
    expect(report).not.toHaveProperty('totalReports');
    expect(Object.keys(report.target ?? {})).not.toContain('reportCount');
  });

  it('is not reachable by a crafted request for another user id — no such parameter exists', async () => {
    const reporter = await registerSeeker('mine-no-param-reporter@example.com');
    const target = await registerSeeker('mine-no-param-target@example.com');

    await postReport(reporter.accessToken, {
      targetType: 'user',
      targetId: target.userId,
      reasonCode: 'spam_or_scam',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .query({ reporter: target.userId, userId: target.userId })
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reports).toHaveLength(1);
    expect(res.body.data.reports[0].reporter).toBe(reporter.userId);
  });

  it('returns newest first', async () => {
    const reporter = await registerSeeker('mine-order-reporter@example.com');
    const targetOne = await registerSeeker('mine-order-target-one@example.com');
    const targetTwo = await registerSeeker('mine-order-target-two@example.com');

    await postReport(reporter.accessToken, {
      targetType: 'user',
      targetId: targetOne.userId,
      reasonCode: 'spam_or_scam',
    });
    await postReport(reporter.accessToken, {
      targetType: 'user',
      targetId: targetTwo.userId,
      reasonCode: 'other',
    });

    const res = await request(app)
      .get('/api/reports/mine')
      .set('Authorization', `Bearer ${reporter.accessToken}`);

    expect(res.body.data.reports).toHaveLength(2);
    expect(res.body.data.reports[0].targetId).toBe(targetTwo.userId);
    expect(res.body.data.reports[1].targetId).toBe(targetOne.userId);
  });
});
