import { GIG_STATUSES } from '../constants/enums';

// Shared by BusinessGigCard and GigDetailScreen so a gig's status badge
// looks identical wherever it appears.
export const GIG_STATUS_BADGE_VARIANT = {
  open: 'positive',
  filled: 'strong',
  closed: 'muted',
  draft: 'neutral',
};

// GL-434: a takedown is still status 'closed' - what changes is the label,
// not the status vocabulary or the badge's variant, so the business reads
// "Closed by Gig Lanka" instead of a plain "Closed" that could look like
// their own action or a bug. No reason, no reporter - just who closed it.
export function getGigStatusLabel({ status, closedByAdminAt }) {
  if (status === 'closed' && closedByAdminAt) {
    return 'Closed by Gig Lanka';
  }

  return GIG_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}
