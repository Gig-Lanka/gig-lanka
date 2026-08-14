const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email) {
  return EMAIL_RE.test((email || '').trim());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

export function validateSignUpForm({ email, password, confirmPassword }) {
  const errors = {};

  if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!isValidPassword(password)) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

function parseDateOnly(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// GL-107's four non-negotiable gig rules, mirrored client-side so the form
// rejects them before a request is ever sent — not just relies on the
// picker/keyboard to make them hard to violate. See GigForm.js.
export function validateGigForm({
  payAmount,
  schedule,
  remote,
  city,
  applicationsCloseDate,
  positions,
}) {
  const errors = {};

  const numericPayAmount = Number(payAmount);
  if (!(numericPayAmount > 0)) {
    errors.payAmount = 'Enter a pay amount greater than zero.';
  }

  if (!Array.isArray(schedule) || schedule.length === 0) {
    errors.schedule = 'Select at least one schedule slot.';
  }

  if (!remote && !(city || '').trim()) {
    errors.city = 'City is required unless this gig is remote.';
  }

  if (applicationsCloseDate && parseDateOnly(applicationsCloseDate) < startOfToday()) {
    errors.applicationsCloseDate = 'Applications close date cannot be in the past.';
  }

  const numericPositions = Number(positions);
  if (!Number.isInteger(numericPositions) || numericPositions < 1) {
    errors.positions = 'Positions must be a whole number of at least 1.';
  }

  return errors;
}
