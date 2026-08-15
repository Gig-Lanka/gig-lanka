import { Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/format';

// The posting business's identity, as returned under `data.business`
// (§10.2) alongside the gig itself — no second request needed. No rating
// slot here: that data doesn't come back from this endpoint, and GL-116's
// RatingSummary needs a `rating` object this screen never receives, so
// nothing is guessed in its place.
export default function GigBusinessBlock({ business, postedAt, className }) {
  return (
    <View
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
    </View>
  );
}
