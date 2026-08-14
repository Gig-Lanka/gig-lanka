import { Text, View } from 'react-native';

/** A single work-experience or education row — `.entry-card` in the v3 mockup. */
export default function EntryCard({ title, subtitle, dateRange, className }) {
  return (
    <View
      className={['rounded-ds-lg border-[1.5px] border-line px-[15px] py-[14px]', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="text-[14.5px] font-bold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="mt-[2px] text-[13px] font-medium text-muted">{subtitle}</Text>
      ) : null}
      {dateRange ? (
        <Text className="mt-[5px] text-[11.5px] font-semibold tracking-[0.02em] text-muted-dark">
          {dateRange}
        </Text>
      ) : null}
    </View>
  );
}
