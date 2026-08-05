import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TabNavigator from './TabNavigator';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      {__DEV__ ? (
        <Stack.Screen
          name="ComponentDemo"
          component={ComponentDemoScreen}
          options={{ headerShown: true, title: 'UI Kit' }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
