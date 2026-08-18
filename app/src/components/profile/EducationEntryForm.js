import { ScrollView, View } from 'react-native';

import DateField from '../ui/DateField';
import Notice from '../ui/Notice';
import TextInput from '../ui/TextInput';

export function createEmptyEducationFormValues() {
  return {
    institution: '',
    qualification: '',
    startDate: null,
    endDate: null,
  };
}

/**
 * One form for both adding and editing an education entry - the caller
 * (`EducationFormScreen`) decides which by pre-filling `values` or not.
 * Education has no `ongoing` flag or `description` field
 * (docs/api-contract.md §8.4), so this stays its own component rather than
 * branching `ExperienceEntryForm` on entry type.
 */
export default function EducationEntryForm({
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
          label="Institution"
          placeholder="e.g. SLIIT"
          value={values.institution}
          onChangeText={(text) => set('institution', text)}
          error={errors.institution}
          disabled={disabled}
          containerClassName="mt-5"
          maxLength={80}
        />

        <TextInput
          label="Qualification"
          placeholder="e.g. BSc (Hons) Information Technology"
          value={values.qualification}
          onChangeText={(text) => set('qualification', text)}
          error={errors.qualification}
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

        <DateField
          label="End date"
          value={values.endDate}
          onChange={(next) => set('endDate', next)}
          optional
          placeholder="Select an end date"
          error={errors.endDate}
          disabled={disabled}
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
