import { Text, View } from 'react-native';

// `{ label, value }` rows — a `null`/`''` value drops the row rather than
// rendering an empty one, since several gig fields (schedule, startDate)
// are optional.
export default function GigDetailList({ rows, className }) {
  const visibleRows = rows.filter((row) => row.value != null && row.value !== '');

  return (
    <View className={className}>
      {visibleRows.map((row, index) => (
        <View
          key={row.label}
          className={[
            'flex-row items-center justify-between py-[10px]',
            index < visibleRows.length - 1 ? 'border-b border-line' : null,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Text className="text-[13.5px] text-muted">{row.label}</Text>
          <Text className="text-[13.5px] font-semibold text-ink">{row.value}</Text>
        </View>
      ))}
    </View>
  );
}
