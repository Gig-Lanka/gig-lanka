import { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthStack from './AuthStack';
import BusinessTabs from './BusinessTabs';
import SeekerTabs from './SeekerTabs';
import Loader from '../components/ui/Loader';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';
import EditGigScreen from '../screens/business/EditGigScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import EducationFormScreen from '../screens/seeker/EducationFormScreen';
import ExperienceFormScreen from '../screens/seeker/ExperienceFormScreen';
import ManageEducationScreen from '../screens/seeker/ManageEducationScreen';
import ManageExperienceScreen from '../screens/seeker/ManageExperienceScreen';
import PostGigScreen from '../screens/business/PostGigScreen';
import GigDetailScreen from '../screens/shared/GigDetailScreen';
import useAuth from '../hooks/useAuth';
import { AUTH_STATUS } from '../store/AuthContext';

const Stack = createNativeStackNavigator();

function AppStack({ role }) {
  const RoleTabs = role === 'business' ? BusinessTabs : SeekerTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RoleTabs} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="GigDetail" component={GigDetailScreen} />
      {role === 'business' ? (
        <>
          <Stack.Screen
            name="PostGig"
            component={PostGigScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="EditGig" component={EditGigScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ManageExperience" component={ManageExperienceScreen} />
          <Stack.Screen name="ExperienceForm" component={ExperienceFormScreen} />
          <Stack.Screen name="ManageEducation" component={ManageEducationScreen} />
          <Stack.Screen name="EducationForm" component={EducationFormScreen} />
        </>
      )}

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

  // A brand-new install should land on RoleSelect (choose seeker/business,
  // sign up) — but anyone who signs out after having been authenticated
  // already has an account, so they belong on Login instead. Adjusted
  // during render rather than in an effect, per React's own pattern for
  // deriving state from a prior render's value — it only ever flips
  // false → true, guarded so it can't loop.
  const [prevStatus, setPrevStatus] = useState(status);
  const [wasAuthenticated, setWasAuthenticated] = useState(status === AUTH_STATUS.AUTHENTICATED);
  // Browsing without an account (GL-172) is a third leaf under
  // UNAUTHENTICATED, not a fourth AUTH_STATUS — signing in for real still
  // goes through the same bootstrap/login/logout status transitions either
  // way, so it stays local UI state here instead of touching AuthContext.
  const [guestMode, setGuestMode] = useState(false);

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === AUTH_STATUS.AUTHENTICATED) {
      setWasAuthenticated(true);
      setGuestMode(false);
    }
  }

  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    return <AppStack role={user?.role} />;
  }

  // Wrapped in its own Stack.Navigator (rather than rendering SeekerTabs
  // bare, as before GL-122) so a guest can still reach GigDetail from
  // Browse — a screen outside the tab navigator itself.
  if (guestMode) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() => <SeekerTabs guest onSignIn={() => setGuestMode(false)} />}
        </Stack.Screen>
        <Stack.Screen name="GigDetail">
          {() => <GigDetailScreen onSignIn={() => setGuestMode(false)} />}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return (
    <AuthStack
      initialRouteName={wasAuthenticated ? 'Login' : 'RoleSelect'}
      onContinueAsGuest={() => setGuestMode(true)}
    />
  );
}
