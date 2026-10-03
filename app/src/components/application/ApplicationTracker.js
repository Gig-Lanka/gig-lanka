import { Text, View } from 'react-native';

import { APPLICATION_STATUSES } from '../../constants/enums';
import { formatRelativeTime } from '../../utils/format';
import { isLiveApplication } from './ApplicationStatusFilter';

const PATH_ORDER = ['applied', 'viewed', 'shortlisted'];

function statusLabel(value) {
  return APPLICATION_STATUSES.find((entry) => entry.value === value)?.label ?? value;
}

// §11.1 only ever records `appliedAt`, `viewedAt`, `decidedAt` and
// `completedAt` - there is no `shortlistedAt`. A live application's own
// `status` says exactly which path step it's on. A decided one only proves
// `applied` (always) and `viewed` (iff `viewedAt` is set); whether it passed
// through `shortlisted` on its way to hired/completed/rejected/withdrawn is
// undecidable from the data alone except for `hired` and `completed`, which
// have no other route in (§11.3: completed's only source is hired, and
// hired's only source is shortlisted). An undetermined step renders as not
// reached rather than assuming it happened.
function buildSteps(application) {
  const { status, viewedAt } = application;
  const isTerminal = !isLiveApplication(application);
  const currentIndex = PATH_ORDER.indexOf(status);

  const pathSteps = PATH_ORDER.map((value, index) => {
    let state;
    if (!isTerminal) {
      state = index < currentIndex ? 'done' : index === currentIndex ? 'now' : 'todo';
    } else if (value === 'applied') {
      state = 'done';
    } else if (value === 'viewed') {
      state = viewedAt ? 'done' : 'todo';
    } else {
      // Hired and completed can only have arrived through shortlisted -
      // completed's own outgoing move starts at hired (§11.3) - so showing
      // this step unreached on either would be a lie the data disproves.
      state = status === 'hired' || status === 'completed' ? 'done' : 'todo';
    }
    return { key: value, label: statusLabel(value), state };
  });

  // Withdrawn and Closed – position filled don't sit on the linear path -
  // they still occupy this final slot so every status renders somewhere,
  // but as a named outcome rather than a forced "Decision" step.
  const decisionStep = isTerminal
    ? { key: 'decision', label: statusLabel(status), state: 'end' }
    : { key: 'decision', label: 'Decision', state: 'todo' };

  return [...pathSteps, decisionStep];
}

function buildSummary(application) {
  const { status, viewedAt, decidedAt, completedAt } = application;

  if (status === 'applied') return 'Not opened yet.';
  if (status === 'viewed') return `Viewed ${formatRelativeTime(viewedAt)}.`;
  if (status === 'shortlisted') return `Shortlisted. Viewed ${formatRelativeTime(viewedAt)}.`;
  if (status === 'hired') return `Hired ${formatRelativeTime(decidedAt)}.`;
  if (status === 'completed') return `Completed ${formatRelativeTime(completedAt)}.`;
  if (status === 'rejected') {
    return `Decided ${formatRelativeTime(decidedAt)}. This gig is finished for you.`;
  }
  if (status === 'withdrawn') {
    return `Withdrawn ${formatRelativeTime(decidedAt)}. You can't apply to this gig again.`;
  }
  return `Closed ${formatRelativeTime(decidedAt)} - the position was filled.`;
}

const DOT_GLYPH = { done: '✓', end: '●' };
const DOT_STYLES = {
  done: 'bg-signal',
  now: 'bg-paper border-[3px] border-signal',
  todo: 'bg-haze border-2 border-line',
  end: 'bg-muted',
};

function StepDot({ state }) {
  return (
    <View className={`h-5 w-5 items-center justify-center rounded-full ${DOT_STYLES[state]}`}>
      {DOT_GLYPH[state] ? (
        <Text className="text-[10px] font-bold text-paper">{DOT_GLYPH[state]}</Text>
      ) : null}
    </View>
  );
}

export default function ApplicationTracker({ application, className }) {
  const steps = buildSteps(application);

  return (
    <View className={className}>
      <View className="flex-row">
        {steps.map((step, index) => {
          const isReached = step.state !== 'todo';

          return (
            <View key={step.key} className="flex-1 items-center">
              <View className="w-full flex-row items-center">
                <View
                  className={[
                    'h-0.5 flex-1',
                    index === 0 ? 'bg-transparent' : isReached ? 'bg-signal' : 'bg-line',
                  ].join(' ')}
                />
                <StepDot state={step.state} />
                <View className="h-0.5 flex-1 bg-transparent" />
              </View>
              <Text
                className={[
                  'mt-[7px] text-center text-[10.5px]',
                  isReached ? 'font-bold text-ink' : 'font-semibold text-muted-dark',
                ].join(' ')}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="mt-[14px] rounded-ds-md bg-haze px-[13px] py-[11px]">
        <Text className="text-[13.5px] font-medium leading-[19px] text-ink">
          {buildSummary(application)}
        </Text>
      </View>
    </View>
  );
}
