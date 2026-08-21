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

// One live application per gig is seeded directly in every test below, so
// applicantCount starts at 1 — the same convention application.withdraw.test.js
// and application.complete.test.js use, since there is no apply-and-then-drive
// -through-every-transition path available here.
const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy, applicantCount: 1 });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('PATCH /api/applications/:id/view', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch(`/api/applications/${new mongoose.Types.ObjectId()}/view`);
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403, including the applicant themselves', async () => {
    const business = await registerBusiness('view-seeker-business@example.com');
    const seeker = await registerSeeker('view-seeker-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/view`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('view-wrong-owner@example.com');
    const other = await registerBusiness('view-wrong-other@example.com');
    const seeker = await registerSeeker('view-wrong-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/view`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(403);

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('applied');
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('view-missing-business@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/view`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('moves an applied application to viewed and leaves the applicant count untouched', async () => {
    const business = await registerBusiness('view-ok-business@example.com');
    const seeker = await registerSeeker('view-ok-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/view`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('viewed');
    expect(res.body.data.application.viewedAt).not.toBeNull();

    const updatedGig = await Gig.findById(gig.id);
    expect(updatedGig.applicantCount).toBe(1);
  });

  it('returns 409 for an application that is not applied', async () => {
    const business = await registerBusiness('view-409-business@example.com');
    const seeker = await registerSeeker('view-409-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'shortlisted',
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/view`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
    expect(res.body.error.message).toContain('shortlisted');
    expect(res.body.error.message).toContain('viewed');
  });
});

describe('PATCH /api/applications/:id/shortlist', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch(
      `/api/applications/${new mongoose.Types.ObjectId()}/shortlist`,
    );
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const business = await registerBusiness('shortlist-seeker-business@example.com');
    const seeker = await registerSeeker('shortlist-seeker-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, { status: 'viewed' });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/shortlist`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('shortlist-wrong-owner@example.com');
    const other = await registerBusiness('shortlist-wrong-other@example.com');
    const seeker = await registerSeeker('shortlist-wrong-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, { status: 'viewed' });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/shortlist`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('shortlist-missing-business@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/shortlist`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('moves a viewed application to shortlisted and leaves the applicant count untouched', async () => {
    const business = await registerBusiness('shortlist-ok-business@example.com');
    const seeker = await registerSeeker('shortlist-ok-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'viewed',
      viewedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/shortlist`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('shortlisted');

    const updatedGig = await Gig.findById(gig.id);
    expect(updatedGig.applicantCount).toBe(1);
  });

  it('returns 409 for an application that has not been viewed yet', async () => {
    const business = await registerBusiness('shortlist-409-business@example.com');
    const seeker = await registerSeeker('shortlist-409-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/shortlist`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
  });
});

describe('PATCH /api/applications/:id/hire', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch(`/api/applications/${new mongoose.Types.ObjectId()}/hire`);
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const business = await registerBusiness('hire-seeker-business@example.com');
    const seeker = await registerSeeker('hire-seeker-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'shortlisted',
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/hire`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('hire-wrong-owner@example.com');
    const other = await registerBusiness('hire-wrong-other@example.com');
    const seeker = await registerSeeker('hire-wrong-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'shortlisted',
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/hire`)
      .set('Authorization', `Bearer ${other.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('hire-missing-business@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/hire`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('moves a shortlisted application to hired, stamps decidedAt, leaves the count untouched', async () => {
    const business = await registerBusiness('hire-ok-business@example.com');
    const seeker = await registerSeeker('hire-ok-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId, {
      status: 'shortlisted',
    });

    const res = await request(app)
      .patch(`/api/applications/${application.id}/hire`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe('hired');
    expect(res.body.data.application.decidedAt).not.toBeNull();

    const updatedGig = await Gig.findById(gig.id);
    expect(updatedGig.applicantCount).toBe(1);
  });

  it.each(['applied', 'viewed'])(
    'returns 409 for a %s application — hiring requires shortlisting first',
    async (status) => {
      const business = await registerBusiness(`hire-409-${status}-business@example.com`);
      const seeker = await registerSeeker(`hire-409-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, { status });

      const res = await request(app)
        .patch(`/api/applications/${application.id}/hire`)
        .set('Authorization', `Bearer ${business.accessToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');

      const reloaded = await Application.findById(application.id);
      expect(reloaded.status).toBe(status);
    },
  );
});

describe('PATCH /api/applications/:id/reject', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/reject`)
      .send({ reasonCode: 'schedule_mismatch' });
    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403, including the applicant themselves', async () => {
    const business = await registerBusiness('reject-seeker-business@example.com');
    const seeker = await registerSeeker('reject-seeker-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch' });

    expect(res.status).toBe(403);

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('applied');
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const owner = await registerBusiness('reject-wrong-owner@example.com');
    const other = await registerBusiness('reject-wrong-other@example.com');
    const seeker = await registerSeeker('reject-wrong-seeker@example.com');
    const gig = await createGigDoc(owner.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('reject-missing-business@example.com');

    const res = await request(app)
      .patch(`/api/applications/${new mongoose.Types.ObjectId()}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch' });

    expect(res.status).toBe(404);
  });

  it.each(['applied', 'viewed', 'shortlisted'])(
    'rejects a %s application, decrements the applicant count, stores the reason verbatim',
    async (status) => {
      const business = await registerBusiness(`reject-ok-${status}-business@example.com`);
      const seeker = await registerSeeker(`reject-ok-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, { status });
      const note = '  We needed someone for Tuesday mornings, not weekends.  ';

      const res = await request(app)
        .patch(`/api/applications/${application.id}/reject`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ reasonCode: 'schedule_mismatch', note });

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe('rejected');
      expect(res.body.data.application.rejectionReasonCode).toBe('schedule_mismatch');
      expect(res.body.data.application.rejectionNote).toBe(note);
      expect(res.body.data.application.decidedAt).not.toBeNull();

      const updatedGig = await Gig.findById(gig.id);
      expect(updatedGig.applicantCount).toBe(0);
    },
  );

  it('accepts a rejection with no note at all', async () => {
    const business = await registerBusiness('reject-nonote-business@example.com');
    const seeker = await registerSeeker('reject-nonote-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch' });

    expect(res.status).toBe(200);
    expect(res.body.data.application.rejectionReasonCode).toBe('schedule_mismatch');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.rejectionNote).toBeUndefined();
  });

  it.each(['hired', 'rejected', 'withdrawn', 'closed_filled'])(
    'returns 409 for a %s application',
    async (status) => {
      const business = await registerBusiness(`reject-409-${status}-business@example.com`);
      const seeker = await registerSeeker(`reject-409-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId, {
        status,
        decidedAt: new Date(),
      });

      const res = await request(app)
        .patch(`/api/applications/${application.id}/reject`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ reasonCode: 'schedule_mismatch' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
    },
  );

  it('returns 400 VALIDATION_ERROR when reasonCode is missing', async () => {
    const business = await registerBusiness('reject-missingcode-business@example.com');
    const seeker = await registerSeeker('reject-missingcode-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors[0].field).toBe('reasonCode');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('applied');
  });

  it('returns 400 VALIDATION_ERROR for positions_filled — a business cannot select the system-only code', async () => {
    const business = await registerBusiness('reject-positionsfilled-business@example.com');
    const seeker = await registerSeeker('reject-positionsfilled-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'positions_filled' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const reloaded = await Application.findById(application.id);
    expect(reloaded.status).toBe('applied');
  });

  it('returns 400 VALIDATION_ERROR for a reasonCode outside the eight values', async () => {
    const business = await registerBusiness('reject-unknowncode-business@example.com');
    const seeker = await registerSeeker('reject-unknowncode-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    const application = await createApplicationDoc(gig.id, seeker.userId);

    const res = await request(app)
      .patch(`/api/applications/${application.id}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'not_a_real_code' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each(['skill_trial_not_passed', 'skill_trial_not_attempted'])(
    'returns 400 VALIDATION_ERROR for %s — the gig carries no skill trial this sprint',
    async (reasonCode) => {
      const business = await registerBusiness(`reject-trial-${reasonCode}-business@example.com`);
      const seeker = await registerSeeker(`reject-trial-${reasonCode}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      const application = await createApplicationDoc(gig.id, seeker.userId);

      const res = await request(app)
        .patch(`/api/applications/${application.id}/reject`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ reasonCode });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const reloaded = await Application.findById(application.id);
      expect(reloaded.status).toBe('applied');
    },
  );
});
