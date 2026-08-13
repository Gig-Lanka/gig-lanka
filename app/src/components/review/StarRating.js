import { Pressable, Text, View } from 'react-native';

const STAR_COUNT = 5;

const SIZE_STYLES = {
  lg: { star: 'text-[38px]', gap: 'gap-[10px]' },
  sm: { star: 'text-[18px]', gap: 'gap-[3px]' },
};

// Interactive stars get a fixed 44x44 tap target regardless of visual size,
// so the small inline size stays reliably tappable one-handed.
const TAP_TARGET = 'h-11 w-11 items-center justify-center';

export default function StarRating({ value = 0, onChange, size = 'lg', className, ...props }) {
  const sizeStyles = SIZE_STYLES[size] ?? SIZE_STYLES.lg;
  const interactive = typeof onChange === 'function';

  return (
    <View
      className={['flex-row', interactive ? '' : sizeStyles.gap, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const rating = i + 1;
        const filled = rating <= value;
        const star = (
          <Text className={[sizeStyles.star, filled ? 'text-signal' : 'text-line'].join(' ')}>
            ★
          </Text>
        );

        if (!interactive) {
          return <View key={rating}>{star}</View>;
        }

        return (
          <Pressable
            key={rating}
            onPress={() => onChange(rating)}
            className={TAP_TARGET}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${rating} star${rating === 1 ? '' : 's'}`}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
