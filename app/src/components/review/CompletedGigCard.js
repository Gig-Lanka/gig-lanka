import { Text, View } from 'react-native';

import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';

// Three states, one card - GL-271. `rated` gets the frame's grey-filled
// treatment (bg-haze, no border) rather than reduced opacity, which was
// failing contrast. `closed` (the window expired before a review was
// written) and `awaiting` both keep the default paper card; only the badge
// and the presence of the action button differ.
const STATE_STYLES = {
  awaiting: { card: 'border-[1.5px] border-line bg-paper', badgeVariant: 'warning' },
  closed: { card: 'border-[1.5px] border-line bg-paper', badgeVariant: 'muted' },
  rated: { card: 'border-transparent bg-haze', badgeVariant: 'positive' },
};

export default function CompletedGigCard({
  state,
  name,
  photoUri,
  square = false,
  gigTitle,
  subText,
  daysLeft,
  actionLabel,
  onPress,
  className,
}) {
  const styles = STATE_STYLES[state] ?? STATE_STYLES.awaiting;

  const badgeLabel =
    state === 'awaiting' ? `${daysLeft}d left` : state === 'rated' ? 'Rated ✓' : 'Rating closed';

  return (
    <View className={['rounded-ds-card p-4', styles.card, className].filter(Boolean).join(' ')}>
      <View className="flex-row items-center gap-[13px]">
        <Avatar uri={photoUri} name={name} square={square} size="md" />
        <View className="flex-1">
          <Text className="text-[15.5px] font-semibold text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="mt-[1px] text-[12.5px] text-muted" numberOfLines={1}>
            {gigTitle} · {subText}
          </Text>
        </View>
        <Badge variant={styles.badgeVariant}>{badgeLabel}</Badge>
      </View>

      {/* Expired and rated cards offer no action at all - a dead button that
          409s is the defect this story exists to avoid repeating. */}
      {state === 'awaiting' ? (
        <Button trailingArrow onPress={onPress} className="mt-3">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
