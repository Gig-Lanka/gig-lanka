import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import GigCard from '../../components/gig/GigCard';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import TextInput from '../../components/ui/TextInput';
import { SCHEDULE_TAGS } from '../../constants/enums';

const LOAD_ERROR_MESSAGE = 'Could not load gigs. Check your connection and try again.';
const SEARCH_PLACEHOLDER = 'Search tutoring, delivery, events…';
// Chosen so a burst of keystrokes collapses into one request without the
// field feeling laggy - stated here per the PR note this ticket asked for.
const SEARCH_DEBOUNCE_MS = 400;

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
  const [searchText, setSearchText] = useState('');
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const searchDebounceRef = useRef(null);

  const hasMore = gigs.length < total;
  const hasFilter = selectedTags.length > 0 || searchText.trim().length > 0;

  // Single entry point for every fetch (initial load, pull-to-refresh, load
  // more, search, filter change) so there is exactly one place guarding
  // against overlapping requests - onEndReached can fire several times
  // before state updates land, and isFetchingRef blocks every one of those
  // beyond the first. q and schedule default to the current committed state
  // so pagination always repeats the same query as the page it follows;
  // toggling a filter passes the new value explicitly instead, since the
  // state setter that commits it hasn't landed yet at the point load() runs.
  const load = useCallback(
    (targetPage, mode, overrides = {}) => {
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

      const q = (overrides.q ?? searchText).trim();
      const schedule = overrides.schedule ?? selectedTags;

      gigApi
        .listGigs({ page: targetPage, q, schedule })
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
    },
    [searchText, selectedTags],
  );

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

  // Clears any pending debounce timer on unmount so a keystroke made just
  // before navigating away never fires load() after the screen is gone -
  // that would be a state update on an unmounted component.
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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

  const handleSearchChange = useCallback(
    (text) => {
      setSearchText(text);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        load(1, 'initial', { q: text, schedule: selectedTags });
      }, SEARCH_DEBOUNCE_MS);
    },
    [load, selectedTags],
  );

  const toggleTag = useCallback(
    (tag) => {
      // Supersedes any debounced search still waiting to fire - otherwise it
      // could land after this tap and overwrite the schedule change with the
      // stale selectedTags it closed over at keystroke time.
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      const next = selectedTags.includes(tag)
        ? selectedTags.filter((value) => value !== tag)
        : [...selectedTags, tag];
      setSelectedTags(next);
      load(1, 'initial', { schedule: next, q: searchText });
    },
    [load, searchText, selectedTags],
  );

  const clearFilters = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setSelectedTags([]);
    setSearchText('');
    load(1, 'initial', { schedule: [], q: '' });
  }, [load]);

  return (
    <Screen>
      <ScreenHeader title="Find a gig" />

      <TextInput
        value={searchText}
        onChangeText={handleSearchChange}
        placeholder={SEARCH_PLACEHOLDER}
        returnKeyType="search"
        autoCorrect={false}
      />

      {/* Always visible, never behind a filter sheet - schedule is the
          first thing this audience filters by. */}
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
          data={gigs}
          keyExtractor={(gig) => gig.id}
          renderItem={({ item }) => <GigCard gig={item} onPress={() => handleCardPress(item)} />}
          ListHeaderComponent={
            gigs.length > 0 ? (
              <View className="mb-3 flex-row items-center justify-between gap-3">
                <Text className="text-label text-muted">
                  {total} {total === 1 ? 'gig' : 'gigs'}
                  {hasFilter ? ' match your filters' : ''}
                </Text>
                {hasFilter ? (
                  <Pressable onPress={clearFilters}>
                    <Text className="text-label font-semibold text-signal">Clear all</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            hasFilter ? (
              <EmptyState
                message="No gigs match your search or filters."
                actionLabel="Clear filters"
                onAction={clearFilters}
              />
            ) : (
              <EmptyState message="No gigs are open right now. Check back soon." />
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
