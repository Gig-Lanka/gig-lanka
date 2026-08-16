import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import EducationEntryForm, {
  createEmptyEducationFormValues,
} from '../../components/profile/EducationEntryForm';
import { validateEducationEntry } from '../../utils/validation';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Fields other than education that PUT /api/profiles/me still needs - left
// out of the body, a PUT clears them rather than preserving them
// (docs/api-contract.md §8.4).
const PASSTHROUGH_FIELDS = ['name', 'photo', 'bio', 'city', 'skills', 'workExperience'];

export default function EducationFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const entryId = route.params?.entryId;
  const isEditing = Boolean(entryId);

  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [passthrough, setPassthrough] = useState({});
  const [education, setEducation] = useState([]);

  const [values, setValues] = useState(createEmptyEducationFormValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Loaded fresh every time this screen gains focus, matching
  // ExperienceFormScreen's own pattern - the current array of entries lives
  // only on the profile document, so there's no per-entry endpoint to fetch.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (cancelled) return;

          const entries = data.education ?? [];
          const existingEntry = isEditing
            ? entries.find((entry) => entry._id === entryId)
            : null;

          if (isEditing && !existingEntry) {
            setStatus(STATUS.ERROR);
            return;
          }

          setPassthrough(
            Object.fromEntries(PASSTHROUGH_FIELDS.map((field) => [field, data[field]])),
          );
          setEducation(entries);
          setValues(
            existingEntry
              ? {
                  institution: existingEntry.institution ?? '',
                  qualification: existingEntry.qualification ?? '',
                  startDate: existingEntry.startDate ?? null,
                  endDate: existingEntry.endDate ?? null,
                }
              : createEmptyEducationFormValues(),
          );
          setErrors({});
          setFormError('');
          setStatus(STATUS.READY);
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      setStatus(STATUS.LOADING);
      loadProfile();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken, entryId, isEditing]),
  );

  function setField(field, fieldValue) {
    setValues((current) => ({ ...current, [field]: fieldValue }));
  }

  async function handleSave() {
    const trimmedValues = {
      ...values,
      institution: values.institution.trim(),
      qualification: values.qualification.trim(),
    };
    const validationErrors = validateEducationEntry(trimmedValues);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    const entryPayload = {
      institution: trimmedValues.institution,
      qualification: trimmedValues.qualification,
      startDate: trimmedValues.startDate || undefined,
      endDate: trimmedValues.endDate || undefined,
    };

    const nextEducation = isEditing
      ? education.map((entry) =>
          entry._id === entryId ? { ...entryPayload, _id: entry._id } : entry,
        )
      : [...education, entryPayload];

    setSubmitting(true);
    try {
      await profileApi.updateMyProfile({
        ...passthrough,
        education: nextEducation,
      });
      navigation.goBack();
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        const unmatched = [];
        apiError.errors.forEach(({ field, message }) => {
          if (['institution', 'qualification', 'startDate', 'endDate'].includes(field)) {
            fieldErrors[field] = message;
          } else {
            unmatched.push(message);
          }
        });
        setErrors(fieldErrors);
        if (unmatched.length > 0) setFormError(unmatched.join(' '));
      } else {
        setFormError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <EmptyState
        className="bg-paper"
        message="We couldn't load this entry."
        actionLabel="Retry"
        onAction={() => setReloadToken((token) => token + 1)}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title={isEditing ? 'Edit education' : 'Add education'}
        small
        onBack={submitting ? undefined : () => navigation.goBack()}
      />

      <EducationEntryForm
        values={values}
        onChange={setField}
        errors={errors}
        formError={formError}
        disabled={submitting}
        footer={
          <Button onPress={handleSave} loading={submitting}>
            Save
          </Button>
        }
      />
    </SafeAreaView>
  );
}
