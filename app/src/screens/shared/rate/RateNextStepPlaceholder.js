// Temporary — GL-203 builds the flow shell only (RateBusinessScreen /
// RateWorkerScreen). This screen is a stand-in for the categories and
// written-review steps a later ticket adds; it exists purely so the
// subject screen's Continue button has somewhere to go and so
// back-navigation-preserves-state is demonstrable now: the rating chosen
// on the previous screen still shows here, and still shows again if you go
// back and return. Delete this file once the real next step lands.

import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import StarRating from '../../../components/review/StarRating';
import ProgressPips from '../../../components/ui/ProgressPips';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { useRateFlow } from './RateFlowContext';

export default function RateNextStepPlaceholder() {
  const navigation = useNavigation();
  const { subject, rating } = useRateFlow();

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Next step" small onBack={() => navigation.goBack()} />
      <View className="flex-1 px-[22px] pt-2">
        <ProgressPips total={3} current={2} />

        <View className="mt-8 items-center">
          <Text className="text-[13px] font-semibold text-ink">
            Rating so far, for {subject?.name}
          </Text>
          <StarRating value={rating} size="sm" className="mt-3" />
          <Text className="mt-4 text-center text-[12.5px] text-muted">
            Categories and the written review land in a follow-up ticket.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
