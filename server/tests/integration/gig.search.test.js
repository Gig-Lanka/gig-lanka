import request from 'supertest';
import mongoose from 'mongoose';
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

  return res.body.data.accessToken;
};

const createGig = async (token, overrides = {}) => {
  const res = await request(app)
    .post('/api/gigs')
    .set('Authorization', `Bearer ${token}`)
    .send(validGigPayload(overrides));

  return res.body.data.gig;
};

const closeGig = async (token, id) => {
  await request(app).patch(`/api/gigs/${id}/close`).set('Authorization', `Bearer ${token}`);
};

const titlesOf = (res) => res.body.data.gigs.map((gig) => gig.title);
const idsOf = (res) => res.body.data.gigs.map((gig) => gig.id);

describe('GET /api/gigs — search, filter and sort', () => {
  it('returns the identical response with no parameters at all', async () => {
    const token = await registerBusiness('search-baseline@example.com');
    await createGig(token, { title: 'Gig one' });
    await createGig(token, { title: 'Gig two' });

    const withNoParams = await request(app).get('/api/gigs');
    const withPageOne = await request(app).get('/api/gigs?page=1');

    expect(withNoParams.status).toBe(200);
    expect(withNoParams.body).toEqual(withPageOne.body);
    expect(titlesOf(withNoParams)).toEqual(['Gig two', 'Gig one']);
  });

  it('q matches the title case-insensitively as a substring', async () => {
    const token = await registerBusiness('search-q-title@example.com');
    await createGig(token, {
      title: 'Chemistry tutor needed',
      description: 'Help with O/L chemistry classes every week.',
    });
    await createGig(token, {
      title: 'Delivery rider wanted',
      description: 'Deliver parcels around the city daily.',
    });

    const res = await request(app).get('/api/gigs').query({ q: 'CHEMISTRY' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Chemistry tutor needed']);
  });

  it('q matches only a description', async () => {
    const token = await registerBusiness('search-q-desc@example.com');
    await createGig(token, {
      title: 'Weekend helper',
      description: 'Assist with wedding photography setup and teardown.',
    });
    await createGig(token, {
      title: 'Office assistant',
      description: 'Filing and data entry for a small office.',
    });

    const res = await request(app).get('/api/gigs').query({ q: 'photography' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Weekend helper']);
  });

  it('escapes regex metacharacters in q instead of crashing or full-scanning', async () => {
    const token = await registerBusiness('search-q-regex@example.com');
    await createGig(token, {
      title: 'Math (advanced) tutor',
      description: 'One-to-one A/L combined maths tuition.',
    });
    await createGig(token, {
      title: 'Other gig',
      description: 'Something entirely unrelated to the above.',
    });

    const paren = await request(app).get('/api/gigs').query({ q: 'Math (advanced)' });
    expect(paren.status).toBe(200);
    expect(titlesOf(paren)).toEqual(['Math (advanced) tutor']);

    const wildcard = await request(app).get('/api/gigs').query({ q: '.*' });
    expect(wildcard.status).toBe(200);
    expect(wildcard.body.data.gigs).toHaveLength(0);
  });

  it('category matches a gig carrying any of the given values (multi-value OR)', async () => {
    const token = await registerBusiness('search-category@example.com');
    await createGig(token, { title: 'Tutor gig', category: 'tutoring' });
    await createGig(token, { title: 'Delivery gig', category: 'delivery' });
    await createGig(token, { title: 'Retail gig', category: 'retail' });

    const res = await request(app).get('/api/gigs').query({ category: 'tutoring,delivery' });

    expect(res.status).toBe(200);
    expect(titlesOf(res).sort()).toEqual(['Delivery gig', 'Tutor gig']);
  });

  it('schedule matches a gig carrying any one of the given tags (multi-value OR), not all of them', async () => {
    const token = await registerBusiness('search-schedule@example.com');
    await createGig(token, { title: 'Evenings only', schedule: ['weekday_evenings'] });
    await createGig(token, { title: 'Weekends only', schedule: ['weekends'] });
    await createGig(token, { title: 'Mornings only', schedule: ['weekday_mornings'] });

    const res = await request(app).get('/api/gigs').query({ schedule: 'weekday_evenings,weekends' });

    expect(res.status).toBe(200);
    expect(titlesOf(res).sort()).toEqual(['Evenings only', 'Weekends only']);
  });

  it('payType filters to the given values', async () => {
    const token = await registerBusiness('search-paytype@example.com');
    await createGig(token, { title: 'Hourly gig', payType: 'per_hour' });
    await createGig(token, { title: 'Fixed gig', payType: 'fixed_price' });

    const res = await request(app).get('/api/gigs').query({ payType: 'fixed_price' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Fixed gig']);
  });

  it('commitment filters to the given values', async () => {
    const token = await registerBusiness('search-commitment@example.com');
    await createGig(token, { title: 'Ongoing gig', commitment: 'ongoing' });
    await createGig(token, { title: 'One-off gig', commitment: 'one_off' });

    const res = await request(app).get('/api/gigs').query({ commitment: 'ongoing' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Ongoing gig']);
  });

  it('remote filters on an exact boolean match', async () => {
    const token = await registerBusiness('search-remote@example.com');
    await createGig(token, { title: 'Remote gig', remote: true, city: undefined });
    await createGig(token, { title: 'Onsite gig', remote: false, city: 'Colombo' });

    const res = await request(app).get('/api/gigs').query({ remote: 'true' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Remote gig']);
  });

  it('city matches case-insensitively', async () => {
    const token = await registerBusiness('search-city@example.com');
    await createGig(token, { title: 'Galle gig', city: 'Galle' });
    await createGig(token, { title: 'Kandy gig', city: 'Kandy' });

    const res = await request(app).get('/api/gigs').query({ city: 'galle' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Galle gig']);
  });

  it('minPay matches payAmount >= value, at and either side of the boundary', async () => {
    const token = await registerBusiness('search-minpay@example.com');
    await createGig(token, { title: 'Below', payAmount: 999 });
    await createGig(token, { title: 'At boundary', payAmount: 1000 });
    await createGig(token, { title: 'Above', payAmount: 1001 });

    const atBoundary = await request(app).get('/api/gigs').query({ minPay: 1000 });
    expect(titlesOf(atBoundary).sort()).toEqual(['Above', 'At boundary']);

    const belowBoundary = await request(app).get('/api/gigs').query({ minPay: 999 });
    expect(titlesOf(belowBoundary).sort()).toEqual(['Above', 'At boundary', 'Below']);

    const aboveBoundary = await request(app).get('/api/gigs').query({ minPay: 1001 });
    expect(titlesOf(aboveBoundary)).toEqual(['Above']);
  });

  it('minPay compares the raw amount across pay types (the documented cross-type limitation)', async () => {
    const token = await registerBusiness('search-minpay-crosstype@example.com');
    await createGig(token, { title: 'Hourly at 1000', payAmount: 1000, payType: 'per_hour' });
    await createGig(token, { title: 'Fixed at 1000', payAmount: 1000, payType: 'fixed_price' });

    const res = await request(app).get('/api/gigs').query({ minPay: 1000 });

    expect(titlesOf(res).sort()).toEqual(['Fixed at 1000', 'Hourly at 1000']);
  });

  it('two filters combine as AND across fields', async () => {
    const token = await registerBusiness('search-and@example.com');
    await createGig(token, { title: 'Matches both', category: 'tutoring', remote: true, city: undefined });
    await createGig(token, { title: 'Right category, wrong remote', category: 'tutoring', remote: false });
    await createGig(token, { title: 'Wrong category, right remote', category: 'delivery', remote: true, city: undefined });

    const res = await request(app).get('/api/gigs').query({ category: 'tutoring', remote: 'true' });

    expect(res.status).toBe(200);
    expect(titlesOf(res)).toEqual(['Matches both']);
  });

  it('an unknown enum value 400s naming the field, never a silent empty list', async () => {
    const res = await request(app).get('/api/gigs').query({ category: 'not_a_real_category' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.errors).toEqual([expect.objectContaining({ field: 'category' })]);
  });

  it('sort=newest (the default) is unchanged from Sprint 1', async () => {
    const token = await registerBusiness('search-sort-newest@example.com');
    const first = await createGig(token, { title: 'First' });
    const second = await createGig(token, { title: 'Second' });

    const explicit = await request(app).get('/api/gigs').query({ sort: 'newest' });
    const implicit = await request(app).get('/api/gigs');

    expect(idsOf(explicit)).toEqual([second.id, first.id]);
    expect(idsOf(explicit)).toEqual(idsOf(implicit));
  });

  it('sort=highest_pay orders by payAmount descending', async () => {
    const token = await registerBusiness('search-sort-pay@example.com');
    await createGig(token, { title: 'Low', payAmount: 500 });
    await createGig(token, { title: 'High', payAmount: 5000 });
    await createGig(token, { title: 'Mid', payAmount: 2000 });

    const res = await request(app).get('/api/gigs').query({ sort: 'highest_pay' });

    expect(titlesOf(res)).toEqual(['High', 'Mid', 'Low']);
  });

  it('sort=starting_soon orders by startDate ascending and puts undated gigs last', async () => {
    const token = await registerBusiness('search-sort-soon@example.com');
    await createGig(token, { title: 'No date A' });
    await createGig(token, { title: 'Later date', startDate: '2026-12-01' });
    await createGig(token, { title: 'No date B' });
    await createGig(token, { title: 'Sooner date', startDate: '2026-09-01' });

    const res = await request(app).get('/api/gigs').query({ sort: 'starting_soon' });

    expect(titlesOf(res)).toEqual(['Sooner date', 'Later date', 'No date A', 'No date B']);
  });

  it('every sort keeps a stable secondary _id tiebreak across a page boundary', async () => {
    const token = await registerBusiness('search-tiebreak@example.com');
    // 12 gigs with identical payAmount, so highest_pay has nothing but the
    // _id tiebreak to order on — a missing tiebreak would repeat or drop a
    // row between page 1 and page 2.
    for (let i = 0; i < 12; i += 1) {
      await createGig(token, { title: `Tied ${i}`, payAmount: 1000 });
    }

    const page1 = await request(app).get('/api/gigs').query({ sort: 'highest_pay', page: 1 });
    const page2 = await request(app).get('/api/gigs').query({ sort: 'highest_pay', page: 2 });

    expect(page1.body.data.gigs).toHaveLength(10);
    expect(page2.body.data.gigs).toHaveLength(2);
    const ids1 = idsOf(page1);
    const ids2 = idsOf(page2);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
    expect(new Set([...ids1, ...ids2]).size).toBe(12);
  });

  it('the tiebreak also holds for starting_soon, whose ordering runs through aggregation', async () => {
    const token = await registerBusiness('search-tiebreak-soon@example.com');
    for (let i = 0; i < 12; i += 1) {
      await createGig(token, { title: `Undated ${i}` });
    }

    const page1 = await request(app).get('/api/gigs').query({ sort: 'starting_soon', page: 1 });
    const page2 = await request(app).get('/api/gigs').query({ sort: 'starting_soon', page: 2 });

    const ids1 = idsOf(page1);
    const ids2 = idsOf(page2);
    expect(ids1.filter((id) => ids2.includes(id))).toHaveLength(0);
    expect(new Set([...ids1, ...ids2]).size).toBe(12);
  });

  it('never surfaces savedBy through the starting_soon aggregation path', async () => {
    const token = await registerBusiness('search-soon-privacy@example.com');
    const gig = await createGig(token, { title: 'Has savers', startDate: '2026-09-01' });
    await Gig.updateOne({ _id: gig.id }, { $set: { savedBy: [new mongoose.Types.ObjectId()] } });

    const res = await request(app).get('/api/gigs').query({ sort: 'starting_soon' });

    expect(JSON.stringify(res.body)).not.toMatch(/savedBy/i);
  });

  it('total counts results after filtering, not the unfiltered set', async () => {
    const token = await registerBusiness('search-total@example.com');
    await createGig(token, { title: 'Tutor A', category: 'tutoring' });
    await createGig(token, { title: 'Tutor B', category: 'tutoring' });
    await createGig(token, { title: 'Delivery A', category: 'delivery' });

    const res = await request(app).get('/api/gigs').query({ category: 'tutoring' });

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.gigs).toHaveLength(2);
  });

  it('status: open is applied unconditionally — a closed gig satisfying every other filter never appears', async () => {
    const token = await registerBusiness('search-closed@example.com');
    const matchingEverything = {
      description: 'Matches every filter below.',
      category: 'tutoring',
      payType: 'per_hour',
      payAmount: 5000,
      city: 'Galle',
      remote: false,
      schedule: ['weekends'],
      commitment: 'ongoing',
      startDate: '2026-09-01',
    };

    const decoy = await createGig(token, { ...matchingEverything, title: 'Sneaky closed gig' });
    await closeGig(token, decoy.id);

    const matching = await createGig(token, { ...matchingEverything, title: 'Genuinely open gig' });

    const res = await request(app).get('/api/gigs').query({
      category: 'tutoring',
      payType: 'per_hour',
      minPay: 5000,
      city: 'galle',
      remote: 'false',
      schedule: 'weekends',
      commitment: 'ongoing',
      sort: 'starting_soon',
    });

    expect(res.status).toBe(200);
    const ids = idsOf(res);
    expect(ids).not.toContain(decoy.id);
    expect(ids).toContain(matching.id);
    expect(res.body.data.total).toBe(1);
  });
});
