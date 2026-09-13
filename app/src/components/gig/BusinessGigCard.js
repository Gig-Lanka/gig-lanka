import { Pressable, Text, View } from 'react-native';

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

export default function BusinessGigCard({ gig, onPress, className, ...props }) {
  const {
    title,
    payAmount,
    payType,
    status,
    applicantCount = 0,
    applicationsCloseDate,
    waitingOnYouCount = 0,
  } = gig;
  const isOpen = status === 'open';
  // Application & Hiring brief §6: once a gig is filled, anyone still
  // shortlisted or sitting on a submitted skill trial is owed a personal
  // answer. This has no dismiss and no expiry - it's not a nudge, it's a
  // standing fact about the gig that only goes away once E4's sweep resolves
  // those applications. waitingOnYouCount comes from that story; this card
  // only renders it.
  const isWaitingOnBusiness = status === 'filled' && waitingOnYouCount > 0;
  // GL-283: same reasoning as GigDetailScreen - once not open, the deadline
  // chip shows the same status-derived "Applications closed" the badge
  // already shows, rather than a second, independently date-derived label.
  const deadline = isOpen
    ? applicationsCloseDate
      ? formatDeadline(applicationsCloseDate)
      : null
    : { label: 'Applications closed', urgent: false };
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
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

      {isWaitingOnBusiness ? (
        <View className="mt-3 rounded-ds-md bg-warning-soft px-[14px] py-[11px]">
          <Text className="text-[13.5px] font-medium text-warning-ink">
            {`${waitingOnYouCount} ${waitingOnYouCount === 1 ? 'applicant' : 'applicants'} still waiting on you`}
          </Text>
        </View>
      ) : null}
    </Container>
  );
}
