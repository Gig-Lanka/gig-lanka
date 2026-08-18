import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import GigCard from '../../components/gig/GigCard';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { SCHEDULE_TAGS } from '../../constants/enums';

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
  const [selectedTags, setSelectedTags] = useState([]);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const hasMore = gigs.length < total;
  const hasFilter = selectedTags.length > 0;

  // Narrows whatever's already loaded rather than querying the server -
  // GET /api/gigs has no filter param this sprint, and adding one is a
  // server-side change that's explicitly out of scope. Scrolling to the
  // bottom of a short filtered view still fetches further raw pages (see
  // handleEndReached), since a later page may hold more matches.
  const filteredGigs = useMemo(() => {
    if (!hasFilter) return gigs;
    return gigs.filter((gig) => (gig.schedule ?? []).some((tag) => selectedTags.includes(tag)));
  }, [gigs, hasFilter, selectedTags]);

  // Single entry point for every fetch (initial load, pull-to-refresh, load
  // more) so there is exactly one place guarding against overlapping
  // requests - onEndReached can fire several times before state updates
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
  // inside an async callback rather than a synchronous setState-on-mount -
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

  const toggleTag = useCallback((tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag],
    );
  }, []);

  const clearTags = useCallback(() => setSelectedTags([]), []);

  return (
    <Screen>
      <ScreenHeader title="Find a gig" />

      {/* Always visible, never behind a filter sheet - schedule is the
          first thing this audience filters by. Room is left below for the
          Sprint 2 search field and a "Filters" entry point beside this row. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4 flex-grow-0"
        contentContainerClassName="gap-2 pr-4"
      >
        {SCHEDULE_TAGS.map((tag) => (
          <Chip
            key={tag.value}
            selected={selectedTags.includes(tag.value)}
            onPress={() => toggleTag(tag.value)}
          >
            {tag.label}
          </Chip>
        ))}
      </ScrollView>

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <FlatList
          data={filteredGigs}
          keyExtractor={(gig) => gig.id}
          renderItem={({ item }) => <GigCard gig={item} onPress={() => handleCardPress(item)} />}
          ListHeaderComponent={
            gigs.length > 0 ? (
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <Text className="text-label text-muted">
                  {hasFilter
                    ? `${filteredGigs.length} ${filteredGigs.length === 1 ? 'gig' : 'gigs'} match your filters`
                    : `${total} ${total === 1 ? 'gig' : 'gigs'}`}
                </Text>
                {hasFilter ? (
                  <Pressable onPress={clearTags}>
                    <Text className="text-label font-semibold text-signal">Clear all</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            gigs.length === 0 ? (
              <EmptyState message="No gigs are open right now. Check back soon." />
            ) : (
              <EmptyState
                message="No gigs match your selected schedule filters."
                actionLabel="Clear filters"
                onAction={clearTags}
              />
            )
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
