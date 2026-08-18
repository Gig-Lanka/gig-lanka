import { Pressable, Text, View } from 'react-native';

import SectionLabel from '../ui/SectionLabel';

/** Section label with an optional trailing text link - `.section-head-row` in the v3 mockup. */
export default function ProfileSectionHeader({ title, actionLabel, onAction, className }) {
  return (
    <View
      className={['flex-row items-center justify-between', className].filter(Boolean).join(' ')}
    >
      <SectionLabel>{title}</SectionLabel>
      {actionLabel ? (
        <Pressable onPress={onAction}>
          <Text className="text-[12.5px] font-bold text-signal">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
