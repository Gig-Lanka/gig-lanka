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

// Mirrors docs/api-contract.md §8.4's own limits, so a rejected save never
// surprises someone who already passed client-side validation.
export const PROFILE_NAME_MAX_LENGTH = 60;
export const PROFILE_BIO_MAX_LENGTH = 500;

export function validateEditProfileForm({ name, bio }) {
  const errors = {};
  const trimmedName = (name || '').trim();

  if (!trimmedName) {
    errors.name = 'Name is required.';
  } else if (trimmedName.length > PROFILE_NAME_MAX_LENGTH) {
    errors.name = `Name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (bio && bio.length > PROFILE_BIO_MAX_LENGTH) {
    errors.bio = `Bio must be ${PROFILE_BIO_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}
