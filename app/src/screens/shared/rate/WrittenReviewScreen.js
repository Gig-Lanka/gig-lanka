// GL-204 — WrittenReviewScreen.js from the v3 mockup. No Skip here, unlike
// the categories step: text is required server-side (§12.1), so offering an
// escape hatch that leads to a submission that can never succeed would be
// wrong. Submission itself isn't wired yet — the button reflects validity
// but has no onPress, the same "present but deliberately left unwired"
// pattern GigDetailScreen uses for its own not-yet-built action.

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import StarRating from '../../../components/review/StarRating';
import Button from '../../../components/ui/Button';
import Chip from '../../../components/ui/Chip';
import ProgressPips from '../../../components/ui/ProgressPips';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import SectionLabel from '../../../components/ui/SectionLabel';
import TextInput from '../../../components/ui/TextInput';
import { REVIEW_TEXT_MAX_LENGTH, isValidReviewText } from '../../../utils/validation';
import { useRateFlow } from './RateFlowContext';

function categoryLabel(categoryList, value) {
  return categoryList.find((category) => category.value === value)?.label ?? value;
}

export default function WrittenReviewScreen() {
  const navigation = useNavigation();
  const { rating, categories, categoryList, text, setText } = useRateFlow();

  const handleBack = () => navigation.goBack();
  const canSubmit = isValidReviewText(text);

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
            Mention what stood out — the work itself, timing, or how they communicated. This is
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
          <Button trailingArrow disabled={!canSubmit}>
            Submit rating
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
