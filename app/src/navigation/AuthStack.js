import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RoleSelectScreen from '../screens/auth/RoleSelectScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LoginScreen from '../screens/auth/LoginScreen';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator initialRouteName="RoleSelect" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}
