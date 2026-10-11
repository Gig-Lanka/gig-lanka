import { Pressable, Text, View } from 'react-native';

// `flush` drops the header's own horizontal padding. Use it inside <Screen>,
// which already pads its children - otherwise the title is indented twice and
// no longer lines up with the content below it.
export default function ScreenHeader({
  title,
  small = false,
  flush = false,
  onBack,
  rightSlot,
  className,
}) {
  return (
    <View
      className={[
        'min-h-12 flex-row items-center justify-between gap-3 pb-[10px] pt-4',
        flush ? '' : 'px-[22px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          className="h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-line bg-haze"
        >
          <Text className="text-[15px] font-semibold text-ink">‹</Text>
        </Pressable>
      ) : null}

      <Text
        className={[
          'flex-1 font-display text-ink',
          small ? 'text-[17px] tracking-[-0.015em]' : 'text-[25px] tracking-[-0.032em]',
        ].join(' ')}
        numberOfLines={1}
      >
        {title}
      </Text>

      {rightSlot ?? null}
    </View>
  );
}
