import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';

import applicationApi from '../../api/applicationApi';
import gigApi from '../../api/gigApi';
import ApplicantRow from '../../components/application/ApplicantRow';
import ApplicantStatusFilter, {
  applicantSegment,
} from '../../components/application/ApplicantStatusFilter';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import RejectReasonSheet from '../../components/application/RejectReasonSheet';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

const LOAD_ERROR_MESSAGE = 'Could not load applicants. Check your connection and try again.';
const REJECT_ERROR_MESSAGE = 'Could not reject this applicant. Try again.';

// GL-221 §14: same wording as ApplicantDetailScreen's conflictMessage - a
// 409 here means someone else (the seeker withdrawing, or the business from
// another session) already decided this application first.
const REJECT_CONFLICT_MESSAGE =
  "This application's status has already changed, so it can no longer be rejected.";

// Serves both the Applicants tab (no gigId, GET /api/applications/for-my-gigs)
// and the pushed, gig-scoped instance (a gigId param, GET
// /api/gigs/:gigId/applications) - GL-257 gives that pushed entry its own
// route name so the tab can't inherit a stale param, but this component just
// reads whatever gigId it was mounted with.
export default function ApplicantsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const gigId = params?.gigId;
  const isScoped = Boolean(gigId);

  const [applications, setApplications] = useState([]);
  const [gig, setGig] = useState(null);
  const [segment, setSegment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectInstance, setRejectInstance] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);
  const [rejectFieldErrors, setRejectFieldErrors] = useState({});
  const hasLoadedRef = useRef(false);

  const fetchApplicants = useCallback(async () => {
    if (gigId) {
      const [{ applications: fetched }, { gig: fetchedGig }] = await Promise.all([
        applicationApi.getGigApplications(gigId),
        gigApi.getGig(gigId),
      ]);
      setApplications(fetched);
      setGig(fetchedGig);
    } else {
      const { applications: fetched } = await applicationApi.getApplicationsForMyGigs();
      setApplications(fetched);
    }
    hasLoadedRef.current = true;
  }, [gigId]);

  // Refetches on every focus, not just mount, so returning here after a
  // status changes elsewhere (e.g. a decision made from the detail screen)
  // shows the update without a manual refresh. Only the first-ever load
  // blocks the screen with a loader - later focuses refetch silently so
  // re-entering the tab, or coming back from a pushed applicant, doesn't
  // flash it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchApplicants()
        .catch(() => {
          if (!cancelled && isFirstLoad) setError(LOAD_ERROR_MESSAGE);
        })
        .finally(() => {
          if (!cancelled && isFirstLoad) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [fetchApplicants]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchApplicants()
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }, [fetchApplicants]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApplicants()
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setRefreshing(false));
  }, [fetchApplicants]);

  function handleCancelReject() {
    if (rejecting) return;
    setRejectTarget(null);
  }

  // Updates the one row in place rather than refetching, matching
  // ApplicantDetailScreen's handleShortlist/handleConfirmReject - the row
  // for this application re-renders with its new status on the next paint.
  // §15: routes a 400 from the rejection rules to the sheet's field errors
  // (always `reasonCode`) instead of the generic banner, same as the detail
  // screen's handleConfirmReject.
  async function handleConfirmReject({ reasonCode, note }) {
    setRejecting(true);
    setRejectError(null);
    setRejectFieldErrors({});
    try {
      const { application: updated } = await applicationApi.rejectApplication(rejectTarget.id, {
        reasonCode,
        note,
      });
      setApplications((current) =>
        current.map((application) => (application.id === updated.id ? updated : application)),
      );
      setRejectTarget(null);
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach((entry) => {
          fieldErrors[entry.field] = entry.message;
        });
        setRejectFieldErrors(fieldErrors);
      } else {
        setRejectError(
          error.response?.status === 409
            ? REJECT_CONFLICT_MESSAGE
            : apiError?.message || REJECT_ERROR_MESSAGE,
        );
      }
    } finally {
      setRejecting(false);
    }
  }

  const filteredApplications = useMemo(() => {
    if (segment === 'all') return applications;
    return applications.filter((application) => applicantSegment(application) === segment);
  }, [applications, segment]);

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader
        title="Applicants"
        small={isScoped}
        onBack={isScoped ? () => navigation.goBack() : undefined}
      />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <>
          {isScoped && gig ? (
            <Notice className="mb-3">
              {gig.title} · {gig.positions} {gig.positions === 1 ? 'position' : 'positions'} ·{' '}
              {gig.applicantCount} {gig.applicantCount === 1 ? 'applicant' : 'applicants'}
            </Notice>
          ) : null}

          <ApplicantStatusFilter
            applications={applications}
            value={segment}
            onChange={setSegment}
            className="mb-4"
          />

          <FlatList
            data={filteredApplications}
            keyExtractor={(application) => application.id}
            renderItem={({ item }) => (
              <ApplicantRow
                application={item}
                showGig={!isScoped}
                onOpen={() => navigation.navigate('ApplicantDetail', { applicationId: item.id })}
                onReject={() => {
                  setRejectError(null);
                  setRejectFieldErrors({});
                  setRejectInstance((value) => value + 1);
                  setRejectTarget(item);
                }}
                className="mb-[10px]"
              />
            )}
            contentContainerClassName="flex-grow pb-6"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              applications.length === 0 ? (
                <EmptyState
                  message={
                    isScoped
                      ? 'This gig has no applicants yet.'
                      : 'No applicants across your gigs yet.'
                  }
                />
              ) : (
                <EmptyState message="No applicants with this status." />
              )
            }
          />
        </>
      )}

      <RejectReasonSheet
        key={rejectInstance}
        visible={Boolean(rejectTarget)}
        applicantName={rejectTarget?.profileSnapshot?.name}
        submitting={rejecting}
        error={rejectError}
        errors={rejectFieldErrors}
        onConfirm={handleConfirmReject}
        onCancel={handleCancelReject}
      />
    </Screen>
  );
}
