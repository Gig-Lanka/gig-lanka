import { Text, View } from 'react-native';

const RATING_VALUES = [5, 4, 3, 2, 1];

export default function RatingBars({ distribution = {}, className, ...props }) {
  const total = RATING_VALUES.reduce((sum, rating) => sum + (distribution[rating] ?? 0), 0);

  return (
    <View className={['gap-[6px]', className].filter(Boolean).join(' ')} {...props}>
      {RATING_VALUES.map((rating) => {
        const count = distribution[rating] ?? 0;
        const percent = total > 0 ? (count / total) * 100 : 0;

        return (
          <View key={rating} className="flex-row items-center gap-[10px]">
            <Text className="w-[14px] text-[11.5px] font-semibold text-muted">{rating}</Text>
            <View className="h-[7px] flex-1 overflow-hidden rounded-full bg-haze">
              <View className="h-full rounded-full bg-signal" style={{ width: `${percent}%` }} />
            </View>
            <Text className="w-5 text-right text-[11px] text-muted-dark">{count}</Text>
          </View>
        );
      })}
    </View>
  );
}
