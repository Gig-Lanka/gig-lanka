import { Pressable, Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import { APPLICATION_STATUSES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

// Same variant map as ApplicationCard.js (the seeker's row) - duplicated
// rather than shared, the same rule GL-118 and GL-121 followed for the two
// gig cards: no role branching inside either component.
const BADGE_VARIANT_BY_STATUS = {
  applied: 'neutral',
  viewed: 'neutral',
  shortlisted: 'positive',
  hired: 'positive',
  completed: 'positive',
  rejected: 'muted',
  withdrawn: 'muted',
  closed_filled: 'muted',
};

// Application & Hiring brief §12: exactly these three states get a badge on
// this row - `not_passed` isn't in the brief's list (or GL-299 AC10's) and
// gets no badge here, same as `not_submitted` or no submission at all. Same
// colours as the `#applicants` frame's badge-trial-pass/-sub/-skip classes,
// via the Badge variants already in use elsewhere rather than a new token.
const TRIAL_BADGE_BY_RESULT = {
  passed: { label: 'Trial passed', variant: 'positive' },
  submitted: { label: 'Trial submitted', variant: 'warning' },
  skipped: { label: 'Trial skipped', variant: 'muted' },
};

function statusLabel(status) {
  return APPLICATION_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

// profileSnapshot.rating is §11.1's frozen aggregate - reviewCount 0 is the
// normal case until GL-222 lands, not an edge case, so it gets its own copy
// rather than "0 reviews".
function formatRating(rating) {
  const { averageRating = 0, reviewCount = 0 } = rating ?? {};
  if (reviewCount === 0) return 'No ratings yet';
  return `★ ${averageRating.toFixed(1)} (${reviewCount})`;
}

// The business's view of an applicant - not ApplicationCard.js, which is the
// seeker's. `showGig` is only ever true in the unscoped ("for-my-gigs") mode,
// where each application carries a §11.6 gig summary; the gig-scoped mode
// (§11.12) omits `gig` entirely since the caller already knows it.
export default function ApplicantRow({
  application,
  showGig = false,
  onOpen,
  onReject,
  className,
}) {
  const { profileSnapshot, status, appliedAt, gig, skillTrialSubmission } = application;
  const trialBadge = TRIAL_BADGE_BY_RESULT[skillTrialSubmission?.result];

  return (
    <View
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="flex-row items-start gap-3">
        <Avatar name={profileSnapshot?.name} size="md" />
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 font-display text-title text-ink">{profileSnapshot?.name}</Text>
            <Badge variant={BADGE_VARIANT_BY_STATUS[status] ?? 'neutral'}>
              {statusLabel(status)}
            </Badge>
          </View>
          <Text className="mt-[3px] text-desc text-muted">
            {formatRating(profileSnapshot?.rating)}
          </Text>
          {showGig && gig ? (
            <Text className="mt-[3px] text-[12.5px] text-muted-dark">{gig.title}</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-3 flex-row items-center gap-[8px]">
        {trialBadge ? <Badge variant={trialBadge.variant}>{trialBadge.label}</Badge> : null}
        <Text className="text-[12.5px] text-muted-dark">
          Applied {formatRelativeTime(appliedAt)}
        </Text>
      </View>

      <View className="mt-3 flex-row gap-[10px]">
        <Pressable
          onPress={onOpen}
          className="h-9 flex-1 items-center justify-center rounded-ds-sm border-[1.5px] border-line bg-paper"
        >
          <Text className="text-label text-ink">Open</Text>
        </Pressable>
        {/* Present and inert until GL-221's reject sheet lands - onReject is
            left undefined by ApplicantsScreen for now, per GL-220's Out of
            Scope. */}
        <Pressable
          onPress={onReject}
          className="h-9 flex-1 items-center justify-center rounded-ds-sm border-[1.5px] border-line bg-paper"
        >
          <Text className="text-label text-muted-dark">Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}
