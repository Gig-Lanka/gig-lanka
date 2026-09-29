import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import reportApi from '../../api/reportApi';
import ReportDecisionSheet from '../../components/report/ReportDecisionSheet';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import SectionLabel from '../../components/ui/SectionLabel';
import { REPORT_REASONS, REPORT_STATUSES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';

const ERROR_MESSAGE_BY_OUTCOME = {
  resolve: 'Could not resolve this report. Try again.',
  dismiss: 'Could not dismiss this report. Try again.',
};

const ALREADY_CLOSED_MESSAGE = 'Another admin already closed this report.';

// Same outcome tones as ReportsScreen's closed rows - duplicated rather than
// shared, the rule GL-118/GL-121 set for the two gig cards' status maps.
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

function isClosedStatus(status) {
  return status === 'resolved' || status === 'dismissed';
}

// A person gets their photo and name; a gig its title and the business that
// posted it; a vanished target (the queue returns `target: null`) just says
// so. Suspend, reinstate and take down will sit under this section once
// that story lands - nothing here acts on the target.
function ReportedTarget({ targetType, target }) {
  if (!target) {
    return <Text className="mt-2 text-desc text-muted-dark">No longer available</Text>;
  }

  if (targetType === 'gig') {
    return (
      <View className="mt-2">
        <Text className="font-display text-title text-ink">{target.title}</Text>
        {target.business?.name ? (
          <Text className="mt-1 text-desc text-muted">{target.business.name}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mt-2 flex-row items-center gap-3">
      <Avatar uri={target.photo} name={target.name} />
      <Text className="flex-1 font-display text-title text-ink">
        {target.name ?? 'Unnamed user'}
      </Text>
    </View>
  );
}

// Pushed from a row on ReportsScreen with that row's data - there's no read
// endpoint for a single report, so everything here comes from the queue
// (GL-406). An open report gets Resolve and Dismiss pinned at the bottom,
// each opening ReportDecisionSheet; a closed one has neither, not even
// disabled - just its Decision section.
export default function ReportDetailScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();

  const [report, setReport] = useState(params.report);
  const [alreadyClosed, setAlreadyClosed] = useState(false);
  const [sheetOutcome, setSheetOutcome] = useState('resolve');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetInstance, setSheetInstance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState(null);
  const [sheetFieldErrors, setSheetFieldErrors] = useState({});
  // State updates land a render late, so a fast double tap on Confirm could
  // get past `submitting` - this ref is the actual double-submit guard.
  const isSubmittingRef = useRef(false);

  const isClosed = isClosedStatus(report.status) || alreadyClosed;

  // Once this report has been closed - here or, per the 409, by someone
  // else - the queue's Open tab is stale, so going back hands it the id and
  // ReportsScreen reloads from page one.
  function handleBack() {
    if (isClosed && !isClosedStatus(params.report.status)) {
      navigation.popTo('Reports', { closedReportId: report.id });
    } else {
      navigation.goBack();
    }
  }

  function openSheet(outcome) {
    if (isSubmittingRef.current) return;
    setSheetOutcome(outcome);
    setSheetError(null);
    setSheetFieldErrors({});
    setSheetInstance((value) => value + 1);
    setSheetVisible(true);
  }

  function handleCancelSheet() {
    if (isSubmittingRef.current) return;
    setSheetVisible(false);
  }

  // The 409 carries no report, and there's no single-report read, so the
  // closed state is found on the first page of the closed queue - most
  // recently closed first, and this one was only just closed. If it isn't
  // there (or that read fails), the actions still go and the Notice still
  // says why; only the Decision section is missing.
  async function refreshAfterConflict() {
    setAlreadyClosed(true);
    try {
      const data = await reportApi.getOpenReports(1, 'closed');
      const closed = data.reports.find((entry) => entry.id === report.id);
      if (closed) setReport(closed);
    } catch {
      // The Notice already covers it - nothing more to say here.
    }
  }

  async function handleConfirm(note) {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setSheetError(null);
    setSheetFieldErrors({});

    const action = sheetOutcome === 'dismiss' ? reportApi.dismissReport : reportApi.resolveReport;

    try {
      await action(report.id, note);
      isSubmittingRef.current = false;
      setSubmitting(false);
      setSheetVisible(false);
      navigation.popTo('Reports', { closedReportId: report.id });
      return;
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'REPORT_ALREADY_CLOSED') {
        setSheetVisible(false);
        await refreshAfterConflict();
      } else if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach((entry) => {
          fieldErrors[entry.field] = entry.message;
        });
        setSheetFieldErrors(fieldErrors);
      } else {
        setSheetError(apiError?.message || ERROR_MESSAGE_BY_OUTCOME[sheetOutcome]);
      }
    }

    isSubmittingRef.current = false;
    setSubmitting(false);
  }

  const hasDecision = isClosedStatus(report.status);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={isClosed ? ['top', 'bottom'] : ['top']}>
      <ScreenHeader title="Report" small onBack={handleBack} />

      <ScrollView contentContainerClassName="px-[22px] pb-8 pt-2">
        {alreadyClosed ? <Notice className="mb-5">{ALREADY_CLOSED_MESSAGE}</Notice> : null}

        <View className="flex-row items-center justify-between gap-3">
          <Badge>{reasonLabel(report.reasonCode)}</Badge>
          <Text className="text-[11.5px] text-muted-dark">
            Filed {formatRelativeTime(report.createdAt)}
          </Text>
        </View>

        <SectionLabel className="mt-6">Reported</SectionLabel>
        <ReportedTarget targetType={report.targetType} target={report.target} />

        <SectionLabel className="mt-6">Reported by</SectionLabel>
        <Text className="mt-2 text-body font-medium text-ink">
          {report.reporter?.name ?? 'Unknown'}
        </Text>

        <SectionLabel className="mt-6">Note</SectionLabel>
        {report.note ? (
          <Text className="mt-2 text-desc leading-[21px] text-ink">{report.note}</Text>
        ) : (
          <Text className="mt-2 text-desc text-muted-dark">No note</Text>
        )}

        {hasDecision ? (
          <>
            <SectionLabel className="mt-6">Decision</SectionLabel>
            <View className="mt-2 flex-row items-center justify-between gap-3">
              <Badge variant={OUTCOME_BADGE_VARIANT[report.status]}>
                {outcomeLabel(report.status)}
              </Badge>
              {report.closedAt ? (
                <Text className="text-[11.5px] text-muted-dark">
                  Closed {formatRelativeTime(report.closedAt)}
                </Text>
              ) : null}
            </View>
            {report.resolutionNote ? (
              <Text className="mt-2 text-desc leading-[21px] text-ink">
                {report.resolutionNote}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {!isClosed ? (
        <SafeAreaView edges={['bottom']} className="border-t border-line bg-paper">
          <View className="flex-row gap-[10px] px-[22px] pb-3 pt-3">
            <Button fullWidth={false} className="flex-1" onPress={() => openSheet('resolve')}>
              Resolve
            </Button>
            <Button
              variant="outline"
              fullWidth={false}
              className="flex-1"
              onPress={() => openSheet('dismiss')}
            >
              Dismiss
            </Button>
          </View>
        </SafeAreaView>
      ) : null}

      <ReportDecisionSheet
        key={sheetInstance}
        visible={sheetVisible}
        outcome={sheetOutcome}
        submitting={submitting}
        error={sheetError}
        errors={sheetFieldErrors}
        onConfirm={handleConfirm}
        onCancel={handleCancelSheet}
      />
    </SafeAreaView>
  );
}
