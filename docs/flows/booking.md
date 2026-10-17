# Booking

How an apartment books, swaps, cancels and releases a time. Every rule lives on the server in [`server/src/booking/lifecycle.ts`](../../server/src/booking/lifecycle.ts); the clients only render what [`core/src/booking/offer.ts`](../../core/src/booking/offer.ts) says a time offers.

## Concepts

- **Resource**: something bookable, such as a laundry room. It belongs to a **kind** (`resource_kinds`), and the kind sets `maxActive`: how many bookings of that kind an apartment may hold at once.
- **Slot**: a fixed time on a resource, such as 07:00-10:00. A resource's slots come in versions, each with a `validFrom` day; a day books the latest version that starts on or before it. A night slot may end the next day (`endOffsetDays`).
- **Booking window**: an apartment can book from today through `bookingWindowDays` ahead, counted in the organization's time zone.
- **Active booking**: one that has not ended yet. It counts against `maxActive` until its end, even after it has been released.

## Booking a free time

1. The resident taps a free time. `takeAction` in `offer.ts` decides what that means:
   - under the cap: **book**
   - at the cap, with a booking that has not started: **swap**, and the resident picks which one to give up
   - at the cap, with every booking started or released: **full**, nothing can be done until one ends
2. The client confirms through `useDialog`, then calls `POST /bookings`, with `replaceBookingId` for a swap.
3. The server, in one transaction:
   1. takes a shared lock on the resource and the apartment's advisory lock, so an admin change or a second request from the same apartment waits its turn
   2. checks that the slot exists that day, has not started, the resource is open and the day is inside the window
   3. checks that the account still holds the apartment
   4. frees the swapped booking, or refuses with `HAS_ACTIVE_BOOKING` at the cap
   5. inserts the booking; a unique index on resource, date and start turns a race into `SLOT_TAKEN`
   6. drops the apartment's own queue place on that slot
4. After the commit, the queue of a swapped booking is told the slot is free (see [Queue and push](queue-and-push.md)).

## Cancelling and releasing

`DELETE /bookings/:id` does one of two things, depending on the clock:

- **Not started**: the booking is deleted and its queue is told.
- **Started**: the booking stays and gets `releasedAt`. It is shown as open for drop-in to others, but still counts against the apartment until it ends. Its queue is told it can drop in.

Asking twice, or for another apartment's id, answers the same as success, so a retried request is safe and an id leaks nothing.

## Where to look

| What                            | Where                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Rules and locking               | [`server/src/booking/lifecycle.ts`](../../server/src/booking/lifecycle.ts)         |
| Routes                          | [`server/src/booking/booking.route.ts`](../../server/src/booking/booking.route.ts) |
| What a time offers in the UI    | [`core/src/booking/offer.ts`](../../core/src/booking/offer.ts)                     |
| The dialogs before each action  | [`core/src/booking/bookingActions.ts`](../../core/src/booking/bookingActions.ts)   |
| Times, windows and zones in SQL | [`server/src/lib/time.ts`](../../server/src/lib/time.ts)                           |
