// GL-205 — RatingConfirmationScreen.js from the v3 mockup. Reads what to
// show from RateFlowContext rather than route params: the flow already
// holds the subject, gig, rating, categories and text, and by the time this
// screen mounts they're exactly what was just submitted. No back arrow —
// the flow is finished, so the only exits are ✕ and Done, both of which
// pop the whole RateFlow off the stack rather than stepping back into a
// submitted form.

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import StarRating from '../../../components/review/StarRating';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import Chip from '../../../components/ui/Chip';
import Notice from '../../../components/ui/Notice';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { useRateFlow } from './RateFlowContext';

function categoryLabel(categoryList, value) {
  return categoryList.find((category) => category.value === value)?.label ?? value;
}

export default function RatingConfirmationScreen() {
  const navigation = useNavigation();
  const { subject, gig, rating, categories, categoryList, text } = useRateFlow();

  // The RateFlow screen sits on the enclosing app stack (RootNavigator), one
  // level up from this nested stack — going back out of the flow means
  // popping that screen, not stepping back within it.
  const handleExit = () => (navigation.getParent() ?? navigation).goBack();

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader
        title=""
        rightSlot={
          <Pressable onPress={handleExit} hitSlop={8}>
            <Text className="text-[15px] font-semibold text-muted">✕</Text>
          </Pressable>
        }
      />

      <View className="flex-1 px-[22px]">
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-2 items-center">
            <View className="h-[64px] w-[64px] items-center justify-center rounded-full bg-signal-soft">
              <Text className="text-[26px] font-bold text-signal">✓</Text>
            </View>
            <Text className="mt-4 font-display text-[19px] text-ink">Rating submitted</Text>
            <Text className="mt-[6px] text-center text-[13px] leading-[18.2px] text-muted">
              Thanks — this helps keep Gig Lanka a trustworthy place to hire and work.
            </Text>
          </View>

          <View className="mt-6 rounded-ds-card border-[1.5px] border-line bg-paper p-4">
            <View className="flex-row items-center gap-[13px]">
              <Avatar
                uri={subject?.photoUri}
                name={subject?.name}
                size="sm"
                square={subject?.square}
              />
              <View className="flex-1">
                <Text className="text-[14px] font-semibold text-ink">{subject?.name}</Text>
                {gig ? (
                  <Text className="mt-[1px] text-[11.5px] text-muted-dark">{gig.title}</Text>
                ) : null}
              </View>
            </View>

            <StarRating value={rating} size="sm" className="mt-3" />

            <Text className="mt-3 text-[13.5px] leading-[19.5px] text-ink">{text}</Text>

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

          <Notice className="mt-4">
            {`Now live on ${subject?.name ?? 'their'} profile. Ratings can't be edited — contact support if something's wrong.`}
          </Notice>
        </ScrollView>

        <View className="pb-2 pt-3">
          <Button onPress={handleExit}>Done</Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
