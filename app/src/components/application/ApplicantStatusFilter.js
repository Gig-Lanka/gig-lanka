import SegmentedControl from '../ui/SegmentedControl';
import { APPLICATION_STATUSES } from '../../constants/enums';

// §11.2's "decided" set (hired, completed, rejected, withdrawn, closed_filled)
// is exactly the `terminal` set ApplicationStatusFilter already reads for the
// seeker side - reused here rather than redeclared.
const DECIDED_VALUES = new Set(
  APPLICATION_STATUSES.filter((status) => status.terminal).map((status) => status.value),
);

export function applicantSegment(application) {
  if (application.status === 'shortlisted') return 'shortlisted';
  if (DECIDED_VALUES.has(application.status)) return 'decided';
  return 'live';
}

// The frame's segment row (All / Trial passed / Shortlisted / Decided) minus
// its trial segment, which has no data until GL-222/Sprint 3 - GL-256's
// description swaps it for Live.
export default function ApplicantStatusFilter({ applications, value, onChange, className }) {
  const liveCount = applications.filter(
    (application) => applicantSegment(application) === 'live',
  ).length;
  const shortlistedCount = applications.filter(
    (application) => applicantSegment(application) === 'shortlisted',
  ).length;
  const decidedCount = applications.length - liveCount - shortlistedCount;

  const options = [
    { value: 'all', label: `All ${applications.length}` },
    { value: 'live', label: `Live ${liveCount}` },
    { value: 'shortlisted', label: `Shortlisted ${shortlistedCount}` },
    { value: 'decided', label: `Decided ${decidedCount}` },
  ];

  return (
    <SegmentedControl options={options} value={value} onChange={onChange} className={className} />
  );
}
