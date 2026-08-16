// GL-203 — the shared state behind the rating flow. One provider per flow
// instance, holding what every step needs: the derived direction and
// subject (so no step ever asks the application for them twice) and the
// in-progress rating/categories/text, lifted here rather than kept local to
// any one step so that navigating between steps never resets them.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import applicationApi from '../../../api/applicationApi';
import gigApi from '../../../api/gigApi';
import profileApi from '../../../api/profileApi';
import {
  BUSINESS_REVIEW_CATEGORIES,
  YOUTH_WORKER_REVIEW_CATEGORIES,
} from '../../../constants/enums';
import useAuth from '../../../hooks/useAuth';
import { formatLocation } from '../../../utils/format';

export const RATE_FLOW_STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

// §6.9/§12.1 — which list applies is decided by direction alone, never by
// anything a step lets the user flip.
const CATEGORY_LISTS_BY_DIRECTION = {
  seeker_to_business: BUSINESS_REVIEW_CATEGORIES,
  business_to_seeker: YOUTH_WORKER_REVIEW_CATEGORIES,
};

const RateFlowContext = createContext(undefined);

export function useRateFlow() {
  const context = useContext(RateFlowContext);
  if (context === undefined) {
    throw new Error('useRateFlow must be used within a RateFlowProvider');
  }
  return context;
}

// The one place direction gets decided — from the application and the
// signed-in user, never from anything a caller screen passed in. A seeker
// only ever reaches this as the applicant; a business only ever reaches it
// as the gig's poster, so comparing ids is sufficient (§12.1 mirrors this
// same derivation server-side).
function directionFor(application, userId) {
  return application.applicant === userId ? 'seeker_to_business' : 'business_to_seeker';
}

export function RateFlowProvider({ applicationId, children }) {
  const { user } = useAuth();

  const [status, setStatus] = useState(RATE_FLOW_STATUS.LOADING);
  const [direction, setDirection] = useState(null);
  const [subject, setSubject] = useState(null);
  const [gig, setGig] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus(RATE_FLOW_STATUS.LOADING);
      try {
        const { application } = await applicationApi.getApplication(applicationId);
        const nextDirection = directionFor(application, user?.id);

        let nextSubject;
        let nextGig;

        if (nextDirection === 'seeker_to_business') {
          // Rating the business — its identity only comes back on the full
          // gig read (§10.2), never on the application's bare gig summary.
          if (!application.gig) {
            throw new Error('GIG_UNAVAILABLE');
          }
          const { gig: fullGig, business } = await gigApi.getGig(application.gig.id);
          nextGig = { id: fullGig.id, title: fullGig.title };
          nextSubject = {
            name: business?.name ?? 'This business',
            photoUri: business?.photo,
            square: true,
            location: formatLocation({
              isRemote: fullGig.remote,
              area: fullGig.area,
              city: fullGig.city,
            }),
          };
        } else {
          // Rating the seeker — their current public profile carries the
          // avatar; the frozen profileSnapshot is only a name fallback for
          // the rare case a profile read fails to resolve one.
          const profile = await profileApi.getPublicProfile(application.applicant);
          nextGig = application.gig
            ? { id: application.gig.id, title: application.gig.title }
            : null;
          nextSubject = {
            name: profile?.name ?? application.profileSnapshot?.name ?? 'This worker',
            photoUri: profile?.photo,
            square: false,
            location: profile?.city,
          };
        }

        if (!cancelled) {
          setDirection(nextDirection);
          setSubject(nextSubject);
          setGig(nextGig);
          setStatus(RATE_FLOW_STATUS.READY);
        }
      } catch {
        if (!cancelled) setStatus(RATE_FLOW_STATUS.ERROR);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [applicationId, user?.id, reloadToken]);

  const value = useMemo(
    () => ({
      applicationId,
      status,
      direction,
      subject,
      gig,
      rating,
      setRating,
      categories,
      setCategories,
      categoryList: CATEGORY_LISTS_BY_DIRECTION[direction] ?? [],
      text,
      setText,
      retry: () => setReloadToken((token) => token + 1),
    }),
    [applicationId, status, direction, subject, gig, rating, categories, text],
  );

  return <RateFlowContext.Provider value={value}>{children}</RateFlowContext.Provider>;
}
