import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// A provider outage or bad key must never reach the client as an unhandled
// rejection or a bare 500 — matches the shape storage.service.js uses for
// 502 STORAGE_UNAVAILABLE. The underlying error is deliberately not attached
// or logged here: it may carry details of the message that shouldn't surface.
const emailError = () => new ApiError(502, 'EMAIL_UNAVAILABLE', 'Could not send the email. Please try again.');

// Recorded here rather than returned from sendEmail, so a test can assert an
// email would have gone out — and what was in it — without a network call.
const sentEmails = [];

export const getSentEmails = () => sentEmails;

export const clearSentEmails = () => {
  sentEmails.length = 0;
};

const sendViaNoop = ({ to, subject, html, text }) => {
  sentEmails.push({ to, subject, html, text });
};

export const sendEmail = async ({ to, subject, html, text }) => {
  if (env.emailTransport === 'resend') {
    // Real transport is wired in a follow-up commit; emailError() above is
    // the shape it throws on a provider failure.
    throw emailError();
  }

  sendViaNoop({ to, subject, html, text });
};
