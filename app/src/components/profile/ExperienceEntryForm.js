import { Pressable, ScrollView, Text, View } from 'react-native';

import DateField from '../ui/DateField';
import Notice from '../ui/Notice';
import TextInput from '../ui/TextInput';
import { WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH } from '../../utils/validation';

export function createEmptyExperienceFormValues() {
  return {
    roleTitle: '',
    employer: '',
    startDate: null,
    endDate: null,
    ongoing: false,
    description: '',
  };
}

function OngoingToggleField({ value, onChange, disabled }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={[
        'mb-4 flex-row items-center justify-between gap-3 rounded-ds-lg bg-haze px-4 py-3.5',
        disabled && 'opacity-40',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Text className="flex-1 text-[14.5px] font-medium text-ink">This is my current role</Text>
      <View
        className={[
          'h-6 w-6 items-center justify-center rounded-[8px]',
          value ? 'bg-signal' : 'border-[1.5px] border-line bg-paper',
        ].join(' ')}
      >
        {value ? <Text className="text-[13px] font-bold text-paper">✓</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * One form for both adding and editing a work experience entry — the caller
 * (`ExperienceFormScreen`) decides which by pre-filling `values` or not.
 * `components/ui` primitives only; the ongoing toggle and field labels are
 * specific to work experience, so it stays here rather than in `ui/`.
 */
export default function ExperienceEntryForm({
  values,
  onChange,
  errors = {},
  formError,
  footer,
  disabled = false,
}) {
  function set(field, fieldValue) {
    onChange(field, fieldValue);
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[22px] pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          label="Role title"
          placeholder="e.g. Barista (part-time)"
          value={values.roleTitle}
          onChangeText={(text) => set('roleTitle', text)}
          error={errors.roleTitle}
          disabled={disabled}
          containerClassName="mt-5"
          maxLength={80}
        />

        <TextInput
          label="Employer"
          placeholder="e.g. Brew & Co."
          value={values.employer}
          onChangeText={(text) => set('employer', text)}
          error={errors.employer}
          disabled={disabled}
          maxLength={80}
        />

        <DateField
          label="Start date"
          value={values.startDate}
          onChange={(next) => set('startDate', next)}
          optional
          placeholder="Select a start date"
          error={errors.startDate}
          disabled={disabled}
        />

        <OngoingToggleField
          value={values.ongoing}
          onChange={(next) => {
            set('ongoing', next);
            if (next) set('endDate', null);
          }}
          disabled={disabled}
        />

        {!values.ongoing ? (
          <DateField
            label="End date"
            value={values.endDate}
            onChange={(next) => set('endDate', next)}
            optional
            placeholder="Select an end date"
            error={errors.endDate}
            disabled={disabled}
          />
        ) : null}

        <TextInput
          label="Description"
          placeholder="What did the role involve?"
          value={values.description}
          onChangeText={(text) => set('description', text)}
          error={errors.description}
          hint={
            errors.description
              ? undefined
              : `${values.description.length} / ${WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH}`
          }
          disabled={disabled}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="h-[110px] pt-3"
          maxLength={WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH}
        />
      </ScrollView>

      {footer ? (
        <View className="border-t border-line px-[22px] pb-3 pt-3">
          {formError ? (
            <Notice variant="error" className="mb-3">
              {formError}
            </Notice>
          ) : null}
          {footer}
        </View>
      ) : null}
    </View>
  );
}
