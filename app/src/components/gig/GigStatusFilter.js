import SegmentedControl from '../ui/SegmentedControl';
import { GIG_STATUSES } from '../../constants/enums';

// A gig never comes back from the API as `draft` — status defaults to
// `open` on creation and can't be set by the client (§10.1) — so it isn't
// worth a tab here.
const FILTERABLE_STATUSES = GIG_STATUSES.filter((status) => status.value !== 'draft');

export default function GigStatusFilter({ value, onChange, className }) {
  return (
    <SegmentedControl
      options={FILTERABLE_STATUSES}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
