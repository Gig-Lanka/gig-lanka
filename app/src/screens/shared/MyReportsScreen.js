// GL-445 - the reporter's own reports (GL-404). There's no frame: the
// list shape follows SavedGigsScreen / CompletedGigsScreen, and each row
// reads a report's fields the way the admin ReportsScreen does.

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import reportApi from '../../api/reportApi';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Screen from '../../components/ui/Screen';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { REPORT_REASONS } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const LOAD_ERROR_MESSAGE = 'Could not load your reports.';

// The reporter only ever sees `open` or `reviewed` (docs/api-contract.md
// §13.3) - resolved and dismissed both arrive as `reviewed`, by design.
// Anything else is a server-internal status that should never have reached
// this screen, so it gets no badge rather than a label of its own.
const STATUS_BADGES = {
  open: { label: 'Open', variant: 'neutral' },
  reviewed: { label: 'Reviewed', variant: 'positive' },
};

function reasonLabel(code) {
  return REPORT_REASONS.find((entry) => entry.value === code)?.label ?? code;
}

// `target` is a public identity for a user and a gig summary for a gig, or
// `null` once the gig is gone (§13.3) - the row still renders and says so.
function targetLabel({ targetType, target }) {
  if (!target) return 'No longer available';
  return (targetType === 'gig' ? target.title : target.name) ?? 'No longer available';
}

// Reads only the fields the reporter is meant to see, by name - a
// `resolutionNote` or stored status arriving in the response is never
// rendered, because nothing here reads it. Not tappable: there's no detail
// to open and nothing to act on.
function MyReportRow({ report }) {
  const status = STATUS_BADGES[report.status];

  return (
    <Card className="gap-2">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row flex-wrap gap-2">
          <Badge>{reasonLabel(report.reasonCode)}</Badge>
          {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
        </View>
        <Text className="text-[11.5px] text-muted-dark">
          {formatRelativeTime(report.createdAt)}
        </Text>
      </View>

      <Text className="text-[14.5px] font-semibold text-ink">{targetLabel(report)}</Text>

      {report.note ? (
        <Text className="mt-2 text-[13.5px] leading-[1.5] text-muted">{report.note}</Text>
      ) : null}
    </Card>
  );
}

export default function MyReportsScreen() {
  const navigation = useNavigation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  // Already newest first from the server (§13.3), so no client-side sort.
  const fetchReports = useCallback(async () => {
    const { reports: fetched } = await reportApi.getMyReports();
    setReports(fetched);
    hasLoadedRef.current = true;
  }, []);

  // Same shape as SavedGigsScreen / CompletedGigsScreen: only the first-ever
  // load blocks the screen with a loader, later focuses refetch silently so
  // a report reviewed in the meantime shows up without flashing the screen.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const isFirstLoad = !hasLoadedRef.current;

      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      fetchReports()
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
    }, [fetchReports]),
  );

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchReports()
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }, [fetchReports]);

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <Screen>
      <ScreenHeader title="My reports" small onBack={() => navigation.goBack()} />

      <Text className="mb-3 text-[11.5px] text-muted-dark">
        Reports go to the Gig Lanka team. The person or business you reported is never told who
        reported them.
      </Text>

      {error ? (
        <EmptyState message={error} actionLabel="Retry" onAction={handleRetry} />
      ) : reports.length === 0 ? (
        <EmptyState message="You haven't reported anything." />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(report) => report.id}
          renderItem={({ item }) => <MyReportRow report={item} />}
          contentContainerClassName="flex-grow gap-3 pb-6"
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
