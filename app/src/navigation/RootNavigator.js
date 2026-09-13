import { useEffect, useRef, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthStack from './AuthStack';
import BusinessTabs from './BusinessTabs';
import SeekerTabs from './SeekerTabs';
import { navigationRef } from './navigationRef';
import Loader from '../components/ui/Loader';
import ComponentDemoScreen from '../screens/dev/ComponentDemoScreen';
import ApplicationDetailScreen from '../screens/seeker/ApplicationDetailScreen';
import ApplyScreen from '../screens/seeker/ApplyScreen';
import AccountSettingsScreen from '../screens/shared/AccountSettingsScreen';
import ApplicantDetailScreen from '../screens/business/ApplicantDetailScreen';
import ApplicantsScreen from '../screens/business/ApplicantsScreen';
import ChangePasswordScreen from '../screens/shared/ChangePasswordScreen';
import EditGigScreen from '../screens/business/EditGigScreen';
import EditProfileScreen from '../screens/shared/EditProfileScreen';
import EducationFormScreen from '../screens/seeker/EducationFormScreen';
import ExperienceFormScreen from '../screens/seeker/ExperienceFormScreen';
import ManageEducationScreen from '../screens/seeker/ManageEducationScreen';
import ManageExperienceScreen from '../screens/seeker/ManageExperienceScreen';
import PostGigScreen from '../screens/business/PostGigScreen';
import CompletedGigsScreen from '../screens/shared/CompletedGigsScreen';
import GigDetailScreen from '../screens/shared/GigDetailScreen';
import RateFlowNavigator from '../screens/shared/rate/RateFlowNavigator';
import PublicProfileScreen from '../screens/shared/PublicProfileScreen';
import ReviewsScreen from '../screens/shared/ReviewsScreen';
import useAuth from '../hooks/useAuth';
import { AUTH_STATUS } from '../store/AuthContext';

const Stack = createNativeStackNavigator();

function AppStack({ role }) {
  const RoleTabs = role === 'business' ? BusinessTabs : SeekerTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={RoleTabs} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="GigDetail" component={GigDetailScreen} />
      {/* Either role can be the one rating (GL-203), so this is registered
          once here rather than duplicated under both branches below. */}
      <Stack.Screen name="RateFlow" component={RateFlowNavigator} />
      {/* Both roles read it (GL-271) - a seeker from My Applications, a
          business from My Gigs - so it's registered once here too. */}
      <Stack.Screen name="CompletedGigs" component={CompletedGigsScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
      {/* Either role can be the subject read about (GL-374), so this is
          registered once here too, rather than duplicated below. */}
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      {role === 'business' ? (
        <>
          <Stack.Screen
            name="PostGig"
            component={PostGigScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="EditGig" component={EditGigScreen} />
          {/* Its own route name, distinct from the "Applicants" tab, so the
              tab can never inherit a gigId left over from this pushed,
              gig-scoped instance (GL-257). */}
          <Stack.Screen name="GigApplicants" component={ApplicantsScreen} />
          <Stack.Screen name="ApplicantDetail" component={ApplicantDetailScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ManageExperience" component={ManageExperienceScreen} />
          <Stack.Screen name="ExperienceForm" component={ExperienceFormScreen} />
          <Stack.Screen name="ManageEducation" component={ManageEducationScreen} />
          <Stack.Screen name="EducationForm" component={EducationFormScreen} />
          <Stack.Screen name="ApplicationDetail" component={ApplicationDetailScreen} />
          <Stack.Screen name="Apply" component={ApplyScreen} />
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

// Auth and app stacks are alternatives, not destinations you navigate to -
// only one is ever mounted, so there's no back/swipe path from one into the other.
export default function RootNavigator() {
  const { status, user } = useAuth();

  // A brand-new install should land on RoleSelect (choose seeker/business,
  // sign up) - but anyone who signs out after having been authenticated
  // already has an account, so they belong on Login instead. Adjusted
  // during render rather than in an effect, per React's own pattern for
  // deriving state from a prior render's value - it only ever flips
  // false → true, guarded so it can't loop.
  const [prevStatus, setPrevStatus] = useState(status);
  const [wasAuthenticated, setWasAuthenticated] = useState(status === AUTH_STATUS.AUTHENTICATED);
  // Browsing without an account (GL-172) is a third leaf under
  // UNAUTHENTICATED, not a fourth AUTH_STATUS - signing in for real still
  // goes through the same bootstrap/login/logout status transitions either
  // way, so it stays local UI state here instead of touching AuthContext.
  const [guestMode, setGuestMode] = useState(false);
  // GL-340: which gig sent a guest to sign-in, so they land back on it
  // instead of the tab home once authenticated. A ref, not state - reading
  // it never needs to trigger a render, only the one-shot effect below,
  // and mutating it there would otherwise be a same-effect setState.
  // Set only by the guest Apply action; untouched by every other sign-in
  // path, so a guest who never tapped Apply keeps landing on Main as before.
  const pendingGigIdRef = useRef(null);

  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === AUTH_STATUS.AUTHENTICATED) {
      setWasAuthenticated(true);
      setGuestMode(false);
    }
  }

  // Fires once AppStack has mounted for this authentication. navigate()
  // pushes GigDetail on top of AppStack's default initial route (Main), so
  // back from it returns to the tab home rather than exiting - the same
  // shape as reaching GigDetail from Browse.
  useEffect(() => {
    if (status !== AUTH_STATUS.AUTHENTICATED || !pendingGigIdRef.current) return;
    if (!navigationRef.isReady()) return;

    navigationRef.navigate('GigDetail', { gigId: pendingGigIdRef.current });
    pendingGigIdRef.current = null;
  }, [status]);

  if (status === AUTH_STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === AUTH_STATUS.AUTHENTICATED) {
    return <AppStack role={user?.role} />;
  }

  // Wrapped in its own Stack.Navigator (rather than rendering SeekerTabs
  // bare, as before GL-122) so a guest can still reach GigDetail from
  // Browse - a screen outside the tab navigator itself.
  if (guestMode) {
    // Only GigDetail's own Apply action has a gig to remember - the "Sign
    // in" prompts SeekerTabs shows on My Applications/Profile go through
    // Button's onPress, which is called with the press event, not a gig id,
    // so that path is wired through the plain no-arg form below instead of
    // handleGuestSignIn directly.
    const handleGuestSignIn = (gigId) => {
      pendingGigIdRef.current = gigId ?? null;
      setGuestMode(false);
    };

    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() => <SeekerTabs guest onSignIn={() => handleGuestSignIn()} />}
        </Stack.Screen>
        <Stack.Screen name="GigDetail">
          {() => <GigDetailScreen onSignIn={handleGuestSignIn} />}
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
