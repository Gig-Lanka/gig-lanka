// GL-374 - ReviewCard's first real caller (docs/mockups/gig-lanka-community-
// rating-v3.html#reviews-section). Either role can be the subject, so this
// is registered once outside both role branches, the same as CompletedGigs
// and PublicProfile.

import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import reviewApi from '../../api/reviewApi';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import ReviewCard from '../../components/review/ReviewCard';

const LOAD_ERROR_MESSAGE = 'Could not load reviews. Check your connection and try again.';
const LOAD_MORE_ERROR_MESSAGE = 'Could not load more reviews.';
const FALLBACK_AUTHOR_NAME = 'Gig Lanka user';

function reviewNoun(count) {
  return count === 1 ? 'review' : 'reviews';
}

export default function ReviewsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { userId } = params;

  const [subject, setSubject] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  const hasMore = reviews.length < total;
  const isBusinessSubject = subject ? !Array.isArray(subject.skills) : false;

  // One entry point for both the initial load and "load more" - onEndReached
  // can fire more than once before state catches up, so isFetchingRef is the
  // single guard against overlapping requests, the same shape BrowseGigsScreen
  // uses. The subject's identity/summary is only refetched on the initial
  // load - it doesn't change while paging through their reviews.
  const load = useCallback(
    (targetPage, mode) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (mode === 'more') {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      const reviewsRequest = reviewApi.getReviewsForUser(userId, targetPage);
      const requests =
        mode === 'more' ? [reviewsRequest] : [reviewsRequest, profileApi.getPublicProfile(userId)];

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
        });
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedRef.current) return;
      hasLoadedRef.current = true;
      load(1, 'initial');
    }, [load]),
  );

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);
  const handleRetry = useCallback(() => load(1, 'initial'), [load]);
  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    load(page + 1, 'more');
  }, [hasMore, load, page]);

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

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
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
