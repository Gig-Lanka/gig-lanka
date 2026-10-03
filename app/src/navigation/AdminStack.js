import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ReportDetailScreen from '../screens/admin/ReportDetailScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import ResetLinkSignedInScreen from '../screens/auth/ResetLinkSignedInScreen';

const Stack = createNativeStackNavigator();

// Landing decision (GL-306 criterion 3): a minimal stack, not a tab bar. One
// screen this sprint doesn't justify a tab bar - Sprint 4's disputes,
// moderation actions and account status can add tabs once there's more than
// one destination. GL-406 adds ReportDetail, but a list and its detail are
// still one destination, so this stays a stack. An admin has no profile, so
// none of AppStack's shared screens (AccountSettings, EditProfile,
// GigDetail, PublicProfile, ...) belong here - every one of them assumes a
// profile that would 403.
export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
      {/* A reset link opened while signed in (GL-396); see useResetLinkRedirect. */}
      <Stack.Screen name="ResetLinkSignedIn" component={ResetLinkSignedInScreen} />
    </Stack.Navigator>
  );
}
