import { useCallback, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { profileApi } from '../../api';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ProfileSectionHeader from '../../components/profile/ProfileSectionHeader';
import RatingSummary from '../../components/review/RatingSummary';
import useHeroScroll from '../../hooks/useHeroScroll';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

export default function ProfileScreen() {
  const navigation = useNavigation();
  const hero = useHeroScroll();

  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetches on every focus, not just on mount - see the same comment on
  // the seeker screen for why (GL-148's edit screen calls goBack() rather
  // than passing data back). State only ever changes after the `await`,
  // so this stays clear of the set-state-in-effect lint rule.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadProfile() {
        try {
          const data = await profileApi.getMyProfile();
          if (!cancelled) {
            setProfile(data);
            setStatus(STATUS.READY);
          }
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      loadProfile();

      return () => {
        cancelled = true;
      };
      // reloadToken isn't read above; bumping it changes this callback's
      // identity, which is what makes useFocusEffect refetch on Retry
      // while the screen is already focused.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken]),
  );

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <EmptyState
        className="bg-paper"
        message="We couldn't load your profile."
        actionLabel="Retry"
        onAction={() => {
          setStatus(STATUS.LOADING);
          setReloadToken((token) => token + 1);
        }}
      />
    );
  }

  const { user, name, photo, bio, city, category, ratingSummary } = profile;

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        // Rubber-band overscroll past the bottom of the (now full-height)
        // HeroSheet would otherwise expose this View's own bg-ink for a
        // moment - bounce is only useful here for the pull-down-at-top
        // gesture over the hero, so it's turned off rather than partially
        // reworked, since RN has no per-edge bounce control.
        bounces={false}
        overScrollMode="never"
        // NativeWind's cssInterop only wires up contentContainerClassName
        // on the plain ScrollView export, not Animated.ScrollView (a
        // distinct component reference) - "grow" was silently inert here,
        // so HeroSheet's flex-1 had nothing to grow into and short
        // profiles showed bare bg-ink below the sheet (GL-282). The raw
        // style prop always works regardless of that registration gap.
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader
            rightSlot={
              <Pressable onPress={() => navigation.navigate('EditProfile')}>
                <Text className="text-[14px] font-bold text-signal">Edit</Text>
              </Pressable>
            }
          >
            <Avatar uri={photo} name={name} size="lg" square className="self-center" />
            <Text className="mt-3 text-center font-display text-[22px] tracking-[-0.025em] text-paper">
              {name}
            </Text>
            <View className="mt-[7px] flex-row flex-wrap items-center justify-center gap-2">
              <Text className="rounded-full border border-white/[0.16] bg-white/10 px-[11px] py-[5px] text-[11.5px] font-bold text-paper">
                Business
              </Text>
              {city ? (
                <Text className="text-[13px] font-medium text-muted-dark">{city}</Text>
              ) : null}
            </View>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          {bio ? <Text className="text-desc leading-[21px] text-muted">{bio}</Text> : null}

          {category ? (
            <View className="mt-5">
              <ProfileSectionHeader title="Category" />
              <View className="mt-[10px]">
                <Chip size="sm">{category}</Chip>
              </View>
            </View>
          ) : null}

          <RatingSummary rating={ratingSummary} userId={user} className="mt-5" />

          <Button
            variant="small"
            fullWidth={false}
            onPress={() => navigation.navigate('AccountSettings')}
            className="mt-8 self-center"
          >
            Account settings
          </Button>
        </HeroSheet>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={name} photo={photo} avatarSquare visible />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
