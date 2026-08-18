import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack({ initialRouteName = 'RoleSelect', onContinueAsGuest }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect">
        {(props) => <RoleSelectScreen {...props} onContinueAsGuest={onContinueAsGuest} />}
      </Stack.Screen>
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
