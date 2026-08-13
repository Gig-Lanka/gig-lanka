import Joi from 'joi';

// Closed list on purpose (parent story AC11): a caller names a fixed purpose,
// never an arbitrary path, so it can never write anywhere else in the bucket.
// `avatars` is the only value this sprint; skill trial files and resumes join
// in Sprint 3.
export const UPLOAD_FOLDER_VALUES = ['avatars'];

export const uploadSchema = Joi.object({
  folder: Joi.string()
    .valid(...UPLOAD_FOLDER_VALUES)
    .required(),
});
