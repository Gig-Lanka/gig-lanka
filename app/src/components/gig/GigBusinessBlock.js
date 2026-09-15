import { Pressable, Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import RatingSummary from '../review/RatingSummary';
import { formatRelativeTime } from '../../utils/format';

// The posting business's identity, as returned under `data.business`
// (§10.2) alongside the gig itself - no second request needed.
//
// `onPress` is left undefined until the caller confirms the route it would
// navigate to actually exists (GL-155's public profile) - see
// GigDetailScreen, which is what keeps a tap inert rather than crashing on
// an unregistered screen while that story hasn't landed.
export default function GigBusinessBlock({ business, postedAt, onPress, className }) {
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={[
        'flex-row items-center gap-[13px] rounded-ds-lg bg-haze px-4 py-[13px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Avatar uri={business?.photo} name={business?.name} size="md" square />
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-ink" numberOfLines={1}>
          {business?.name ?? 'Business'}
        </Text>
        <RatingSummary rating={business?.ratingSummary} variant="compact" className="mt-[2px]" />
        <Text className="mt-[2px] text-[12px] text-muted">
          Posted {formatRelativeTime(postedAt)}
        </Text>
      </View>
      {onPress ? <Text className="text-[15px] text-muted-dark">›</Text> : null}
    </Container>
  );
}
