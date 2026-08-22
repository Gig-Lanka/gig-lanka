import { useCallback, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { profileApi } from '../../api';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import EntryCard from '../../components/profile/EntryCard';
import ProfileSectionHeader from '../../components/profile/ProfileSectionHeader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import RatingSummary from '../../components/review/RatingSummary';
import SkillsRow from '../../components/profile/SkillsRow';
import useHeroScroll from '../../hooks/useHeroScroll';
import { formatDateRange } from '../../utils/format';

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
        <EmptyState
          message="This profile is no longer available."
          actionLabel="Go back"
          onAction={handleBack}
        />
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

  // The public shape has no role field (docs/api-contract.md §8.2) - a
  // seeker subject always carries `skills` as an array, a business subject
  // never does, so that presence is the only signal available for which
  // avatar shape and sections to render here.
  const {
    name,
    photo,
    city,
    bio,
    category,
    ratingSummary,
    skills = [],
    workExperience = [],
    education = [],
  } = profile;
  const isBusinessSubject = !Array.isArray(profile.skills);

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

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          {bio ? <Text className="text-desc leading-[21px] text-muted">{bio}</Text> : null}

          {/*
            Skill Trial badges - read-only, no route into anything. Same
            discipline as the own-profile screens: the per-entry shape isn't
            published by Application & Hiring yet and skillTrialResults is
            empty until Sprint 3, so nothing is rendered here rather than a
            guessed shape.
          */}

          {isBusinessSubject ? (
            <>
              {category ? (
                <View className="mt-5">
                  <ProfileSectionHeader title="Category" />
                  <View className="mt-[10px]">
                    <Chip size="sm">{category}</Chip>
                  </View>
                </View>
              ) : null}

              <RatingSummary rating={ratingSummary} className="mt-5" />
            </>
          ) : (
            <>
              {skills.length > 0 ? (
                <View className="mt-5">
                  <ProfileSectionHeader title="Skills" />
                  <View className="mt-[10px]">
                    <SkillsRow skills={skills} />
                  </View>
                </View>
              ) : null}

              {workExperience.length > 0 ? (
                <View className="mt-5">
                  <ProfileSectionHeader title="Work experience" />
                  <View className="mt-[10px] gap-[10px]">
                    {workExperience.map((entry) => (
                      <EntryCard
                        key={entry._id}
                        title={entry.roleTitle}
                        subtitle={entry.employer}
                        dateRange={formatDateRange(entry)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {education.length > 0 ? (
                <View className="mt-5">
                  <ProfileSectionHeader title="Education" />
                  <View className="mt-[10px] gap-[10px]">
                    {education.map((entry) => (
                      <EntryCard
                        key={entry._id}
                        title={entry.qualification}
                        subtitle={entry.institution}
                        dateRange={formatDateRange(entry)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <RatingSummary rating={ratingSummary} className="mt-5" />
            </>
          )}
        </HeroSheet>
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
