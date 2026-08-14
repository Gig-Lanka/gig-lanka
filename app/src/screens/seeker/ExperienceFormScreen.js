import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import ExperienceEntryForm, {
  createEmptyExperienceFormValues,
} from '../../components/profile/ExperienceEntryForm';
import { validateWorkExperienceEntry } from '../../utils/validation';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

// Fields other than workExperience that PUT /api/profiles/me still needs —
// left out of the body, a PUT clears them rather than preserving them
// (docs/api-contract.md §8.4).
const PASSTHROUGH_FIELDS = ['name', 'photo', 'bio', 'city', 'skills', 'education'];

export default function ExperienceFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const entryId = route.params?.entryId;
  const isEditing = Boolean(entryId);

  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);
  const [passthrough, setPassthrough] = useState({});
  const [workExperience, setWorkExperience] = useState([]);

  const [values, setValues] = useState(createEmptyExperienceFormValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Loaded fresh every time this screen gains focus, matching
  // EditProfileScreen's own pattern — the current array of entries lives
  // only on the profile document, so there's no per-entry endpoint to fetch.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (cancelled) return;

          const entries = data.workExperience ?? [];
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
          setWorkExperience(entries);
          setValues(
            existingEntry
              ? {
                  roleTitle: existingEntry.roleTitle ?? '',
                  employer: existingEntry.employer ?? '',
                  startDate: existingEntry.startDate ?? null,
                  endDate: existingEntry.endDate ?? null,
                  ongoing: Boolean(existingEntry.ongoing),
                  description: existingEntry.description ?? '',
                }
              : createEmptyExperienceFormValues(),
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
      roleTitle: values.roleTitle.trim(),
      employer: values.employer.trim(),
      description: values.description.trim(),
    };
    const validationErrors = validateWorkExperienceEntry(trimmedValues);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    const entryPayload = {
      roleTitle: trimmedValues.roleTitle,
      employer: trimmedValues.employer,
      startDate: trimmedValues.startDate || undefined,
      endDate: trimmedValues.ongoing ? undefined : trimmedValues.endDate || undefined,
      ongoing: trimmedValues.ongoing,
      description: trimmedValues.description || undefined,
    };

    const nextWorkExperience = isEditing
      ? workExperience.map((entry) =>
          entry._id === entryId ? { ...entryPayload, _id: entry._id } : entry,
        )
      : [...workExperience, entryPayload];

    setSubmitting(true);
    try {
      await profileApi.updateMyProfile({
        ...passthrough,
        workExperience: nextWorkExperience,
      });
      navigation.goBack();
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        const unmatched = [];
        apiError.errors.forEach(({ field, message }) => {
          if (['roleTitle', 'employer', 'startDate', 'endDate', 'description'].includes(field)) {
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
        title={isEditing ? 'Edit experience' : 'Add experience'}
        small
        onBack={submitting ? undefined : () => navigation.goBack()}
      />

      <ExperienceEntryForm
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
