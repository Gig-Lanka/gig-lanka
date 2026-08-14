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
});
