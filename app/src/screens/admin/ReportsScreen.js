import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import reportApi from '../../api/reportApi';
import ReportNote from '../../components/report/ReportNote';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SegmentedControl from '../../components/ui/SegmentedControl';
import useAuth from '../../hooks/useAuth';
import { REPORT_REASONS, REPORT_STATUSES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const LOAD_ERROR_MESSAGE = 'Could not load reports. Check your connection and try again.';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

const EMPTY_MESSAGE_BY_STATUS = {
  open: "No open reports right now — you're all caught up.",
  closed: 'No closed reports yet.',
};

// Same convention as ApplicationCard's status badges: a good outcome is
// positive, a no-action outcome is muted grey - never alarm red.
const OUTCOME_BADGE_VARIANT = {
  resolved: 'positive',
  dismissed: 'muted',
};

function reasonLabel(code) {
  return REPORT_REASONS.find((entry) => entry.value === code)?.label ?? code;
}

function outcomeLabel(status) {
  return REPORT_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

// The queue API resolves `target` through the same narrow boundaries every
// other component reads through, and returns it `null` when the reported
// gig or user is gone (GL-306 criterion 10) - the row still renders, it just
// says so instead of naming a target it can no longer look up.
function targetLabel({ targetType, target }) {
  if (!target) {
    return targetType === 'gig' ? 'Gig no longer available' : 'Profile no longer available';
  }
  if (targetType === 'gig') {
    return target.business?.name ? `${target.title} · ${target.business.name}` : target.title;
  }
  return target.name ?? 'Unnamed user';
}

// A closed row (§13.4's `status=closed`) is the open row plus its outcome
// Badge beside the reason and a line saying when it was closed.
//
// GL-406: the whole row opens ReportDetail with this row's data - there's no
// single-report read - and the chevron is the only thing it adds, the same
// `›` ApplicantDetailScreen's routable trial row uses.
function ReportRow({ report, onPress }) {
  const isClosed = report.status === 'resolved' || report.status === 'dismissed';

  return (
    <Card onPress={onPress} className="flex-row items-center gap-3">
      <View className="flex-1 gap-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 flex-row flex-wrap gap-2">
            <Badge>{reasonLabel(report.reasonCode)}</Badge>
            {isClosed ? (
              <Badge variant={OUTCOME_BADGE_VARIANT[report.status]}>
                {outcomeLabel(report.status)}
              </Badge>
            ) : null}
          </View>
          <Text className="text-[11.5px] text-muted-dark">
            {formatRelativeTime(report.createdAt)}
          </Text>
        </View>

        <Text className="text-[14.5px] font-semibold text-ink">{targetLabel(report)}</Text>
        <Text className="text-[12.5px] text-muted-dark">
          Reported by {report.reporter?.name ?? 'Unknown'}
        </Text>
        {isClosed && report.closedAt ? (
          <Text className="text-[12.5px] text-muted-dark">
            Closed {formatRelativeTime(report.closedAt)}
          </Text>
        ) : null}

        <ReportNote note={report.note} />
      </View>
      <Text className="text-[17px] font-semibold text-muted-dark">›</Text>
    </Card>
  );
}

// Sign-out decision (GL-306/GL-385): the admin stack gets its own minimal
// sign-out here rather than reusing AccountSettingsScreen, which isn't
// admin-safe - it renders Edit profile/Work experience/Education rows that
// all 403 for an admin and round-trips to GET /auth/me, itself a profile
// endpoint. A header action is the only control an admin needs this sprint.
export default function ReportsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { logout } = useAuth();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [loadMoreError, setLoadMoreError] = useState(null);
  // Guards every fetch (initial, refresh, load more) against overlapping
  // requests, the same single in-flight guard BrowseGigsScreen uses -
  // onEndReached can fire more than once before state updates land.
  const isFetchingRef = useRef(false);
  // Bumped whenever the tab changes (and on unmount), so a response still in
  // flight for the tab being left is dropped instead of landing in the new
  // tab's list or clearing its guard and loading flags.
  const generationRef = useRef(0);

  const hasMore = reports.length < total;

  const load = useCallback(
    (targetPage, mode) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const generation = generationRef.current;

      if (mode === 'refresh') {
        setRefreshing(true);
        setError(null);
      } else if (mode === 'more') {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setLoading(true);
        setError(null);
        setLoadMoreError(null);
      }

      reportApi
        .getOpenReports(targetPage, status)
        .then((data) => {
          if (generation !== generationRef.current) return;
          setReports((prev) => (mode === 'more' ? [...prev, ...data.reports] : data.reports));
          setTotal(data.total);
          setPage(data.page);
        })
        .catch(() => {
          if (generation !== generationRef.current) return;
          if (mode === 'more') {
            setLoadMoreError(LOAD_ERROR_MESSAGE);
          } else {
            setError(LOAD_ERROR_MESSAGE);
          }
        })
        .finally(() => {
          if (generation !== generationRef.current) return;
          isFetchingRef.current = false;
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        });
    },
    [status],
  );

  // `load` synchronously calls setLoading/setError before its first await,
  // so calling it straight from this effect trips
  // react-hooks/set-state-in-effect. Deferring through a zero-delay timeout
  // keeps the effect itself from synchronously updating state, and the
  // cleanup skips the request entirely if the screen unmounts first.
  // `load` changes with `status`, so switching tabs re-runs this and starts
  // the new tab from page one; the cleanup also invalidates whatever the old
  // tab still has in flight and releases the guard for the new tab.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      load(1, 'initial');
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      generationRef.current += 1;
      isFetchingRef.current = false;
    };
  }, [load]);

  // ReportDetail pops back here with `closedReportId` once a report has been
  // resolved or dismissed (or found already closed), so the open list is
  // stale: reload it from page one rather than dropping the row locally,
  // which would shift the server's page offsets under the next load-more.
  // Anything still in flight is invalidated first so the reload can't be
  // swallowed by the in-flight guard. The ref makes each id fire once.
  const closedReportId = route.params?.closedReportId;
  const handledClosedReportIdRef = useRef(null);
  useEffect(() => {
    if (!closedReportId || closedReportId === handledClosedReportIdRef.current) return undefined;
    handledClosedReportIdRef.current = closedReportId;

    const timeoutId = setTimeout(() => {
      generationRef.current += 1;
      isFetchingRef.current = false;
      load(1, 'refresh');
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [closedReportId, load]);

  const handleOpenReport = useCallback(
    (report) => navigation.navigate('ReportDetail', { report }),
    [navigation],
  );

  // Clears the tab being left before the new one loads, so its rows never
  // show under the new tab and a stray onEndReached can't page the new
  // status from the old tab's `page`/`total` before page one lands.
  const handleStatusChange = useCallback(
    (nextStatus) => {
      if (nextStatus === status) return;
      setReports([]);
      setTotal(0);
      setPage(1);
      setLoading(true);
      setStatus(nextStatus);
    },
    [status],
  );

  const handleRetry = useCallback(() => load(1, 'initial'), [load]);
  const handleRefresh = useCallback(() => load(1, 'refresh'), [load]);
  const handleEndReached = useCallback(() => {
    if (!hasMore) return;
    load(page + 1, 'more');
  }, [hasMore, load, page]);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader
        title="Reports"
        rightSlot={
          <Pressable onPress={() => setLogoutConfirmVisible(true)}>
            <Text className="text-[14px] font-bold text-signal">Log out</Text>
          </Pressable>
        }
      />

      <SegmentedControl
        options={STATUS_OPTIONS}
        value={status}
        onChange={handleStatusChange}
        className="mb-4"
      />

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => (
            <ReportRow report={item} onPress={() => handleOpenReport(item)} />
          )}
          ListEmptyComponent={<EmptyState message={EMPTY_MESSAGE_BY_STATUS[status]} />}
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
          contentContainerClassName="flex-grow gap-3 pb-6"
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      <ConfirmDialog
        visible={logoutConfirmVisible}
        destructive
        title="Log out?"
        body="You'll need to sign in again to access your account."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        onConfirm={logout}
        onCancel={() => setLogoutConfirmVisible(false)}
      />
    </Screen>
  );
}
