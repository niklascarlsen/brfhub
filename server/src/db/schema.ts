import {date, pgTable, text, unique, uuid} from 'drizzle-orm/pg-core';

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
  },
  (table) => [unique('bookings_date_slot_unique').on(table.date, table.slotId)],
);

