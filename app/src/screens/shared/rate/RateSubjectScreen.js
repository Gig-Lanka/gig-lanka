// GL-203 — RateBusinessScreen.js / RateWorkerScreen.js from the v3 mockup.
// One component for both directions: only the copy differs, driven by
// `direction` from RateFlowContext rather than a prop from whichever screen
// launched the flow.

import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import StarRating from '../../../components/review/StarRating';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import Loader from '../../../components/ui/Loader';
import Notice from '../../../components/ui/Notice';
import ProgressPips from '../../../components/ui/ProgressPips';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { RATE_FLOW_STATUS, useRateFlow } from './RateFlowContext';

const TITLE_BY_DIRECTION = {
  seeker_to_business: 'Rate this business',
  business_to_seeker: 'Rate this worker',
};

const RATING_CAPTIONS = {
  1: 'Poor — tap to change',
  2: 'Fair — tap to change',
  3: 'Good — tap to change',
  4: 'Great — tap to change',
  5: 'Excellent — tap to change',
};

const LOAD_ERROR_MESSAGE = 'Could not load this rating. Check your connection and try again.';

export default function RateSubjectScreen() {
  const navigation = useNavigation();
  const { status, direction, subject, gig, rating, setRating, retry } = useRateFlow();

  const handleBack = () => navigation.goBack();

  if (status === RATE_FLOW_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === RATE_FLOW_STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Rate" small onBack={handleBack} />
        <EmptyState message={LOAD_ERROR_MESSAGE} actionLabel="Retry" onAction={retry} />
      </SafeAreaView>
    );
  }

  const title = TITLE_BY_DIRECTION[direction] ?? 'Rate';

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title={title} small onBack={handleBack} />

      <View className="flex-1 px-[22px]">
        <ProgressPips total={3} current={1} />

        <ScrollView
          className="mt-4 flex-1"
          contentContainerClassName="pb-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center">
            <Avatar
              uri={subject.photoUri}
              name={subject.name}
              size="lg"
              square={subject.square}
              className="border-[5px] border-signal-soft"
            />
            <Text className="mt-3 font-display text-[17px] text-ink">{subject.name}</Text>
            {subject.location ? (
              <Text className="mt-[2px] text-[12.5px] text-muted">{subject.location}</Text>
            ) : null}

            <Text className="mt-[18px] text-[14.5px] font-semibold text-ink">
              How was your experience?
            </Text>
            <StarRating value={rating} onChange={setRating} size="lg" className="mt-[14px]" />
            <Text
              className={[
                'mt-[10px] text-[12.5px] font-medium',
                rating > 0 ? 'text-muted' : 'text-muted-dark',
              ].join(' ')}
            >
              {rating > 0 ? RATING_CAPTIONS[rating] : 'Tap a star to rate'}
            </Text>
          </View>

          <View className="mt-6 rounded-ds-lg bg-haze px-4 py-[14px]">
            <Text className="text-[12.5px] font-semibold text-ink">You&apos;re rating</Text>
            <Text className="mt-1 text-[15.5px] font-medium text-ink">{subject.name}</Text>
            <Text className="mt-1 text-[11.5px] text-muted-dark">
              {gig ? `For: ${gig.title}` : 'This gig is no longer available.'}
            </Text>
          </View>

          <Notice className="mt-4">
            {`Ratings can't be edited once submitted. ${subject.name} will see this on their profile.`}
          </Notice>
        </ScrollView>

        <View className="pb-2 pt-3">
          <Button
            trailingArrow
            disabled={rating === 0}
            onPress={() => navigation.navigate('RatingCategories')}
          >
            Continue
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
