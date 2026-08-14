import mongoose from 'mongoose';
import { Application } from '../../src/models/application.model.js';
import { Profile } from '../../src/models/profile.model.js';

const buildSnapshot = (overrides = {}) => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [
    {
      roleTitle: 'Barista',
      employer: 'Cafe Kandy',
      startDate: '2025-06-01',
      endDate: '2025-12-31',
      ongoing: false,
    },
  ],
  education: [
    {
      institution: 'University of Colombo',
      qualification: 'BSc Computer Science',
    },
  ],
  rating: { averageRating: 4.6, reviewCount: 12, topCategories: ['communication'] },
  ...overrides,
});

describe('Application model', () => {
  beforeAll(async () => {
    await Application.init();
  });

  it('saves a valid application with defaults applied', async () => {
    const gig = new mongoose.Types.ObjectId();
    const applicant = new mongoose.Types.ObjectId();

    const application = await Application.create({
      gig,
      applicant,
      profileSnapshot: buildSnapshot(),
    });

    expect(application.status).toBe('applied');
    expect(application.appliedAt).toBeInstanceOf(Date);
    expect(application.viewedAt).toBeNull();
    expect(application.decidedAt).toBeNull();
    expect(application.profileSnapshot.name).toBe('Nimal Perera');
  });

  it('only accepts the seven closed status values', async () => {
    const application = new Application({
      gig: new mongoose.Types.ObjectId(),
      applicant: new mongoose.Types.ObjectId(),
      profileSnapshot: buildSnapshot(),
      status: 'not-a-real-status',
    });

    await expect(application.validate()).rejects.toThrow();
  });

  it('enforces one application per seeker per gig, permanently', async () => {
    const gig = new mongoose.Types.ObjectId();
    const applicant = new mongoose.Types.ObjectId();

    await Application.create({ gig, applicant, profileSnapshot: buildSnapshot() });

    await expect(
      Application.create({ gig, applicant, profileSnapshot: buildSnapshot() }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('withdrawing does not free the gig/applicant slot for a re-application', async () => {
    const gig = new mongoose.Types.ObjectId();
    const applicant = new mongoose.Types.ObjectId();

    const application = await Application.create({
      gig,
      applicant,
      profileSnapshot: buildSnapshot(),
      status: 'withdrawn',
    });

    expect(application.status).toBe('withdrawn');

    await expect(
      Application.create({ gig, applicant, profileSnapshot: buildSnapshot() }),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('does not change an existing application when the source profile is edited later', async () => {
    const applicantUser = new mongoose.Types.ObjectId();
    const profile = await Profile.create({
      user: applicantUser,
      name: 'Nimal Perera',
      bio: 'Second-year student, free weekday evenings and weekends.',
    });

    const application = await Application.create({
      gig: new mongoose.Types.ObjectId(),
      applicant: applicantUser,
      profileSnapshot: buildSnapshot({ name: profile.name, headline: profile.bio }),
    });

    profile.name = 'Nimal Perera (Updated)';
    profile.bio = 'A completely different bio now.';
    await profile.save();

    const reloaded = await Application.findById(application._id);

    expect(reloaded.profileSnapshot.name).toBe('Nimal Perera');
    expect(reloaded.profileSnapshot.headline).toBe(
      'Second-year student, free weekday evenings and weekends.',
    );
  });
});
