import { Modal, Pressable, Text, View } from 'react-native';

import Button from '../ui/Button';

/**
 * The bottom-sheet equivalent of `ConfirmDialog` (GL-103, a centred modal) -
 * GL-221's technical note puts both the hire confirmation and the
 * mark-complete confirmation in bottom sheets over a scrim instead, so
 * neither uses `ConfirmDialog`. Named after this file, the only one the
 * story's technical notes add for the two, and reused as-is for
 * mark-complete: both are the same shape - a title, a body, Cancel and one
 * confirm action - so it's parameterised rather than duplicated, the way
 * `ConfirmDialog` itself is already reused across withdraw, close-gig and
 * delete-gig.
 *
 * `title` must name the applicant being hired (GL-221 §3); `body` must
 * state no auto-close consequences for Hire (§4) and must state that
 * completing unlocks rating for both sides and can't be undone for Mark
 * complete (§11) - both are the caller's job, not this component's.
 */
export default function HireConfirmSheet({
  visible,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  submitting = false,
  error,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={submitting ? undefined : onCancel}
    >
      <Pressable
        className="flex-1 justify-end bg-ink/[0.46]"
        onPress={submitting ? undefined : onCancel}
      >
        <Pressable className="rounded-t-ds-sheet bg-paper px-[22px] pb-8 pt-3" onPress={() => {}}>
          <View className="mx-auto mb-3.5 h-[5px] w-11 rounded-full bg-line" />

          <Text className="font-display text-[21px] tracking-[-0.03em] text-ink">{title}</Text>
          <Text className="mt-[9px] text-[14px] leading-[21px] text-muted">{body}</Text>

          {error ? <Text className="mt-3 text-[12.5px] text-danger-ink">{error}</Text> : null}

          <View className="mt-5 flex-row gap-[10px]">
            <Button
              variant="outline"
              fullWidth={false}
              className="flex-1"
              onPress={onCancel}
              disabled={submitting}
            >
              {cancelLabel}
            </Button>
            <Button
              fullWidth={false}
              className="flex-1"
              onPress={onConfirm}
              disabled={submitting}
              loading={submitting}
            >
              {confirmLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
