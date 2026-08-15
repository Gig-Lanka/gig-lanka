import { Pressable, Text, View } from 'react-native';

import Chip from '../ui/Chip';
import { GIG_CATEGORIES, SCHEDULE_TAGS } from '../../constants/enums';
import { formatDeadline, formatLocation, formatPay, formatRelativeTime } from '../../utils/format';

function categoryLabel(category) {
  return GIG_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

function scheduleLabel(tag) {
  return SCHEDULE_TAGS.find((entry) => entry.value === tag)?.label ?? tag;
}

export default function GigCard({ gig, onPress, className, ...props }) {
  const {
    title,
    payAmount,
    payType,
    city,
    area,
    remote,
    category,
    schedule = [],
    positions,
    applicantCount = 0,
    createdAt,
    applicationsCloseDate,
  } = gig;

  const deadline = applicationsCloseDate ? formatDeadline(applicationsCloseDate) : null;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Text className="text-[15.5px] font-semibold leading-[19.8px] tracking-[-0.01em] text-ink">
        {title}
      </Text>

      <Text className="mt-2 font-display text-title text-signal">{formatPay(payAmount, payType)}</Text>

      <Text className="mt-[2px] text-[13.5px] text-muted">
        {formatLocation({ isRemote: remote, area, city })}
      </Text>

      <Text className="mt-2 text-overline text-muted-dark">{categoryLabel(category)}</Text>

      <View className="mt-[10px] flex-row flex-wrap gap-[6px]">
        {schedule.map((tag) => (
          <Chip key={tag} size="sm">
            {scheduleLabel(tag)}
          </Chip>
        ))}
      </View>

      <View className="mt-[11px] flex-row items-center justify-between gap-3 border-t border-line pt-[10px]">
        <Text className="flex-1 text-[11.5px] text-muted-dark">
          {formatRelativeTime(createdAt)} · {positions} {positions === 1 ? 'position' : 'positions'} ·{' '}
          {applicantCount} applied
        </Text>
        {deadline ? (
          <Text
            className={[
              'text-[11.5px]',
              deadline.urgent ? 'font-semibold text-danger-ink' : 'font-medium text-muted',
            ].join(' ')}
          >
            {deadline.label}
          </Text>
        ) : null}
      </View>
    </Container>
  );
}
