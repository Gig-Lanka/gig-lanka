import Joi from 'joi';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidCalendarDate = (value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const dateOnly = () =>
  Joi.string()
    .pattern(DATE_ONLY_PATTERN)
    .custom((value, helpers) => {
      if (!isValidCalendarDate(value)) {
        return helpers.error('date.invalid');
      }
      return value;
    })
    .messages({
      'string.pattern.base': 'must be a date in YYYY-MM-DD format',
      'date.invalid': 'must be a valid calendar date in YYYY-MM-DD format',
    });

// Optional free text. Empty string is allowed so a client can clear a field
// it previously set, rather than having to omit it.
const optionalText = (max) => {
  const base = Joi.string().trim().allow('');
  return max ? base.max(max) : base;
};

const workExperienceEntry = Joi.object({
  roleTitle: Joi.string().trim().required(),
  employer: Joi.string().trim().required(),
  startDate: dateOnly().optional(),
  endDate: dateOnly().optional(),
  ongoing: Joi.boolean().optional(),
  description: optionalText(1000).optional(),
});

const educationEntry = Joi.object({
  institution: Joi.string().trim().required(),
  qualification: Joi.string().trim().required(),
  startDate: dateOnly().optional(),
  endDate: dateOnly().optional(),
});

// Declared and forbidden rather than left out of the schema: validate() strips
// unknown keys silently, and criterion 9 requires these to be named in a 400
// instead of being quietly dropped. ratingSummary and skillTrialResults belong
// to other components; role and email live on User and are not editable here.
const systemOwned = Joi.any().forbidden();

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().max(60).required(),
  photo: optionalText().optional(),
  bio: optionalText(500).optional(),
  city: optionalText().optional(),

  // Seeker-only and business-only fields are shape-checked here; whether the
  // caller's role may set them at all is decided in the service, which has the
  // user loaded from the database rather than the role claimed by the token.
  skills: Joi.array().items(Joi.string().trim()).optional(),
  workExperience: Joi.array().items(workExperienceEntry).optional(),
  education: Joi.array().items(educationEntry).optional(),
  category: optionalText().optional(),

  ratingSummary: systemOwned,
  skillTrialResults: systemOwned,
  role: systemOwned,
  email: systemOwned,
});
