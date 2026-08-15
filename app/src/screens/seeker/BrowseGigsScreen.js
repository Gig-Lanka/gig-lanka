import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import GigCard from '../../components/gig/GigCard';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

const LOAD_ERROR_MESSAGE = 'Could not load gigs. Check your connection and try again.';

export default function BrowseGigsScreen() {
  const navigation = useNavigation();
  const [gigs, setGigs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const hasMore = gigs.length < total;

  // Single entry point for every fetch (initial load, pull-to-refresh, load
  // more) so there is exactly one place guarding against overlapping
  // requests — onEndReached can fire several times before state updates
  // land, and isFetchingRef blocks every one of those beyond the first.
  const load = useCallback((targetPage, mode) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (mode === 'refresh') {
      setRefreshing(true);
      setError(null);
    } else if (mode === 'more') {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    gigApi
      .listGigs({ page: targetPage })
      .then((data) => {
        setGigs((prev) => (mode === 'more' ? [...prev, ...data.gigs] : data.gigs));
        setTotal(data.total);
        setPage(data.page);
      })
      .catch(() => {
        if (mode === 'more') {
          setLoadMoreError(LOAD_ERROR_MESSAGE);
        } else {
          setError(LOAD_ERROR_MESSAGE);
        }
      })
      .finally(() => {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      });
  }, []);

  // useFocusEffect rather than a plain mount effect only to keep the fetch
  // inside an async callback rather than a synchronous setState-on-mount —
  // hasLoadedRef still limits it to firing once, same as a mount effect would.
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      load(1, 'initial');
    }, [load]),
  );

  const handleRetry = useCallback(() => load(1, 'initial'), [load]);
  const handleRefresh = useCallback(() => load(1, 'refresh'), [load]);
  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    load(page + 1, 'more');
  }, [hasMore, load, page]);

  const handleCardPress = useCallback(
    (gig) => navigation.navigate('GigDetail', { gigId: gig.id }),
    [navigation],
  );

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="Find a gig" />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <FlatList
          data={gigs}
          keyExtractor={(gig) => gig.id}
          renderItem={({ item }) => <GigCard gig={item} onPress={() => handleCardPress(item)} />}
          ListHeaderComponent={
            gigs.length > 0 ? (
              <Text className="mb-3 text-label text-muted">
                {total} {total === 1 ? 'gig' : 'gigs'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState message="No gigs are open right now. Check back soon." />
          }
          ListFooterComponent={
            loadingMore ? (
              <Loader />
            ) : loadMoreError ? (
              <View className="items-center py-4">
                <Text className="text-[13px] text-danger-ink">{loadMoreError}</Text>
                <Pressable onPress={handleEndReached} className="mt-2">
                  <Text className="text-[13px] font-semibold text-signal">Retry</Text>
                </Pressable>
              </View>
            ) : null
          }
          contentContainerClassName="flex-grow gap-3 pb-6"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </Screen>
  );
}
