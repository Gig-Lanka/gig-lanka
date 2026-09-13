import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { markGigFilled, assertGigIsOpen } from '../../src/services/gig.service.js';

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
  postedBy: new mongoose.Types.ObjectId(),
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

describe('markGigFilled', () => {
  it('moves an open gig to filled and saves it', async () => {
    const gig = await Gig.create(validGigPayload());

    const result = await markGigFilled(gig.id);

    expect(result.status).toBe('filled');
    const stored = await Gig.findById(gig.id);
    expect(stored.status).toBe('filled');
  });

  it('is idempotent on a gig that is already filled', async () => {
    const gig = await Gig.create(validGigPayload());
    await markGigFilled(gig.id);

    const result = await markGigFilled(gig.id);

    expect(result.status).toBe('filled');
    const stored = await Gig.findById(gig.id);
    expect(stored.status).toBe('filled');
  });

  it('refuses a closed gig, leaving its status untouched', async () => {
    const gig = await Gig.create(validGigPayload());
    gig.status = 'closed';
    await gig.save({ validateModifiedOnly: true });

    await expect(markGigFilled(gig.id)).rejects.toMatchObject({ status: 409 });

    const stored = await Gig.findById(gig.id);
    expect(stored.status).toBe('closed');
  });

  // Not in this sub-task's explicit cover list, but the same refusal branch
  // as 'closed' in gig.service.js and cheap to prove alongside it.
  it('refuses a draft gig, leaving its status untouched', async () => {
    const gig = await Gig.create(validGigPayload());
    gig.status = 'draft';
    await gig.save({ validateModifiedOnly: true });

    await expect(markGigFilled(gig.id)).rejects.toMatchObject({ status: 409 });

    const stored = await Gig.findById(gig.id);
    expect(stored.status).toBe('draft');
  });
});

describe('a filled gig in the public listing and single read', () => {
  it('is excluded from GET /api/gigs via buildOpenGigFilter\'s pinned status: open, with no second condition needed', async () => {
    const business = await registerBusiness('filled-browse-business@example.com');
    const openGig = await postGigAsBusiness(business, { title: 'Still open' });
    const filledGig = await postGigAsBusiness(business, { title: 'Now filled' });
    await markGigFilled(filledGig.id);

    const res = await request(app).get('/api/gigs');

    const ids = res.body.data.gigs.map((gig) => gig.id);
    expect(ids).toContain(openGig.id);
    expect(ids).not.toContain(filledGig.id);
  });

  it('is still returned by GET /api/gigs/:id, not a 404', async () => {
    const business = await registerBusiness('filled-detail-business@example.com');
    const gig = await postGigAsBusiness(business);
    await markGigFilled(gig.id);

    const res = await request(app).get(`/api/gigs/${gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('filled');
  });
});

describe('closeIfExpired and the listMyGigs sweep against a filled gig', () => {
  it('does not let closeIfExpired overwrite filled with closed on GET /api/gigs/:id, even with a past deadline', async () => {
    const business = await registerBusiness('filled-deadline-business@example.com');
    const gig = await postGigAsBusiness(business);
    await markGigFilled(gig.id);

    // The model's isNotPastDate validator only runs on save(), so a direct
    // updateOne is the way to put an already-filled gig into the ordinary
    // state of also carrying a passed deadline - exactly the state
    // closeIfExpired's `gig.status === 'open'` guard must leave alone.
    await Gig.updateOne({ _id: gig.id }, { $set: { applicationsCloseDate: '2000-01-01' } });

    const res = await request(app).get(`/api/gigs/${gig.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.gig.status).toBe('filled');

    const stored = await Gig.findById(gig.id);
    expect(stored.status).toBe('filled');
  });

  it("leaves a filled gig alone in listMyGigs's expired-open sweep, while still closing an actually-open expired one", async () => {
    const business = await registerBusiness('filled-sweep-business@example.com');
    const filledGig = await postGigAsBusiness(business, { title: 'Filled, deadline passed' });
    const openGig = await postGigAsBusiness(business, { title: 'Open, deadline passed' });
    await markGigFilled(filledGig.id);

    await Gig.updateMany(
      { _id: { $in: [filledGig.id, openGig.id].map((id) => new mongoose.Types.ObjectId(id)) } },
      { $set: { applicationsCloseDate: '2000-01-01' } },
    );

    const res = await request(app)
      .get('/api/gigs/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    const byId = new Map(res.body.data.gigs.map((gig) => [gig.id, gig]));
    expect(byId.get(filledGig.id).status).toBe('filled');
    expect(byId.get(openGig.id).status).toBe('closed');
  });
});

describe('applying and saving a filled gig', () => {
  it('refuses applying with 409 GIG_CLOSED, through assertGigIsOpen, no new error code', async () => {
    const business = await registerBusiness('filled-apply-business@example.com');
    const seeker = await registerSeeker('filled-apply-seeker@example.com');
    const gig = await postGigAsBusiness(business);
    await markGigFilled(gig.id);

    const res = await request(app)
      .post(`/api/gigs/${gig.id}/applications`)
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GIG_CLOSED');
  });

  // No save endpoint is wired up yet - gig.service.js's own comment on
  // assertGigIsOpen names a future save endpoint as its second caller,
  // alongside apply. Exercising the shared gate directly is the right level
  // until that route exists; once it does, it refuses through this same
  // function and this assertion keeps holding.
  it('refuses saving with 409 GIG_CLOSED, through the same assertGigIsOpen gate saving will use', async () => {
    const business = await registerBusiness('filled-save-business@example.com');
    const gig = await postGigAsBusiness(business);
    await markGigFilled(gig.id);

    await expect(assertGigIsOpen(gig.id)).rejects.toMatchObject({
      status: 409,
      code: 'GIG_CLOSED',
    });
  });
});
