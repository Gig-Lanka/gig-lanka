import { Text, View } from 'react-native';

import Badge from '../ui/Badge';
import { APPLICATION_STATUSES } from '../../constants/enums';
import { formatPay, formatRelativeTime } from '../../utils/format';

// Kept in sync with ApplicantRow.js's map so a status reads the same colour
// on both sides. Applied is orange, Viewed amber, Shortlisted blue, Hired /
// Completed green, Rejected the app's danger red; Withdrawn and Closed stay
// muted grey since neither is a verdict on the applicant.
const BADGE_VARIANT_BY_STATUS = {
  applied: 'strong',
  viewed: 'warning',
  shortlisted: 'info',
  hired: 'positive',
  completed: 'positive',
  rejected: 'danger',
  withdrawn: 'muted',
  closed_filled: 'muted',
};

function statusLabel(status) {
  return APPLICATION_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export default function ApplicationCard({ application, className, ...props }) {
  const { gig, status, appliedAt } = application;

  return (
    <View
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-display text-title text-ink">
          {gig?.title ?? 'Gig no longer available'}
        </Text>
        <Badge variant={BADGE_VARIANT_BY_STATUS[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
      </View>

      {gig ? (
        <Text className="mt-[5px] text-desc text-muted">
          {formatPay(gig.payAmount, gig.payType)} · {gig.city}
        </Text>
      ) : null}

      <Text className="mt-3 text-[12.5px] text-muted-dark">
        Applied {formatRelativeTime(appliedAt)}
      </Text>
    </View>
  );
}
