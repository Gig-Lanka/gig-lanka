import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { Application } from '../../src/models/application.model.js';
import { Profile } from '../../src/models/profile.model.js';

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

const VALID_TEXT_RESPONSE = 'x'.repeat(40);

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

const postGigAsBusiness = async (business, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${business.accessToken}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const applyAsSeeker = async (seeker, gigId, body) =>
  request(app)
    .post(`/api/gigs/${gigId}/applications`)
    .set('Authorization', `Bearer ${seeker.accessToken}`)
    .send(body ?? {});

const reviewTrial = async (business, applicationId, body) =>
  request(app)
    .patch(`/api/applications/${applicationId}/trial-review`)
    .set('Authorization', `Bearer ${business.accessToken}`)
    .send(body ?? {});

describe('POST /api/gigs/:gigId/applications — skill trial submission, requirement "none"', () => {
  it('creates an application with no skillTrialSubmission when the gig carries no trial', async () => {
    const business = await registerBusiness('trial-apply-none-ok-business@example.com');
    const seeker = await registerSeeker('trial-apply-none-ok-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id);

    expect(res.status).toBe(201);
    expect(res.body.data.application).not.toHaveProperty('skillTrialSubmission');
  });

  it('refuses a submission sent to a gig with no trial, with a field-level 400', async () => {
    const business = await registerBusiness('trial-apply-none-refused-business@example.com');
    const seeker = await registerSeeker('trial-apply-none-refused-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'skillTrialSubmission' })]),
    );
  });
});

describe('POST /api/gigs/:gigId/applications — skill trial submission, requirement "optional"', () => {
  it('records result "skipped" when applying without a submission', async () => {
    const business = await registerBusiness('trial-apply-skip-business@example.com');
    const seeker = await registerSeeker('trial-apply-skip-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });

    const res = await applyAsSeeker(seeker, gig.id);

    expect(res.status).toBe(201);
    expect(res.body.data.application.skillTrialSubmission).toMatchObject({ result: 'skipped' });
  });

  it('records result "submitted" with submittedAt when applying with a valid submission', async () => {
    const business = await registerBusiness('trial-apply-submit-business@example.com');
    const seeker = await registerSeeker('trial-apply-submit-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });

    const res = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.application.skillTrialSubmission).toMatchObject({
      result: 'submitted',
      textResponse: VALID_TEXT_RESPONSE,
    });
    expect(res.body.data.application.skillTrialSubmission.submittedAt).toBeTruthy();
  });

  describe('content validation against submissionType', () => {
    it('requires textResponse and forbids fileUrl for "text"', async () => {
      const business = await registerBusiness('trial-type-text-business@example.com');
      const seeker = await registerSeeker('trial-type-text-seeker@example.com');
      const gig = await postGigAsBusiness(business, {
        skillTrial: validSkillTrial({ submissionType: 'text' }),
      });

      const missing = await applyAsSeeker(seeker, gig.id, { skillTrialSubmission: {} });
      expect(missing.status).toBe(400);
      expect(missing.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.textResponse' }),
        ]),
      );

      const tooShort = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: { textResponse: 'too short' },
      });
      expect(tooShort.status).toBe(400);
      expect(tooShort.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.textResponse' }),
        ]),
      );

      const tooLong = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: { textResponse: 'x'.repeat(2001) },
      });
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.textResponse' }),
        ]),
      );

      const fileForbidden = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: {
          textResponse: VALID_TEXT_RESPONSE,
          fileUrl: 'https://example.com/file.pdf',
        },
      });
      expect(fileForbidden.status).toBe(400);
      expect(fileForbidden.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.fileUrl' }),
        ]),
      );

      const valid = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
      });
      expect(valid.status).toBe(201);
    });

    it('requires fileUrl and forbids textResponse for "file"', async () => {
      const business = await registerBusiness('trial-type-file-business@example.com');
      const seeker = await registerSeeker('trial-type-file-seeker@example.com');
      const gig = await postGigAsBusiness(business, {
        skillTrial: validSkillTrial({ submissionType: 'file' }),
      });

      const missing = await applyAsSeeker(seeker, gig.id, { skillTrialSubmission: {} });
      expect(missing.status).toBe(400);
      expect(missing.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.fileUrl' }),
        ]),
      );

      const textForbidden = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: {
          fileUrl: 'https://example.com/file.pdf',
          textResponse: VALID_TEXT_RESPONSE,
        },
      });
      expect(textForbidden.status).toBe(400);
      expect(textForbidden.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.textResponse' }),
        ]),
      );

      const valid = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: { fileUrl: 'https://example.com/file.pdf' },
      });
      expect(valid.status).toBe(201);
    });

    it('requires both textResponse and fileUrl for "text_and_file"', async () => {
      const business = await registerBusiness('trial-type-both-business@example.com');
      const seeker = await registerSeeker('trial-type-both-seeker@example.com');
      const gig = await postGigAsBusiness(business, {
        skillTrial: validSkillTrial({ submissionType: 'text_and_file' }),
      });

      const missingBoth = await applyAsSeeker(seeker, gig.id, { skillTrialSubmission: {} });
      expect(missingBoth.status).toBe(400);
      expect(missingBoth.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.textResponse' }),
          expect.objectContaining({ field: 'skillTrialSubmission.fileUrl' }),
        ]),
      );

      const missingFile = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
      });
      expect(missingFile.status).toBe(400);
      expect(missingFile.body.error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'skillTrialSubmission.fileUrl' }),
        ]),
      );

      const valid = await applyAsSeeker(seeker, gig.id, {
        skillTrialSubmission: {
          textResponse: VALID_TEXT_RESPONSE,
          fileUrl: 'https://example.com/file.pdf',
        },
      });
      expect(valid.status).toBe(201);
    });
  });

  it('refuses a second submission on the same application with 409 TRIAL_ALREADY_SUBMITTED', async () => {
    const business = await registerBusiness('trial-double-submit-business@example.com');
    const seeker = await registerSeeker('trial-double-submit-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });

    const first = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });
    expect(first.status).toBe(201);

    const second = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('TRIAL_ALREADY_SUBMITTED');
  });

  it('refuses a second application with 409 TRIAL_ALREADY_SUBMITTED even after skipping the first time', async () => {
    const business = await registerBusiness('trial-double-skip-business@example.com');
    const seeker = await registerSeeker('trial-double-skip-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });

    const first = await applyAsSeeker(seeker, gig.id);
    expect(first.status).toBe(201);

    const second = await applyAsSeeker(seeker, gig.id);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('TRIAL_ALREADY_SUBMITTED');
  });
});

describe('PATCH /api/applications/:id/trial-review', () => {
  const setupSubmittedApplication = async (suffix) => {
    const business = await registerBusiness(`trial-review-${suffix}-business@example.com`);
    const seeker = await registerSeeker(`trial-review-${suffix}-seeker@example.com`);
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    return { business, seeker, gig, applicationId: applied.body.data.application.id };
  };

  it('rejects a guest with 401', async () => {
    const { applicationId } = await setupSubmittedApplication('guest');

    const res = await request(app)
      .patch(`/api/applications/${applicationId}/trial-review`)
      .send({ result: 'passed' });

    expect(res.status).toBe(401);
  });

  it('rejects a seeker token with 403', async () => {
    const { seeker, applicationId } = await setupSubmittedApplication('seeker-caller');

    const res = await reviewTrial(seeker, applicationId, { result: 'passed' });

    expect(res.status).toBe(403);
  });

  it('rejects a business that did not post the gig with 403', async () => {
    const { applicationId } = await setupSubmittedApplication('other-business');
    const otherBusiness = await registerBusiness('trial-review-other-business@example.com');

    const res = await reviewTrial(otherBusiness, applicationId, { result: 'passed' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for an application that does not exist', async () => {
    const business = await registerBusiness('trial-review-missing-business@example.com');

    const res = await reviewTrial(business, new mongoose.Types.ObjectId().toString(), {
      result: 'passed',
    });

    expect(res.status).toBe(404);
  });

  it('rejects a missing or unrecognised result with 400', async () => {
    const { business, applicationId } = await setupSubmittedApplication('bad-result');

    const missing = await reviewTrial(business, applicationId, {});
    expect(missing.status).toBe(400);
    expect(missing.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'result' })]),
    );

    const unrecognised = await reviewTrial(business, applicationId, { result: 'maybe' });
    expect(unrecognised.status).toBe(400);
  });

  it('rejects a resultNote over 300 characters with 400', async () => {
    const { business, applicationId } = await setupSubmittedApplication('long-note');

    const res = await reviewTrial(business, applicationId, {
      result: 'passed',
      resultNote: 'x'.repeat(301),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'resultNote' })]),
    );
  });

  it('marks a trial passed, storing resultNote verbatim and stamping reviewedAt', async () => {
    const { business, applicationId } = await setupSubmittedApplication('pass');

    const res = await reviewTrial(business, applicationId, {
      result: 'passed',
      resultNote: '  Great work, confirmed the edge cases.  ',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.application.skillTrialSubmission).toMatchObject({
      result: 'passed',
      resultNote: '  Great work, confirmed the edge cases.  ',
    });
    expect(res.body.data.application.skillTrialSubmission.reviewedAt).toBeTruthy();
  });

  it('marks a trial not_passed', async () => {
    const { business, applicationId } = await setupSubmittedApplication('fail');

    const res = await reviewTrial(business, applicationId, { result: 'not_passed' });

    expect(res.status).toBe(200);
    expect(res.body.data.application.skillTrialSubmission.result).toBe('not_passed');
  });

  it('refuses a second review with 409 TRIAL_ALREADY_REVIEWED, including passed-then-passed', async () => {
    const { business, applicationId } = await setupSubmittedApplication('twice');

    const first = await reviewTrial(business, applicationId, { result: 'passed' });
    expect(first.status).toBe(200);

    const second = await reviewTrial(business, applicationId, { result: 'passed' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('TRIAL_ALREADY_REVIEWED');

    const thirdOppositeDirection = await reviewTrial(business, applicationId, {
      result: 'not_passed',
    });
    expect(thirdOppositeDirection.status).toBe(409);
    expect(thirdOppositeDirection.body.error.code).toBe('TRIAL_ALREADY_REVIEWED');
  });

  it('refuses reviewing a trial that was skipped, with 409 TRIAL_ALREADY_REVIEWED', async () => {
    const business = await registerBusiness('trial-review-skipped-business@example.com');
    const seeker = await registerSeeker('trial-review-skipped-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    const applied = await applyAsSeeker(seeker, gig.id);

    const res = await reviewTrial(business, applied.body.data.application.id, {
      result: 'passed',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIAL_ALREADY_REVIEWED');
  });

  it('refuses reviewing an application whose gig carries no trial, with 409 TRIAL_ALREADY_REVIEWED', async () => {
    const business = await registerBusiness('trial-review-none-business@example.com');
    const seeker = await registerSeeker('trial-review-none-seeker@example.com');
    const gig = await postGigAsBusiness(business);
    const applied = await applyAsSeeker(seeker, gig.id);

    const res = await reviewTrial(business, applied.body.data.application.id, {
      result: 'passed',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIAL_ALREADY_REVIEWED');
  });
});

describe('Skill trial profile write (GL-353)', () => {
  it('writes a skillTrialResults entry carrying the gig category on a pass', async () => {
    const business = await registerBusiness('trial-profile-pass-business@example.com');
    const seeker = await registerSeeker('trial-profile-pass-seeker@example.com');
    const gig = await postGigAsBusiness(business, {
      category: 'tutoring',
      skillTrial: validSkillTrial(),
    });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    await reviewTrial(business, applied.body.data.application.id, { result: 'passed' });

    const profile = await Profile.findOne({ user: seeker.userId }).lean();
    expect(profile.skillTrialResults).toHaveLength(1);
    expect(profile.skillTrialResults[0]).toMatchObject({ skill: 'tutoring', passed: true });
    expect(profile.skillTrialResults[0].completedAt).toBeTruthy();
  });

  it('writes nothing to the profile on a not_passed result', async () => {
    const business = await registerBusiness('trial-profile-fail-business@example.com');
    const seeker = await registerSeeker('trial-profile-fail-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });

    await reviewTrial(business, applied.body.data.application.id, { result: 'not_passed' });

    const profile = await Profile.findOne({ user: seeker.userId }).lean();
    expect(profile?.skillTrialResults ?? []).toHaveLength(0);
  });

  it('writes nothing to the profile when the trial was skipped', async () => {
    const business = await registerBusiness('trial-profile-skip-business@example.com');
    const seeker = await registerSeeker('trial-profile-skip-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    await applyAsSeeker(seeker, gig.id);

    const profile = await Profile.findOne({ user: seeker.userId }).lean();
    expect(profile?.skillTrialResults ?? []).toHaveLength(0);
  });
});

describe('Skill trial submission visibility', () => {
  const setupReviewedApplication = async (suffix) => {
    const business = await registerBusiness(`trial-visibility-${suffix}-business@example.com`);
    const seeker = await registerSeeker(`trial-visibility-${suffix}-seeker@example.com`);
    const gig = await postGigAsBusiness(business, {
      category: 'tutoring',
      skillTrial: validSkillTrial(),
    });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });
    const applicationId = applied.body.data.application.id;

    await reviewTrial(business, applicationId, { result: 'passed', resultNote: 'Nicely done.' });

    return { business, seeker, gig, applicationId };
  };

  it('is visible to the applicant on GET /api/applications/:id', async () => {
    const { seeker, applicationId } = await setupReviewedApplication('applicant');

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.skillTrialSubmission).toMatchObject({
      result: 'passed',
      resultNote: 'Nicely done.',
    });
  });

  it('is visible to the business that posted the gig on GET /api/applications/:id', async () => {
    const { business, applicationId } = await setupReviewedApplication('business');

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.skillTrialSubmission.result).toBe('passed');
  });

  it('is never visible to a third party on GET /api/applications/:id', async () => {
    const { applicationId } = await setupReviewedApplication('third-party');
    const thirdParty = await registerSeeker('trial-visibility-third-party-viewer@example.com');

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${thirdParty.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('publishes only {skill, passed, completedAt} on the public profile, never the submission body or note', async () => {
    const { seeker } = await setupReviewedApplication('public-profile');
    const viewer = await registerBusiness('trial-visibility-public-viewer@example.com');

    const res = await request(app)
      .get(`/api/profiles/${seeker.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.skillTrialResults).toEqual([
      expect.objectContaining({ skill: 'tutoring', passed: true }),
    ]);
    const badge = res.body.data.profile.skillTrialResults[0];
    expect(badge).not.toHaveProperty('resultNote');
    expect(badge).not.toHaveProperty('textResponse');
    expect(badge).not.toHaveProperty('fileUrl');
  });

  it('never publishes a not_passed or skipped trial on the public profile', async () => {
    const business = await registerBusiness('trial-visibility-not-passed-business@example.com');
    const seeker = await registerSeeker('trial-visibility-not-passed-seeker@example.com');
    const viewer = await registerBusiness('trial-visibility-not-passed-viewer@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });
    await reviewTrial(business, applied.body.data.application.id, { result: 'not_passed' });

    const res = await request(app)
      .get(`/api/profiles/${seeker.userId}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.skillTrialResults).toEqual([]);
  });
});

describe('Skill trial submission and reject-reason interaction', () => {
  it('leaves skillTrialSubmission untouched by a status transition (reject)', async () => {
    const business = await registerBusiness('trial-reject-interaction-business@example.com');
    const seeker = await registerSeeker('trial-reject-interaction-seeker@example.com');
    const gig = await postGigAsBusiness(business, { skillTrial: validSkillTrial() });
    const applied = await applyAsSeeker(seeker, gig.id, {
      skillTrialSubmission: { textResponse: VALID_TEXT_RESPONSE },
    });
    const applicationId = applied.body.data.application.id;

    await reviewTrial(business, applicationId, { result: 'not_passed' });

    const rejectRes = await request(app)
      .patch(`/api/applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'skill_trial_not_passed' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.application.status).toBe('rejected');

    const reloaded = await Application.findById(applicationId);
    expect(reloaded.skillTrialSubmission.result).toBe('not_passed');
  });
});
