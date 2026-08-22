import { View } from 'react-native';

import Button from '../ui/Button';

// GL-221 §1: each status shows exactly its own actions, and a status absent
// from this map (completed, rejected, withdrawn, closed_filled) shows none.
// `applied` only appears here because the view-on-open PATCH (GL-220) can
// fail and leave a business looking at an `applied` application.
const ACTIONS_BY_STATUS = {
  applied: ['reject'],
  viewed: ['shortlist', 'reject'],
  shortlisted: ['hire', 'reject'],
  hired: ['complete'],
};

const ACTION_LABEL = {
  shortlist: 'Shortlist',
  reject: 'Reject',
  hire: 'Hire',
  complete: 'Mark complete',
};

// Reject is the only negative action in this row - everything else moves
// the application forward - so it's the only one styled as outline.
const ACTION_VARIANT = {
  shortlist: 'primary',
  reject: 'outline',
  hire: 'primary',
  complete: 'primary',
};

export function applicantActionsForStatus(status) {
  return ACTIONS_BY_STATUS[status] ?? [];
}

/**
 * The pinned bar from GL-221's `#applicant-detail` frame. Shortlist is
 * wired here (GL-260, no sheet of its own); Reject and Hire open sheets
 * built by GL-261 and GL-262, and Mark complete is GL-262's too - until
 * those land, `onReject`, `onHire` and `onComplete` are left undefined by
 * the screen and those buttons render present but inert, same as
 * `ApplicantRow.js`'s list-row Reject action under GL-220.
 */
export default function ApplicantActionRow({
  status,
  pendingAction,
  onShortlist,
  onReject,
  onHire,
  onComplete,
  className,
}) {
  const actions = applicantActionsForStatus(status);
  if (actions.length === 0) return null;

  const handlerFor = {
    shortlist: onShortlist,
    reject: onReject,
    hire: onHire,
    complete: onComplete,
  };

  return (
    <View className={['flex-row gap-[10px]', className].filter(Boolean).join(' ')}>
      {actions.map((action) => (
        <Button
          key={action}
          variant={ACTION_VARIANT[action]}
          fullWidth={false}
          className="flex-1"
          loading={pendingAction === action}
          disabled={Boolean(pendingAction) && pendingAction !== action}
          onPress={handlerFor[action]}
        >
          {ACTION_LABEL[action]}
        </Button>
      ))}
    </View>
  );
}
