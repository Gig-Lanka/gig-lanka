import { useCallback, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import applicationApi from '../../api/applicationApi';
import ApplicationTracker from '../../components/application/ApplicationTracker';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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

// §11.3: withdraw is only reachable from these three — hired, rejected,
// withdrawn and closed_filled are all terminal and have no outgoing move.
const WITHDRAWABLE_STATUSES = new Set(['applied', 'viewed', 'shortlisted']);

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
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);

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

  async function handleConfirmWithdraw() {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      const { application: updated } = await applicationApi.withdrawApplication(application.id);
      // Updates in place — no refetch — so this matches the row on the list
      // screen, which silently refetches on its own next focus (GL-188).
      setApplication(updated);
      setWithdrawVisible(false);
    } catch (error) {
      const isConflict = error.response?.status === 409;
      setWithdrawError(
        isConflict
          ? "This application's status has already changed, so it can no longer be withdrawn."
          : 'Could not withdraw this application. Try again.',
      );
    } finally {
      setWithdrawing(false);
    }
  }

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

          {WITHDRAWABLE_STATUSES.has(applicationStatus) ? (
            <View className="mt-5">
              <Pressable
                onPress={() => setWithdrawVisible(true)}
                className="h-[52px] items-center justify-center rounded-ds-lg border-[1.5px] border-danger bg-paper"
              >
                <Text className="text-body font-semibold text-danger-ink">
                  Withdraw application
                </Text>
              </Pressable>
              {withdrawError ? (
                <Text className="mt-2 text-[12.5px] text-danger-ink">{withdrawError}</Text>
              ) : null}
            </View>
          ) : null}
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

      <ConfirmDialog
        visible={withdrawVisible}
        destructive
        title="Withdraw this application?"
        body="This can't be undone, and you won't be able to apply to this gig again."
        confirmLabel={withdrawing ? 'Withdrawing…' : 'Withdraw'}
        cancelLabel="Keep my application"
        onConfirm={handleConfirmWithdraw}
        onCancel={() => setWithdrawVisible(false)}
      />
    </View>
  );
}
