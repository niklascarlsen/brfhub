# Resource changes

How an admin changes when a resource can be booked, and what happens to bookings that no longer fit. The principle: **bookings are promised, free slots are not.** The booking window only says how far ahead apartments may book. An admin can still change anything, but never cancels a booking without first seeing it.

## What an admin can change

| Change                             | Starts                   | Route                                             |
| ---------------------------------- | ------------------------ | ------------------------------------------------- |
| New times (a new schedule version) | tomorrow at the earliest | `PUT /admin/resources/:id/schedule`               |
| Remove an upcoming version         | tomorrow at the earliest | `DELETE /admin/resources/:id/schedule/:validFrom` |
| Close the resource from a day      | today at the earliest    | `PUT /admin/resources/:id/closing`                |
| Reopen                             | at once                  | `DELETE /admin/resources/:id/closing`             |
| Remove a closed resource           | once closed              | `DELETE /admin/resources/:id`                     |

New times replace every version from their first day on. Times start tomorrow at the earliest so they never overlap a slot that is under way today.

## Preview, then change

1. The admin fills in the change. The client sends it to `POST /admin/resources/:id/preview`.
2. The server makes the change in a transaction, lists the bookings it leaves without a slot, and rolls back. Since the preview runs the real change, the two can never disagree.
3. If anything would be cancelled, the client shows the list (apartment, day, time) and offers an optional reason, written in every language the organization uses.
4. The client sends the change with the ids it was shown. The server makes the change under the resource's exclusive lock, so nobody books on it meanwhile, then takes the locks of the affected apartments and reads again.
5. If any booking would be cancelled that the admin was not shown (someone booked meanwhile), the whole change is refused with `CHANGE_CANCELS_BOOKINGS` and the client previews again.
6. After the commit, each affected apartment gets a push and a mail with the admin's reason. Queue places on slots that are gone are removed without a word: nobody lost a booking.

A booking that has already started is never cancelled.

## Closing

A closed resource stays visible to residents, with the admin's note, so they know why it cannot be booked. Reopening only adds days, so it needs no preview. A resource closed today or earlier can be removed for good; the event log keeps its name.

## Where to look

| What                                     | Where                                                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Applying, previewing and making a change | [`server/src/resourceAdmin/resourceAdmin.service.ts`](../../server/src/resourceAdmin/resourceAdmin.service.ts)                                                                                     |
| Cancelling what is left without a slot   | [`server/src/booking/lifecycle.ts`](../../server/src/booking/lifecycle.ts) (`orphanedBookings`, `cancelOrphaned`)                                                                                  |
| Telling the apartments                   | [`server/src/booking/booking.notification.ts`](../../server/src/booking/booking.notification.ts) (`announceCancelled`), [`server/src/mail/mail.service.ts`](../../server/src/mail/mail.service.ts) |
| Which version a day books                | [`server/src/resource/schedule.query.ts`](../../server/src/resource/schedule.query.ts)                                                                                                             |
| Client forms                             | `ScheduleForm.tsx`, `CloseForm.tsx`, `ChangeDay.tsx` in [`app/src/admin/`](../../app/src/admin) and [`web/src/admin/`](../../web/src/admin)                                                        |
