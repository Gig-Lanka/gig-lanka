import { Text, View } from 'react-native';

import Badge from '../ui/Badge';
import { GIG_STATUSES } from '../../constants/enums';
import { formatDeadline, formatPay } from '../../utils/format';

const BADGE_VARIANT_BY_STATUS = {
  open: 'positive',
  filled: 'strong',
  closed: 'muted',
  draft: 'neutral',
};

function statusLabel(status) {
  return GIG_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export default function BusinessGigCard({ gig, className, ...props }) {
  const { title, payAmount, payType, status, applicantCount = 0, applicationsCloseDate } = gig;
  const deadline = applicationsCloseDate ? formatDeadline(applicationsCloseDate) : null;

  return (
    <View
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-display text-title text-ink">{title}</Text>
        <Badge variant={BADGE_VARIANT_BY_STATUS[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
      </View>

      <Text className="mt-[5px] text-desc text-muted">{formatPay(payAmount, payType)}</Text>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-[12.5px] text-muted-dark">
          {applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}
        </Text>
        {deadline ? (
          <Text
            className={[
              'text-[12.5px]',
              deadline.urgent ? 'text-danger-ink' : 'text-muted-dark',
            ].join(' ')}
          >
            {deadline.label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
