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

// Mirrors docs/api-contract.md §9.1's own upload rules, so an oversize or
// wrong-type file is caught before it costs a round trip to POST /api/uploads.
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];

export function validateImageFile({ fileSize, mimeType }) {
  if (mimeType && !ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    return 'Photo must be a PNG or JPG file.';
  }

  if (typeof fileSize === 'number' && fileSize > MAX_IMAGE_FILE_SIZE) {
    return 'Photo must be 5MB or smaller.';
  }

  return null;
}

// Mirrors docs/api-contract.md §12.1's review text rule - trimmed before the
// length check, so an all-whitespace string fails the minimum the same way
// an empty one does.
export const REVIEW_TEXT_MIN_LENGTH = 20;
export const REVIEW_TEXT_MAX_LENGTH = 1000;

export function isValidReviewText(text) {
  const trimmedLength = (text || '').trim().length;
  return trimmedLength >= REVIEW_TEXT_MIN_LENGTH && trimmedLength <= REVIEW_TEXT_MAX_LENGTH;
}

function parseDateOnly(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const TITLE_MAX_LENGTH = 80;
const DESCRIPTION_MIN_LENGTH = 20;
const DESCRIPTION_MAX_LENGTH = 2000;

// Mirrors GL-158's gig validation client-side - title/description length
// plus GL-107's four non-negotiable rules - so the form rejects them before
// a request is ever sent, not just relies on the picker/keyboard to make
// them hard to violate. See GigForm.js. Shared by PostGigScreen and (GL-120)
// EditGigScreen since both submit the same shape.
export function validateGigForm({
  title,
  description,
  payAmount,
  schedule,
  remote,
  city,
  applicationsCloseDate,
  positions,
}) {
  const errors = {};

  const trimmedTitle = (title || '').trim();
  if (!trimmedTitle) {
    errors.title = 'Enter a title.';
  } else if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    errors.title = `Title must be ${TITLE_MAX_LENGTH} characters or fewer.`;
  }

  const descriptionLength = (description || '').trim().length;
  if (descriptionLength < DESCRIPTION_MIN_LENGTH || descriptionLength > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be between ${DESCRIPTION_MIN_LENGTH} and ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

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

const ROLE_TITLE_MAX_LENGTH = 80;
const EMPLOYER_MAX_LENGTH = 80;
export const WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH = 1000;

// Mirrors docs/api-contract.md §8.4's workExperience rule: roleTitle and
// employer are required, dates are optional, and an end date earlier than
// its start date is rejected. An ongoing entry has no end date to compare.
export function validateWorkExperienceEntry({
  roleTitle,
  employer,
  startDate,
  endDate,
  ongoing,
  description,
}) {
  const errors = {};
  const trimmedRoleTitle = (roleTitle || '').trim();
  const trimmedEmployer = (employer || '').trim();

  if (!trimmedRoleTitle) {
    errors.roleTitle = 'Enter a role title.';
  } else if (trimmedRoleTitle.length > ROLE_TITLE_MAX_LENGTH) {
    errors.roleTitle = `Role title must be ${ROLE_TITLE_MAX_LENGTH} characters or fewer.`;
  }

  if (!trimmedEmployer) {
    errors.employer = 'Enter an employer.';
  } else if (trimmedEmployer.length > EMPLOYER_MAX_LENGTH) {
    errors.employer = `Employer must be ${EMPLOYER_MAX_LENGTH} characters or fewer.`;
  }

  if (description && description.length > WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${WORK_EXPERIENCE_DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }

  if (!ongoing && startDate && endDate && parseDateOnly(endDate) < parseDateOnly(startDate)) {
    errors.endDate = 'End date cannot be before the start date.';
  }

  return errors;
}

const INSTITUTION_MAX_LENGTH = 80;
const QUALIFICATION_MAX_LENGTH = 80;

// Mirrors docs/api-contract.md §8.4's education rule: institution and
// qualification are required, dates are optional (no `ongoing` flag exists
// for this entry type), and an end date earlier than its start date is
// rejected - same rule as workExperience.
export function validateEducationEntry({ institution, qualification, startDate, endDate }) {
  const errors = {};
  const trimmedInstitution = (institution || '').trim();
  const trimmedQualification = (qualification || '').trim();

  if (!trimmedInstitution) {
    errors.institution = 'Enter an institution.';
  } else if (trimmedInstitution.length > INSTITUTION_MAX_LENGTH) {
    errors.institution = `Institution must be ${INSTITUTION_MAX_LENGTH} characters or fewer.`;
  }

  if (!trimmedQualification) {
    errors.qualification = 'Enter a qualification.';
  } else if (trimmedQualification.length > QUALIFICATION_MAX_LENGTH) {
    errors.qualification = `Qualification must be ${QUALIFICATION_MAX_LENGTH} characters or fewer.`;
  }

  if (startDate && endDate && parseDateOnly(endDate) < parseDateOnly(startDate)) {
    errors.endDate = 'End date cannot be before the start date.';
  }

  return errors;
}
