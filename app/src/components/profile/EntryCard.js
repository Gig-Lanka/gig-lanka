import { Pressable, Text, View } from 'react-native';

/**
 * A single work-experience or education row — `.entry-card` in the v3 mockup.
 * `description` and `onEdit` are optional: the read-only summary on
 * `MyProfileScreen` passes neither, while the management screens (GL-149,
 * GL-150) pass both for the fuller row with an edit action.
 */
export default function EntryCard({ title, subtitle, dateRange, description, onEdit, className }) {
  return (
    <View
      className={[
        'flex-row items-start gap-[10px] rounded-ds-lg border-[1.5px] border-line px-[15px] py-[14px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="flex-1">
        <Text className="text-[14.5px] font-bold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="mt-[2px] text-[13px] font-medium text-muted">{subtitle}</Text>
        ) : null}
        {dateRange ? (
          <Text className="mt-[5px] text-[11.5px] font-semibold tracking-[0.02em] text-muted-dark">
            {dateRange}
          </Text>
        ) : null}
        {description ? (
          <Text className="mt-[6px] text-[13px] leading-[18px] text-muted">{description}</Text>
        ) : null}
      </View>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          className="h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-line bg-haze"
        >
          <Text className="text-[12px] text-muted">✎</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
