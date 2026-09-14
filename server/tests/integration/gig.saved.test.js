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
