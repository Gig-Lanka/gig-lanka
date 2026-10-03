import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
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

// Admin accounts are never created through public registration — see
// gig auth.rbac.test.js and server/README.md.
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

const createGigDoc = async (postedBy, overrides = {}) =>
  Gig.create({ ...validGigPayload(overrides), postedBy });

describe('PUT/DELETE /api/gigs/:id/save', () => {
  it('saves and unsaves a gig for a seeker, round-tripping the savedBy membership', async () => {
    const business = await registerBusiness('saved-round-trip-business@example.com');
    const seeker = await registerSeeker('saved-round-trip-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    const saveRes = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(saveRes.status).toBe(200);

    const afterSave = await Gig.findById(gig.id).select('+savedBy');
    expect(afterSave.savedBy.map(String)).toContain(seeker.userId.toString());

    const unsaveRes = await request(app)
      .delete(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(unsaveRes.status).toBe(200);

    const afterUnsave = await Gig.findById(gig.id).select('+savedBy');
    expect(afterUnsave.savedBy.map(String)).not.toContain(seeker.userId.toString());
  });

  it('is idempotent on save: saving an already-saved gig twice does not duplicate the entry', async () => {
    const business = await registerBusiness('saved-idempotent-save-business@example.com');
    const seeker = await registerSeeker('saved-idempotent-save-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    const first = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    const second = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const afterBoth = await Gig.findById(gig.id).select('+savedBy');
    const occurrences = afterBoth.savedBy.filter(
      (id) => id.toString() === seeker.userId.toString(),
    );
    expect(occurrences).toHaveLength(1);
  });

  it('is idempotent on unsave: unsaving a gig that was never saved succeeds', async () => {
    const business = await registerBusiness('saved-idempotent-unsave-business@example.com');
    const seeker = await registerSeeker('saved-idempotent-unsave-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    const res = await request(app)
      .delete(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
  });

  it('refuses a business with 403', async () => {
    const business = await registerBusiness('saved-refuse-business@example.com');
    const gig = await createGigDoc(business.userId);

    const saveRes = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${business.accessToken}`);
    const unsaveRes = await request(app)
      .delete(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(saveRes.status).toBe(403);
    expect(unsaveRes.status).toBe(403);
  });

  it('refuses an admin with 403', async () => {
    const business = await registerBusiness('saved-refuse-admin-business@example.com');
    const gig = await createGigDoc(business.userId);
    const adminToken = await createAdminAccessToken('saved-refuse-admin@example.com');

    const saveRes = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${adminToken}`);
    const unsaveRes = await request(app)
      .delete(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(saveRes.status).toBe(403);
    expect(unsaveRes.status).toBe(403);
  });

  it.each(['closed', 'filled'])(
    'refuses saving a %s gig with 409 GIG_CLOSED, but unsaving it still succeeds',
    async (status) => {
      const business = await registerBusiness(`saved-${status}-business@example.com`);
      const seeker = await registerSeeker(`saved-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);
      await Gig.updateOne({ _id: gig.id }, { $set: { status } });

      const saveRes = await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(saveRes.status).toBe(409);
      expect(saveRes.body.error.code).toBe('GIG_CLOSED');

      const unsaveRes = await request(app)
        .delete(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(unsaveRes.status).toBe(200);
    },
  );

  it('refuses saving a gig whose applications close date has passed with 409 GIG_CLOSED, but unsaving it still succeeds', async () => {
    const business = await registerBusiness('saved-expired-business@example.com');
    const seeker = await registerSeeker('saved-expired-seeker@example.com');
    const gig = await createGigDoc(business.userId);
    // applicationsCloseDate rejects past dates on write (isNotPastDate), so
    // the expiry is written directly, mirroring gig.closed.test.js's approach
    // to exercising closeIfExpired's lazy-close path.
    await Gig.updateOne({ _id: gig.id }, { $set: { applicationsCloseDate: '2000-01-01' } });

    const saveRes = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(saveRes.status).toBe(409);
    expect(saveRes.body.error.code).toBe('GIG_CLOSED');

    const unsaveRes = await request(app)
      .delete(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(unsaveRes.status).toBe(200);
  });

  it('does not touch applicantCount when saving', async () => {
    const business = await registerBusiness('saved-applicant-count-business@example.com');
    const seeker = await registerSeeker('saved-applicant-count-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    const afterSave = await Gig.findById(gig.id);
    expect(afterSave.applicantCount).toBe(0);
  });
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('GET /api/gigs/saved', () => {
  it('resolves as the literal route rather than being swallowed as :id', async () => {
    const seeker = await registerSeeker('saved-list-literal-seeker@example.com');

    const res = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gigs).toEqual([]);
  });

  it('refuses a business and an admin with 403', async () => {
    const business = await registerBusiness('saved-list-refuse-business@example.com');
    const adminToken = await createAdminAccessToken('saved-list-refuse-admin@example.com');

    const businessRes = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${business.accessToken}`);
    const adminRes = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(businessRes.status).toBe(403);
    expect(adminRes.status).toBe(403);
  });

  it('returns only the caller saves, newest-saved first, and no parameter reaches another seeker’s list', async () => {
    const business = await registerBusiness('saved-list-scope-business@example.com');
    const seeker = await registerSeeker('saved-list-scope-seeker@example.com');
    const otherSeeker = await registerSeeker('saved-list-scope-other-seeker@example.com');

    const gigA = await createGigDoc(business.userId, { title: 'Gig A' });
    const gigB = await createGigDoc(business.userId, { title: 'Gig B' });
    const otherSeekerGig = await createGigDoc(business.userId, { title: 'Not this caller' });

    await request(app)
      .put(`/api/gigs/${gigA.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    await wait(20);
    await request(app)
      .put(`/api/gigs/${gigB.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    await request(app)
      .put(`/api/gigs/${otherSeekerGig.id}/save`)
      .set('Authorization', `Bearer ${otherSeeker.accessToken}`);

    const res = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gigs.map((gig) => gig.id)).toEqual([gigB.id.toString(), gigA.id.toString()]);

    // Nothing in the request (query string, body) can widen the scope past
    // the authenticated caller's own saves.
    const scopedRes = await request(app)
      .get(`/api/gigs/saved?userId=${otherSeeker.userId}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(scopedRes.body.data.gigs.map((gig) => gig.id)).toEqual([
      gigB.id.toString(),
      gigA.id.toString(),
    ]);
  });

  it.each(['closed', 'filled'])(
    'still includes a saved gig that has since been marked %s, carrying its real status',
    async (status) => {
      const business = await registerBusiness(`saved-list-${status}-business@example.com`);
      const seeker = await registerSeeker(`saved-list-${status}-seeker@example.com`);
      const gig = await createGigDoc(business.userId);

      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);
      await Gig.updateOne({ _id: gig.id }, { $set: { status } });

      const res = await request(app)
        .get('/api/gigs/saved')
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gigs).toHaveLength(1);
      expect(res.body.data.gigs[0].status).toBe(status);
    },
  );

  it('still includes a saved gig whose deadline has passed, corrected to closed', async () => {
    const business = await registerBusiness('saved-list-expired-business@example.com');
    const seeker = await registerSeeker('saved-list-expired-seeker@example.com');
    const gig = await createGigDoc(business.userId);

    await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    await Gig.updateOne({ _id: gig.id }, { $set: { applicationsCloseDate: '2000-01-01' } });

    const res = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gigs).toHaveLength(1);
    expect(res.body.data.gigs[0].status).toBe('closed');
  });
});

describe('viewerSaved', () => {
  describe('GET /api/gigs/:id', () => {
    it('is true for the seeker who saved the gig', async () => {
      const business = await registerBusiness('viewer-saved-detail-true-business@example.com');
      const seeker = await registerSeeker('viewer-saved-detail-true-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app)
        .get(`/api/gigs/${gig.id}`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerSaved).toBe(true);
    });

    it('is false for a different seeker who has not saved it', async () => {
      const business = await registerBusiness('viewer-saved-detail-other-business@example.com');
      const seeker = await registerSeeker('viewer-saved-detail-other-saver@example.com');
      const otherSeeker = await registerSeeker('viewer-saved-detail-other-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app)
        .get(`/api/gigs/${gig.id}`)
        .set('Authorization', `Bearer ${otherSeeker.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerSaved).toBe(false);
    });

    it('is false for the business that posted it, even though it was saved', async () => {
      const business = await registerBusiness('viewer-saved-detail-business-business@example.com');
      const seeker = await registerSeeker('viewer-saved-detail-business-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app)
        .get(`/api/gigs/${gig.id}`)
        .set('Authorization', `Bearer ${business.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerSaved).toBe(false);
    });

    it('is false for an admin', async () => {
      const business = await registerBusiness('viewer-saved-detail-admin-business@example.com');
      const seeker = await registerSeeker('viewer-saved-detail-admin-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);
      const adminToken = await createAdminAccessToken('viewer-saved-detail-admin@example.com');

      const res = await request(app)
        .get(`/api/gigs/${gig.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerSaved).toBe(false);
    });

    it('is false for a guest', async () => {
      const business = await registerBusiness('viewer-saved-detail-guest-business@example.com');
      const seeker = await registerSeeker('viewer-saved-detail-guest-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app).get(`/api/gigs/${gig.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.viewerSaved).toBe(false);
    });
  });

  describe('GET /api/gigs', () => {
    it('carries viewerSaved true only on the saved gig, for a signed-in seeker', async () => {
      const business = await registerBusiness('viewer-saved-list-business@example.com');
      const seeker = await registerSeeker('viewer-saved-list-seeker@example.com');
      const savedGig = await createGigDoc(business.userId, { title: 'Saved in the list' });
      const unsavedGig = await createGigDoc(business.userId, { title: 'Not saved in the list' });
      await request(app)
        .put(`/api/gigs/${savedGig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app)
        .get('/api/gigs')
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      expect(res.status).toBe(200);
      const byId = new Map(res.body.data.gigs.map((gig) => [gig.id, gig]));
      expect(byId.get(savedGig.id.toString()).viewerSaved).toBe(true);
      expect(byId.get(unsavedGig.id.toString()).viewerSaved).toBe(false);
    });

    it('is false throughout for a guest, with no lookup performed', async () => {
      const business = await registerBusiness('viewer-saved-list-guest-business@example.com');
      const seeker = await registerSeeker('viewer-saved-list-guest-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app).get('/api/gigs');

      expect(res.status).toBe(200);
      expect(res.body.data.gigs.every((g) => g.viewerSaved === false)).toBe(true);
    });

    it('is false throughout for a business, even for a gig it posted and someone saved', async () => {
      const business = await registerBusiness('viewer-saved-list-business-role-business@example.com');
      const seeker = await registerSeeker('viewer-saved-list-business-role-seeker@example.com');
      const gig = await createGigDoc(business.userId);
      await request(app)
        .put(`/api/gigs/${gig.id}/save`)
        .set('Authorization', `Bearer ${seeker.accessToken}`);

      const res = await request(app)
        .get('/api/gigs')
        .set('Authorization', `Bearer ${business.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.gigs.every((g) => g.viewerSaved === false)).toBe(true);
    });
  });
});
