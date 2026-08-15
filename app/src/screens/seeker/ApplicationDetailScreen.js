import { useCallback, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import ApplicationTracker from '../../components/application/ApplicationTracker';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useHeroScroll from '../../hooks/useHeroScroll';
import { APPLICATION_STATUSES, REJECTION_REASONS } from '../../constants/enums';
import { formatPay } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error' };

const LOAD_ERROR_MESSAGE = 'Could not load this application. Check your connection and try again.';

function statusLabel(value) {
  return APPLICATION_STATUSES.find((entry) => entry.value === value)?.label ?? value;
}

function reasonLabel(code) {
  return REJECTION_REASONS.find((entry) => entry.value === code)?.label ?? code;
}

export default function ApplicationDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { applicationId } = params;
  const hero = useHeroScroll();

  const [application, setApplication] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetches on every focus, not just mount — same pattern as GigDetailScreen
  // (GL-172), and doubles as the retry mechanism via reloadToken.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadApplication() {
        try {
          const data = await applicationApi.getApplication(applicationId);
          if (!cancelled) {
            setApplication(data.application);
            setStatus(STATUS.READY);
          }
        } catch {
          if (!cancelled) setStatus(STATUS.ERROR);
        }
      }

      loadApplication();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applicationId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Application" small onBack={handleBack} />
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

  const { gig, status: applicationStatus, rejectionReasonCode, rejectionNote } = application;
  const isRejected = applicationStatus === 'rejected';

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        contentContainerClassName="grow"
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader onBack={handleBack}>
            <Text className="font-display text-[23px] leading-[27px] tracking-[-0.025em] text-paper">
              {gig?.title ?? 'Gig no longer available'}
            </Text>
            <View className="mt-3 flex-row items-center gap-[9px]">
              {/* Neutral on the hero regardless of status — a rejection is
                  not an error, so it never turns this pill red. */}
              <View className="rounded-full border border-white/[0.14] bg-white/10 px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-paper">
                  {statusLabel(applicationStatus)}
                </Text>
              </View>
              {gig ? (
                <Text className="text-[13.5px] font-medium text-muted-dark">
                  {formatPay(gig.payAmount, gig.payType)}
                </Text>
              ) : null}
            </View>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          <ApplicationTracker application={application} />

          {isRejected ? (
            <View className="mt-5">
              <SectionLabel>Reason given</SectionLabel>
              <Text className="mt-2 font-display text-title text-ink">
                {reasonLabel(rejectionReasonCode)}
              </Text>
              {rejectionNote ? (
                <Text className="mt-2 text-desc leading-[21px] text-muted">{rejectionNote}</Text>
              ) : null}
            </View>
          ) : null}

          <View className="mt-5">
            <SectionLabel>The gig</SectionLabel>
            {gig ? (
              <Pressable
                onPress={() => navigation.navigate('GigDetail', { gigId: gig.id })}
                className="mt-2 flex-row items-center justify-between rounded-ds-card border-[1.5px] border-line bg-paper p-4"
              >
                <View className="flex-1">
                  <Text className="font-display text-title text-ink">{gig.title}</Text>
                  <Text className="mt-[5px] text-desc text-muted">
                    {formatPay(gig.payAmount, gig.payType)} · {gig.city}
                  </Text>
                </View>
                <Text className="text-[15px] font-semibold text-muted-dark">›</Text>
              </Pressable>
            ) : (
              <Text className="mt-2 text-desc text-muted">This gig is no longer available.</Text>
            )}
          </View>
        </HeroSheet>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={gig?.title ?? 'Application'} onBack={handleBack} visible />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
