// GL-204/GL-205 - WrittenReviewScreen.js from the v3 mockup. No Skip here,
// unlike the categories step: text is required server-side (§12.1), so
// offering an escape hatch that leads to a submission that can never
// succeed would be wrong.

import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import reviewApi from '../../../api/reviewApi';
import StarRating from '../../../components/review/StarRating';
import Button from '../../../components/ui/Button';
import Chip from '../../../components/ui/Chip';
import Notice from '../../../components/ui/Notice';
import ProgressPips from '../../../components/ui/ProgressPips';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SectionLabel from '../../../components/ui/SectionLabel';
import TextInput from '../../../components/ui/TextInput';
import { REVIEW_TEXT_MAX_LENGTH, isValidReviewText } from '../../../utils/validation';
import { useRateFlow } from './RateFlowContext';

function categoryLabel(categoryList, value) {
  return categoryList.find((category) => category.value === value)?.label ?? value;
}

// A generic fallback only - the 409s §12.1 defines (not completed, already
// reviewed) and the 403 for a non-party both carry their own readable
// `message` from the server, which is shown as-is when present.
const GENERIC_SUBMIT_ERROR = 'Could not submit your rating. Check your connection and try again.';

export default function WrittenReviewScreen() {
  const navigation = useNavigation();
  const { applicationId, rating, categories, categoryList, text, setText } = useRateFlow();

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleBack = () => navigation.goBack();
  const canSubmit = isValidReviewText(text);

  // Belt-and-braces alongside Button's own `loading` → disabled onPress:
  // the guard that actually has to hold is here, not in the JSX, so one
  // flow can never fire two POSTs (§GL-205).
  async function handleSubmit() {
    if (submitting) return;

    setFormError('');
    setSubmitting(true);
    try {
      await reviewApi.submitReview(applicationId, { rating, categories, text });
      // replace, not navigate - a submitted review is permanent, so the
      // written-review step should never be reachable again by going back
      // from the confirmation that follows it.
      navigation.replace('RatingConfirmation');
    } catch (error) {
      // Nothing here is cleared on failure: rating/categories/text all
      // still live in RateFlowContext, so the screen the user lands back
      // on has exactly what they typed.
      setFormError(error.response?.data?.error?.message || GENERIC_SUBMIT_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Add a few words" small onBack={handleBack} />

      <View className="flex-1 px-[22px]">
        <ProgressPips total={3} current={3} />

        <ScrollView
          className="mt-4 flex-1"
          contentContainerClassName="pb-6"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            label="Your review"
            placeholder="What stood out about this gig?"
            multiline
            value={text}
            onChangeText={setText}
            maxLength={REVIEW_TEXT_MAX_LENGTH}
          />
          <Text className="mt-1 text-right text-[11.5px] text-muted-dark">
            {text.length} / {REVIEW_TEXT_MAX_LENGTH}
          </Text>

          <Text className="mt-3 text-[12px] leading-[17.4px] text-muted">
            Mention what stood out - the work itself, timing, or how they communicated. This is
            feedback about the gig, not the person.
          </Text>

          <SectionLabel className="mt-5">Your rating so far</SectionLabel>
          <View className="mt-[10px] rounded-ds-lg bg-haze px-4 py-[14px]">
            <StarRating value={rating} size="sm" />
            {categories.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-[6px]">
                {categories.map((value) => (
                  <Chip key={value} size="sm">
                    {categoryLabel(categoryList, value)}
                  </Chip>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View className="pb-2 pt-3">
          {formError ? (
            <Notice variant="error" className="mb-3">
              {formError}
            </Notice>
          ) : null}
          <Button
            trailingArrow
            disabled={!canSubmit}
            loading={submitting}
            onPress={handleSubmit}
          >
            Submit rating
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
