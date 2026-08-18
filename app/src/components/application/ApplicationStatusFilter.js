import SegmentedControl from '../ui/SegmentedControl';
import { APPLICATION_STATUSES } from '../../constants/enums';

const TERMINAL_VALUES = new Set(
  APPLICATION_STATUSES.filter((status) => status.terminal).map((status) => status.value),
);

export function isLiveApplication(application) {
  return !TERMINAL_VALUES.has(application.status);
}

export default function ApplicationStatusFilter({ applications, value, onChange, className }) {
  const liveCount = applications.filter(isLiveApplication).length;
  const decidedCount = applications.length - liveCount;

  const options = [
    { value: 'all', label: `All ${applications.length}` },
    { value: 'live', label: `Live ${liveCount}` },
    { value: 'decided', label: `Decided ${decidedCount}` },
  ];

  return (
    <SegmentedControl options={options} value={value} onChange={onChange} className={className} />
  );
}
