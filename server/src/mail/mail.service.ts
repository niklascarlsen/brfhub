import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations, user} from '../db/schema.js';
import {WEB_ORIGIN} from '../lib/env.js';
import {requestedLocales, resolveLocale, type Locale} from '../lib/locale.js';
import type {Mail, SendMail} from '../lib/mail.js';

const APP_NAME = 'Boka';

// Better Auth sends the sign-in code from inside its own plugin, which
// cannot be handed the transport buildApp was given, so the transport is
// set here once and read by whoever sends.
let transport: SendMail = async () => {
  throw new Error('No mail transport has been set');
};

export function setMailTransport(send: SendMail): void {
  transport = send;
}

export function sendMail(mail: Mail): Promise<void> {
  return transport(mail);
}

// Where to sign in, when the server knows it. The apps are found by name.
function whereToSignIn(locale: Locale): string {
  const web = WEB_ORIGIN
    ? ` ${locale === 'sv' ? 'eller' : 'or'} ${WEB_ORIGIN}`
    : '';
  return `${APP_NAME}${web}`;
}

const SIGN_IN_CODE: Record<Locale, (code: string, minutes: number) => Mail> = {
  sv: (code, minutes) => ({
    to: '',
    subject: `${code} är din kod till ${APP_NAME}`,
    text: [
      `Din kod för att logga in i ${APP_NAME} är ${code}.`,
      `Den gäller i ${minutes} minuter.`,
      'Har du inte försökt logga in kan du bortse från det här mejlet.',
    ].join('\n\n'),
  }),
  en: (code, minutes) => ({
    to: '',
    subject: `${code} is your ${APP_NAME} code`,
    text: [
      `Your code to sign in to ${APP_NAME} is ${code}.`,
      `It is valid for ${minutes} minutes.`,
      'If you did not try to sign in, you can ignore this email.',
    ].join('\n\n'),
  }),
};

const WELCOME: Record<Locale, (organization: string, where: string) => Mail> = {
  sv: (organization, where) => ({
    to: '',
    subject: `Välkommen till ${APP_NAME}, ${organization}`,
    text: [
      `Du kan nu boka i ${organization} med den här e-postadressen.`,
      `Öppna ${where}, skriv in din e-post och ange koden du får hit. Inget lösenord behövs.`,
    ].join('\n\n'),
  }),
  en: (organization, where) => ({
    to: '',
    subject: `Welcome to ${APP_NAME}, ${organization}`,
    text: [
      `You can now book in ${organization} with this email address.`,
      `Open ${where}, enter your email and type in the code it sends you. No password needed.`,
    ].join('\n\n'),
  }),
};

// The code is written in the language the device asked for, when the
// organization writes in it, like every other answer to that device.
export async function sendSignInCode(
  email: string,
  code: string,
  expiresInSeconds: number,
  acceptLanguage: string | undefined,
): Promise<void> {
  const [row] = await db
    .select({locales: organizations.locales})
    .from(user)
    .innerJoin(organizations, eq(organizations.id, user.organizationId))
    .where(eq(user.email, email));

  if (!row) {
    throw new Error(`No account for ${email}`);
  }

  const locale = resolveLocale(requestedLocales(acceptLanguage), row.locales);
  const mail = SIGN_IN_CODE[locale](code, Math.round(expiresInSeconds / 60));

  await sendMail({...mail, to: email});
}

// A new resident is told they can sign in, in the organization's first
// language: nothing is known about their device yet.
export async function sendWelcome(
  organizationId: string,
  email: string,
): Promise<void> {
  const [organization] = await db
    .select({name: organizations.name, locales: organizations.locales})
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!organization) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  const locale = organization.locales[0] ?? 'sv';
  const mail = WELCOME[locale](organization.name, whereToSignIn(locale));

  await sendMail({...mail, to: email});
}
