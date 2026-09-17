import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import reportApi from '../../api/reportApi';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import useAuth from '../../hooks/useAuth';
import { REPORT_REASONS } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const LOAD_ERROR_MESSAGE = 'Could not load reports. Check your connection and try again.';
// A character-count proxy for "would this wrap past a few lines", rather
// than measuring rendered layout - simple, deterministic, and well under
// the 300-character cap the server enforces on a report's note.
const NOTE_PREVIEW_LENGTH = 140;

function reasonLabel(code) {
  return REPORT_REASONS.find((entry) => entry.value === code)?.label ?? code;
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

// Full note or a clear truncation with a way to read the rest (GL-306
// criterion 7) - expanding it is a read affordance, not an action on the
// report, so it doesn't trip criterion 9's "not one action anywhere".
function ReportNote({ note }) {
  const [expanded, setExpanded] = useState(false);

  if (!note) return null;

  const needsTruncation = note.length > NOTE_PREVIEW_LENGTH;
  const shown =
    expanded || !needsTruncation ? note : `${note.slice(0, NOTE_PREVIEW_LENGTH).trimEnd()}…`;

  return (
    <View className="mt-2">
      <Text className="text-[13.5px] leading-[1.5] text-muted">{shown}</Text>
      {needsTruncation ? (
        <Pressable onPress={() => setExpanded((value) => !value)} className="mt-1 self-start">
          <Text className="text-[12.5px] font-semibold text-signal">
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReportRow({ report }) {
  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <Badge>{reasonLabel(report.reasonCode)}</Badge>
        <Text className="text-[11.5px] text-muted-dark">
          {formatRelativeTime(report.createdAt)}
        </Text>
      </View>

      <Text className="text-[14.5px] font-semibold text-ink">{targetLabel(report)}</Text>
      <Text className="text-[12.5px] text-muted-dark">
        Reported by {report.reporter?.name ?? 'Unknown'}
      </Text>

      <ReportNote note={report.note} />
    </Card>
  );
}

// Sign-out decision (GL-306/GL-385): the admin stack gets its own minimal
// sign-out here rather than reusing AccountSettingsScreen, which isn't
// admin-safe - it renders Edit profile/Work experience/Education rows that
// all 403 for an admin and round-trips to GET /auth/me, itself a profile
// endpoint. A header action is the only control an admin needs this sprint.
export default function ReportsScreen() {
  const { logout } = useAuth();
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

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

  const hasMore = reports.length < total;

  const load = useCallback((targetPage, mode) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (mode === 'refresh') {
      setRefreshing(true);
      setError(null);
    } else if (mode === 'more') {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    reportApi
      .getOpenReports(targetPage)
      .then((data) => {
        setReports((prev) => (mode === 'more' ? [...prev, ...data.reports] : data.reports));
        setTotal(data.total);
        setPage(data.page);
      })
      .catch(() => {
        if (mode === 'more') {
          setLoadMoreError(LOAD_ERROR_MESSAGE);
        } else {
          setError(LOAD_ERROR_MESSAGE);
        }
      })
      .finally(() => {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      });
  }, []);

  useEffect(() => {
    load(1, 'initial');
  }, [load]);

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

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => <ReportRow report={item} />}
          ListEmptyComponent={
            <EmptyState message="No open reports right now — you're all caught up." />
          }
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
