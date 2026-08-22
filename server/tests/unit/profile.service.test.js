import { User } from '../../src/models/user.model.js';
import { Profile } from '../../src/models/profile.model.js';
import { setRatingSummary } from '../../src/services/profile.service.js';

const aggregate = (overrides = {}) => ({
  averageRating: 4.3,
  reviewCount: 3,
  topCategories: ['communication'],
  distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 },
  ...overrides,
});

describe('setRatingSummary', () => {
  it('writes the aggregate onto a profile that already exists', async () => {
    const user = await User.create({ email: 'has-profile@example.com', passwordHash: 'hash', role: 'seeker' });
    await Profile.create({ user: user._id, name: 'Nimal Perera', city: 'Colombo' });

    await setRatingSummary(user._id, aggregate());

    const profile = await Profile.findOne({ user: user._id });
    expect(profile.ratingSummary.toObject()).toMatchObject(aggregate());
    // Narrow write: every other field on the profile is left untouched.
    expect(profile.city).toBe('Colombo');
  });

  it('creates the profile first when the subject has never read their own', async () => {
    const user = await User.create({ email: 'no-profile@example.com', passwordHash: 'hash', role: 'business' });
    expect(await Profile.findOne({ user: user._id })).toBeNull();

    await setRatingSummary(user._id, aggregate());

    const profile = await Profile.findOne({ user: user._id });
    expect(profile).not.toBeNull();
    expect(profile.ratingSummary.toObject()).toMatchObject(aggregate());
  });

  it('does nothing for a user id that does not exist', async () => {
    const missingUserId = (await User.create({ email: 'temp@example.com', passwordHash: 'hash', role: 'seeker' }))._id;
    await User.deleteOne({ _id: missingUserId });

    await expect(setRatingSummary(missingUserId, aggregate())).resolves.toBeUndefined();
    expect(await Profile.findOne({ user: missingUserId })).toBeNull();
  });
});
