import mongoose from 'mongoose';
import { Application } from '../../src/models/application.model.js';
import { transitionApplicationStatus } from '../../src/services/application.service.js';

const buildSnapshot = () => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
});

const seedApplication = async (status) =>
  Application.create({
    gig: new mongoose.Types.ObjectId(),
    applicant: new mongoose.Types.ObjectId(),
    profileSnapshot: buildSnapshot(),
    status,
  });

describe('transitionApplicationStatus', () => {
  const permitted = [
    ['applied', 'viewed'],
    ['applied', 'rejected'],
    ['applied', 'withdrawn'],
    ['applied', 'closed_filled'],
    ['viewed', 'shortlisted'],
    ['viewed', 'rejected'],
    ['viewed', 'withdrawn'],
    ['viewed', 'closed_filled'],
    ['shortlisted', 'hired'],
    ['shortlisted', 'rejected'],
    ['shortlisted', 'withdrawn'],
  ];

  it.each(permitted)('allows %s -> %s and persists it', async (from, to) => {
    const application = await seedApplication(from);

    const result = await transitionApplicationStatus(application, to);

    expect(result.status).toBe(to);

    const reloaded = await Application.findById(application._id);
    expect(reloaded.status).toBe(to);
  });

  const forbidden = [
    // Not in the permitted-moves list at all.
    ['applied', 'hired'],
    ['applied', 'shortlisted'],
    // Status never moves backwards.
    ['viewed', 'applied'],
    ['shortlisted', 'viewed'],
    ['shortlisted', 'applied'],
    // The four terminal statuses can never be reopened by any transition.
    ['hired', 'viewed'],
    ['hired', 'rejected'],
    ['rejected', 'applied'],
    ['rejected', 'viewed'],
    ['withdrawn', 'applied'],
    ['withdrawn', 'viewed'],
    ['closed_filled', 'applied'],
    ['closed_filled', 'viewed'],
  ];

  it.each(forbidden)('rejects %s -> %s with 409 naming both statuses', async (from, to) => {
    const application = await seedApplication(from);

    await expect(transitionApplicationStatus(application, to)).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_APPLICATION_TRANSITION',
      message: expect.stringContaining(from),
    });

    const reloaded = await Application.findById(application._id);
    expect(reloaded.status).toBe(from);
  });
});
