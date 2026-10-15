import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations, user} from '../db/schema.js';
import {WEB_ORIGIN} from '../lib/env.js';
import {
  localize,
  requestedLocales,
  resolveLocale,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
import type {Mail, SendMail} from '../lib/mail.js';
import {formatWhen} from '../lib/time.js';

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

const APARTMENT_LINKED: Record<
  Locale,
  (organization: string, label: string, where: string) => Mail
> = {
  sv: (organization, label, where) => ({
    to: '',
    subject: `Lägenhet ${label} i ${organization} är kopplad till ditt konto`,
    text: [
      `Du kan nu boka för lägenhet ${label} i ${organization} med samma konto som du administrerar med.`,
      `Öppna ${where} och logga in som vanligt. Bokningen finns under "Till bokningen" på sidan Föreningen, och administrationen under "Administrera föreningen" på sidan Lägenhet.`,
    ].join('\n\n'),
  }),
  en: (organization, label, where) => ({
    to: '',
    subject: `Apartment ${label} in ${organization} is linked to your account`,
    text: [
      `You can now book for apartment ${label} in ${organization} with the same account you administer with.`,
      `Open ${where} and sign in as usual. Booking is under "Back to booking" on the Association page, and administration under "Manage the association" on the Apartment page.`,
    ].join('\n\n'),
  }),
};

const PASSWORD_CODE: Record<Locale, (code: string, minutes: number) => Mail> = {
  sv: (code, minutes) => ({
    to: '',
    subject: `${code} är din kod för att sätta lösenord i ${APP_NAME}`,
    text: [
      `Din kod för att sätta ett nytt lösenord i ${APP_NAME} är ${code}.`,
      `Den gäller i ${minutes} minuter.`,
      'Har du inte bett om den kan du bortse från det här mejlet.',
    ].join('\n\n'),
  }),
  en: (code, minutes) => ({
    to: '',
    subject: `${code} is your ${APP_NAME} password code`,
    text: [
      `Your code to set a new password in ${APP_NAME} is ${code}.`,
      `It is valid for ${minutes} minutes.`,
      'If you did not ask for it, you can ignore this email.',
    ].join('\n\n'),
  }),
};

const ADMIN_INVITATION: Record<
  Locale,
  (organization: string, where: string) => Mail
> = {
  sv: (organization, where) => ({
    to: '',
    subject: `Du är admin för ${organization} i ${APP_NAME}`,
    text: [
      `Du har lagts till som admin för ${organization} med den här e-postadressen.`,
      `Öppna ${where} och skriv in din e-post. Du får en kod hit och väljer sedan ett lösenord.`,
      'Första gången du loggar in sätter du också upp en authenticator-app, som ger en kod vid varje inloggning.',
    ].join('\n\n'),
  }),
  en: (organization, where) => ({
    to: '',
    subject: `You are an admin of ${organization} in ${APP_NAME}`,
    text: [
      `You have been added as an admin of ${organization} with this email address.`,
      `Open ${where} and enter your email. A code is sent here, and then you choose a password.`,
      'The first time you sign in you also set up an authenticator app, which gives a code at every sign-in.',
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
  purpose: 'sign-in' | 'password',
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
  const words = purpose === 'sign-in' ? SIGN_IN_CODE : PASSWORD_CODE;
  const mail = words[locale](code, Math.round(expiresInSeconds / 60));

  await sendMail({...mail, to: email});
}

const BOOKINGS_CANCELLED: Record<
  Locale,
  (organization: string, times: string[], reason: string, where: string) => Mail
> = {
  sv: (organization, times, reason, where) => ({
    to: '',
    subject:
      times.length === 1
        ? `Din bokning i ${organization} har avbokats`
        : `Dina bokningar i ${organization} har avbokats`,
    text: [
      times.length === 1
        ? 'Föreningen har avbokat din bokning:'
        : 'Föreningen har avbokat dina bokningar:',
      times.join('\n'),
      ...(reason ? [`Anledning: ${reason}`] : []),
      `Öppna ${where} för att boka en annan tid.`,
    ].join('\n\n'),
  }),
  en: (organization, times, reason, where) => ({
    to: '',
    subject:
      times.length === 1
        ? `Your booking in ${organization} was cancelled`
        : `Your bookings in ${organization} were cancelled`,
    text: [
      times.length === 1
        ? 'The association cancelled your booking:'
        : 'The association cancelled your bookings:',
      times.join('\n'),
      ...(reason ? [`Reason: ${reason}`] : []),
      `Open ${where} to book another time.`,
    ].join('\n\n'),
  }),
};

async function organizationOf(organizationId: string) {
  const [organization] = await db
    .select({name: organizations.name, locales: organizations.locales})
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!organization) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return organization;
}

// A new admin is told what to do, in the organization's first language.
export async function sendAdminInvitation(
  organizationId: string,
  email: string,
): Promise<void> {
  const organization = await organizationOf(organizationId);
  const locale = organization.locales[0] ?? 'sv';
  const mail = ADMIN_INVITATION[locale](
    organization.name,
    whereToSignIn(locale),
  );

  await sendMail({...mail, to: email});
}

// An admin given an apartment is told where to find it: they sign in as
// they already do.
export async function sendApartmentLinked(
  organizationId: string,
  email: string,
  label: string,
): Promise<void> {
  const organization = await organizationOf(organizationId);
  const locale = organization.locales[0] ?? 'sv';
  const mail = APARTMENT_LINKED[locale](
    organization.name,
    label,
    whereToSignIn(locale),
  );

  await sendMail({...mail, to: email});
}

// A new resident is told they can sign in, in the organization's first
// language: nothing is known about their device yet.
export async function sendWelcome(
  organizationId: string,
  email: string,
): Promise<void> {
  const organization = await organizationOf(organizationId);
  const locale = organization.locales[0] ?? 'sv';
  const mail = WELCOME[locale](organization.name, whereToSignIn(locale));

  await sendMail({...mail, to: email});
}

// Every resident of an apartment is told of its bookings a change by the
// admin cancelled, in the organization's first language, like the other
// mail the organization sends: a resident may have no device to ask.
export async function sendBookingsCancelled(
  organizationId: string,
  memberId: string,
  resourceName: LocalizedText,
  cancelled: {date: string; start: string; end: string}[],
  reason: LocalizedText,
): Promise<void> {
  const organization = await organizationOf(organizationId);
  const locale = organization.locales[0] ?? 'sv';
  const resource = localize(resourceName, locale) ?? '';
  const residents = await db
    .select({email: user.email})
    .from(user)
    .where(eq(user.memberId, memberId));
  const mail = BOOKINGS_CANCELLED[locale](
    organization.name,
    cancelled.map(
      (booking) =>
        `${resource}, ${formatWhen(locale, booking.date, booking.start, booking.end)}`,
    ),
    localize(reason, locale) ?? '',
    whereToSignIn(locale),
  );

  for (const {email} of residents) {
    await sendMail({...mail, to: email});
  }
}
