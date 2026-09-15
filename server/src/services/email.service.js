import { Resend } from 'resend';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// The only module that may import the provider SDK — everything else calls
// sendEmail() so the provider stays swappable in this one file.
//
// Constructed lazily, on first real send, rather than at module scope: the
// SDK itself throws when it can find no API key at all, and this module must
// stay importable with none of the EMAIL_* vars set (the no-op default).
let resend;
const getResendClient = () => {
  if (!resend) {
    resend = new Resend(env.resendApiKey);
  }
  return resend;
};

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

const sendViaResend = async ({ to, subject, html, text }) => {
  let result;
  try {
    result = await getResendClient().emails.send({ from: env.emailFrom, to, subject, html, text });
  } catch (error) {
    console.error('Email provider request failed:', error.message);
    throw emailError();
  }

  if (result.error) {
    console.error('Email provider rejected the send:', result.error.message);
    throw emailError();
  }
};

export const sendEmail = async ({ to, subject, html, text }) => {
  if (env.emailTransport === 'resend') {
    await sendViaResend({ to, subject, html, text });
    return;
  }

  sendViaNoop({ to, subject, html, text });
};
