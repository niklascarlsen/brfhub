# Queue and push

How an apartment waits for a taken time and hears when it frees up, and how push reaches native apps and browsers alike.

## Queueing for a taken time

1. The resident taps a time another apartment holds and confirms. The client calls `POST /subscriptions`.
2. The server checks the slot the same way booking does, then that another apartment holds it (`SLOT_AVAILABLE` if it is free, `HAS_ACTIVE_BOOKING` if it is the apartment's own). The holding booking is locked while the queue place goes in, so a cancel either waits for it or has already freed the slot.
3. Queueing twice for the same slot updates the existing place.

Leaving the queue is `DELETE /subscriptions/:id`, idempotent like cancelling.

## When a slot frees up

Whenever a booking that has not started is deleted (a cancel, a swap, an admin replacing a resident or removing an apartment), the transaction reads the slot's queue before committing. After the commit and the response, everyone in that queue except the apartment that let it go gets a push: "A slot opened up". It is first come, first served: the push does not reserve anything.

When a booking that has started is opened for drop-in instead ("Jag är klar / I'm done"), it cannot be booked, but the queue gets a different push: "En tid är öppen för drop-in / A slot is open for drop-in". A queue place on a time under way is kept for this. The booking stays in the apartment's Mina tider / My times, faded and marked Avslutad / Ended.

Tapping either push opens the booking screen on that day and resource.

## Delivery

Sending runs through the `Notifier` ([`server/src/notification/notification.service.ts`](../../server/src/notification/notification.service.ts)), which `buildApp` is given:

- `later()` runs the send after the response, so a slow push service never delays the request, and a transaction that rolls back sends nothing.
- Each device gets the message in its own language, stored with its token.
- Tokens the push service reports as gone are deleted. Expo only answers a send with a ticket saying it took the message; whether Apple or Google delivered it comes as a receipt, which the server asks for 15 minutes later. A token whose receipt says the app is gone is deleted then, unless the device registered it again in between. The receipts are not kept past a restart: a lost one only means the dead token is caught at its next push.

[`server/src/lib/push.ts`](../../server/src/lib/push.ts) picks the transport per token:

| Token                    | Transport                                         | Platform                    |
| ------------------------ | ------------------------------------------------- | --------------------------- |
| `ExponentPushToken[...]` | Expo push service, which forwards to APNs and FCM | iOS and Android apps        |
| JSON push subscription   | Web Push with VAPID keys                          | browsers and installed PWAs |

## Tokens and the push switch

- The app ([`app/src/push.ts`](../../app/src/push.ts)) and the web ([`web/src/lib/push.ts`](../../web/src/lib/push.ts)) send their token to `POST /push-tokens` on every start and language change, so a rotated token or a stale VAPID key is replaced.
- A token belongs to the session that registered it. Signing out, or being signed out by an admin, deletes the session and the token with it.
- The switch under Lägenhet / Apartment keeps the wish on the device (`lib/pushPreference.ts`). Off drops the token. A device where the OS was told no can only be turned on again in its settings.
- An apartment keeps at most 20 tokens; the oldest go first.
- The switch is all or nothing. On Android each push also goes on a channel, `slots` (Lediga tider / Available times) or `announcements` (Anslag / Announcements), which the app registers when it signs up for push. Android lists them under Settings, Apps, BrfHub, Notifications, where each can be turned off on its own; a channel nothing has arrived on yet sits under "Show unused categories". iOS and web browsers have no such thing, so this is Android alone: Apple lets an app's notifications be turned on or off only as a whole in the iPhone's settings, with no list of kinds an app could add to, and a browser allows or blocks a site's. Muting one kind on every platform would take a switch per kind under Lägenhet / Apartment, honoured by the server.

## Where to look

| What                        | Where                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Queue rules                 | [`server/src/booking/lifecycle.ts`](../../server/src/booking/lifecycle.ts) (`queue`)                                                                   |
| Who is told of a freed slot | [`server/src/booking/booking.notification.ts`](../../server/src/booking/booking.notification.ts)                                                       |
| Notifier                    | [`server/src/notification/notification.service.ts`](../../server/src/notification/notification.service.ts)                                             |
| Transports                  | [`server/src/lib/push.ts`](../../server/src/lib/push.ts)                                                                                               |
| Client registration         | [`app/src/push.ts`](../../app/src/push.ts), [`web/src/lib/push.ts`](../../web/src/lib/push.ts), [`web/public/push-sw.js`](../../web/public/push-sw.js) |
| Trying it end to end        | `npm run push:test` in `server/`                                                                                                                       |
