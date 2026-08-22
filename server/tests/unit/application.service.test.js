import mongoose from 'mongoose';
import { Application } from '../../src/models/application.model.js';
import { Gig } from '../../src/models/gig.model.js';
import { User } from '../../src/models/user.model.js';
import {
  transitionApplicationStatus,
  adjustGigApplicantCount,
} from '../../src/services/application.service.js';

const buildSnapshot = () => ({
  name: 'Nimal Perera',
  headline: 'Second-year student, free weekday evenings and weekends.',
  experience: [],
  education: [],
  rating: { averageRating: 0, reviewCount: 0, topCategories: [] },
});

const validGigPayload = {
  title: 'Weekend event helper',
  description: 'Help set up and run a community weekend event, greeting guests.',
  category: 'event_help',
  payAmount: 2500,
  payType: 'per_day',
  city: 'Colombo',
  schedule: ['weekends'],
  commitment: 'one_off',
  positions: 2,
};

describe('transitionApplicationStatus', () => {
  let business;
  let applicant;
  let gig;
  let businessActor;
  let applicantActor;

  beforeEach(async () => {
    business = await User.create({
      email: 'biz@example.com',
      passwordHash: 'hash',
      role: 'business',
    });
    applicant = await User.create({
      email: 'seeker@example.com',
      passwordHash: 'hash',
      role: 'seeker',
    });
    gig = await Gig.create({ ...validGigPayload, postedBy: business._id });

    businessActor = { id: business.id, role: 'business' };
    applicantActor = { id: applicant.id, role: 'seeker' };
  });

  const seedApplication = async (status, overrides = {}) =>
    Application.create({
      gig: gig._id,
      applicant: applicant._id,
      profileSnapshot: buildSnapshot(),
      status,
      ...overrides,
    });

  describe('permitted moves', () => {
    const cases = [
      ['applied', 'viewed', () => businessActor],
      ['applied', 'withdrawn', () => applicantActor],
      ['applied', 'closed_filled', () => null],
      ['viewed', 'shortlisted', () => businessActor],
      ['viewed', 'withdrawn', () => applicantActor],
      ['viewed', 'closed_filled', () => null],
      ['shortlisted', 'hired', () => businessActor],
      ['shortlisted', 'withdrawn', () => applicantActor],
      ['hired', 'completed', () => businessActor],
    ];

    it.each(cases)('allows %s -> %s for the right actor', async (from, to, actorFn) => {
      const application = await seedApplication(from);

      const result = await transitionApplicationStatus(application, to, actorFn());

      expect(result.status).toBe(to);

      const reloaded = await Application.findById(application._id);
      expect(reloaded.status).toBe(to);
    });

    it.each([['applied'], ['viewed'], ['shortlisted']])(
      'allows %s -> rejected by the owning business with a reason code',
      async (from) => {
        const application = await seedApplication(from);

        const result = await transitionApplicationStatus(application, 'rejected', businessActor, {
          code: 'schedule_mismatch',
          note: 'Could not make the shift pattern work.',
        });

        expect(result.status).toBe('rejected');
        expect(result.rejectionReasonCode).toBe('schedule_mismatch');
        expect(result.rejectionNote).toBe('Could not make the shift pattern work.');
      },
    );
  });

  describe('actor restrictions', () => {
    it("refuses the owning business withdrawing on the applicant's behalf", async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'withdrawn', businessActor),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses the applicant marking their own application Viewed', async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'viewed', applicantActor),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses a business that does not own the gig', async () => {
      const otherBusiness = { id: new mongoose.Types.ObjectId().toString(), role: 'business' };
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'viewed', otherBusiness),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses a seeker who is not the applicant withdrawing it', async () => {
      const otherSeeker = { id: new mongoose.Types.ObjectId().toString(), role: 'seeker' };
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'withdrawn', otherSeeker),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses the applicant marking their own hired application Completed', async () => {
      const application = await seedApplication('hired', { decidedAt: new Date() });

      await expect(
        transitionApplicationStatus(application, 'completed', applicantActor),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses a business that does not own the gig marking it Completed', async () => {
      const otherBusiness = { id: new mongoose.Types.ObjectId().toString(), role: 'business' };
      const application = await seedApplication('hired', { decidedAt: new Date() });

      await expect(
        transitionApplicationStatus(application, 'completed', otherBusiness),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses a system-triggered call (no actor) marking an application Completed', async () => {
      const application = await seedApplication('hired', { decidedAt: new Date() });

      await expect(
        transitionApplicationStatus(application, 'completed', null),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses a business request moving an application to Closed - position filled', async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'closed_filled', businessActor),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
    });

    it('refuses an unauthenticated call to a business-gated transition', async () => {
      const application = await seedApplication('applied');

      await expect(transitionApplicationStatus(application, 'viewed', null)).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
      });
    });

    it('allows a system-triggered call (no actor) to close-fill', async () => {
      const application = await seedApplication('applied');

      const result = await transitionApplicationStatus(application, 'closed_filled', null);

      expect(result.status).toBe('closed_filled');
    });
  });

  describe('rejection reason codes', () => {
    it('refuses a rejection with no reason code, 400', async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'rejected', businessActor),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    });

    it('refuses the system-only positions_filled code from a business, 400', async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'rejected', businessActor, {
          code: 'positions_filled',
        }),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    });

    it('refuses a trial-related code while the gig carries no skill trial, 400', async () => {
      const application = await seedApplication('applied');

      await expect(
        transitionApplicationStatus(application, 'rejected', businessActor, {
          code: 'skill_trial_not_passed',
        }),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
    });
  });

  describe('timestamps', () => {
    it('sets viewedAt the first time Viewed is reached and a later transition leaves it untouched', async () => {
      const application = await seedApplication('applied');

      const viewed = await transitionApplicationStatus(application, 'viewed', businessActor);
      const firstViewedAt = viewed.viewedAt;
      expect(firstViewedAt).toBeInstanceOf(Date);

      const shortlisted = await transitionApplicationStatus(viewed, 'shortlisted', businessActor);
      expect(shortlisted.viewedAt.getTime()).toBe(firstViewedAt.getTime());
    });

    it('never overwrites an already-set viewedAt', async () => {
      const earlier = new Date('2026-01-01T00:00:00.000Z');
      const application = await seedApplication('applied', { viewedAt: earlier });

      const result = await transitionApplicationStatus(application, 'viewed', businessActor);

      expect(result.viewedAt.getTime()).toBe(earlier.getTime());
    });

    it('sets decidedAt the first time a decided status is reached', async () => {
      const application = await seedApplication('shortlisted');

      const result = await transitionApplicationStatus(application, 'hired', businessActor);

      expect(result.decidedAt).toBeInstanceOf(Date);
    });

    // The trap GL-218 exists to stop: `hired` staying in DECIDED_STATUSES is
    // what keeps decidedAt stamped at the moment of hire, now that Hired has
    // an outgoing move. Drop it from the list and this test goes null.
    it('stamps decidedAt at the moment of hire and completion does not move it', async () => {
      const application = await seedApplication('shortlisted');

      const hired = await transitionApplicationStatus(application, 'hired', businessActor);
      const decidedAtHire = hired.decidedAt;
      expect(decidedAtHire).toBeInstanceOf(Date);

      const completed = await transitionApplicationStatus(hired, 'completed', businessActor);

      expect(completed.status).toBe('completed');
      expect(completed.decidedAt.getTime()).toBe(decidedAtHire.getTime());
      expect(completed.completedAt).toBeInstanceOf(Date);

      const reloaded = await Application.findById(application._id);
      expect(reloaded.decidedAt.getTime()).toBe(decidedAtHire.getTime());
    });

    // Completing an application that somehow never had decidedAt stamped still
    // gets one, because `completed` is in the list too — the seeker's tracker
    // never renders a decided application against a null date.
    it('stamps decidedAt on completion when the hire left it unset', async () => {
      const application = await seedApplication('hired', { decidedAt: null });

      const result = await transitionApplicationStatus(application, 'completed', businessActor);

      expect(result.decidedAt).toBeInstanceOf(Date);
    });

    it('never overwrites an already-set decidedAt', async () => {
      const earlier = new Date('2026-01-01T00:00:00.000Z');
      const application = await seedApplication('shortlisted', { decidedAt: earlier });

      const result = await transitionApplicationStatus(application, 'hired', businessActor);

      expect(result.decidedAt.getTime()).toBe(earlier.getTime());
    });

    it('leaves completedAt null until Completed is reached', async () => {
      const application = await seedApplication('shortlisted');

      const result = await transitionApplicationStatus(application, 'hired', businessActor);

      expect(result.completedAt).toBeNull();
    });

    it('sets completedAt the first time Completed is reached', async () => {
      const application = await seedApplication('hired', { decidedAt: new Date() });

      const result = await transitionApplicationStatus(application, 'completed', businessActor);

      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('never overwrites an already-set completedAt', async () => {
      const earlier = new Date('2026-01-01T00:00:00.000Z');
      const application = await seedApplication('hired', {
        decidedAt: new Date(),
        completedAt: earlier,
      });

      const result = await transitionApplicationStatus(application, 'completed', businessActor);

      expect(result.completedAt.getTime()).toBe(earlier.getTime());
    });
  });

  describe('structurally forbidden moves (unaffected by actor rules)', () => {
    const forbidden = [
      // Not in the permitted-moves list at all.
      ['applied', 'hired'],
      ['applied', 'shortlisted'],
      // Status never moves backwards.
      ['viewed', 'applied'],
      ['shortlisted', 'viewed'],
      ['shortlisted', 'applied'],
      // Terminal statuses can never be reopened by any transition. Hired's
      // only outgoing move is to Completed; everything else out of it stays
      // refused.
      ['hired', 'viewed'],
      ['hired', 'rejected'],
      ['rejected', 'applied'],
      ['rejected', 'viewed'],
      ['withdrawn', 'applied'],
      ['withdrawn', 'viewed'],
      ['closed_filled', 'applied'],
      ['closed_filled', 'viewed'],
      // Completing is reachable from Hired and from nowhere else — a business
      // cannot skip the chain by marking an undecided application finished.
      ['applied', 'completed'],
      ['viewed', 'completed'],
      ['shortlisted', 'completed'],
      ['rejected', 'completed'],
      ['withdrawn', 'completed'],
      ['closed_filled', 'completed'],
      ['completed', 'completed'],
      // And Completed itself is the end of the line.
      ['completed', 'viewed'],
      ['completed', 'hired'],
      ['completed', 'rejected'],
      ['completed', 'withdrawn'],
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

  describe('adjustGigApplicantCount', () => {
    it('increments and decrements the count and returns the new value', async () => {
      await expect(adjustGigApplicantCount(gig._id, 1)).resolves.toBe(1);
      await expect(adjustGigApplicantCount(gig._id, 1)).resolves.toBe(2);
      await expect(adjustGigApplicantCount(gig._id, -1)).resolves.toBe(1);

      const reloaded = await Gig.findById(gig._id);
      expect(reloaded.applicantCount).toBe(1);
    });
  });

  describe('applicant count on transition', () => {
    const decrementing = [
      ['applied', 'rejected', () => businessActor, { code: 'schedule_mismatch' }],
      ['applied', 'withdrawn', () => applicantActor, undefined],
      ['applied', 'closed_filled', () => null, undefined],
      ['viewed', 'rejected', () => businessActor, { code: 'schedule_mismatch' }],
      ['viewed', 'withdrawn', () => applicantActor, undefined],
      ['viewed', 'closed_filled', () => null, undefined],
      ['shortlisted', 'rejected', () => businessActor, { code: 'schedule_mismatch' }],
      ['shortlisted', 'withdrawn', () => applicantActor, undefined],
    ];

    it.each(decrementing)(
      'decrements applicantCount when %s -> %s leaves the live set',
      async (from, to, actorFn, reason) => {
        await Gig.findByIdAndUpdate(gig._id, { applicantCount: 1 });
        const application = await seedApplication(from);

        await transitionApplicationStatus(application, to, actorFn(), reason);

        const reloadedGig = await Gig.findById(gig._id);
        expect(reloadedGig.applicantCount).toBe(0);
      },
    );

    const staysLive = [
      ['applied', 'viewed', () => businessActor],
      ['viewed', 'shortlisted', () => businessActor],
      ['shortlisted', 'hired', () => businessActor],
      ['hired', 'completed', () => businessActor],
    ];

    it.each(staysLive)(
      'leaves applicantCount untouched when %s -> %s stays in the live set',
      async (from, to, actorFn) => {
        await Gig.findByIdAndUpdate(gig._id, { applicantCount: 1 });
        const application = await seedApplication(from);

        await transitionApplicationStatus(application, to, actorFn());

        const reloadedGig = await Gig.findById(gig._id);
        expect(reloadedGig.applicantCount).toBe(1);
      },
    );
  });
});
