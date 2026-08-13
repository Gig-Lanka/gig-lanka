import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthStack from './AuthStack';
import BusinessTabs from './BusinessTabs';
import SeekerTabs from './SeekerTabs';
import Loader from '../components/ui/Loader';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';
import useAuth from '../hooks/useAuth';
import { AUTH_STATUS } from '../store/AuthContext';

const Stack = createNativeStackNavigator();

function AppStack({ role }) {
  const RoleTabs = role === 'business' ? BusinessTabs : SeekerTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RoleTabs} />
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

// Auth and app stacks are alternatives, not destinations you navigate to —
// only one is ever mounted, so there's no back/swipe path from one into the other.
export default function RootNavigator() {
  const { status, user } = useAuth();

  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  return status === AUTH_STATUS.AUTHENTICATED ? <AppStack role={user?.role} /> : <AuthStack />;
}
