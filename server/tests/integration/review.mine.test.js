import request from 'supertest';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';

const validPassword = 'Password123!';

const validGigPayload = {
  title: 'Weekend cafe shift',
  description: 'Help run the counter and serve customers during weekend shifts.',
  category: 'hospitality',
  payAmount: 1000,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 1,
};

const buildSnapshot = () => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
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

const createCompletedApplication = async (businessId, seekerId) => {
  const gig = await Gig.create({ ...validGigPayload, postedBy: businessId });

  return Application.create({
    gig: gig._id,
    applicant: seekerId,
    profileSnapshot: buildSnapshot(),
    status: 'completed',
    completedAt: new Date(),
  });
};

const postReview = async (applicationId, accessToken, body) =>
  request(app)
    .post(`/api/applications/${applicationId}/reviews`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);

describe('GET /api/reviews/mine', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/reviews/mine');

    expect(res.status).toBe(401);
  });

  it('returns 200 with an empty list for a caller who has written no reviews', async () => {
    const seeker = await registerSeeker('mine-empty-seeker@example.com');

    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toEqual([]);
  });

  it("returns only the caller's own reviews, each carrying its application id", async () => {
    const business = await registerBusiness('mine-business@example.com');
    const seeker = await registerSeeker('mine-seeker@example.com');
    const application = await createCompletedApplication(business.userId, seeker.userId);

    const created = await postReview(application.id, seeker.accessToken, {
      rating: 5,
      text: 'Paid on time and communicated clearly throughout the gig.',
      categories: ['fair_payment'],
    });
    expect(created.status).toBe(201);

    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].application).toBe(application.id);
    expect(res.body.data.reviews[0].author).toBe(seeker.userId);
    expect(res.body.data.reviews[0].direction).toBe('seeker_to_business');
  });

  it("does not return the other party's review of the same application", async () => {
    const business = await registerBusiness('mine-other-party-business@example.com');
    const seeker = await registerSeeker('mine-other-party-seeker@example.com');
    const application = await createCompletedApplication(business.userId, seeker.userId);

    await postReview(application.id, business.accessToken, {
      rating: 4,
      text: 'Solid, reliable work across the whole shift.',
    });

    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toEqual([]);
  });

  it("keeps each direction's rated status independent: a seeker's review of a business does not mark the business's own rating done", async () => {
    const business = await registerBusiness('mine-direction-business@example.com');
    const seeker = await registerSeeker('mine-direction-seeker@example.com');
    const application = await createCompletedApplication(business.userId, seeker.userId);

    await postReview(application.id, seeker.accessToken, {
      rating: 5,
      text: 'Paid on time and communicated clearly throughout the gig.',
    });

    const seekerMine = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);
    const businessMine = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${business.accessToken}`);

    expect(seekerMine.body.data.reviews).toHaveLength(1);
    expect(businessMine.body.data.reviews).toEqual([]);
  });

  it('returns newest first', async () => {
    const business = await registerBusiness('mine-order-business@example.com');
    const seeker = await registerSeeker('mine-order-seeker@example.com');
    const applicationOne = await createCompletedApplication(business.userId, seeker.userId);
    const applicationTwo = await createCompletedApplication(business.userId, seeker.userId);

    await postReview(applicationOne.id, seeker.accessToken, {
      rating: 3,
      text: 'The first review written, twenty-plus characters long.',
    });
    await postReview(applicationTwo.id, seeker.accessToken, {
      rating: 5,
      text: 'The second review written, twenty-plus characters long.',
    });

    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${seeker.accessToken}`);

    expect(res.body.data.reviews).toHaveLength(2);
    expect(res.body.data.reviews[0].application).toBe(applicationTwo.id);
    expect(res.body.data.reviews[1].application).toBe(applicationOne.id);
  });
});
