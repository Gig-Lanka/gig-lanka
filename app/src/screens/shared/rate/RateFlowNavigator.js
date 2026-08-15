// GL-203 — the entry point registered in the app stack as "RateFlow". Takes
// only an applicationId route param; everything else (direction, subject,
// category list) is derived inside RateFlowProvider so two different
// callers — the seeker side and the business side — can never disagree
// about what this flow shows.

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';

import { RateFlowProvider } from './RateFlowContext';
import RateSubjectScreen from './RateSubjectScreen';
import RatingCategoriesScreen from './RatingCategoriesScreen';
import RatingConfirmationScreen from './RatingConfirmationScreen';
import WrittenReviewScreen from './WrittenReviewScreen';

const Stack = createNativeStackNavigator();

export default function RateFlowNavigator() {
  const { params } = useRoute();
  const { applicationId } = params;

  return (
    <RateFlowProvider applicationId={applicationId}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="RateSubject" component={RateSubjectScreen} />
        <Stack.Screen name="RatingCategories" component={RatingCategoriesScreen} />
        <Stack.Screen name="WrittenReview" component={WrittenReviewScreen} />
        <Stack.Screen
          name="RatingConfirmation"
          component={RatingConfirmationScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </RateFlowProvider>
  );
}
