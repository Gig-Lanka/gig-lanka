import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ReportsScreen from '../screens/admin/ReportsScreen';

const Stack = createNativeStackNavigator();

// Landing decision (GL-306 criterion 3): a minimal stack, not a tab bar. One
// screen this sprint doesn't justify a tab bar - Sprint 4's disputes,
// moderation actions and account status can add tabs once there's more than
// one destination. An admin has no profile, so none of AppStack's shared
// screens (AccountSettings, EditProfile, GigDetail, PublicProfile, ...)
// belong here - every one of them assumes a profile that would 403.
export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Reports" component={ReportsScreen} />
    </Stack.Navigator>
  );
}
