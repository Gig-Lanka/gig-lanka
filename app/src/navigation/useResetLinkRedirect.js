import { useCallback, useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';

import { getResetToken, isResetPasswordLink } from './linking';
import { navigationRef } from './navigationRef';
import { AUTH_STATUS } from '../store/AuthContext';

// The linking config only works when ResetPassword is mounted, which is only
// the signed-out AuthStack. Every other state a reset link can arrive in is
// settled here instead, so the link is never silently dropped (GL-396 AC6):
//
// - signed in (any role): show ResetLinkSignedIn. Never signs the user out.
// - guest browsing: guests sit in their own navigator with no ResetPassword,
//   so leave guest mode and open ResetPassword on the AuthStack that replaces it.
// - signed out in AuthStack: the linking config already handled it.
//
// A cold start's link is read once at launch and a warm start's arrives as an
// event; either may land before auth has bootstrapped or the container is
// ready, so it is parked until both are.
export default function useResetLinkRedirect({ status, guestMode, onLeaveGuestMode }) {
  const pendingUrlRef = useRef(null);
  const leftGuestModeRef = useRef(false);
  const latestRef = useRef({ status, guestMode, onLeaveGuestMode });

  useEffect(() => {
    latestRef.current = { status, guestMode, onLeaveGuestMode };
  });

  const settle = useCallback(() => {
    const url = pendingUrlRef.current;
    const { status, guestMode, onLeaveGuestMode } = latestRef.current;
    if (!url || status === AUTH_STATUS.LOADING || !navigationRef.isReady()) return;

    if (status === AUTH_STATUS.AUTHENTICATED) {
      pendingUrlRef.current = null;
      navigationRef.navigate('ResetLinkSignedIn');
      return;
    }

    if (guestMode) {
      leftGuestModeRef.current = true;
      onLeaveGuestMode();
      return;
    }

    pendingUrlRef.current = null;
    if (leftGuestModeRef.current) {
      leftGuestModeRef.current = false;
      navigationRef.navigate('ResetPassword', { token: getResetToken(url) });
    }
  }, []);

  useEffect(() => {
    const park = (url) => {
      if (!isResetPasswordLink(url)) return;
      pendingUrlRef.current = url;
      settle();
    };

    Linking.getInitialURL().then(park);
    const subscription = Linking.addEventListener('url', ({ url }) => park(url));
    // Covers a link parked before the container was ready.
    const unsubscribeState = navigationRef.addListener('state', settle);

    return () => {
      subscription.remove();
      unsubscribeState();
    };
  }, [settle]);

  useEffect(() => {
    settle();
  }, [status, guestMode, settle]);
}
