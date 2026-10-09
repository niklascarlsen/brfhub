import {sql} from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  bookingWindowDays: integer('booking_window_days').notNull(),
});

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
    name: text('name').notNull(),
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
    name: text('name').notNull(),
    tags: text('tags').array().notNull(),
    sortOrder: integer('sort_order').notNull(),
    // Bookable up to the day before. Null while the resource stays open.
    closesFrom: date('closes_from', {mode: 'string'}),
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

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});

export const userRole = pgEnum('user_role', ['member', 'admin']);

// Better Auth owns the shape of these four tables. role, organizationId and
// memberId are ours: a member account books for one apartment, the one
// admin account of an organization manages it and books nothing.
export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: userRole('role').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id),
    memberId: uuid('member_id'),
    // Kept apart from the sessions, which go when the password changes.
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
    check(
      'user_role_member_check',
      sql`(${table.role} = 'member') = (${table.memberId} is not null)`,
    ),
    uniqueIndex('user_one_account_per_apartment')
      .on(table.memberId)
      .where(sql`${table.memberId} is not null`),
    uniqueIndex('user_one_admin_per_organization')
      .on(table.organizationId)
      .where(sql`${table.role} = 'admin'`),
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
