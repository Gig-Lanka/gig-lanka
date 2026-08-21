import { useCallback, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import gigApi from '../../api/gigApi';
import GigBusinessBlock from '../../components/gig/GigBusinessBlock';
import GigDetailList from '../../components/gig/GigDetailList';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import HeroHeader, { HeroSheet, HeroStickyBar } from '../../components/ui/HeroHeader';
import Loader from '../../components/ui/Loader';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import useAuth from '../../hooks/useAuth';
import useHeroScroll from '../../hooks/useHeroScroll';
import {
  COMMITMENT_LENGTHS,
  GIG_CATEGORIES,
  GIG_STATUSES,
  SCHEDULE_TAGS,
} from '../../constants/enums';
import { formatDeadline, formatLocation, formatPay, formatShortDate } from '../../utils/format';

const STATUS = { LOADING: 'loading', READY: 'ready', ERROR: 'error', NOT_FOUND: 'not_found' };

const LOAD_ERROR_MESSAGE = 'Could not load this gig. Check your connection and try again.';

// Same status → Badge variant mapping as BusinessGigCard, kept in sync so a
// gig's status pill reads identically wherever it appears.
const BADGE_VARIANT_BY_STATUS = {
  open: 'positive',
  filled: 'strong',
  closed: 'muted',
  draft: 'neutral',
};

function labelFor(list, value) {
  return list.find((entry) => entry.value === value)?.label ?? value;
}

export default function GigDetailScreen({ onSignIn }) {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId } = params;
  const hero = useHeroScroll();
  const { user } = useAuth();

  const [gig, setGig] = useState(null);
  const [business, setBusiness] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetches on every focus, not just on mount - same rationale as the
  // profile screens (GL-145's edit screen calls goBack() rather than
  // passing data back), and it doubles as the retry mechanism: bumping
  // reloadToken changes this callback's identity, which is what makes
  // useFocusEffect run it again while the screen is already focused.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadGig() {
        try {
          const data = await gigApi.getGig(gigId);
          if (!cancelled) {
            setGig(data.gig);
            setBusiness(data.business);
            setStatus(STATUS.READY);
          }
        } catch (error) {
          if (cancelled) return;
          const isNotFound =
            error.response?.status === 404 || error.response?.data?.error?.code === 'NOT_FOUND';
          setStatus(isNotFound ? STATUS.NOT_FOUND : STATUS.ERROR);
        }
      }

      loadGig();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gigId, reloadToken]),
  );

  const handleBack = () => navigation.goBack();

  if (status === STATUS.LOADING) {
    return <Loader fullScreen />;
  }

  if (status === STATUS.NOT_FOUND) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Gig" small onBack={handleBack} />
        <EmptyState
          message="This gig no longer exists."
          actionLabel="Go back"
          onAction={handleBack}
        />
      </SafeAreaView>
    );
  }

  if (status === STATUS.ERROR) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Gig" small onBack={handleBack} />
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

  const {
    title,
    payAmount,
    payType,
    status: gigStatus,
    city,
    area,
    remote,
    category,
    schedule = [],
    commitment,
    positions,
    startDate,
    applicationsCloseDate,
    applicantCount = 0,
    createdAt,
    description,
  } = gig;

  const location = formatLocation({ isRemote: remote, area, city });
  const deadline = applicationsCloseDate ? formatDeadline(applicationsCloseDate) : null;

  // GL-155's public profile screen may not be registered yet - routing into
  // it unconditionally would throw on tap ("was not handled by any
  // navigator"). Checking the enclosing stack's own route names is what
  // keeps the block inert until that screen actually exists, with nothing
  // else here needing to change once it does.
  const canViewBusinessProfile = navigation.getState().routeNames.includes('PublicProfile');
  const handleViewBusiness = canViewBusinessProfile
    ? () => navigation.navigate('PublicProfile', { userId: business.id })
    : undefined;

  // Four states, checked in this order because each overrides the ones
  // below it - an owner sees their edit route no matter the gig's status,
  // and a closed gig reads the same to a guest as to a seeker:
  //  1. The owning business - apply is never offered, editing is.
  //  2. Any other viewer, gig not open - "Applications closed", disabled,
  //     never hidden.
  //  3. A guest, gig open - routes to sign-in; reading is public, applying
  //     is not.
  //  4. A signed-in seeker, gig open - routes to GL-123's apply screen.
  // Display-only: the server is what actually enforces who may apply.
  const isOwner = user?.role === 'business' && business?.id === user?.id;
  const isSeeker = user?.role === 'seeker';
  const isOpen = gigStatus === 'open';

  let primaryAction = null;
  if (isOwner) {
    primaryAction = {
      label: 'Edit this gig',
      onPress: () => navigation.navigate('EditGig', { gigId }),
    };
  } else if (!isOpen) {
    primaryAction = { label: 'Applications closed', disabled: true };
  } else if (!user) {
    primaryAction = { label: 'Apply for this gig', onPress: () => onSignIn?.() };
  } else if (isSeeker) {
    primaryAction = {
      label: 'Apply for this gig',
      onPress: () => navigation.navigate('Apply', { gigId }),
    };
  }

  const detailRows = [
    { label: 'Category', value: labelFor(GIG_CATEGORIES, category) },
    { label: 'Schedule', value: schedule.map((tag) => labelFor(SCHEDULE_TAGS, tag)).join(', ') },
    { label: 'Commitment', value: labelFor(COMMITMENT_LENGTHS, commitment) },
    { label: 'Location', value: location },
    { label: 'Starts', value: startDate ? formatShortDate(new Date(startDate)) : null },
    { label: 'Positions', value: String(positions) },
    { label: 'Applicants so far', value: String(applicantCount) },
  ];

  return (
    <View className="flex-1 bg-ink">
      <Animated.ScrollView
        className="flex-1"
        onScroll={hero.onScroll}
        scrollEventThrottle={hero.scrollEventThrottle}
        contentContainerClassName="grow"
      >
        <View onLayout={hero.onHeroLayout}>
          <HeroHeader onBack={handleBack}>
            <Text className="font-display text-[25px] leading-[29px] tracking-[-0.025em] text-paper">
              {title}
            </Text>
            <View className="mt-3 flex-row items-center gap-[11px]">
              <Text className="font-display text-[24px] tracking-[-0.03em] text-signal">
                {formatPay(payAmount, payType)}
              </Text>
              <Badge variant={BADGE_VARIANT_BY_STATUS[gigStatus] ?? 'neutral'}>
                {labelFor(GIG_STATUSES, gigStatus)}
              </Badge>
            </View>
            <Text className="mt-2 text-[13.5px] font-medium text-muted-dark">
              {location} · {labelFor(COMMITMENT_LENGTHS, commitment)}
            </Text>
          </HeroHeader>
        </View>

        <HeroSheet className="px-[22px] pb-8 pt-[22px]">
          {deadline ? (
            <View
              className={[
                'rounded-ds-md px-[14px] py-[11px]',
                deadline.urgent ? 'bg-warning-soft' : 'bg-haze',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-[13.5px] font-medium',
                  deadline.urgent ? 'text-warning-ink' : 'text-muted',
                ].join(' ')}
              >
                {deadline.label}
              </Text>
            </View>
          ) : null}

          <GigBusinessBlock
            business={business}
            postedAt={createdAt}
            onPress={handleViewBusiness}
            className={deadline ? 'mt-4' : undefined}
          />

          <View className="mt-5">
            <SectionLabel>About this gig</SectionLabel>
            <Text className="mt-2 text-desc leading-[21px] text-muted">{description}</Text>
          </View>

          <View className="mt-5">
            <SectionLabel>Details</SectionLabel>
            <GigDetailList rows={detailRows} className="mt-2" />
          </View>
        </HeroSheet>
      </Animated.ScrollView>

      {primaryAction ? (
        <SafeAreaView
          edges={['bottom']}
          className="border-t border-line bg-paper px-[22px] pb-[10px] pt-[14px]"
        >
          <Button
            disabled={primaryAction.disabled}
            trailingArrow={!primaryAction.disabled}
            onPress={primaryAction.onPress}
          >
            {primaryAction.label}
          </Button>
        </SafeAreaView>
      ) : null}

      <Animated.View
        pointerEvents={hero.stickyPointerEvents}
        style={hero.stickyStyle}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView edges={['top']} className="bg-paper">
          <HeroStickyBar title={title} onBack={handleBack} visible />
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}
