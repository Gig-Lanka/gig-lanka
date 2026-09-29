import { Pressable, Text, View } from 'react-native';

// `flat` is the grey-filled, borderless card the v3 frames draw for a read-only
// summary (`.card-flat`) - denser than the default, so it carries its own
// padding rather than leaning on a `className` override, which can't reliably
// beat the default's `p-5` / `bg-paper` / `border-line`. Ignored on a
// selectable card (one with a `title`), which has its own selected look.
export default function Card({
  children,
  title,
  description,
  selected = false,
  flat = false,
  onPress,
  className,
  ...props
}) {
  const isSelectable = title !== undefined;
  const isSelected = isSelectable && selected;
  const isFlat = flat && !isSelectable;
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={[
        'rounded-ds-card border-[1.5px]',
        isFlat ? 'border-transparent bg-haze p-4' : 'p-5',
        !isFlat && (isSelected ? 'border-ink bg-ink' : 'border-line bg-paper'),
        isSelectable && 'flex-row items-start gap-[14px]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {isSelectable ? (
        <>
          <View className="flex-1">
            <Text
              className={['font-display text-title', isSelected ? 'text-paper' : 'text-ink'].join(
                ' ',
              )}
            >
              {title}
            </Text>
            {description ? (
              <Text
                className={[
                  'mt-[5px] text-desc',
                  isSelected ? 'text-muted-dark' : 'text-muted',
                ].join(' ')}
              >
                {description}
              </Text>
            ) : null}
          </View>

          <View
            className={[
              'mt-0.5 h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
              isSelected ? 'bg-signal' : 'border-[1.5px] border-line',
            ].join(' ')}
          >
            {isSelected ? <Text className="text-[13px] font-bold text-paper">✓</Text> : null}
          </View>
        </>
      ) : (
        children
      )}
    </Container>
  );
}
