import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import gigApi from '../../api/gigApi';
import GigForm, { createEmptyGigFormValues } from '../../components/gig/GigForm';
import { validateGigForm } from '../../utils/validation';

const GENERIC_FORM_ERROR = 'Could not post this gig. Check your connection and try again.';

// Only fields the create endpoint accepts (§10.3) — status and postedBy are
// server-set and rejected if sent from the client.
function buildGigPayload(values) {
  const payload = {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    payAmount: Number(values.payAmount),
    payType: values.payType,
    remote: Boolean(values.remote),
    schedule: values.schedule,
    commitment: values.commitment,
    positions: Number(values.positions),
  };

  if ((values.city || '').trim()) payload.city = values.city.trim();
  if ((values.area || '').trim()) payload.area = values.area.trim();
  if (values.startDate) payload.startDate = values.startDate;
  if (values.applicationsCloseDate) payload.applicationsCloseDate = values.applicationsCloseDate;

  return payload;
}

export default function PostGigScreen() {
  const navigation = useNavigation();
  const [values, setValues] = useState(createEmptyGigFormValues());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  async function handleSubmit() {
    if (submitting) return;

    const validationErrors = validateGigForm(values);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { gig } = await gigApi.createGig(buildGigPayload(values));
      navigation.replace('GigDetail', { gigId: gig.id });
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach(({ field, message }) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
      } else if (apiError?.code === 'FORBIDDEN') {
        setFormError('Only business accounts can post a gig.');
      } else {
        setFormError(apiError?.message || GENERIC_FORM_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="min-h-12 flex-row items-center justify-between px-[22px] pb-[10px] pt-1">
        <Pressable onPress={() => navigation.goBack()} disabled={submitting} hitSlop={8}>
          <Text
            className={['text-[14px] font-semibold', submitting ? 'text-muted-dark' : 'text-muted']
              .filter(Boolean)
              .join(' ')}
          >
            Cancel
          </Text>
        </Pressable>

        <Text className="font-display text-[17px] tracking-[-0.015em] text-ink">Post a gig</Text>

        <Pressable onPress={handleSubmit} disabled={submitting} hitSlop={8}>
          {submitting ? (
            <ActivityIndicator size="small" className="text-signal" />
          ) : (
            <Text className="text-[14px] font-bold text-signal">Post</Text>
          )}
        </Pressable>
      </View>

      <View className="flex-1 px-[22px]">
        <GigForm
          values={values}
          onChange={handleChange}
          errors={errors}
          formError={formError}
          disabled={submitting}
        />
      </View>
    </SafeAreaView>
  );
}
