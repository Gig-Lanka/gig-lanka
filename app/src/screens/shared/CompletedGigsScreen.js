// GL-271 - the entry point for the rating flow (§7.2 of the feature
// inventory called this out as the missing piece: five screens with no way
// in). Both roles land here; which application endpoint and which "other
// party" label apply is decided once, from the signed-in user's role.

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import applicationApi from '../../api/applicationApi';
import gigApi from '../../api/gigApi';
import reviewApi from '../../api/reviewApi';
import CompletedGigCard from '../../components/review/CompletedGigCard';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useAuth from '../../hooks/useAuth';
import { formatRelativeTime } from '../../utils/format';

// Stated as a product rule by GL-269, enforced server-side there - this is
// only the client's half: computing days remaining for display, never the
// gate itself. A window that only existed here would be a suggestion.
const RATING_WINDOW_DAYS = 14;
const RATING_WINDOW_MS = RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const ACTION_LABEL_BY_ROLE = {
  seeker: 'Rate this business',
  business: 'Rate this worker',
};

// Every completed application, decorated with whatever the card needs to
// render: the other party's identity, and the caller's own review of it if
// one exists. Direction is never asked here - GET /reviews/mine already
// answers "have I rated this?" per the caller's own authorship (GL-270),
// which is exactly what "per direction" means: a seeker's review of a
// business says nothing about the business's own obligation, and vice versa.
async function loadEntries(isSeeker) {
  const [applicationsResult, reviewsResult] = await Promise.all([
    isSeeker
      ? applicationApi.getMyApplications()
      : applicationApi.getApplicationsForMyGigs({ status: 'completed' }),
    reviewApi.getMyReviews(),
  ]);

  const completedApplications = isSeeker
    ? applicationsResult.applications.filter((application) => application.status === 'completed')
    : applicationsResult.applications;

  const reviewByApplicationId = new Map(
    reviewsResult.reviews.map((review) => [review.application, review]),
  );

  // The seeker's own applications only carry a gig summary (§11.6), which
  // has no business identity on it - that only comes back from a full gig
  // read (§10.2). The business side needs no equivalent lookup: its
  // applications already carry the seeker's frozen profileSnapshot.name,
  // the same field ApplicantRow.js reads for the same reason.
  let businessByGigId = new Map();
  if (isSeeker) {
    const gigIds = [...new Set(completedApplications.map((app) => app.gig?.id).filter(Boolean))];
    const results = await Promise.all(
      gigIds.map((gigId) =>
        gigApi
          .getGig(gigId)
          .then(({ business }) => [gigId, business])
          .catch(() => [gigId, null]),
      ),
    );
    businessByGigId = new Map(results);
  }

  return completedApplications.map((application) => {
    const who = isSeeker
      ? (() => {
          const business = application.gig ? businessByGigId.get(application.gig.id) : null;
          return {
            name: business?.name ?? 'This business',
            photoUri: business?.photo,
            square: true,
          };
        })()
      : {
          name: application.profileSnapshot?.name ?? 'This worker',
          photoUri: undefined,
          square: false,
        };

    return {
      application,
      review: reviewByApplicationId.get(application.id) ?? null,
      who,
    };
  });
}

// Status is checked before the window everywhere else this gate appears
// (GL-268, GL-269) - here there's nothing to check, since every entry is
// already `completed` by construction, but the review comes first for the
// same reason: whether it's rated is a fact, the window is only a deadline.
function partitionEntries(entries) {
  const awaiting = [];
  const alreadyRated = [];
  const ratingClosed = [];
  const now = Date.now();

  entries.forEach((entry) => {
    if (entry.review) {
      alreadyRated.push(entry);
      return;
    }

    const completedAtMs = entry.application.completedAt
      ? new Date(entry.application.completedAt).getTime()
      : now;
    const elapsedMs = now - completedAtMs;

    if (elapsedMs > RATING_WINDOW_MS) {
      ratingClosed.push(entry);
    } else {
      const daysLeft = Math.max(
        0,
        RATING_WINDOW_DAYS - Math.floor(elapsedMs / (24 * 60 * 60 * 1000)),
      );
      awaiting.push({ ...entry, daysLeft });
    }
  });

  return { awaiting, alreadyRated, ratingClosed };
}

function countLine(awaitingCount) {
  const noun = awaitingCount === 1 ? 'gig' : 'gigs';
  return `${awaitingCount} ${noun} waiting · rating closes ${RATING_WINDOW_DAYS} days after a gig ends`;
}

export default function CompletedGigsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const isSeeker = user?.role === 'seeker';

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchEntries = useCallback(async () => {
    const fetched = await loadEntries(isSeeker);
    setEntries(fetched);
    hasLoadedRef.current = true;
  }, [isSeeker]);

  // Same shape as MyApplicationsScreen.js / MyGigsScreen.js: only the
  // first-ever load blocks the screen with a loader, so returning to this
  // screen after rating something refetches silently instead of flashing it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchEntries()
        .catch(() => {
          if (!cancelled && isFirstLoad) {
            setError('Could not load your completed gigs.');
          }
        })
        .finally(() => {
          if (!cancelled && isFirstLoad) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [fetchEntries]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEntries()
      .catch(() => setError('Could not load your completed gigs.'))
      .finally(() => setLoading(false));
  }, [fetchEntries]);

  const { awaiting, alreadyRated, ratingClosed } = useMemo(
    () => partitionEntries(entries),
    [entries],
  );

  const openRateFlow = (applicationId) => {
    navigation.navigate('RateFlow', { applicationId });
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="Completed" small onBack={() => navigation.goBack()} />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : entries.length === 0 ? (
        <EmptyState message="No completed gigs yet. They'll show up here once a hire wraps up." />
      ) : (
        <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
          <Text className="text-[11.5px] text-muted-dark">{countLine(awaiting.length)}</Text>

          {awaiting.length > 0 ? (
            <View className="mt-4">
              <SectionLabel>Awaiting your rating</SectionLabel>
              <View className="mt-[10px] gap-[10px]">
                {awaiting.map((entry) => (
                  <CompletedGigCard
                    key={entry.application.id}
                    state="awaiting"
                    name={entry.who.name}
                    photoUri={entry.who.photoUri}
                    square={entry.who.square}
                    gigTitle={entry.application.gig?.title ?? 'Gig no longer available'}
                    subText={`ended ${formatRelativeTime(entry.application.completedAt)}`}
                    daysLeft={entry.daysLeft}
                    actionLabel={
                      isSeeker ? ACTION_LABEL_BY_ROLE.seeker : ACTION_LABEL_BY_ROLE.business
                    }
                    onPress={() => openRateFlow(entry.application.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {alreadyRated.length > 0 ? (
            <View className="mt-5">
              <SectionLabel>Already rated</SectionLabel>
              <View className="mt-[10px] gap-[10px]">
                {alreadyRated.map((entry) => (
                  <CompletedGigCard
                    key={entry.application.id}
                    state="rated"
                    name={entry.who.name}
                    photoUri={entry.who.photoUri}
                    square={entry.who.square}
                    gigTitle={entry.application.gig?.title ?? 'Gig no longer available'}
                    subText={`rated ${formatRelativeTime(entry.review.createdAt)}`}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {ratingClosed.length > 0 ? (
            <View className="mt-5">
              <SectionLabel>Rating closed</SectionLabel>
              <View className="mt-[10px] gap-[10px]">
                {ratingClosed.map((entry) => (
                  <CompletedGigCard
                    key={entry.application.id}
                    state="closed"
                    name={entry.who.name}
                    photoUri={entry.who.photoUri}
                    square={entry.who.square}
                    gigTitle={entry.application.gig?.title ?? 'Gig no longer available'}
                    subText={`ended ${formatRelativeTime(entry.application.completedAt)}`}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
