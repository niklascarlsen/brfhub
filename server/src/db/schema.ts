import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const timeSlots = pgTable('time_slots', {
  id: text('id').primaryKey(),
  start: text('start').notNull(),
  end: text('end').notNull(),
});

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', {mode: 'string'}).notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => timeSlots.id),
    userId: text('user_id').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
  },
  (table) => [
    unique('bookings_date_slot_unique').on(table.date, table.slotId),
    index('bookings_user_ends_at_idx').on(table.userId, table.endsAt),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', {mode: 'string'}).notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => timeSlots.id),
    userId: text('user_id').notNull(),
    endsAt: timestamp('ends_at', {withTimezone: true}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique('subscriptions_user_date_slot_unique').on(
      table.userId,
      table.date,
      table.slotId,
    ),
    index('subscriptions_date_slot_idx').on(table.date, table.slotId),
    index('subscriptions_user_ends_at_idx').on(table.userId, table.endsAt),
  ],
);

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .notNull()
    .defaultNow(),
});
