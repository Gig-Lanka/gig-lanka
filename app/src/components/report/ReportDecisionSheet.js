import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import Button from '../ui/Button';
import TextInput from '../ui/TextInput';

const NOTE_MAX_LENGTH = 300;

const COPY = {
  resolve: {
    title: 'Resolve this report',
    body: 'Action was taken, or the report was valid.',
    confirmLabel: 'Resolve',
  },
  dismiss: {
    title: 'Dismiss this report',
    body: 'No action needed.',
    confirmLabel: 'Dismiss',
  },
};

/**
 * The admin's resolve/dismiss sheet (GL-452), modelled directly on
 * `RejectReasonSheet` and `ReportSheet` - a decision plus a note - so it
 * reuses that structure and sheet chrome rather than inventing a third kind
 * of sheet. The decision itself is already made by which button opened it
 * (`outcome` is `'resolve'` or `'dismiss'`), so there's no reason list,
 * only the note, and here the note is mandatory: Confirm stays disabled
 * until it has a non-space character, with the reason said beneath it.
 *
 * Finality is stated in the sheet itself, above Confirm - there is no
 * second confirmation dialog. The Cancel / Confirm row sits outside the
 * scroll so it stays pinned while the note grows.
 *
 * The caller owns the actual `PATCH .../resolve|dismiss` call and its
 * `submitting`/`error`/`errors` state. `errors.note`, if set, renders on the
 * note field (a VALIDATION_ERROR from the server); `error` is anything else
 * and stays a single line near the buttons, with the typed note left intact
 * so Confirm doubles as the retry.
 *
 * The caller should change `key` every time it opens this, so the note
 * resets to empty rather than carrying over from a previous opening.
 */
export default function ReportDecisionSheet({
  visible,
  outcome,
  submitting = false,
  error,
  errors = {},
  onConfirm,
  onCancel,
}) {
  const [note, setNote] = useState('');
  const copy = COPY[outcome] ?? COPY.resolve;
  const hasNote = note.trim().length > 0;

  function handleConfirm() {
    if (!hasNote || submitting) return;
    onConfirm(note);
  }

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
        <Pressable className="max-h-[86%] rounded-t-ds-sheet bg-paper" onPress={() => {}}>
          <View className="mx-auto mb-3.5 mt-3 h-[5px] w-11 rounded-full bg-line" />

          <ScrollView
            contentContainerClassName="px-[22px]"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="font-display text-[21px] tracking-[-0.03em] text-ink">
              {copy.title}
            </Text>
            <Text className="mt-[9px] text-[14px] leading-[21px] text-muted">{copy.body}</Text>

            <TextInput
              label="Note"
              placeholder="Record what was decided and why"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              error={errors.note}
              containerClassName="mb-0 mt-4"
              editable={!submitting}
            />
            <Text className="mt-1 text-right text-[11.5px] text-muted-dark">
              {note.length} / {NOTE_MAX_LENGTH}
            </Text>
          </ScrollView>

          <View className="px-[22px] pb-8">
            {error ? <Text className="mt-3 text-[12.5px] text-danger-ink">{error}</Text> : null}

            <Text className="mt-4 text-[12px] leading-[17.4px] text-muted">
              This can&apos;t be undone.
            </Text>

            <View className="mt-3 flex-row gap-[10px]">
              <Button
                variant="outline"
                fullWidth={false}
                className="flex-1"
                onPress={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                fullWidth={false}
                className="flex-1"
                onPress={handleConfirm}
                disabled={!hasNote || submitting}
                loading={submitting}
              >
                {copy.confirmLabel}
              </Button>
            </View>

            {!hasNote ? (
              <Text className="mt-2 text-center text-[12px] font-medium text-muted">
                Add a note to record the decision
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
