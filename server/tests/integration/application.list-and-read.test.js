import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';

const validPassword = 'Password123!';

const validGigPayload = (overrides = {}) => ({
  title: 'Weekend cafe shift',
  description: 'Help run the counter and serve customers during weekend shifts.',
  category: 'hospitality',
  payAmount: 1000,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 1,
  ...overrides,
});

const buildSnapshot = (overrides = {}) => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
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

const validSkillTrial = (overrides = {}) => ({
  requirement: 'optional',
  taskTitle: 'Plan a stock check',
  taskBrief: 'Describe how you would run a stock check before opening the counter.',
  submissionType: 'text',
  effortEstimate: 'under_30_minutes',
  ...overrides,
});

const GIG_SUMMARY_KEYS = ['city', 'id', 'payAmount', 'payType', 'status', 'title'];

const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('GET /api/applications/mine', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/applications/mine');
    expect(res.status).toBe(401);
  });

  it('rejects a business token with 403', async () => {
    const business = await registerBusiness('mine-business-caller@example.com');

    const res = await request(app)
      .get('/api/applications/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns an empty list for a seeker with no applications', async () => {
    const seeker = await registerSeeker('mine-empty-seeker@example.com');

    const res = await request(app)
      .get('/api/applications/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toEqual([]);
  });

  it('returns the applications, newest first, each with a gig summary', async () => {
    const business = await registerBusiness('mine-order-business@example.com');
    const seeker = await registerSeeker('mine-order-seeker@example.com');
    const gigA = await createGigDoc(business.userId, { title: 'First gig' });
    const gigB = await createGigDoc(business.userId, { title: 'Second gig' });
    await createApplicationDoc(gigA.id, seeker.userId);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await createApplicationDoc(gigB.id, seeker.userId);

    const res = await request(app)
      .get('/api/applications/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(2);
    expect(res.body.data.applications[0].gig.title).toBe('Second gig');
    expect(res.body.data.applications[1].gig.title).toBe('First gig');
    expect(res.body.data.applications[0].gig.id).toBe(gigB.id);
  });

  it('never returns another seeker’s application', async () => {
    const business = await registerBusiness('mine-privacy-business@example.com');
    const seekerA = await registerSeeker('mine-privacy-seeker-a@example.com');
    const seekerB = await registerSeeker('mine-privacy-seeker-b@example.com');
    const gig = await createGigDoc(business.userId);
    await createApplicationDoc(gig.id, seekerA.userId);
    await createApplicationDoc(gig.id, seekerB.userId);

    const res = await request(app)
      .get('/api/applications/mine')
      .set('Authorization', `Bearer ${seekerB.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.applications[0].applicant).toBe(seekerB.userId);
  });

  it('leaves the gig summary at six fields even for a gig with a skill trial', async () => {
    const business = await registerBusiness('mine-trial-summary-business@example.com');
    const seeker = await registerSeeker('mine-trial-summary-seeker@example.com');
    const gig = await createGigDoc(business.userId, { skillTrial: validSkillTrial() });
    await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get('/api/applications/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.applications[0].gig).sort()).toEqual(GIG_SUMMARY_KEYS);
  });
});

describe('GET /api/applications/for-my-gigs', () => {
  it('leaves the gig summary at six fields even for a gig with a skill trial', async () => {
    const business = await registerBusiness('formygigs-trial-summary-business@example.com');
    const seeker = await registerSeeker('formygigs-trial-summary-seeker@example.com');
    const gig = await createGigDoc(business.userId, { skillTrial: validSkillTrial() });
    await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get('/api/applications/for-my-gigs')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.applications).toHaveLength(1);
    expect(Object.keys(res.body.data.applications[0].gig).sort()).toEqual(GIG_SUMMARY_KEYS);
  });
});

describe('GET /api/applications/:id', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get(`/api/applications/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for an application that does not exist', async () => {
    const seeker = await registerSeeker('read-missing-seeker@example.com');

    const res = await request(app)
      .get(`/api/applications/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed id, distinct from a wrong-party 403', async () => {
    const seeker = await registerSeeker('read-malformed-seeker@example.com');

    const res = await request(app)
      .get('/api/applications/not-a-valid-id')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for a seeker who is not the applicant', async () => {
    const business = await registerBusiness('read-stranger-business@example.com');
    const owner = await registerSeeker('read-stranger-owner@example.com');
    const stranger = await registerSeeker('read-stranger-stranger@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, owner.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for a business that did not post the gig', async () => {
    const owner = await registerBusiness('read-other-business-owner@example.com');
    const otherBusiness = await registerBusiness('read-other-business-other@example.com');
    const seeker = await registerSeeker('read-other-business-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${otherBusiness.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns the application to the seeker who owns it, with a gig summary', async () => {
    const business = await registerBusiness('read-applicant-business@example.com');
    const seeker = await registerSeeker('read-applicant-seeker@example.com');
    const gig = await createGigDoc(business.userId, { title: 'Owned by applicant test' });
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.id).toBe(application.id);
    expect(res.body.data.application.gig.title).toBe('Owned by applicant test');
  });

  it('returns the application to the business that posted the gig', async () => {
    const business = await registerBusiness('read-business-party-business@example.com');
    const seeker = await registerSeeker('read-business-party-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.id).toBe(application.id);
  });

  it('names the skill trial on the gig summary when the gig has one', async () => {
    const business = await registerBusiness('read-trial-gig-business@example.com');
    const seeker = await registerSeeker('read-trial-gig-seeker@example.com');
    const gig = await createGigDoc(business.userId, {
      skillTrial: validSkillTrial({ submissionType: 'text_and_file' }),
    });
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.gig.skillTrial).toEqual({
      title: 'Plan a stock check',
      submissionType: 'text_and_file',
    });
    expect(Object.keys(res.body.data.application.gig).sort()).toEqual(
      [...GIG_SUMMARY_KEYS, 'skillTrial'].sort(),
    );
  });

  it('omits skillTrial from the gig summary when the gig has no trial', async () => {
    const business = await registerBusiness('read-no-trial-gig-business@example.com');
    const seeker = await registerSeeker('read-no-trial-gig-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.gig).not.toHaveProperty('skillTrial');
    expect(Object.keys(res.body.data.application.gig).sort()).toEqual(GIG_SUMMARY_KEYS);
  });

  it('keeps gig null, with no trial to read, when the gig has been deleted', async () => {
    const business = await registerBusiness('read-deleted-trial-gig-business@example.com');
    const seeker = await registerSeeker('read-deleted-trial-gig-seeker@example.com');
    const gig = await createGigDoc(business.userId, { skillTrial: validSkillTrial() });
    const application = await createApplicationDoc(gig.id, seeker.userId);
    await Gig.deleteOne({ _id: gig.id });

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.gig).toBeNull();
  });

  it('shows the rejection reason and note verbatim once decided', async () => {
    const business = await registerBusiness('read-rejected-business@example.com');
    const seeker = await registerSeeker('read-rejected-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'rejected',
      rejectionReasonCode: 'schedule_mismatch',
      rejectionNote: 'The schedule did not match what we needed.',
      decidedAt: new Date(),
    });

    const res = await request(app)
      .get(`/api/applications/${application.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('rejected');
    expect(res.body.data.application.rejectionReasonCode).toBe('schedule_mismatch');
    expect(res.body.data.application.rejectionNote).toBe(
      'The schedule did not match what we needed.',
    );
  });
});
