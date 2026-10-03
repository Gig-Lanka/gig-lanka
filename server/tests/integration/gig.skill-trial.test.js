import request from 'supertest';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';

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

const validSkillTrial = (overrides = {}) => ({
  requirement: 'optional',
  taskTitle: 'Write a short function',
  taskBrief: 'Write a short function that reverses a string, in any language you like.',
  submissionType: 'text',
  effortEstimate: 'under_30_minutes',
  ...overrides,
});

const skillTrialMissing = (field) => {
  const trial = validSkillTrial();
  delete trial[field];
  return trial;
};

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

const createGig = async (token, overrides = {}) =>
  request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

// Bypasses HTTP, same convention application.business-transitions.test.js uses -
// applicantCount is seeded directly so the reject flow (§11.5) has something to
// decrement, since there is no apply-and-drive-through-every-transition path here.
const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy, applicantCount: 1 });

const createApplicationDoc = async (gigId, applicantId, overrides = {}) =>
  Application.create({
    gig: gigId,
    applicant: applicantId,
    profileSnapshot: buildSnapshot(),
    ...overrides,
  });

describe('POST /api/gigs — skillTrial', () => {
  it('creates a gig with requirement "none" and stores nothing, not an empty object', async () => {
    const business = await registerBusiness('trial-create-none@example.com');

    const res = await createGig(business.accessToken);

    expect(res.status).toBe(201);
    expect(res.body.data.gig).not.toHaveProperty('skillTrial');

    const stored = await Gig.findById(res.body.data.gig.id).lean();
    expect(stored.skillTrial).toBeUndefined();
  });

  it('creates a gig with requirement "optional" and returns the full trial shape', async () => {
    const business = await registerBusiness('trial-create-optional@example.com');

    const res = await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    expect(res.status).toBe(201);
    expect(res.body.data.gig.skillTrial).toEqual(validSkillTrial());
  });

  it('rejects an unrecognised requirement value with 400', async () => {
    const business = await registerBusiness('trial-bad-requirement@example.com');

    const res = await createGig(business.accessToken, {
      // 'required' is the value the brief originally named and the product
      // later rejected - it must 400 like any other value outside the enum.
      skillTrial: validSkillTrial({ requirement: 'required' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.requirement' })]),
    );
  });

  it('rejects an unrecognised submissionType with 400', async () => {
    const business = await registerBusiness('trial-bad-submission@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ submissionType: 'carrier_pigeon' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.submissionType' })]),
    );
  });

  it('rejects an unrecognised effortEstimate with 400', async () => {
    const business = await registerBusiness('trial-bad-effort@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ effortEstimate: 'a_fortnight' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.effortEstimate' })]),
    );
  });

  it('rejects a fourth effortEstimate value even if it would fit under the two-hour ceiling', async () => {
    const business = await registerBusiness('trial-effort-ceiling@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ effortEstimate: '1_hour_30_minutes' }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects a missing taskTitle when requirement is optional', async () => {
    const business = await registerBusiness('trial-missing-title@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: skillTrialMissing('taskTitle'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.taskTitle' })]),
    );
  });

  it('rejects a taskTitle over 80 characters', async () => {
    const business = await registerBusiness('trial-long-title@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ taskTitle: 'x'.repeat(81) }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.taskTitle' })]),
    );
  });

  it('rejects a missing taskBrief when requirement is optional', async () => {
    const business = await registerBusiness('trial-missing-brief@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: skillTrialMissing('taskBrief'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.taskBrief' })]),
    );
  });

  it('rejects a taskBrief under 20 characters', async () => {
    const business = await registerBusiness('trial-short-brief@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ taskBrief: 'too short' }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.taskBrief' })]),
    );
  });

  it('rejects a taskBrief over 1000 characters', async () => {
    const business = await registerBusiness('trial-long-brief@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: validSkillTrial({ taskBrief: 'x'.repeat(1001) }),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.taskBrief' })]),
    );
  });

  it('rejects a missing submissionType when requirement is optional', async () => {
    const business = await registerBusiness('trial-missing-submission@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: skillTrialMissing('submissionType'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.submissionType' })]),
    );
  });

  it('rejects a missing effortEstimate when requirement is optional', async () => {
    const business = await registerBusiness('trial-missing-effort@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: skillTrialMissing('effortEstimate'),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrial.effortEstimate' })]),
    );
  });

  it('rejects taskTitle being set when requirement is "none"', async () => {
    const business = await registerBusiness('trial-none-with-title@example.com');

    const res = await createGig(business.accessToken, {
      skillTrial: { requirement: 'none', taskTitle: 'Should not be allowed' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects taskBrief, submissionType and effortEstimate being set when requirement is "none"', async () => {
    const business = await registerBusiness('trial-none-with-rest@example.com');
    const trial = validSkillTrial();

    const res = await createGig(business.accessToken, {
      skillTrial: {
        requirement: 'none',
        taskBrief: trial.taskBrief,
        submissionType: trial.submissionType,
        effortEstimate: trial.effortEstimate,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/gigs/:id — skillTrial and the applicants guard', () => {
  it('allows adding a trial when the gig has no applicants', async () => {
    const business = await registerBusiness('trial-put-add-ok@example.com');
    const created = await createGig(business.accessToken);

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: validSkillTrial() }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.skillTrial).toEqual(validSkillTrial());
  });

  it('allows changing an existing trial when the gig has no applicants', async () => {
    const business = await registerBusiness('trial-put-change-ok@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: validSkillTrial({ taskTitle: 'A different task' }) }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.skillTrial.taskTitle).toBe('A different task');
  });

  it('allows removing an existing trial when the gig has no applicants', async () => {
    const business = await registerBusiness('trial-put-remove-ok@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: { requirement: 'none' } }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig).not.toHaveProperty('skillTrial');
  });

  it('leaves an existing trial untouched when the update omits skillTrial entirely', async () => {
    const business = await registerBusiness('trial-put-omit-ok@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ title: 'Renamed, trial untouched' }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.title).toBe('Renamed, trial untouched');
    expect(res.body.data.gig.skillTrial).toEqual(validSkillTrial());
  });

  it('returns 409 GIG_HAS_APPLICANTS when adding a trial to a gig that has an application', async () => {
    const business = await registerBusiness('trial-put-add-409@example.com');
    const seeker = await registerSeeker('trial-put-add-409-seeker@example.com');
    const created = await createGig(business.accessToken);
    await createApplicationDoc(created.body.data.gig.id, seeker.userId);

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: validSkillTrial() }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_HAS_APPLICANTS');
  });

  it('returns 409 GIG_HAS_APPLICANTS when changing a trial on a gig that has an application', async () => {
    const business = await registerBusiness('trial-put-change-409@example.com');
    const seeker = await registerSeeker('trial-put-change-409-seeker@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });
    await createApplicationDoc(created.body.data.gig.id, seeker.userId);

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: validSkillTrial({ taskTitle: 'A different task' }) }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_HAS_APPLICANTS');

    const unchanged = await Gig.findById(created.body.data.gig.id);
    expect(unchanged.skillTrial.taskTitle).toBe(validSkillTrial().taskTitle);
  });

  it('returns 409 GIG_HAS_APPLICANTS when removing a trial from a gig that has an application', async () => {
    const business = await registerBusiness('trial-put-remove-409@example.com');
    const seeker = await registerSeeker('trial-put-remove-409-seeker@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });
    await createApplicationDoc(created.body.data.gig.id, seeker.userId);

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: { requirement: 'none' } }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_HAS_APPLICANTS');

    const stillHasTrial = await Gig.findById(created.body.data.gig.id);
    expect(stillHasTrial.skillTrial.requirement).toBe('optional');
  });

  it('still allows editing every other field once the gig has applicants', async () => {
    const business = await registerBusiness('trial-put-other-fields-ok@example.com');
    const seeker = await registerSeeker('trial-put-other-fields-seeker@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });
    await createApplicationDoc(created.body.data.gig.id, seeker.userId);

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ title: 'Updated title, trial untouched' }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.title).toBe('Updated title, trial untouched');
    expect(res.body.data.gig.skillTrial).toEqual(validSkillTrial());
  });

  // GL-342's technical note: keying this on applicantCount (which falls when
  // applicants withdraw) would let a business wait everyone out and then
  // change a trial whose terms someone already applied under. This proves
  // the guard is keyed on Application's existence instead.
  it('still refuses a trial change once every applicant has withdrawn', async () => {
    const business = await registerBusiness('trial-put-withdrawn-409@example.com');
    const seeker = await registerSeeker('trial-put-withdrawn-409-seeker@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });
    await createApplicationDoc(created.body.data.gig.id, seeker.userId, { status: 'withdrawn' });

    const res = await request(app)
      .put(`/api/gigs/${created.body.data.gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ skillTrial: { requirement: 'none' } }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_HAS_APPLICANTS');
  });
});

describe('Skill trial on gig read paths', () => {
  it('appears on GET /api/gigs/:id', async () => {
    const business = await registerBusiness('trial-read-detail@example.com');
    const created = await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    const res = await request(app).get(`/api/gigs/${created.body.data.gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.skillTrial).toEqual(validSkillTrial());
  });

  it('appears on GET /api/gigs', async () => {
    const business = await registerBusiness('trial-read-list@example.com');
    await createGig(business.accessToken, {
      title: 'Trial gig for the public list',
      skillTrial: validSkillTrial(),
    });

    const res = await request(app).get('/api/gigs').query({ q: 'Trial gig for the public list' });

    expect(res.status).toBe(200);
    expect(res.body.data.gigs).toHaveLength(1);
    expect(res.body.data.gigs[0].skillTrial).toEqual(validSkillTrial());
  });

  it('appears on GET /api/gigs/mine', async () => {
    const business = await registerBusiness('trial-read-mine@example.com');
    await createGig(business.accessToken, { skillTrial: validSkillTrial() });

    const res = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gigs).toHaveLength(1);
    expect(res.body.data.gigs[0].skillTrial).toEqual(validSkillTrial());
  });
});

// assertValidRejection (application.service.js) has guarded these two codes
// behind `gig?.skillTrial` since Sprint 1, predicting they would start
// working with no change once this field existed. Proven both directions
// here rather than assumed, per GL-344.
describe('PATCH /api/applications/:id/reject — the two trial rejection codes', () => {
  it.each(['skill_trial_not_passed', 'skill_trial_not_attempted'])(
    'accepts %s when the gig carries a skill trial',
    async (reasonCode) => {
      const business = await registerBusiness(`trial-reject-ok-${reasonCode}@example.com`);
      const seeker = await registerSeeker(`trial-reject-ok-seeker-${reasonCode}@example.com`);
      const gig = await createGigDoc(business.userId, { skillTrial: validSkillTrial() });
      const application = await createApplicationDoc(gig.id, seeker.userId);

      const res = await request(app)
        .patch(`/api/applications/${application.id}/reject`)
        .set('Authorization', `Bearer ${business.accessToken}`)
        .send({ reasonCode });

      expect(res.status).toBe(200);
      expect(res.body.data.application.status).toBe('rejected');
      expect(res.body.data.application.rejectionReasonCode).toBe(reasonCode);
    },
  );

  it.each(['skill_trial_not_passed', 'skill_trial_not_attempted'])(
    'still refuses %s with 400 when the gig carries no skill trial',
    async (reasonCode) => {
      const business = await registerBusiness(`trial-reject-bad-${reasonCode}@example.com`);
      const seeker = await registerSeeker(`trial-reject-bad-seeker-${reasonCode}@example.com`);
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
