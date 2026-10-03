import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import Button from '../ui/Button';
import SectionLabel from '../ui/SectionLabel';
import TextInput from '../ui/TextInput';
import { REPORT_REASONS } from '../../constants/enums';

const NOTE_MAX_LENGTH = 300;

const TITLES = {
  gig: 'Report this gig',
  business: 'Report this business',
  person: 'Report this person',
};

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
 * The report bottom sheet (GL-380), modelled directly on
 * `RejectReasonSheet` - the same shape of problem, a mandatory pick from a
 * closed list plus an optional note, so it reuses that structure and sheet
 * chrome rather than inventing a second kind of sheet.
 *
 * The caller owns the actual `POST .../reports` call and its
 * `submitting`/`error` state, including the 409 "already reported" case,
 * which per GL-380 is handled as information rather than an error and isn't
 * this component's concern - it only picks the reason and the note.
 *
 * The caller should change `key` every time it opens this for a new target
 * (e.g. an incrementing counter bumped alongside `visible`) so the reason
 * and note reset to fresh - React remounts the component rather than
 * carrying the previous pick's state into the next one.
 */
export default function ReportSheet({
  visible,
  targetType,
  targetName,
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
              {TITLES[targetType]}
            </Text>
            <Text className="mt-[9px] text-[14px] leading-[21px] text-muted">
              Reporting {targetName}.
            </Text>

            <SectionLabel className="mt-5">Reason</SectionLabel>
            <View className="mt-2.5">
              {REPORT_REASONS.map((reason) => (
                <ReasonOption
                  key={reason.value}
                  label={reason.label}
                  selected={reasonCode === reason.value}
                  onPress={() => setReasonCode(reason.value)}
                />
              ))}
            </View>

            <SectionLabel className="mt-5">Anything else? (optional)</SectionLabel>
            <TextInput
              placeholder="Add a note"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={NOTE_MAX_LENGTH}
              containerClassName="mb-0 mt-2.5"
              editable={!submitting}
            />
            <Text className="mt-1 text-right text-[11.5px] text-muted-dark">
              {note.length} / {NOTE_MAX_LENGTH}
            </Text>

            <Text className="mt-4 text-[12px] leading-[17.4px] text-muted">
              This report goes to the Gig Lanka team. The person or business you&apos;re
              reporting won&apos;t be told who filed it.
            </Text>

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
                Submit report
              </Button>
            </View>

            {!reasonCode ? (
              <Text className="mt-2 text-center text-[12px] font-medium text-muted">
                Choose a reason to submit
              </Text>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
