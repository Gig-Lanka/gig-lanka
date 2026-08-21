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

const GIG_SORT_ORDER_VALUES = ['newest', 'highest_pay', 'starting_soon'];

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

// Wire format for a multi-value query parameter is a comma-separated list
// (`?category=tech,creative`), documented in the contract at §10.4 so GL-216
// builds against the same shape. Each item is matched against the closed
// vocabulary so an unrecognised value 400s naming the field, rather than
// silently filtering it out into an empty result.
const commaSeparatedEnum = (values) =>
  Joi.string()
    .custom((raw, helpers) => {
      const items = raw
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (items.length === 0) {
        return helpers.error('any.empty');
      }

      const invalid = items.find((item) => !values.includes(item));
      if (invalid) {
        return helpers.error('any.only');
      }

      return items;
    })
    .messages({
      'any.empty': 'must not be empty',
      'any.only': `must only contain: ${values.join(', ')}`,
    });

export const listGigsQuerySchema = Joi.object({
  page: Joi.any().optional(),
  q: Joi.string().trim().max(200).optional(),
  category: commaSeparatedEnum(GIG_CATEGORY_VALUES).optional(),
  schedule: commaSeparatedEnum(SCHEDULE_TAG_VALUES).optional(),
  payType: commaSeparatedEnum(PAY_TYPE_VALUES).optional(),
  commitment: commaSeparatedEnum(COMMITMENT_VALUES).optional(),
  remote: Joi.boolean().optional(),
  city: Joi.string().trim().max(120).optional(),
  minPay: Joi.number().min(0).optional(),
  sort: Joi.string()
    .valid(...GIG_SORT_ORDER_VALUES)
    .default('newest'),
});
