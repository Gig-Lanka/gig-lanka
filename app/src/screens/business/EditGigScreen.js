import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import gigApi from '../../api/gigApi';
import GigForm, { createEmptyGigFormValues } from '../../components/gig/GigForm';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import Loader from '../../components/ui/Loader';
import Notice from '../../components/ui/Notice';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { validateGigForm } from '../../utils/validation';

const GENERIC_LOAD_ERROR = 'Could not load this gig. Check your connection and try again.';
const GENERIC_SAVE_ERROR = 'Could not save these changes. Check your connection and try again.';
const GENERIC_CLOSE_ERROR = 'Could not close this gig. Try again.';
const GENERIC_DELETE_ERROR = 'Could not delete this gig. Try again.';
const SKILL_TRIAL_LOCKED_REASON =
  "This gig already has applicants, so its skill trial terms can't change underneath people who already applied under them.";
const SKILL_TRIAL_LOCKED_SAVE_ERROR =
  "This gig's skill trial terms can't change now that someone has applied - the rest of your changes were not saved. Go back and try again.";

// Same shape PostGigScreen sends to POST - PUT uses the same validation
// (§10.7 reuses §10.3), and since PUT replaces the gig in full, every field
// the form holds is sent, never only the ones that changed. status is never
// included: closing is PATCH /gigs/:id/close, not this form.
//
// skillTrial is the one exception to "always send everything" (GL-342,
// GL-343): when locked, the key is omitted entirely so the server's "omitted
// means unchanged" rule leaves the existing trial alone. When unlocked, the
// key is always sent - even for 'none' - since on update (unlike create)
// omitting it would NOT clear a trial the user just removed in the form.
function buildGigPayload(values, skillTrialLocked) {
  const payload = {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category,
    payAmount: Number(values.payAmount),
    payType: values.payType,
    remote: Boolean(values.remote),
    schedule: values.schedule,
    commitment: values.commitment,
    positions: Number(values.positions),
  };

  if ((values.city || '').trim()) payload.city = values.city.trim();
  if ((values.area || '').trim()) payload.area = values.area.trim();
  if (values.startDate) payload.startDate = values.startDate;
  if (values.applicationsCloseDate) payload.applicationsCloseDate = values.applicationsCloseDate;

  if (!skillTrialLocked) {
    payload.skillTrial =
      values.skillTrialRequirement === 'optional'
        ? {
            requirement: 'optional',
            taskTitle: values.skillTrialTaskTitle.trim(),
            taskBrief: values.skillTrialTaskBrief.trim(),
            submissionType: values.skillTrialSubmissionType,
            effortEstimate: values.skillTrialEffortEstimate,
          }
        : { requirement: 'none' };
  }

  return payload;
}

function gigToFormValues(gig) {
  return {
    title: gig.title ?? '',
    description: gig.description ?? '',
    category: gig.category,
    payAmount: gig.payAmount != null ? String(gig.payAmount) : '',
    payType: gig.payType,
    city: gig.city ?? '',
    area: gig.area ?? '',
    remote: Boolean(gig.remote),
    schedule: gig.schedule ?? [],
    commitment: gig.commitment,
    positions: gig.positions != null ? String(gig.positions) : '1',
    startDate: gig.startDate ?? null,
    applicationsCloseDate: gig.applicationsCloseDate ?? null,
    skillTrialRequirement: gig.skillTrial?.requirement ?? 'none',
    skillTrialTaskTitle: gig.skillTrial?.taskTitle ?? '',
    skillTrialTaskBrief: gig.skillTrial?.taskBrief ?? '',
    skillTrialSubmissionType: gig.skillTrial?.submissionType,
    skillTrialEffortEstimate: gig.skillTrial?.effortEstimate,
    // Never persisted (GL-343) and never known from a past save - always
    // starts unticked, so keeping an existing trial still requires a fresh
    // confirmation on this save.
    skillTrialConfirmed: false,
  };
}

export default function EditGigScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { gigId } = params;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [status, setStatus] = useState(null);
  const [applicantCount, setApplicantCount] = useState(0);
  const [values, setValues] = useState(createEmptyGigFormValues());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const hasLoadedRef = useRef(false);

  const busy = submitting || closing || deleting;

  const fetchGig = useCallback(async () => {
    try {
      const { gig } = await gigApi.getGig(gigId);
      setValues(gigToFormValues(gig));
      setApplicantCount(gig.applicantCount ?? 0);
      setStatus(gig.status);
    } catch (error) {
      const apiError = error.response?.data?.error;
      setLoadError(
        apiError?.code === 'NOT_FOUND' ? 'This gig no longer exists.' : GENERIC_LOAD_ERROR,
      );
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, [gigId]);

  // Fetches once - on first focus only, via hasLoadedRef - so re-focusing
  // this screen (e.g. after a picker) never overwrites values the user has
  // already started editing.
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) fetchGig();
    }, [fetchGig]),
  );

  const handleChange = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  // GL-342's guard is keyed on whether an application has ever existed, not
  // this count (it falls when applicants withdraw or are rejected) - the
  // client has no cheaper way to know that, so this is a best-effort lock,
  // backstopped below by the GIG_HAS_APPLICANTS branch for the rare case
  // where every applicant has withdrawn and the server still refuses.
  const skillTrialLocked = applicantCount > 0;

  async function handleSubmit() {
    if (busy) return;

    const validationErrors = validateGigForm({ ...values, skillTrialLocked });
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      await gigApi.updateGig(gigId, buildGigPayload(values, skillTrialLocked));
      navigation.goBack();
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'VALIDATION_ERROR' && apiError.errors) {
        const fieldErrors = {};
        apiError.errors.forEach(({ field, message }) => {
          fieldErrors[field] = message;
        });
        setErrors(fieldErrors);
      } else if (apiError?.code === 'FORBIDDEN') {
        setFormError("You don't have permission to edit this gig.");
      } else if (apiError?.code === 'NOT_FOUND') {
        // The gig was deleted elsewhere between load and save - nothing left
        // to edit, so drop into the same "no longer exists" state the
        // initial fetch uses, rather than leaving a Notice on a dead form.
        setLoadError('This gig no longer exists.');
      } else if (apiError?.code === 'GIG_HAS_APPLICANTS') {
        // Only reachable when applicantCount had already fallen to zero (so
        // the section looked unlocked) while an application still exists on
        // record - see the comment on skillTrialLocked above.
        setFormError(SKILL_TRIAL_LOCKED_SAVE_ERROR);
      } else {
        setFormError(apiError?.message || GENERIC_SAVE_ERROR);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmClose() {
    if (busy) return;
    setClosing(true);
    setCloseError('');
    try {
      const { gig } = await gigApi.closeGig(gigId);
      setStatus(gig.status);
      setCloseConfirmVisible(false);
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'FORBIDDEN') {
        setCloseError("You don't have permission to close this gig.");
      } else if (apiError?.code === 'NOT_FOUND') {
        setCloseConfirmVisible(false);
        setLoadError('This gig no longer exists.');
      } else {
        setCloseError(apiError?.message || GENERIC_CLOSE_ERROR);
      }
    } finally {
      setClosing(false);
    }
  }

  async function handleConfirmDelete() {
    if (busy) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await gigApi.deleteGig(gigId);
      navigation.goBack();
    } catch (error) {
      const apiError = error.response?.data?.error;
      if (apiError?.code === 'FORBIDDEN') {
        setDeleteError("You don't have permission to delete this gig.");
        setDeleting(false);
      } else if (apiError?.code === 'NOT_FOUND') {
        // Already gone - the outcome the user wanted is already true.
        navigation.goBack();
      } else {
        setDeleteError(apiError?.message || GENERIC_DELETE_ERROR);
        setDeleting(false);
      }
    }
  }

  if (loading) {
    return <Loader fullScreen />;
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
        <ScreenHeader title="Edit gig" small onBack={() => navigation.goBack()} />
        <EmptyState
          message={loadError}
          actionLabel="Go back"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  const applicantsBanner =
    applicantCount > 0 ? (
      <Notice>
        {applicantCount} {applicantCount === 1 ? 'person has' : 'people have'} already applied -
        changes to the hours or pay affect them.
      </Notice>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <ScreenHeader title="Edit gig" small onBack={() => navigation.goBack()} />

      <View className="flex-1 px-[22px]">
        <GigForm
          values={values}
          onChange={handleChange}
          errors={errors}
          formError={formError}
          banner={applicantsBanner}
          disabled={busy}
          skillTrialLocked={skillTrialLocked}
          skillTrialLockedReason={SKILL_TRIAL_LOCKED_REASON}
          footer={
            <View className="gap-3">
              <Button
                loading={submitting}
                disabled={busy && !submitting}
                trailingArrow
                onPress={handleSubmit}
              >
                Save changes
              </Button>

              <View className="flex-row gap-[10px]">
                {status === 'open' ? (
                  <Button
                    variant="small"
                    fullWidth={false}
                    className="h-11 flex-1"
                    loading={closing}
                    disabled={busy && !closing}
                    onPress={() => setCloseConfirmVisible(true)}
                  >
                    Close gig
                  </Button>
                ) : null}

                <Button
                  variant="small-danger"
                  fullWidth={false}
                  className="h-11 flex-1"
                  loading={deleting}
                  disabled={busy && !deleting}
                  onPress={() => setDeleteConfirmVisible(true)}
                >
                  Delete gig
                </Button>
              </View>

              {closeError ? (
                <Text className="text-[12.5px] text-danger-ink">{closeError}</Text>
              ) : null}
              {deleteError ? (
                <Text className="text-[12.5px] text-danger-ink">{deleteError}</Text>
              ) : null}
            </View>
          }
        />
      </View>

      <ConfirmDialog
        visible={closeConfirmVisible}
        title="Close this gig?"
        body="This stops the gig from accepting new applications. People who already applied are unaffected and can still be processed."
        confirmLabel={closing ? 'Closing…' : 'Close gig'}
        cancelLabel="Keep it open"
        onConfirm={handleConfirmClose}
        onCancel={() => setCloseConfirmVisible(false)}
      />

      <ConfirmDialog
        visible={deleteConfirmVisible}
        destructive
        title="Delete this gig?"
        body="This is permanent and cannot be undone - the gig and its listing are removed immediately."
        confirmLabel={deleting ? 'Deleting…' : 'Delete gig'}
        cancelLabel="Keep it"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
    </SafeAreaView>
  );
}
