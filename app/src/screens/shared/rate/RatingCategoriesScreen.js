// GL-204 - RatingCategoriesScreen.js from the v3 mockup. The list itself
// (business vs. youth worker) comes from RateFlowContext's categoryList,
// already resolved from the application's direction - this screen never
// decides which set applies. Selection is optional throughout: Skip and
// Continue do the same thing, since nothing here blocks submission.

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import CategoryChipGroup from '../../../components/review/CategoryChipGroup';
import StarRating from '../../../components/review/StarRating';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import ProgressPips from '../../../components/ui/ProgressPips';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { useRateFlow } from './RateFlowContext';

export default function RatingCategoriesScreen() {
  const navigation = useNavigation();
  const { subject, rating, categories, setCategories, categoryList } = useRateFlow();

  const handleBack = () => navigation.goBack();
  const handleNext = () => navigation.navigate('WrittenReview');

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title="What went well?"
        small
        onBack={handleBack}
        rightSlot={
          <Pressable onPress={handleNext} hitSlop={8}>
            <Text className="text-[12.5px] font-medium text-muted">Skip</Text>
          </Pressable>
        }
      />

      <View className="flex-1 px-[22px]">
        <ProgressPips total={3} current={2} />

        <ScrollView
          className="mt-4 flex-1"
          contentContainerClassName="pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center gap-[13px]">
            <Avatar
              uri={subject?.photoUri}
              name={subject?.name}
              size="sm"
              square={subject?.square}
            />
            <View className="flex-1">
              <Text className="text-[14px] font-semibold text-ink">{subject?.name}</Text>
              <Text className="mt-[1px] text-[11.5px] text-muted-dark">
                You rated {rating} star{rating === 1 ? '' : 's'}
              </Text>
            </View>
            <StarRating value={rating} size="sm" />
          </View>

          <Text className="mt-5 text-[12px] leading-[17.4px] text-muted">
            Select all that apply. Three or four is plenty - this stays quick, not a survey.
          </Text>

          <CategoryChipGroup
            categories={categoryList}
            value={categories}
            onChange={setCategories}
            className="mt-3"
          />
        </ScrollView>

        <View className="pb-2 pt-3">
          <Button trailingArrow onPress={handleNext}>
            Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
