import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import gigApi from '../../api/gigApi';
import BusinessGigCard from '../../components/gig/BusinessGigCard';
import GigActionRow from '../../components/gig/GigActionRow';
import GigStatusFilter from '../../components/gig/GigStatusFilter';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

export default function MyGigsScreen() {
  const navigation = useNavigation();
  const [gigs, setGigs] = useState([]);
  const [status, setStatus] = useState('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchGigs = useCallback(async () => {
    const { gigs: fetchedGigs } = await gigApi.getMyGigs();
    setGigs(fetchedGigs);
    hasLoadedRef.current = true;
  }, []);

  // Refetches on every focus, not just mount, so returning from posting
  // (GL-119) or editing (GL-120) a gig shows the updated list without a
  // manual refresh. Only the first-ever load blocks the screen with a
  // loader — later focuses refetch silently so re-entering the tab doesn't
  // flash it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchGigs()
        .catch(() => {
          if (!cancelled && isFirstLoad) {
            setError('Could not load your gigs.');
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
    }, [fetchGigs]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGigs()
      .catch(() => setError('Could not load your gigs.'))
      .finally(() => setLoading(false));
  }, [fetchGigs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGigs()
      .catch(() => setError('Could not load your gigs.'))
      .finally(() => setRefreshing(false));
  }, [fetchGigs]);

  const handleGigUpdated = useCallback((updatedGig) => {
    setGigs((prev) => prev.map((gig) => (gig.id === updatedGig.id ? updatedGig : gig)));
  }, []);

  const filteredGigs = useMemo(() => gigs.filter((gig) => gig.status === status), [gigs, status]);

  const postAction = (
    <Pressable onPress={() => navigation.navigate('PostGig')}>
      <Text className="text-[14px] font-bold text-signal">+ Post</Text>
    </Pressable>
  );

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="My Gigs" rightSlot={postAction} />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <>
          <GigStatusFilter value={status} onChange={setStatus} className="mb-4" />

          <FlatList
            data={filteredGigs}
            keyExtractor={(gig) => gig.id}
            renderItem={({ item }) => (
              <View className="gap-[10px]">
                <BusinessGigCard gig={item} />
                <GigActionRow gig={item} onGigUpdated={handleGigUpdated} />
              </View>
            )}
            contentContainerClassName="flex-grow gap-3 pb-6"
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              gigs.length === 0 ? (
                <EmptyState
                  message="You haven't posted any gigs yet."
                  actionLabel="Post a gig"
                  onAction={() => navigation.navigate('PostGig')}
                />
              ) : (
                <EmptyState message="No gigs with this status." />
              )
            }
          />
        </>
      )}
    </Screen>
  );
}
