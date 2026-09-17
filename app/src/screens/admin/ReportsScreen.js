import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import useAuth from '../../hooks/useAuth';

// Placeholder body only (GL-384) - this route exists so the admin branch has
// somewhere real to land ahead of the moderation queue API (E5). The actual
// open-reports list (GL-306 criteria 6-11) replaces this body once
// GET /api/admin/reports exists.
//
// Sign-out decision (GL-306/GL-385): the admin stack gets its own minimal
// sign-out here rather than reusing AccountSettingsScreen, which isn't
// admin-safe - it renders Edit profile/Work experience/Education rows that
// all 403 for an admin and round-trips to GET /auth/me, itself a profile
// endpoint. A header action is the only control an admin needs this sprint.
export default function ReportsScreen() {
  const { logout } = useAuth();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="Reports"
        rightSlot={
          <Pressable onPress={() => setLogoutConfirmVisible(true)}>
            <Text className="text-[14px] font-bold text-signal">Log out</Text>
          </Pressable>
        }
      />
      <EmptyState message="Open reports will show here." />

      <ConfirmDialog
        visible={logoutConfirmVisible}
        destructive
        title="Log out?"
        body="You'll need to sign in again to access your account."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onConfirm={logout}
        onCancel={() => setLogoutConfirmVisible(false)}
      />
    </Screen>
  );
}
