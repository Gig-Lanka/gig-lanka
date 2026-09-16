import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import Badge from '../ui/Badge';
import Chip from '../ui/Chip';
import useSavedToggle from '../../hooks/useSavedToggle';
import { GIG_CATEGORIES, GIG_STATUSES, SCHEDULE_TAGS } from '../../constants/enums';
import { formatDeadline, formatLocation, formatPay, formatRelativeTime } from '../../utils/format';

// Ionicons takes a literal color, not a className - these mirror the
// `signal` / `star-off` tokens in tailwind.config.js rather than importing
// them, same reasoning as SavedGigsScreen's own SIGNAL_HEX.
const SIGNAL_HEX = '#FF4A1C';
const STAR_OFF_HEX = '#C6C7CF';

function categoryLabel(category) {
  return GIG_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

function scheduleLabel(tag) {
  return SCHEDULE_TAGS.find((entry) => entry.value === tag)?.label ?? tag;
}

function statusLabel(status) {
  return GIG_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

// Same status → Badge variant mapping as BusinessGigCard and GigDetailScreen,
// kept in sync so a gig's status pill reads identically wherever it appears.
const BADGE_VARIANT_BY_STATUS = {
  open: 'positive',
  filled: 'strong',
  closed: 'muted',
  draft: 'neutral',
};

export default function GigCard({ gig, onPress, className, ...props }) {
  const {
    id,
    title,
    payAmount,
    payType,
    city,
    area,
    remote,
    category,
    schedule = [],
    positions,
    applicantCount = 0,
    createdAt,
    applicationsCloseDate,
    status,
    viewerSaved,
  } = gig;

  // Browse only ever lists open gigs, so `status` is absent there and this
  // stays the plain card it's always been. The Saved list carries every
  // status (docs/api-contract.md §10.12: a saved gig that's since closed or
  // filled still shows here, with its real status) - the badge and the
  // "Applications closed" deadline copy only appear once status diverges
  // from open, matching the closed treatment used elsewhere in the app.
  const isOpen = status == null || status === 'open';
  const deadline = isOpen
    ? applicationsCloseDate
      ? formatDeadline(applicationsCloseDate)
      : null
    : { label: 'Applications closed', urgent: false };
  const Container = onPress ? Pressable : View;

  // Missing viewerSaved (a response that doesn't carry it at all) reads as
  // not-saved, not a crash.
  const { saved, toggle, conflictMessage } = useSavedToggle(id, viewerSaved ?? false);

  return (
    <Container
      onPress={onPress}
      className={['rounded-ds-card border-[1.5px] border-line bg-paper p-4', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-[15.5px] font-semibold leading-[19.8px] tracking-[-0.01em] text-ink">
          {title}
        </Text>
        <View className="flex-row items-center gap-[6px]">
          {!isOpen ? (
            <Badge variant={BADGE_VARIANT_BY_STATUS[status] ?? 'neutral'}>{statusLabel(status)}</Badge>
          ) : null}
          {/* A Pressable nested inside Container's own Pressable tree, not a
              sibling - React Native resolves the touch to whichever
              Pressable is deepest under the finger, so this claims the tap
              and Container's onPress never also fires for it. Verified by
              tapping the star repeatedly without gig detail opening. */}
          <Pressable
            onPress={toggle}
            hitSlop={8}
            className="h-7 w-7 items-center justify-center"
          >
            <Ionicons
              name={saved ? 'star' : 'star-outline'}
              size={19}
              color={saved ? SIGNAL_HEX : STAR_OFF_HEX}
            />
          </Pressable>
        </View>
      </View>

      <Text className="mt-2 font-display text-title text-signal">{formatPay(payAmount, payType)}</Text>

      <Text className="mt-[2px] text-[13.5px] text-muted">
        {formatLocation({ isRemote: remote, area, city })}
      </Text>

      <Text className="mt-2 text-overline text-muted-dark">{categoryLabel(category)}</Text>

      <View className="mt-[10px] flex-row flex-wrap gap-[6px]">
        {schedule.map((tag) => (
          <Chip key={tag} size="sm">
            {scheduleLabel(tag)}
          </Chip>
        ))}
      </View>

      <View className="mt-[11px] flex-row items-center justify-between gap-3 border-t border-line pt-[10px]">
        <Text className="flex-1 text-[11.5px] text-muted-dark">
          {formatRelativeTime(createdAt)} · {positions} {positions === 1 ? 'position' : 'positions'} ·{' '}
          {applicantCount} applied
        </Text>
        {deadline ? (
          <Text
            className={[
              'text-[11.5px]',
              deadline.urgent ? 'font-semibold text-danger-ink' : 'font-medium text-muted',
            ].join(' ')}
          >
            {deadline.label}
          </Text>
        ) : null}
      </View>

      {conflictMessage ? (
        <Text className="mt-2 text-[11.5px] font-medium text-danger-ink">{conflictMessage}</Text>
      ) : null}
    </Container>
  );
}
