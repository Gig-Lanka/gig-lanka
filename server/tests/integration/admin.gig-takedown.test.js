import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { markGigFilled } from '../../src/services/gig.service.js';

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

// Admin accounts are never created through public registration — the same
// direct-database approach report.admin-queue.test.js already uses.
const createAdmin = async (email) => {
  const admin = await User.create({ email, passwordHash: 'not-a-real-hash', role: 'admin' });
  const accessToken = jwt.sign({ id: admin.id, role: admin.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });

  return { accessToken, userId: admin.id };
};

const postGigAsBusiness = async (business, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${business.accessToken}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const takeDownGig = (gigId, admin) =>
  request(app)
    .patch(`/api/admin/gigs/${gigId}/close`)
    .set('Authorization', `Bearer ${admin.accessToken}`);

describe('PATCH /api/admin/gigs/:id/close', () => {
  it('rejects a guest with 401', async () => {
    const business = await registerBusiness('takedown-401-business@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await request(app).patch(`/api/admin/gigs/${gig.id}/close`);

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const business = await registerBusiness('takedown-403-seeker-business@example.com');
    const seeker = await registerSeeker('takedown-403-seeker@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await request(app)
      .patch(`/api/admin/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it("rejects a business with 403, even the gig's own owner", async () => {
    const business = await registerBusiness('takedown-403-business@example.com');
    const gig = await postGigAsBusiness(business);

    const res = await request(app)
      .patch(`/api/admin/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 NOT_FOUND for an id that does not exist', async () => {
    const admin = await createAdmin('takedown-404-unknown@example.com');

    const res = await takeDownGig('64f1a2b3c4d5e6f7a8b9c0d8', admin);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 NOT_FOUND for a malformed id', async () => {
    const admin = await createAdmin('takedown-404-malformed@example.com');

    const res = await takeDownGig('not-a-valid-object-id', admin);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('takes down an open gig: status closed, closedByAdminAt set', async () => {
    const business = await registerBusiness('takedown-open-business@example.com');
    const admin = await createAdmin('takedown-open-admin@example.com');
    const gig = await postGigAsBusiness(business, { title: 'Open gig to take down' });

    const res = await takeDownGig(gig.id, admin);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('closed');
    expect(res.body.data.gig.closedByAdminAt).not.toBeNull();
    expect(res.body.data.gig.title).toBe('Open gig to take down');
  });

  it('takes down a filled gig: status moves to closed, closedByAdminAt set', async () => {
    const business = await registerBusiness('takedown-filled-business@example.com');
    const admin = await createAdmin('takedown-filled-admin@example.com');
    const gig = await postGigAsBusiness(business, { title: 'Filled gig to take down' });

    await markGigFilled(gig.id);

    const res = await takeDownGig(gig.id, admin);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('closed');
    expect(res.body.data.gig.closedByAdminAt).not.toBeNull();
  });

  it('on a gig the business already closed itself: 200, closedByAdminAt set, nothing else changes', async () => {
    const business = await registerBusiness('takedown-biz-closed-business@example.com');
    const admin = await createAdmin('takedown-biz-closed-admin@example.com');
    const gig = await postGigAsBusiness(business, { title: 'Business closed this one' });

    await request(app)
      .patch(`/api/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const res = await takeDownGig(gig.id, admin);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('closed');
    expect(res.body.data.gig.closedByAdminAt).not.toBeNull();
    expect(res.body.data.gig.title).toBe('Business closed this one');
    expect(res.body.data.gig.payAmount).toBe(2500);
  });

  it('on a gig already taken down: 409 GIG_ALREADY_TAKEN_DOWN', async () => {
    const business = await registerBusiness('takedown-already-business@example.com');
    const admin = await createAdmin('takedown-already-admin@example.com');
    const gig = await postGigAsBusiness(business);

    const first = await takeDownGig(gig.id, admin);
    expect(first.status).toBe(200);

    const second = await takeDownGig(gig.id, admin);

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('GIG_ALREADY_TAKEN_DOWN');
  });
});

describe('effects of an admin takedown', () => {
  it('removes the gig from GET /api/gigs', async () => {
    const business = await registerBusiness('takedown-browse-business@example.com');
    const admin = await createAdmin('takedown-browse-admin@example.com');
    const gig = await postGigAsBusiness(business, { title: 'Taken down, should not browse' });

    await takeDownGig(gig.id, admin);

    const res = await request(app).get('/api/gigs');

    expect(res.status).toBe(200);
    expect(res.body.data.gigs.find((g) => g.id === gig.id)).toBeUndefined();
  });

  it('refuses a new application with 409 GIG_CLOSED', async () => {
    const business = await registerBusiness('takedown-apply-business@example.com');
    const seeker = await registerSeeker('takedown-apply-seeker@example.com');
    const admin = await createAdmin('takedown-apply-admin@example.com');
    const gig = await postGigAsBusiness(business);

    await takeDownGig(gig.id, admin);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });

  it('refuses the business editing it, with 409 GIG_TAKEN_DOWN', async () => {
    const business = await registerBusiness('takedown-edit-business@example.com');
    const admin = await createAdmin('takedown-edit-admin@example.com');
    const gig = await postGigAsBusiness(business, { title: 'Original title' });

    await takeDownGig(gig.id, admin);

    const res = await request(app)
      .put(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload({ title: 'Trying to reopen or rename' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_TAKEN_DOWN');
  });

  it('leaves an existing application untouched and still processable by the business', async () => {
    const business = await registerBusiness('takedown-app-business@example.com');
    const seeker = await registerSeeker('takedown-app-seeker@example.com');
    const admin = await createAdmin('takedown-app-admin@example.com');
    const gig = await postGigAsBusiness(business);

    const applyRes = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`)
      .send({});
    const applicationId = applyRes.body.data.application.id;

    await takeDownGig(gig.id, admin);

    const readAfterTakedown = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set('Authorization', `Bearer ${business.accessToken}`);
    expect(readAfterTakedown.status).toBe(200);
    expect(readAfterTakedown.body.data.application.status).toBe('applied');

    const viewRes = await request(app)
      .patch(`/api/applications/${applicationId}/view`)
      .set('Authorization', `Bearer ${business.accessToken}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.data.application.status).toBe('viewed');

    const rejectRes = await request(app)
      .patch(`/api/applications/${applicationId}/reject`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ reasonCode: 'schedule_mismatch' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.application.status).toBe('rejected');
  });
});

describe('closedByAdminAt visibility', () => {
  it('is present for the owner on GET /api/gigs/mine and on GET /api/gigs/:id', async () => {
    const business = await registerBusiness('takedown-visible-owner-business@example.com');
    const admin = await createAdmin('takedown-visible-owner-admin@example.com');
    const gig = await postGigAsBusiness(business);

    await takeDownGig(gig.id, admin);

    const mine = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);
    expect(mine.status).toBe(200);
    const mineGig = mine.body.data.gigs.find((g) => g.id === gig.id);
    expect(mineGig.closedByAdminAt).not.toBeNull();
    expect(mineGig.closedByAdminAt).toBeDefined();

    const read = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${business.accessToken}`);
    expect(read.status).toBe(200);
    expect(read.body.data.gig.closedByAdminAt).not.toBeNull();
  });

  it('is absent for a seeker reading the gig', async () => {
    const business = await registerBusiness('takedown-hidden-seeker-business@example.com');
    const seeker = await registerSeeker('takedown-hidden-seeker@example.com');
    const admin = await createAdmin('takedown-hidden-seeker-admin@example.com');
    const gig = await postGigAsBusiness(business);

    await takeDownGig(gig.id, admin);

    const res = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('closed');
    expect(res.body.data.gig.closedByAdminAt).toBeUndefined();
  });

  it('is absent for a guest reading the gig', async () => {
    const business = await registerBusiness('takedown-hidden-guest-business@example.com');
    const admin = await createAdmin('takedown-hidden-guest-admin@example.com');
    const gig = await postGigAsBusiness(business);

    await takeDownGig(gig.id, admin);

    const res = await request(app).get(`/api/gigs/${gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('closed');
    expect(res.body.data.gig.closedByAdminAt).toBeUndefined();
  });
});
