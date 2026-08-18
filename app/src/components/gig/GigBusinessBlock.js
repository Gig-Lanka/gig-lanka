import { Pressable, Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/format';

// The posting business's identity, as returned under `data.business`
// (§10.2) alongside the gig itself - no second request needed.
//
// `onPress` is left undefined until the caller confirms the route it would
// navigate to actually exists (GL-155's public profile) - see
// GigDetailScreen, which is what keeps a tap inert rather than crashing on
// an unregistered screen while that story hasn't landed.
//
// No rating slot: GET /api/gigs/:id never sends a rating for the business
// (only id/name/photo), and RatingSummary (GL-116) has no compact form
// built for a strip this size even once it does - so nothing is rendered
// here rather than a guessed score or the component's full breakdown.
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
        <Text className="mt-[2px] text-[12px] text-muted">
          Posted {formatRelativeTime(postedAt)}
        </Text>
      </View>
      {onPress ? <Text className="text-[15px] text-muted-dark">›</Text> : null}
    </Container>
  );
}
