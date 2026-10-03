import request from 'supertest';
import app from '../../src/app.js';

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

// Same origin tests/setup.js points `SUPABASE_URL` at - the shape
// storage.service.js would actually hand back from POST /api/uploads into
// the `resumes` folder (§9.1). A plain string is enough here: GL-362's
// isStorageUrl only ever compares origins, it never fetches the URL.
const OWN_STORAGE_RESUME_URL =
  'https://test.supabase.co/storage/v1/object/public/test-bucket/resumes/sample.pdf';
const OFF_PLATFORM_RESUME_URL = 'https://evil-storage.example.com/resumes/sample.pdf';

describe('POST /api/gigs/:gigId/applications — resumeUrl (GL-362)', () => {
  it('stores resumeUrl when applying with one from the platform’s own storage', async () => {
    const business = await registerBusiness('resume-apply-with-business@example.com');
    const seeker = await registerSeeker('resume-apply-with-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id, { resumeUrl: OWN_STORAGE_RESUME_URL });

    expect(res.status).toBe(201);
    expect(res.body.data.application.resumeUrl).toBe(OWN_STORAGE_RESUME_URL);
  });

  it('stores nothing - not even an empty string - when applying without one', async () => {
    const business = await registerBusiness('resume-apply-without-business@example.com');
    const seeker = await registerSeeker('resume-apply-without-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id);

    expect(res.status).toBe(201);
    expect(res.body.data.application).not.toHaveProperty('resumeUrl');
  });

  it('refuses an off-platform URL with 400, naming the resumeUrl field', async () => {
    const business = await registerBusiness('resume-off-platform-business@example.com');
    const seeker = await registerSeeker('resume-off-platform-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id, { resumeUrl: OFF_PLATFORM_RESUME_URL });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'resumeUrl' })]),
    );

    const gigDoc = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(gigDoc.body.data.gig.applicantCount).toBe(0);
  });

  it('refuses a malformed resumeUrl with 400, the same as an off-platform one', async () => {
    const business = await registerBusiness('resume-malformed-business@example.com');
    const seeker = await registerSeeker('resume-malformed-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id, { resumeUrl: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'resumeUrl' })]),
    );
  });

  it('leaves profileIncomplete unaffected by a resume being attached', async () => {
    const business = await registerBusiness('resume-incomplete-with-business@example.com');
    const seeker = await registerSeeker('resume-incomplete-with-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id, { resumeUrl: OWN_STORAGE_RESUME_URL });

    expect(res.status).toBe(201);
    // No experience/education was ever set for this seeker, so this should
    // read true whether or not a resume came along with it (GL-300 §15
    // rule 3 - the profile is the resume, never the other way round).
    expect(res.body.data.profileIncomplete).toBe(true);
  });

  it('leaves profileIncomplete unaffected by no resume being attached', async () => {
    const business = await registerBusiness('resume-incomplete-without-business@example.com');
    const seeker = await registerSeeker('resume-incomplete-without-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await applyAsSeeker(seeker, gig.id);

    expect(res.status).toBe(201);
    expect(res.body.data.profileIncomplete).toBe(true);
  });
});

// The guarantee that a later change cannot quietly turn an optional extra
// into a soft requirement: a resume must reach exactly the applicant and the
// gig's own business, and nobody else - never a different business, never a
// guest. Mirrors the shape of the skill trial submission's own visibility
// block in application.skill-trial.test.js.
describe('resumeUrl visibility on GET /api/applications/:id', () => {
  const setupApplicationWithResume = async (suffix) => {
    const business = await registerBusiness(`resume-visibility-${suffix}-business@example.com`);
    const seeker = await registerSeeker(`resume-visibility-${suffix}-seeker@example.com`);
    const gig = await postGigAsBusiness(business);
    const applied = await applyAsSeeker(seeker, gig.id, { resumeUrl: OWN_STORAGE_RESUME_URL });

    return { business, seeker, gig, applicationId: applied.body.data.application.id };
  };

  it('is visible to the applicant', async () => {
    const { seeker, applicationId } = await setupApplicationWithResume('applicant');

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.resumeUrl).toBe(OWN_STORAGE_RESUME_URL);
  });

  it('is visible to the business that posted the gig', async () => {
    const { business, applicationId } = await setupApplicationWithResume('business');

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.application.resumeUrl).toBe(OWN_STORAGE_RESUME_URL);
  });

  it('is never visible to a different business', async () => {
    const { applicationId } = await setupApplicationWithResume('other-business');
    const otherBusiness = await registerBusiness(
      'resume-visibility-other-business-viewer@example.com',
    );

    const res = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${otherBusiness.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('is never visible to a guest', async () => {
    const { applicationId } = await setupApplicationWithResume('guest');

    const res = await request(app).get(`/api/applications/${applicationId}`);

    expect(res.status).toBe(401);
  });
});

// resumeUrl is never on any profile shape, a gig, or a review (GL-300) -
// spot-checked here rather than re-asserted in every one of those suites,
// the same "one deliberate cross-boundary check" approach the skill trial's
// own visibility block takes for the public profile (application.skill-trial.test.js).
describe('resumeUrl never leaks outside applications', () => {
  it('is absent from the gig the application belongs to', async () => {
    const business = await registerBusiness('resume-leak-gig-business@example.com');
    const seeker = await registerSeeker('resume-leak-gig-seeker@example.com');
    const gig = await postGigAsBusiness(business);
    await applyAsSeeker(seeker, gig.id, { resumeUrl: OWN_STORAGE_RESUME_URL });

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig).not.toHaveProperty('resumeUrl');
  });

  it('is absent from the applicant’s own profile', async () => {
    const business = await registerBusiness('resume-leak-profile-business@example.com');
    const seeker = await registerSeeker('resume-leak-profile-seeker@example.com');
    const gig = await postGigAsBusiness(business);
    await applyAsSeeker(seeker, gig.id, { resumeUrl: OWN_STORAGE_RESUME_URL });

    const res = await request(app)
      .get('/api/profiles/me')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.profile).not.toHaveProperty('resumeUrl');
  });
});
