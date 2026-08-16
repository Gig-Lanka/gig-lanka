import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable } from 'react-native';

import applicationApi from '../../api/applicationApi';
import ApplicationCard from '../../components/application/ApplicationCard';
import ApplicationStatusFilter, {
  isLiveApplication,
} from '../../components/application/ApplicationStatusFilter';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

export default function MyApplicationsScreen() {
  const navigation = useNavigation();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchApplications = useCallback(async () => {
    const { applications: fetched } = await applicationApi.getMyApplications();
    setApplications(fetched);
    hasLoadedRef.current = true;
  }, []);

  // Refetches on every focus, not just mount, so returning to this tab after
  // a status changes elsewhere shows the update without a manual refresh.
  // Only the first-ever load blocks the screen with a loader — later focuses
  // refetch silently so re-entering the tab doesn't flash it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchApplications()
        .catch(() => {
          if (!cancelled && isFirstLoad) {
            setError('Could not load your applications.');
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
    }, [fetchApplications]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchApplications()
      .catch(() => setError('Could not load your applications.'))
      .finally(() => setLoading(false));
  }, [fetchApplications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchApplications()
      .catch(() => setError('Could not load your applications.'))
      .finally(() => setRefreshing(false));
  }, [fetchApplications]);

  const filteredApplications = useMemo(() => {
    if (filter === 'live') return applications.filter(isLiveApplication);
    if (filter === 'decided') return applications.filter((app) => !isLiveApplication(app));
    return applications;
  }, [applications, filter]);

  const goBrowse = () => navigation.navigate('Browse');

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="Applications" />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <>
          <ApplicationStatusFilter
            applications={applications}
            value={filter}
            onChange={setFilter}
            className="mb-4"
          />

          <FlatList
            data={filteredApplications}
            keyExtractor={(application) => application.id}
            renderItem={({ item }) => (
              <Pressable
                className="mb-[10px]"
                onPress={() => navigation.navigate('ApplicationDetail', { applicationId: item.id })}
              >
                <ApplicationCard application={item} />
              </Pressable>
            )}
            contentContainerClassName="flex-grow pb-6"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              applications.length === 0 ? (
                <EmptyState
                  message="You haven't applied to anything yet."
                  actionLabel="Browse gigs"
                  onAction={goBrowse}
                />
              ) : (
                <EmptyState message="No applications with this status." />
              )
            }
          />
        </>
      )}
    </Screen>
  );
}
