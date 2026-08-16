import { Text, View } from 'react-native';

import Button from '../ui/Button';

/**
 * Inline prompt for an empty repeatable section (skills, work experience,
 * education) - invites the first entry instead of just showing nothing.
 * Not `EmptyState` from `components/ui`: that one is a full-screen block,
 * this sits inside a section of an otherwise-populated screen.
 */
export default function ProfileEmptyRow({ message, actionLabel, onAction, className }) {
  return (
    <View
      className={['items-center gap-3 rounded-ds-lg bg-haze px-4 py-5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="text-center text-[13px] font-medium text-muted">{message}</Text>
      <Button variant="small" fullWidth={false} onPress={onAction}>
        {actionLabel}
      </Button>
    </View>
  );
}
