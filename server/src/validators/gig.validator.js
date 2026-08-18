import Joi from 'joi';

const GIG_CATEGORY_VALUES = [
  'tutoring',
  'delivery',
  'event_help',
  'retail',
  'hospitality',
  'admin_data_entry',
  'creative',
  'tech',
  'other',
];

const PAY_TYPE_VALUES = ['per_hour', 'per_day', 'fixed_price'];

const SCHEDULE_TAG_VALUES = ['weekday_mornings', 'weekday_evenings', 'weekends', 'flexible_hours'];

const COMMITMENT_VALUES = ['one_off', 'under_a_week', 'one_to_four_weeks', 'ongoing'];

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

const futureOrTodayDateOnly = () =>
  dateOnly()
    .custom((value, helpers) => {
      const today = new Date().toISOString().slice(0, 10);
      if (value < today) {
        return helpers.error('date.past');
      }
      return value;
    })
    .messages({
      'date.past': 'cannot be in the past',
    });

export const gigSchema = Joi.object({
  title: Joi.string().trim().max(80).required(),
  description: Joi.string().trim().min(20).max(2000).required(),
  category: Joi.string()
    .valid(...GIG_CATEGORY_VALUES)
    .required(),
  payAmount: Joi.number().greater(0).required(),
  payType: Joi.string()
    .valid(...PAY_TYPE_VALUES)
    .required(),
  remote: Joi.boolean().default(false),
  city: Joi.string().trim().when('remote', {
    is: true,
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  area: Joi.string().trim().optional(),
  schedule: Joi.array()
    .items(Joi.string().valid(...SCHEDULE_TAG_VALUES))
    .min(1)
    .required(),
  commitment: Joi.string()
    .valid(...COMMITMENT_VALUES)
    .required(),
  positions: Joi.number().integer().min(1).default(1),
  startDate: dateOnly().optional(),
  applicationsCloseDate: futureOrTodayDateOnly().optional(),
});

export const createGigSchema = gigSchema;

export const updateGigSchema = gigSchema;
