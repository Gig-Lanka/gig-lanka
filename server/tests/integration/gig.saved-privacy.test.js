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

  // The three tests above go through the HTTP surface, which in this
  // codebase happens to make the two schema guards mutually redundant: every
  // current reader either never asks for `+savedBy` (so select:false alone
  // already hides it, whether or not toJSON also deletes it) or calls
  // `.toJSON()` before a response is sent (so the transform alone already
  // strips it, whether or not select:false already excluded it from the
  // query). Removing either guard *alone* leaves every HTTP-level test above
  // passing — only removing both together makes them fail. That means an
  // HTTP-only suite cannot actually tell the difference between "both guards
  // are intact" and "exactly one was quietly deleted," which is precisely
  // the gap this story's done-when clause ("confirm the suite fails if
  // either guard is removed") is guarding against. These two tests pin each
  // guard directly at the model layer instead, independent of whether any
  // current controller happens to lean on the other one for cover.
  describe('each schema guard, pinned independently of the other', () => {
    it('select: false keeps savedBy out of a default query, with no explicit select and no toJSON call involved', async () => {
      const owner = await registerBusiness('saved-privacy-guard-select-owner@example.com');
      const gig = await createGig(owner.accessToken, { title: 'Guard: select false' });
      await Gig.updateOne({ _id: gig.id }, { $set: { savedBy: [owner.userId] } });

      const defaultLoad = await Gig.findById(gig.id);

      // Undefined, not an empty array: select:false means the path was never
      // fetched at all, not fetched-and-happened-to-be-empty. Removing
      // `select: false` from the schema turns this into a populated array
      // and fails the assertion, with no toJSON transform anywhere in the
      // path to obscure the regression.
      expect(defaultLoad.savedBy).toBeUndefined();
    });

    it('the toJSON transform strips savedBy even when a query explicitly loads it with +savedBy', async () => {
      const owner = await registerBusiness('saved-privacy-guard-tojson-owner@example.com');
      const gig = await createGig(owner.accessToken, { title: 'Guard: toJSON deletion' });
      await Gig.updateOne({ _id: gig.id }, { $set: { savedBy: [owner.userId] } });

      const explicitLoad = await Gig.findById(gig.id).select('+savedBy');
      // Sanity check first: the field must actually be loaded here, or the
      // assertion below would pass for the wrong reason (nothing to strip)
      // rather than because the transform did its job.
      expect(explicitLoad.savedBy).toHaveLength(1);

      // select:false is irrelevant to this assertion — `+savedBy` bypassed
      // it on purpose. Only the transform's own `delete ret.savedBy` stands
      // between this loaded array and the object below; removing that line
      // fails this assertion regardless of select:false's state.
      expect(explicitLoad.toJSON()).not.toHaveProperty('savedBy');
    });
  });
});
