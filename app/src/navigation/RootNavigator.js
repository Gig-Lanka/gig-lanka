import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TabNavigator from './TabNavigator';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';
import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';

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
      {__DEV__ ? <Stack.Screen name="RoleSelect" component={RoleSelectScreen} /> : null}
      {__DEV__ ? <Stack.Screen name="SignUp" component={SignUpScreen} /> : null}
      {__DEV__ ? <Stack.Screen name="Login" component={LoginScreen} /> : null}
    </Stack.Navigator>
  );
}
