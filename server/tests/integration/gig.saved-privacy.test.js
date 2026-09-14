import request from 'supertest';
import app from '../../src/app.js';
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

  return { accessToken: res.body.data.accessToken, userId: res.body.data.user.id };
};

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const expectNoSavedByAnywhere = (value) => {
  const json = JSON.stringify(value);
  expect(json).not.toMatch(/savedBy/i);
};

describe('gig saved-by privacy', () => {
  it('never surfaces savedBy, even to the owner, once the field holds saver ids', async () => {
    const owner = await registerBusiness('saved-privacy-owner@example.com');
    const gig = await createGig(owner.accessToken, { title: 'Has savers' });

    // Simulate Sprint 2 having written saver ids to the field.
    await Gig.updateOne(
      { _id: gig.id },
      { $set: { savedBy: [owner.userId] } },
    );

    const listRes = await request(app).get('/api/gigs');
    expectNoSavedByAnywhere(listRes.body);

    const detailRes = await request(app).get(`/api/gigs/${gig.id}`);
    expectNoSavedByAnywhere(detailRes.body);

    const mineRes = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expectNoSavedByAnywhere(mineRes.body);
  });

  // GL-331: the case the above test could only simulate — savedBy is now
  // actually written by PUT /api/gigs/:id/save, not seeded directly through
  // the model. This is the case select: false and the toJSON deletion were
  // guarding two sprints ahead of. If either guard were removed, the saver's
  // own id would surface in the save response, the detail read, and the
  // public list — this asserts none of them do.
  it('stays hidden from every response once a real save has written it, including to the saver', async () => {
    const owner = await registerBusiness('saved-privacy-real-owner@example.com');
    const seeker = await registerSeeker('saved-privacy-real-seeker@example.com');
    const gig = await createGig(owner.accessToken, { title: 'Really has a saver' });

    const saveRes = await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expect(saveRes.status).toBe(200);
    expectNoSavedByAnywhere(saveRes.body);

    const listRes = await request(app).get('/api/gigs');
    expectNoSavedByAnywhere(listRes.body);

    const detailAsSaverRes = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expectNoSavedByAnywhere(detailAsSaverRes.body);

    const detailAsOwnerRes = await request(app)
      .get(`/api/gigs/${gig.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expectNoSavedByAnywhere(detailAsOwnerRes.body);

    const mineRes = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expectNoSavedByAnywhere(mineRes.body);

    const savedListRes = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    expectNoSavedByAnywhere(savedListRes.body);
    expect(savedListRes.body.data.gigs.map((g) => g.id)).toEqual([gig.id.toString()]);
  });

  it('never lets one seeker read another seeker’s saved list through GET /api/gigs/saved', async () => {
    const owner = await registerBusiness('saved-privacy-cross-owner@example.com');
    const saver = await registerSeeker('saved-privacy-cross-saver@example.com');
    const otherSeeker = await registerSeeker('saved-privacy-cross-other@example.com');
    const gig = await createGig(owner.accessToken, { title: 'Saved by someone else' });

    await request(app)
      .put(`/api/gigs/${gig.id}/save`)
      .set('Authorization', `Bearer ${saver.accessToken}`);

    const otherSeekerRes = await request(app)
      .get('/api/gigs/saved')
      .set('Authorization', `Bearer ${otherSeeker.accessToken}`);

    expect(otherSeekerRes.status).toBe(200);
    expect(otherSeekerRes.body.data.gigs).toEqual([]);
    expectNoSavedByAnywhere(otherSeekerRes.body);
  });
});
