import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const RESOURCE_KINDS = ['laundry', 'drying'] as const;
type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').$type<ResourceKind>().notNull(),
  hasDryer: boolean('has_dryer').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const timeSlots = pgTable('time_slots', {
  id: text('id').primaryKey(),
  start: text('start').notNull(),
  end: text('end').notNull(),
});

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: text('resource_id')
      .notNull()
      .references(() => resources.id),
    date: date('date', {mode: 'string'}).notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => timeSlots.id),
    userId: text('apartment_number').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
    releasedAt: timestamp('released_at', {withTimezone: true}),
  },
  (table) => [
    unique('bookings_resource_date_slot_unique').on(
      table.resourceId,
      table.date,
      table.slotId,
    ),
    index('bookings_user_ends_at_idx').on(table.userId, table.endsAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resourceId: text('resource_id')
      .notNull()
      .references(() => resources.id),
    date: date('date', {mode: 'string'}).notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => timeSlots.id),
    userId: text('apartment_number').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('subscriptions_user_resource_date_slot_unique').on(
      table.userId,
      table.resourceId,
      table.date,
      table.slotId,
    ),
    index('subscriptions_resource_date_slot_idx').on(
      table.resourceId,
      table.date,
      table.slotId,
    ),
    index('subscriptions_user_ends_at_idx').on(table.userId, table.endsAt),
  ],
);

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  userId: text('apartment_number').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});
