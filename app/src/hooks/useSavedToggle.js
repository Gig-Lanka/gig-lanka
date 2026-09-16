import { useCallback, useRef, useState } from 'react';

import gigApi from '../api/gigApi';

const GIG_CLOSED_MESSAGE = "This gig is closed and can't be saved.";

// Shared by GigCard and GigDetailScreen - brief §6: saving is optimistic
// with a silent revert, no dialog, no toast. The one exception is 409
// GIG_CLOSED on a save attempt, which the caller renders as an ordinary
// inline message instead of failing silently, since that's news the seeker
// actually needs.
//
// Intended state lives in `intendedRef`, not component state alone, so a
// request already in flight can be superseded by a later tap rather than
// the star disabling itself mid-flight - a star that ignores the second tap
// is worse than one that settles correctly. `confirmedRef` is the last
// state the server actually agreed to, and is what a silent revert falls
// back to. The worker loop re-reads `intendedRef` on every iteration
// instead of queuing individual taps, so a burst of taps collapses into
// whatever the last one asked for rather than firing once per tap.
export default function useSavedToggle(gigId, initialSaved) {
  const initial = Boolean(initialSaved);
  const [saved, setSaved] = useState(initial);
  const [conflictMessage, setConflictMessage] = useState(null);
  const intendedRef = useRef(initial);
  const confirmedRef = useRef(initial);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    while (intendedRef.current !== confirmedRef.current) {
      const target = intendedRef.current;
      try {
        if (target) {
          await gigApi.saveGig(gigId);
        } else {
          await gigApi.unsaveGig(gigId);
        }
        confirmedRef.current = target;
      } catch (error) {
        const isGigClosed =
          target &&
          error.response?.status === 409 &&
          error.response?.data?.error?.code === 'GIG_CLOSED';

        // Only snap back if nothing has asked for a different state since
        // this specific call went out - otherwise this would stomp a newer
        // tap that's about to run its own loop iteration.
        if (intendedRef.current === target) {
          intendedRef.current = confirmedRef.current;
          setSaved(confirmedRef.current);
        }

        if (isGigClosed) {
          setConflictMessage(GIG_CLOSED_MESSAGE);
          break;
        }
      }
    }

    runningRef.current = false;
  }, [gigId]);

  const toggle = useCallback(() => {
    setConflictMessage(null);
    const next = !intendedRef.current;
    intendedRef.current = next;
    setSaved(next);
    run();
  }, [run]);

  return { saved, toggle, conflictMessage };
}
