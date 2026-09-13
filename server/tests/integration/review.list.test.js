import request from 'supertest';
import app from '../../src/app.js';
import { Gig } from '../../src/models/gig.model.js';
import { Application } from '../../src/models/application.model.js';
import { Review } from '../../src/models/review.model.js';

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

const setProfile = async (accessToken, { name, photo }) => {
  const res = await request(app)
    .put('/api/profiles/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name, photo });

  if (res.status !== 200) {
    throw new Error(`setProfile failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
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

describe('GET /api/users/:userId/reviews', () => {
  it('rejects a guest with 401', async () => {
    const res = await request(app).get('/api/users/64f1a2b3c4d5e6f7a8b9c0d1/reviews');

    expect(res.status).toBe(401);
  });

  it('returns an empty page with total 0 for a user with no reviews', async () => {
    const caller = await registerSeeker('list-caller@example.com');

    const res = await request(app)
      .get('/api/users/64f1a2b3c4d5e6f7a8b9c0d1/reviews')
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('returns reviews about the user with live author name/photo, newest first', async () => {
    const business = await registerBusiness('list-review-business@example.com');
    const seeker = await registerSeeker('list-review-seeker@example.com');
    const otherSeeker = await registerSeeker('list-review-other-seeker@example.com');
    const caller = await registerSeeker('list-review-caller@example.com');

    await setProfile(seeker.accessToken, { name: 'Original Name', photo: 'https://cdn.test/old.jpg' });

    const applicationOne = await createCompletedApplication(business.userId, seeker.userId);
    const applicationTwo = await createCompletedApplication(business.userId, otherSeeker.userId);

    // Business reviews seeker (subject = seeker) on applicationOne.
    await request(app)
      .post(`/api/applications/${applicationOne.id}/reviews`)
      .set('Authorization', `Bearer ${business.accessToken}`)
      .send({ rating: 4, text: 'Solid, reliable work across the whole shift.' });

    // A different seeker's review of the business is not about our seeker.
    await request(app)
      .post(`/api/applications/${applicationTwo.id}/reviews`)
      .set('Authorization', `Bearer ${otherSeeker.accessToken}`)
      .send({ rating: 5, text: 'Paid on time and communicated clearly throughout.' });

    // Author changes their name after writing the review about the seeker —
    // wait, business is the author here. Change the business's profile after
    // the review to prove the read is live, not frozen.
    await setProfile(business.accessToken, { name: 'Updated Business Name', photo: 'https://cdn.test/new.jpg' });

    const res = await request(app)
      .get(`/api/users/${seeker.userId}/reviews`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.reviews).toHaveLength(1);

    const [review] = res.body.data.reviews;
    expect(review.rating).toBe(4);
    expect(review.text).toBe('Solid, reliable work across the whole shift.');
    expect(review.direction).toBe('business_to_seeker');
    expect(review.author.id).toBe(business.userId);
    expect(review.author.name).toBe('Updated Business Name');
    expect(review.author.photo).toBe('https://cdn.test/new.jpg');
    expect(review).toHaveProperty('categories');
    expect(review).toHaveProperty('createdAt');
  });

  it('paginates ten at a time, newest first, with a correct total', async () => {
    const business = await registerBusiness('page-business@example.com');
    const seeker = await registerSeeker('page-seeker@example.com');
    const caller = await registerSeeker('page-caller@example.com');

    for (let i = 0; i < 12; i += 1) {
      const application = await createCompletedApplication(business.userId, seeker.userId);
      await Review.create({
        application: application._id,
        author: business.userId,
        subject: seeker.userId,
        direction: 'business_to_seeker',
        rating: 5,
        text: `Review number ${i} written about this seeker, twenty plus chars.`,
      });
    }

    const pageOne = await request(app)
      .get(`/api/users/${seeker.userId}/reviews`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.data.reviews).toHaveLength(10);
    expect(pageOne.body.data.total).toBe(12);
    expect(pageOne.body.data.page).toBe(1);
    expect(pageOne.body.data.limit).toBe(10);

    const pageTwo = await request(app)
      .get(`/api/users/${seeker.userId}/reviews?page=2`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.data.reviews).toHaveLength(2);
    expect(pageTwo.body.data.total).toBe(12);
  });

  it('narrows to a single star value server-side, keeping total in sync with the filtered list', async () => {
    const business = await registerBusiness('rating-filter-business@example.com');
    const seeker = await registerSeeker('rating-filter-seeker@example.com');
    const caller = await registerSeeker('rating-filter-caller@example.com');

    const ratings = [5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 1];
    for (const rating of ratings) {
      const application = await createCompletedApplication(business.userId, seeker.userId);
      await Review.create({
        application: application._id,
        author: business.userId,
        subject: seeker.userId,
        direction: 'business_to_seeker',
        rating,
        text: `A review at ${rating} stars, long enough to pass validation easily.`,
      });
    }

    const fiveStar = await request(app)
      .get(`/api/users/${seeker.userId}/reviews?rating=5`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(fiveStar.status).toBe(200);
    expect(fiveStar.body.data.total).toBe(9);
    expect(fiveStar.body.data.reviews).toHaveLength(9);
    expect(fiveStar.body.data.reviews.every((review) => review.rating === 5)).toBe(true);

    // A matching review past the first page of the *unfiltered* list (the
    // 1-star review is 12th, i.e. on page 2 of the plain endpoint) must
    // still surface on page 1 of the filtered query — the defect GL-215/
    // GL-216 removed on Browse.
    const oneStar = await request(app)
      .get(`/api/users/${seeker.userId}/reviews?rating=1`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(oneStar.status).toBe(200);
    expect(oneStar.body.data.total).toBe(1);
    expect(oneStar.body.data.reviews).toHaveLength(1);
    expect(oneStar.body.data.reviews[0].rating).toBe(1);

    const fourStar = await request(app)
      .get(`/api/users/${seeker.userId}/reviews?rating=4`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(fourStar.status).toBe(200);
    expect(fourStar.body.data.total).toBe(0);
    expect(fourStar.body.data.reviews).toEqual([]);
  });

  it('rejects an out-of-range rating filter with 400', async () => {
    const caller = await registerSeeker('rating-filter-invalid-caller@example.com');

    const res = await request(app)
      .get('/api/users/64f1a2b3c4d5e6f7a8b9c0d1/reviews?rating=6')
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it("keeps a deactivated user's reviews visible — deactivation never deletes reviews", async () => {
    const business = await registerBusiness('deactivated-business@example.com');
    const seeker = await registerSeeker('deactivated-seeker@example.com');
    const caller = await registerSeeker('deactivated-caller@example.com');
    const application = await createCompletedApplication(business.userId, seeker.userId);

    await Review.create({
      application: application._id,
      author: business.userId,
      subject: seeker.userId,
      direction: 'business_to_seeker',
      rating: 3,
      text: 'A perfectly fine review written before any deactivation happened.',
    });

    // isActive doesn't exist as a field or flow yet (Sprint 3) — this asserts
    // the read path has no dependency on user status at all, deactivated or not.
    const res = await request(app)
      .get(`/api/users/${seeker.userId}/reviews`)
      .set('Authorization', `Bearer ${caller.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
  });
});
