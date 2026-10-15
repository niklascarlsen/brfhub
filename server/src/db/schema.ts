import {sql} from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  LOCALES,
  type Locale,
  type LocalizedTags,
  type LocalizedText,
} from '../lib/locale.js';

export const locale = pgEnum('locale', LOCALES);

// Text the admin writes once per language of the organization, which is
// shown in the language each device asks for.
function localizedText(name: string) {
  return jsonb(name).$type<LocalizedText>();
}

export const organizations = pgTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    // Not translated: a name reads the same in every language.
    name: text('name').notNull(),
    // IANA name, set when the organization is created and never changed:
    // bookings store the instant their slot ends, worked out in this zone.
    timeZone: text('time_zone').notNull(),
    bookingWindowDays: integer('booking_window_days').notNull(),
    // The languages the organization writes in, and so the only ones its
    // apartments can show. In the order of LOCALES.
    locales: locale('locales').array().$type<Locale[]>().notNull(),
    // House rules in the admin's own words, shown above the derived ones.
    // Empty when there are none.
    rulesText: localizedText('rules_text').notNull().default({}),
  },
  (table) => [
    check(
      'organizations_locales_check',
      sql`cardinality(${table.locales}) > 0`,
    ),
  ],
);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    label: text('label').notNull(),
    leftAt: timestamp('left_at', {withTimezone: true}),
  },
  (table) => [
    // Only among apartments still in the organization, so a number frees up
    // once its apartment is removed.
    uniqueIndex('members_organization_label_unique')
      .on(table.organizationId, table.label)
      .where(sql`${table.leftAt} is null`),
    unique('members_organization_id_unique').on(table.organizationId, table.id),
  ],
);

export const resourceKinds = pgTable(
  'resource_kinds',
  {
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    id: text('id').notNull(),
    name: localizedText('name').notNull(),
    maxActive: integer('max_active').notNull(),
  },
  (table) => [primaryKey({columns: [table.organizationId, table.id]})],
);

export const resources = pgTable(
  'resources',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    kindId: text('kind_id').notNull(),
    name: localizedText('name').notNull(),
    tags: jsonb('tags').$type<LocalizedTags>().notNull(),
    sortOrder: integer('sort_order').notNull(),
    // Bookable up to the day before. Null while the resource stays open.
    closesFrom: date('closes_from', {mode: 'string'}),
    // What the admin says about the closing, shown with the closed resource
    // and sent with the bookings it cancelled. Empty while open.
    closingNote: localizedText('closing_note').notNull().default({}),
  },
  (table) => [
    unique('resources_organization_id_unique').on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: 'resources_kind_fk',
      columns: [table.organizationId, table.kindId],
      foreignColumns: [resourceKinds.organizationId, resourceKinds.id],
    }),
  ],
);

// The slots of a resource sharing a validFrom are one version of its
// schedule. Each day books the version with the latest validFrom on or
// before it, so a change can be set up to start on a later day.
export const resourceSlots = pgTable(
  'resource_slots',
  {
    resourceId: text('resource_id')
      .notNull()
      .references(() => resources.id),
    validFrom: date('valid_from', {mode: 'string'}).notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    endOffsetDays: integer('end_offset_days').notNull().default(0),
  },
  (table) => [
    primaryKey({columns: [table.resourceId, table.validFrom, table.start]}),
  ],
);

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    memberId: uuid('member_id').notNull(),
    resourceId: text('resource_id').notNull(),
    date: date('date', {mode: 'string'}).notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
    releasedAt: timestamp('released_at', {withTimezone: true}),
  },
  (table) => [
    unique('bookings_resource_date_start_unique').on(
      table.resourceId,
      table.date,
      table.start,
    ),
    foreignKey({
      name: 'bookings_member_fk',
      columns: [table.organizationId, table.memberId],
      foreignColumns: [members.organizationId, members.id],
    }),
    foreignKey({
      name: 'bookings_resource_fk',
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resources.organizationId, resources.id],
    }),
    index('bookings_member_ends_at_idx').on(table.memberId, table.endsAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    memberId: uuid('member_id').notNull(),
    resourceId: text('resource_id').notNull(),
    date: date('date', {mode: 'string'}).notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('subscriptions_member_resource_date_start_unique').on(
      table.memberId,
      table.resourceId,
      table.date,
      table.start,
    ),
    foreignKey({
      name: 'subscriptions_member_fk',
      columns: [table.organizationId, table.memberId],
      foreignColumns: [members.organizationId, members.id],
    }),
    foreignKey({
      name: 'subscriptions_resource_fk',
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resources.organizationId, resources.id],
    }),
    index('subscriptions_resource_date_start_idx').on(
      table.resourceId,
      table.date,
      table.start,
    ),
    index('subscriptions_member_ends_at_idx').on(table.memberId, table.endsAt),
  ],
);

// Shown to the organization's apartments from publishedOn through endsOn,
// or until removed when endsOn is null.
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    title: localizedText('title').notNull(),
    body: localizedText('body').notNull(),
    publishedOn: date('published_on', {mode: 'string'}).notNull(),
    endsOn: date('ends_on', {mode: 'string'}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    // An edit shows the announcement again to apartments that hid it.
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('announcements_organization_published_idx').on(
      table.organizationId,
      table.publishedOn,
    ),
  ],
);

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  // The sign-in that registered it. Signing out, on the device or
  // everywhere, ends the session and takes the token with it, also when the
  // device could not drop it itself.
  sessionId: text('session_id')
    .notNull()
    .references(() => session.id, {onDelete: 'cascade'}),
  // The language the device shows, which its push is written in.
  locale: locale('locale').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});

// Better Auth owns the shape of these five tables. organizationId, memberId
// and admin are ours: an account books for its apartment, manages its
// organization, or both, and always belongs to one organization.
export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    // The apartment the account books for. Cleared when it moves out.
    memberId: uuid('member_id'),
    admin: boolean('admin').notNull().default(false),
    // Better Auth's two-factor plugin sets it once the admin has verified
    // an authenticator app. An admin without it may only read the account.
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    // Kept apart from the sessions, which go when the account is signed
    // out everywhere.
    lastSignInAt: timestamp('last_sign_in_at', {withTimezone: true}),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: 'user_member_fk',
      columns: [table.organizationId, table.memberId],
      foreignColumns: [members.organizationId, members.id],
    }),
    // An account with nothing to do cannot be made.
    check(
      'user_has_role_check',
      sql`${table.memberId} is not null or ${table.admin}`,
    ),
    uniqueIndex('user_one_account_per_apartment')
      .on(table.memberId)
      .where(sql`${table.memberId} is not null`),
  ],
);

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// Better Auth's two-factor plugin: the admin's TOTP secret and backup codes,
// both encrypted with the auth secret.
export const twoFactor = pgTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, {onDelete: 'cascade'}),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').notNull().default(true),
    failedVerificationCount: integer('failed_verification_count')
      .notNull()
      .default(0),
    lockedUntil: timestamp('locked_until', {withTimezone: true}),
  },
  (table) => [
    index('two_factor_user_id_idx').on(table.userId),
    index('two_factor_secret_idx').on(table.secret),
  ],
);

// What the admins did, for the other admins to see: who removed apartment
// 12, and when. The actor is the address at the time, since the account
// may be gone by the time anyone reads it.
export const adminEvents = pgTable(
  'admin_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    // What it was done to, as the actor saw it: a number, a name. A change
    // to the settings names the parts it touched by key instead.
    subject: text('subject').notNull(),
    at: timestamp('at', {withTimezone: true}).notNull().defaultNow(),
  },
  (table) => [
    index('admin_events_organization_at_idx').on(
      table.organizationId,
      table.at,
    ),
  ],
);
