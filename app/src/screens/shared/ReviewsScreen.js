// GL-374/GL-375 - ReviewCard's first real caller (docs/mockups/gig-lanka-
// community-rating-v3.html#reviews-section). Either role can be the
// subject, so this is registered once outside both role branches, the same
// as CompletedGigs and PublicProfile.

import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import reviewApi from '../../api/reviewApi';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SegmentedControl from '../../components/ui/SegmentedControl';
import ReviewCard from '../../components/review/ReviewCard';

const LOAD_ERROR_MESSAGE = 'Could not load reviews. Check your connection and try again.';
const LOAD_MORE_ERROR_MESSAGE = 'Could not load more reviews.';
const FALLBACK_AUTHOR_NAME = 'Gig Lanka user';
// Descending, matching the frame's "5★ 9", "4★ 2", "3★ 1" order.
const STAR_VALUES = [5, 4, 3, 2, 1];

function reviewNoun(count) {
  return count === 1 ? 'review' : 'reviews';
}

// GL-264's distribution, turned into tabs: "All N" plus one tab per star
// value that actually has a review. A bucket at zero renders no tab at all,
// as drawn - a profile with no 1-star reviews shows no 1★ tab.
function buildRatingTabs(ratingSummary) {
  const { reviewCount = 0, distribution = {} } = ratingSummary ?? {};

  if (reviewCount === 0) return [];

  const starTabs = STAR_VALUES.filter((star) => (distribution[star] ?? 0) > 0).map((star) => ({
    value: star,
    label: `${star}★ ${distribution[star]}`,
  }));

  return [{ value: null, label: `All ${reviewCount}` }, ...starTabs];
}

export default function ReviewsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { userId } = params;

  const [subject, setSubject] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRating, setSelectedRating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const hasMore = reviews.length < total;
  const isBusinessSubject = subject ? !Array.isArray(subject.skills) : false;
  const ratingTabs = useMemo(() => buildRatingTabs(subject?.ratingSummary), [subject]);

  // One entry point for every fetch (initial load, load more, star tab
  // switch) so there is exactly one place guarding against overlapping
  // requests - onEndReached can fire more than once before state catches
  // up, and isFetchingRef blocks every one of those beyond the first, the
  // same shape BrowseGigsScreen uses. `ratingOverride` defaults to the
  // current filter so "load more" keeps paging the same narrowed query it
  // started; a tab switch passes the new value explicitly instead, since
  // the state setter that commits it hasn't landed yet at the point load()
  // runs. The subject's identity/summary/distribution is only fetched on
  // the initial load - it doesn't change while paging or filtering.
  const load = useCallback(
    (targetPage, mode, ratingOverride = selectedRating) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (mode === 'more') {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else if (mode === 'filter') {
        setFilterLoading(true);
        setError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const reviewsRequest = reviewApi.getReviewsForUser(
        userId,
        targetPage,
        ratingOverride ?? undefined,
      );
      const requests =
        mode === 'initial' ? [reviewsRequest, profileApi.getPublicProfile(userId)] : [reviewsRequest];

      Promise.all(requests)
        .then(([reviewsResult, profileResult]) => {
          setReviews((prev) =>
            mode === 'more' ? [...prev, ...reviewsResult.reviews] : reviewsResult.reviews,
          );
          setTotal(reviewsResult.total);
          setPage(reviewsResult.page);
          if (profileResult) setSubject(profileResult);
        })
        .catch(() => {
          if (mode === 'more') {
            setLoadMoreError(LOAD_MORE_ERROR_MESSAGE);
          } else {
            setError(LOAD_ERROR_MESSAGE);
          }
        })
        .finally(() => {
          isFetchingRef.current = false;
          setLoading(false);
          setLoadingMore(false);
          setFilterLoading(false);
        });
    },
    [userId, selectedRating],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      load(1, 'initial');
    }, [load]),
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  // Once the subject has loaded, a retry only needs to redo the reviews
  // query (whatever star tab was active), not the profile it already has.
  const handleRetry = useCallback(
    () => load(1, subject ? 'filter' : 'initial'),
    [load, subject],
  );
  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    load(page + 1, 'more');
  }, [hasMore, load, page]);
  // Re-queries the server, resetting to page 1, rather than filtering the
  // pages already fetched - narrowing the loaded pages would make a
  // matching review past page 1 of the unfiltered list unreachable
  // (GL-215/GL-216's defect, on Browse).
  const handleSelectRating = useCallback(
    (rating) => {
      if (rating === selectedRating || isFetchingRef.current) return;
      setSelectedRating(rating);
      load(1, 'filter', rating);
    },
    [load, selectedRating],
  );

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Reviews" small onBack={handleBack} />

      {subject ? (
        <View className="flex-row items-center gap-[11px] pb-3">
          <Avatar uri={subject.photo} name={subject.name} size="sm" square={isBusinessSubject} />
          <View className="flex-1">
            <Text className="text-[14px] font-semibold text-ink">{subject.name}</Text>
            <Text className="text-[11.5px] text-muted-dark">
              {subject.ratingSummary.averageRating.toFixed(1)} average ·{' '}
              {subject.ratingSummary.reviewCount}{' '}
              {reviewNoun(subject.ratingSummary.reviewCount)} from completed gigs
            </Text>
          </View>
        </View>
      ) : null}

      {ratingTabs.length > 0 ? (
        <SegmentedControl
          options={ratingTabs}
          value={selectedRating}
          onChange={handleSelectRating}
          className="mb-3"
        />
      ) : null}

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : filterLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(review) => review.id}
          // No gig title here - GET /api/users/:userId/reviews returns only
          // the application id, not a populated gig, so the frame's "Product
          // photography shoot" line isn't sourceable yet without a further
          // server change outside this subtask's scope.
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              authorName={item.author?.name ?? FALLBACK_AUTHOR_NAME}
              authorAvatarUrl={item.author?.photo}
              className="mb-[10px]"
            />
          )}
          ListEmptyComponent={<EmptyState message="No reviews yet." />}
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
          contentContainerClassName="flex-grow pb-6"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
        />
      )}
    </Screen>
  );
}
