import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import Button from '../ui/Button';
import TextInput from '../ui/TextInput';
import { REJECTION_REASONS } from '../../constants/enums';

const NOTE_MAX_LENGTH = 300;

// §11.4/§6.8: five business-selectable codes this sprint, not seven -
// `positions_filled` is system-only (§10) and the two skill-trial codes are
// refused by the server on any gig without a trial, which is every gig
// until Sprint 3 (GL-221's Out of Scope). Filtering `REJECTION_REASONS`
// here, rather than retyping five strings, is what keeps this list from
// drifting from the server's vocabulary.
const TRIAL_CODES = new Set(['skill_trial_not_passed', 'skill_trial_not_attempted']);
const REASON_OPTIONS = REJECTION_REASONS.filter(
  (reason) => !reason.systemOnly && !TRIAL_CODES.has(reason.value),
);

function ReasonOption({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={[
        'mb-2 flex-row items-center justify-between gap-3 rounded-ds-lg border-[1.5px] px-[15px] py-[13px]',
        selected ? 'border-signal bg-signal-soft' : 'border-line bg-paper',
      ].join(' ')}
    >
      <Text
        className={[
          'flex-1 text-[14px]',
          selected ? 'font-semibold text-signal-ink' : 'font-medium text-ink',
        ].join(' ')}
      >
        {label}
      </Text>
      <View
        className={[
          'h-[21px] w-[21px] flex-shrink-0 items-center justify-center rounded-full',
          selected ? 'bg-signal' : 'border-[1.5px] border-line',
        ].join(' ')}
      >
        {selected ? <Text className="text-[11px] font-bold text-paper">✓</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * The bottom sheet from GL-221's `#reject-reason` frame - opened from both
 * the applicant detail screen and the Reject action on the applicants list
 * row (GL-221 §5). Each caller owns the actual `PATCH .../reject` call and
 * its `submitting`/`error` state; this component only picks the code and
 * the note. `ConfirmDialog` (GL-103) is a centred modal - this is a scrim
 * sheet, so it isn't reused here, per GL-221's technical note.
 *
 * The caller should change `key` every time it opens this for a new pick
 * (e.g. an incrementing counter bumped alongside `visible`) so the code and
 * note reset to fresh - React remounts the component rather than carrying
 * the previous pick's state into the next one.
 */
export default function RejectReasonSheet({
  visible,
  applicantName,
  submitting = false,
  error,
  onConfirm,
  onCancel,
}) {
  const [reasonCode, setReasonCode] = useState(null);
  const [note, setNote] = useState('');

  function handleConfirm() {
    if (!reasonCode || submitting) return;
    onConfirm({ reasonCode, note: note.length > 0 ? note : undefined });
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
            contentContainerClassName="px-[22px] pb-8"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text className="font-display text-[21px] tracking-[-0.03em] text-ink">
              Why are you rejecting?
            </Text>
            <Text className="mt-[9px] text-[14px] leading-[21px] text-muted">
              Rejecting {applicantName}. They&apos;ll see the reason you pick.
            </Text>

            <View className="mt-4">
              {REASON_OPTIONS.map((reason) => (
                <ReasonOption
                  key={reason.value}
                  label={reason.label}
                  selected={reasonCode === reason.value}
                  onPress={() => setReasonCode(reason.value)}
                />
              ))}
            </View>

            <TextInput
              label="Add a note (optional)"
              placeholder="Optional"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              hint="Shown to the applicant word for word."
              containerClassName="mb-0 mt-2"
              editable={!submitting}
            />

            {error ? <Text className="mt-3 text-[12.5px] text-danger-ink">{error}</Text> : null}

            <View className="mt-5 flex-row gap-[10px]">
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
                disabled={!reasonCode || submitting}
                loading={submitting}
              >
                Reject
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
