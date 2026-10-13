// One transport for every mail the server sends: SMTP through nodemailer,
// which Mailpit speaks in dev and any mail service speaks in production.
// The tests pass their own, to read what would have been sent.
import nodemailer from 'nodemailer';

import {withTimeout} from './timeout.js';

// A mail service that never answers would otherwise hold the sign-in.
export const MAIL_TIMEOUT_MS = 10_000;

export type Mail = {
  to: string;
  subject: string;
  // Plain text: nothing to render wrong, nothing to track.
  text: string;
};

export type SendMail = (mail: Mail) => Promise<void>;

export function smtpMail(url: string, from: string): SendMail {
  const transport = nodemailer.createTransport(url);

  return async (mail) => {
    await withTimeout(
      transport.sendMail({from, ...mail}),
      MAIL_TIMEOUT_MS,
      'mail service',
    );
  };
}
