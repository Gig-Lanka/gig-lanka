import { useCallback, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import useHeroScroll from '../../hooks/useHeroScroll';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this profile. Check your connection and try again.';

export default function PublicProfileScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { userId } = params;
  const hero = useHeroScroll();

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Same retry mechanism as GigDetailScreen: bumping reloadToken changes
  // this callback's identity, which is what makes useFocusEffect refetch
  // while the screen is already focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getPublicProfile(userId);
          if (!cancelled) {
            setProfile(data);
            setStatus(STATUS.READY);
          }
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            error.response?.status === 404 || error.response?.data?.error?.code === 'NOT_FOUND';
          setStatus(isNotFound ? STATUS.NOT_FOUND : STATUS.ERROR);
        }
      }

      loadProfile();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.NOT_FOUND) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Profile" small onBack={handleBack} />
        <EmptyState message="This profile is no longer available." actionLabel="Go back" onAction={handleBack} />
      </SafeAreaView>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Profile" small onBack={handleBack} />
        <EmptyState
          message={LOAD_ERROR_MESSAGE}
          actionLabel="Retry"
          onAction={() => {
            setStatus(STATUS.LOADING);
            setReloadToken((token) => token + 1);
          }}
        />
      </SafeAreaView>
    );
  }

  // The public shape has no role field (docs/api-contract.md §8.2) — a
  // seeker subject always carries `skills` as an array, a business subject
  // never does, so that presence is the only signal available for which
  // avatar shape to use here.
  const { name, photo, city } = profile;
  const isBusinessSubject = !Array.isArray(profile.skills);

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        contentContainerClassName="grow"
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader onBack={handleBack}>
            <Avatar
              uri={photo}
              name={name}
              size="lg"
              square={isBusinessSubject}
              className="self-center"
            />
            <Text className="mt-3 text-center font-display text-[22px] tracking-[-0.025em] text-paper">
              {name}
            </Text>
            {city ? (
              <Text className="mt-[7px] text-center text-[13px] font-medium text-muted-dark">
                {city}
              </Text>
            ) : null}
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]" />
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={name} onBack={handleBack} visible />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
