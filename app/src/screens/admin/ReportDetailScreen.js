import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import adminApi from '../../api/adminApi';
import reportApi from '../../api/reportApi';
import ReportDecisionSheet from '../../components/report/ReportDecisionSheet';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
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

const ACCOUNT_DIALOG = {
  suspend: {
    title: (targetType) =>
      targetType === 'gig' ? 'Suspend this business?' : 'Suspend this account?',
    body: "They'll be signed out everywhere and can't sign in. Their gigs are hidden. Nothing is deleted, and you can reinstate them.",
    label: 'Suspend',
    busyLabel: 'Suspending…',
    cancelLabel: 'Keep it active',
  },
  reinstate: {
    title: () => 'Reinstate this account?',
    body: 'They can sign in again, and their gigs are shown again.',
    label: 'Reinstate',
    busyLabel: 'Reinstating…',
    cancelLabel: 'Keep it suspended',
  },
};

// §14.2-14.3's refusals. The 409s tell us the account's real state, so they
// set it rather than just reporting it; the 403 and 404 mean there's nothing
// to act on, so the action goes. Anything else keeps the screen as it was.
const ACCOUNT_REFUSALS = {
  ACCOUNT_ALREADY_SUSPENDED: {
    suspended: true,
    message: 'This account was already suspended.',
  },
  ACCOUNT_NOT_SUSPENDED: {
    suspended: false,
    message: 'This account is no longer suspended.',
  },
  FORBIDDEN: {
    unavailable: true,
    variant: 'error',
    message: "Admins can't be suspended.",
  },
  NOT_FOUND: {
    unavailable: true,
    variant: 'error',
    message: 'This account no longer exists.',
  },
};

const ACCOUNT_ERROR_MESSAGE = {
  suspend: 'Could not suspend this account. Try again.',
  reinstate: 'Could not reinstate this account. Try again.',
};

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

// The account a report lets the admin act on: the person themselves, or the
// business that posted the gig. None for a vanished target.
function accountIdFor(targetType, target) {
  if (!target) return null;
  return targetType === 'gig' ? (target.business?.id ?? null) : target.id;
}

// Suspend (destructive, like Delete on EditGigScreen) or, once suspended,
// the "Suspended" badge and Reinstate. The in-flight state shows on the
// button as well as the dialog's label.
function AccountAction({ suspendLabel, suspended, unavailable, busy, notice, error, onPress }) {
  return (
    <View className="mt-3 gap-3">
      {!unavailable ? (
        <View className="flex-row items-center gap-3">
          {suspended ? <Badge variant="danger">Suspended</Badge> : null}
          <Button
            variant={suspended ? 'small' : 'small-danger'}
            fullWidth={false}
            loading={busy}
            onPress={onPress}
          >
            {suspended ? 'Reinstate account' : suspendLabel}
          </Button>
        </View>
      ) : null}
      {notice ? <Notice variant={notice.variant}>{notice.message}</Notice> : null}
      {error ? <Text className="text-[12.5px] text-danger-ink">{error}</Text> : null}
    </View>
  );
}

// A person gets their photo and name; a gig its title and the business that
// posted it; a vanished target (the queue returns `target: null`) just says
// so, and offers no action. The account action sits under the person, or
// under the business's name on a gig - never in the pinned Resolve /
// Dismiss row, since acting on the target and deciding the report are
// separate steps.
function ReportedTarget({ targetType, target, accountAction }) {
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
        {accountAction}
      </View>
    );
  }

  return (
    <View className="mt-2">
      <View className="flex-row items-center gap-3">
        <Avatar uri={target.photo} name={target.name} />
        <Text className="flex-1 font-display text-title text-ink">
          {target.name ?? 'Unnamed user'}
        </Text>
      </View>
      {accountAction}
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

  // The account action. Works the same on open and closed reports. The queue
  // doesn't carry a suspended flag yet, so this reads one if it's there and
  // otherwise starts as not suspended - a 409 corrects it.
  const accountId = accountIdFor(report.targetType, report.target);
  const accountSummary = report.targetType === 'gig' ? report.target?.business : report.target;
  const [suspended, setSuspended] = useState(Boolean(accountSummary?.suspended));
  const [accountUnavailable, setAccountUnavailable] = useState(false);
  const [accountDialogVisible, setAccountDialogVisible] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountNotice, setAccountNotice] = useState(null);
  const [accountError, setAccountError] = useState(null);
  // Fixed when the dialog opens, so its wording doesn't flip to the other
  // action while it fades out after a success.
  const [dialogAction, setDialogAction] = useState('suspend');
  const isActingOnAccountRef = useRef(false);

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

  function openAccountDialog() {
    if (isActingOnAccountRef.current) return;
    setDialogAction(suspended ? 'reinstate' : 'suspend');
    setAccountDialogVisible(true);
  }

  function handleCancelAccountDialog() {
    if (isActingOnAccountRef.current) return;
    setAccountDialogVisible(false);
  }

  async function handleConfirmAccountAction() {
    if (isActingOnAccountRef.current) return;
    isActingOnAccountRef.current = true;
    setAccountBusy(true);
    setAccountNotice(null);
    setAccountError(null);

    const action = dialogAction;

    try {
      if (action === 'suspend') {
        await adminApi.suspendUser(accountId);
        setSuspended(true);
      } else {
        await adminApi.reinstateUser(accountId);
        setSuspended(false);
      }
    } catch (error) {
      const refusal = ACCOUNT_REFUSALS[error.response?.data?.error?.code];
      if (refusal) {
        if (refusal.suspended !== undefined) setSuspended(refusal.suspended);
        if (refusal.unavailable) setAccountUnavailable(true);
        setAccountNotice({ variant: refusal.variant, message: refusal.message });
      } else {
        setAccountError(ACCOUNT_ERROR_MESSAGE[action]);
      }
    }

    isActingOnAccountRef.current = false;
    setAccountBusy(false);
    setAccountDialogVisible(false);
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
        <ReportedTarget
          targetType={report.targetType}
          target={report.target}
          accountAction={
            accountId ? (
              <AccountAction
                suspendLabel={report.targetType === 'gig' ? 'Suspend business' : 'Suspend account'}
                suspended={suspended}
                unavailable={accountUnavailable}
                busy={accountBusy}
                notice={accountNotice}
                error={accountError}
                onPress={openAccountDialog}
              />
            ) : null
          }
        />

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

      <ConfirmDialog
        visible={accountDialogVisible}
        destructive={dialogAction === 'suspend'}
        title={ACCOUNT_DIALOG[dialogAction].title(report.targetType)}
        body={ACCOUNT_DIALOG[dialogAction].body}
        confirmLabel={
          accountBusy ? ACCOUNT_DIALOG[dialogAction].busyLabel : ACCOUNT_DIALOG[dialogAction].label
        }
        cancelLabel={ACCOUNT_DIALOG[dialogAction].cancelLabel}
        onConfirm={handleConfirmAccountAction}
        onCancel={handleCancelAccountDialog}
      />
    </SafeAreaView>
  );
}
