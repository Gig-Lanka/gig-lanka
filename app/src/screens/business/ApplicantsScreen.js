import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text } from 'react-native';

import applicationApi from '../../api/applicationApi';
import gigApi from '../../api/gigApi';
import ApplicantRow from '../../components/application/ApplicantRow';
import ApplicantStatusFilter, {
  applicantSegment,
} from '../../components/application/ApplicantStatusFilter';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

const LOAD_ERROR_MESSAGE = 'Could not load applicants. Check your connection and try again.';

// Serves both the Applicants tab (no gigId, GET /api/applications/for-my-gigs)
// and the pushed, gig-scoped instance (a gigId param, GET
// /api/gigs/:gigId/applications) - GL-257 gives that pushed entry its own
// route name so the tab can't inherit a stale param, but this component just
// reads whatever gigId it was mounted with.
//
// Loading/error/refresh polish (a loader that doesn't flash on refocus, pull
// to refresh, retry, an empty-gig empty state) is GL-259's own stated scope
// ("Add the list and detail states...") - this only fetches once and shows a
// bare loader/error so the list itself is testable.
export default function ApplicantsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const gigId = params?.gigId;
  const isScoped = Boolean(gigId);

  const [applications, setApplications] = useState([]);
  const [gig, setGig] = useState(null);
  const [segment, setSegment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (gigId) {
          const [{ applications: fetched }, { gig: fetchedGig }] = await Promise.all([
            applicationApi.getGigApplications(gigId),
            gigApi.getGig(gigId),
          ]);
          if (!cancelled) {
            setApplications(fetched);
            setGig(fetchedGig);
          }
        } else {
          const { applications: fetched } = await applicationApi.getApplicationsForMyGigs();
          if (!cancelled) setApplications(fetched);
        }
      } catch {
        if (!cancelled) setError(LOAD_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [gigId]);

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
        <Text className="px-1 text-[13px] text-danger-ink">{error}</Text>
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
                className="mb-[10px]"
              />
            )}
            contentContainerClassName="flex-grow pb-6"
          />
        </>
      )}
    </Screen>
  );
}
