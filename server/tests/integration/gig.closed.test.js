import mongoose from 'mongoose';
import { Gig } from '../../src/models/gig.model.js';
import { assertGigIsOpen } from '../../src/services/gig.service.js';
import { ApiError } from '../../src/utils/ApiError.js';

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

describe('assertGigIsOpen', () => {
  it('resolves with the gig when it is open', async () => {
    const gig = await Gig.create(validGigPayload());

    const result = await assertGigIsOpen(gig.id);

    expect(result.id.toString()).toBe(gig.id.toString());
  });

  it('throws GIG_CLOSED (409) for a closed gig, not a generic failure', async () => {
    const gig = await Gig.create(validGigPayload());
    gig.status = 'closed';
    await gig.save({ validateModifiedOnly: true });

    await expect(assertGigIsOpen(gig.id)).rejects.toMatchObject({
      status: 409,
      code: 'GIG_CLOSED',
    });
    await expect(assertGigIsOpen(gig.id)).rejects.toBeInstanceOf(ApiError);
  });

  it('throws GIG_CLOSED (409) for a filled gig', async () => {
    const gig = await Gig.create(validGigPayload());
    gig.status = 'filled';
    await gig.save({ validateModifiedOnly: true });

    await expect(assertGigIsOpen(gig.id)).rejects.toMatchObject({
      status: 409,
      code: 'GIG_CLOSED',
    });
  });

  it('throws NOT_FOUND (404) for a gig that does not exist', async () => {
    await expect(assertGigIsOpen('64f1a2b3c4d5e6f7a8b9c0d1')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
