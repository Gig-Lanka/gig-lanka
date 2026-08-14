const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function withThousandsSeparator(amount) {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatShortDate(date) {
  return `${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatPay(amount, payType) {
  const formattedAmount = withThousandsSeparator(amount);

  if (payType === 'per_hour') {
    return `Rs ${formattedAmount}/hr`;
  }
  if (payType === 'per_day') {
    return `Rs ${formattedAmount}/day`;
  }
  return `Rs ${formattedAmount}`;
}

export function formatRelativeTime(date, now = new Date()) {
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();

  if (diffMs < MINUTE_MS) {
    return 'Just now';
  }
  if (diffMs < HOUR_MS) {
    return `${Math.floor(diffMs / MINUTE_MS)}m ago`;
  }
  if (diffMs < DAY_MS) {
    return `${Math.floor(diffMs / HOUR_MS)}h ago`;
  }
  if (diffMs < WEEK_MS) {
    return `${Math.floor(diffMs / DAY_MS)}d ago`;
  }
  return formatShortDate(target);
}

export function formatDeadline(deadline, now = new Date()) {
  const target = new Date(deadline);
  const dayDiff = Math.round((startOfDay(target) - startOfDay(now)) / DAY_MS);

  if (dayDiff < 0) {
    return { label: 'Applications closed', urgent: true };
  }
  if (dayDiff === 0) {
    return { label: 'Closes today', urgent: true };
  }
  if (dayDiff === 1) {
    return { label: 'Closes tomorrow', urgent: true };
  }
  if (dayDiff <= 3) {
    return { label: `Closes in ${dayDiff} days`, urgent: true };
  }
  return { label: `Closes ${formatShortDate(target)}`, urgent: false };
}

export function formatLocation({ isRemote, area, city }) {
  if (isRemote) {
    return 'Remote';
  }
  return area ? `${area}, ${city}` : city;
}

function formatMonthYear(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return `${MONTH_ABBREVIATIONS[date.getMonth()]} ${date.getFullYear()}`;
}

// Work experience and education entries (docs/api-contract.md §8.1) share this
// shape loosely: a start date, and either an end date or an ongoing flag.
// Education has no `ongoing` field, so an entry with no end date just reads
// as its start month rather than assuming "Present" — the contract doesn't
// say an absent end date means current, only that the field is optional.
export function formatDateRange({ startDate, endDate, ongoing = false }) {
  const start = formatMonthYear(startDate);
  const end = ongoing ? 'Present' : formatMonthYear(endDate);

  if (start && end) {
    return start === end ? start : `${start} — ${end}`;
  }
  return start || end || null;
}
