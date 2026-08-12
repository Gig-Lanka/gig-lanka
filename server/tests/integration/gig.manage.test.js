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
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'business',
  });

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const registerSeeker = async (email) => {
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: validPassword,
    role: 'seeker',
  });

  return res.body.data.accessToken;
};

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

describe('GET /api/gigs/mine', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/gigs/mine');

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seekerToken = await registerSeeker('mine-seeker@example.com');

    const res = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns only the signed-in business own gigs, at every status, with applicant count', async () => {
    const business = await registerBusiness('mine-business@example.com');
    const otherBusiness = await registerBusiness('mine-other-business@example.com');

    const openGig = await createGig(business.accessToken, { title: 'Open gig' });
    const toBeClosedGig = await createGig(business.accessToken, { title: 'Will be closed' });
    await createGig(otherBusiness.accessToken, { title: 'Someone elses gig' });

    await request(app)
      .patch(`/api/gigs/${toBeClosedGig.id}/close`)
      .set('Authorization', `Bearer ${business.accessToken}`);

    const res = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gigs).toHaveLength(2);
    const titles = res.body.data.gigs.map((gig) => gig.title);
    expect(titles).toEqual(expect.arrayContaining(['Open gig', 'Will be closed']));
    const statuses = res.body.data.gigs.map((gig) => gig.status);
    expect(statuses).toEqual(expect.arrayContaining(['open', 'closed']));
    res.body.data.gigs.forEach((gig) => {
      expect(gig).toHaveProperty('applicantCount', 0);
    });
    expect(openGig.id).not.toBe(toBeClosedGig.id);
  });
});

describe('PUT /api/gigs/:id', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app)
      .put('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1')
      .send(validGigPayload());

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seekerToken = await registerSeeker('put-seeker@example.com');

    const res = await request(app)
      .put('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Authorization', `Bearer ${seekerToken}`)
      .send(validGigPayload());

    expect(res.status).toBe(403);
  });

  it('returns 404 for a gig that does not exist', async () => {
    const business = await registerBusiness('put-owner-404@example.com');

    const res = await request(app)
      .put('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send(validGigPayload());

    expect(res.status).toBe(404);
  });

  it('returns 403 for a gig that exists but is not owned by the caller', async () => {
    const owner = await registerBusiness('put-owner@example.com');
    const intruder = await registerBusiness('put-intruder@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .put(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`)
      .send(validGigPayload({ title: 'Hijacked title' }));

    expect(res.status).toBe(403);
  });

  it('updates a gig owned by the caller, applying create-level validation', async () => {
    const owner = await registerBusiness('put-owner-success@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .put(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(validGigPayload({ title: 'Updated title', payAmount: 5000 }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.title).toBe('Updated title');
    expect(res.body.data.gig.payAmount).toBe(5000);
  });

  it('rejects an invalid update with 400 (same validation as create)', async () => {
    const owner = await registerBusiness('put-owner-invalid@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .put(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(validGigPayload({ payAmount: -5 }));

    expect(res.status).toBe(400);
  });

  it('never lets the client set status directly', async () => {
    const owner = await registerBusiness('put-owner-status@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .put(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send(validGigPayload({ status: 'filled' }));

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('open');
  });
});

describe('PATCH /api/gigs/:id/close', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).patch('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1/close');

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seekerToken = await registerSeeker('close-seeker@example.com');

    const res = await request(app)
      .patch('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1/close')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a gig that does not exist', async () => {
    const business = await registerBusiness('close-owner-404@example.com');

    const res = await request(app)
      .patch('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1/close')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for a gig that exists but is not owned by the caller', async () => {
    const owner = await registerBusiness('close-owner@example.com');
    const intruder = await registerBusiness('close-intruder@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .patch(`/api/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('closes the gig, hiding it from the public list but keeping it in /mine and the detail view', async () => {
    const owner = await registerBusiness('close-owner-success@example.com');
    const gig = await createGig(owner.accessToken);

    const closeRes = await request(app)
      .patch(`/api/gigs/${gig.id}/close`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.data.gig.status).toBe('closed');

    const listRes = await request(app).get('/api/gigs');
    expect(listRes.body.data.gigs.map((g) => g.id)).not.toContain(gig.id);

    const detailRes = await request(app).get(`/api/gigs/${gig.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.gig.status).toBe('closed');

    const mineRes = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(mineRes.body.data.gigs.map((g) => g.id)).toContain(gig.id);
  });
});

describe('DELETE /api/gigs/:id', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).delete('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1');

    expect(res.status).toBe(401);
  });

  it('rejects a seeker with 403', async () => {
    const seekerToken = await registerSeeker('delete-seeker@example.com');

    const res = await request(app)
      .delete('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Authorization', `Bearer ${seekerToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for a gig that does not exist', async () => {
    const business = await registerBusiness('delete-owner-404@example.com');

    const res = await request(app)
      .delete('/api/gigs/64f1a2b3c4d5e6f7a8b9c0d1')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 for a gig that exists but is not owned by the caller', async () => {
    const owner = await registerBusiness('delete-owner@example.com');
    const intruder = await registerBusiness('delete-intruder@example.com');
    const gig = await createGig(owner.accessToken);

    const res = await request(app)
      .delete(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${intruder.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('permanently deletes the gig with no soft-delete trace', async () => {
    const owner = await registerBusiness('delete-owner-success@example.com');
    const gig = await createGig(owner.accessToken);

    const deleteRes = await request(app)
      .delete(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    expect(deleteRes.status).toBe(200);

    const detailRes = await request(app).get(`/api/gigs/${gig.id}`);
    expect(detailRes.status).toBe(404);

    const mineRes = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(mineRes.body.data.gigs.map((g) => g.id)).not.toContain(gig.id);
  });
});
