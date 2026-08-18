import { Text, View } from 'react-native';

import Badge from '../ui/Badge';
import { APPLICATION_STATUSES } from '../../constants/enums';
import { formatPay, formatRelativeTime } from '../../utils/format';

// §12 of the mockup source: Applied and Viewed neutral, Shortlisted and
// Hired positive, Rejected / Withdrawn / Closed muted grey - never alarm
// red, even for a rejection.
const BADGE_VARIANT_BY_STATUS = {
  applied: 'neutral',
  viewed: 'neutral',
  shortlisted: 'positive',
  hired: 'positive',
  rejected: 'muted',
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
