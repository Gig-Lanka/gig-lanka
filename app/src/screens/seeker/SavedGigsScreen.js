import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import gigApi from '../../api/gigApi';
import GigCard from '../../components/gig/GigCard';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';

const LOAD_ERROR_MESSAGE = 'Could not load your saved gigs.';

// #saved-gigs-empty's glyph sits in signal orange on a signal-soft circle -
// Ionicons takes a literal color, not a className, so this mirrors the
// `signal` token hex from tailwind.config.js rather than importing it.
const SIGNAL_HEX = '#FF4A1C';

export default function SavedGigsScreen() {
  const navigation = useNavigation();
  const [gigs, setGigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  const fetchSavedGigs = useCallback(async () => {
    const { gigs: fetched } = await gigApi.getSavedGigs();
    // GET /gigs/saved doesn't send viewerSaved per item the way listGigs and
    // getGig do (docs/api-contract.md §10.12) - everything it returns is
    // saved by definition, so that's filled in here rather than leaving
    // GigCard's star to fall back to its unsaved default.
    setGigs(fetched.map((gig) => ({ ...gig, viewerSaved: true })));
    hasLoadedRef.current = true;
  }, []);

  // Refetches on every focus, not just mount - brief §6: a gig unsaved from
  // Browse or gig detail is gone when this tab is reopened. Only the
  // first-ever load blocks the screen with a loader; later focuses refetch
  // silently so re-entering the tab doesn't flash it.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchSavedGigs()
        .catch(() => {
          if (!cancelled && isFirstLoad) {
            setError(LOAD_ERROR_MESSAGE);
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
    }, [fetchSavedGigs]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSavedGigs()
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }, [fetchSavedGigs]);

  const goBrowse = () => navigation.navigate('Browse');

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Saved" />

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : gigs.length === 0 ? (
        // #saved-gigs-empty note: sits high on the screen, not vertically
        // centred - EmptyState's own flex-1 + justify-center would sink it,
        // so this is built to the frame directly instead of reusing it.
        <View className="items-center pt-8">
          <View className="w-full items-center rounded-[22px] border-[1.5px] border-dashed border-line bg-haze px-6 py-[30px]">
            <View className="mb-[13px] h-12 w-12 items-center justify-center rounded-2xl bg-signal-soft">
              <Ionicons name="star-outline" size={22} color={SIGNAL_HEX} />
            </View>
            <Text className="text-center font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
              Nothing saved yet
            </Text>
            <Text className="mt-[6px] text-center text-[14px] leading-[21px] text-muted">
              Tap the star on any gig and it waits for you here.
            </Text>
            <Button variant="outline" className="mt-5" onPress={goBrowse}>
              Browse gigs
            </Button>
          </View>
        </View>
      ) : (
        <>
          <Text className="mb-3 text-[11.5px] text-muted-dark">
            {gigs.length} {gigs.length === 1 ? 'gig' : 'gigs'} parked to decide on later
          </Text>

          <FlatList
            data={gigs}
            keyExtractor={(gig) => gig.id}
            renderItem={({ item }) => (
              <GigCard
                gig={item}
                onPress={() => navigation.navigate('GigDetail', { gigId: item.id })}
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
