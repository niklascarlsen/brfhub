# Apartments and admins

How the people in an organization come and go. Admins are equals who trust each other: there are no role levels, and what one admin does is shown to the others in the event log.

## Organizations

An organization is created once from the command line, with its first admin:

```sh
npm run org:create -- --id <slug> --name <name> --time-zone <IANA zone> --admin-email <email> [--languages sv,en]
```

The password is printed once. The time zone cannot change later, since bookings store the instant they end, worked out in it. The languages can.

## Apartments

An apartment (`members`) has a number and one resident account, identified by email.

| Action               | What happens                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add                  | The apartment and its account are created, and the resident is mailed that they can sign in. An address that is an admin's in the organization joins the admin's account to the apartment instead, and the admin is mailed that.  |
| Change the address   | Whoever used the old address is signed out, and the new address is mailed. The bookings stay with the apartment.                                                                                                                  |
| Sign out             | Every session of the resident ends, and their push tokens with them.                                                                                                                                                              |
| Replace the resident | For a move: the old resident's bookings are let go as if they cancelled them (queues are told), their queue places go, and so does their account unless it is an admin's, which stays as admin alone. The new resident is mailed. |
| Remove               | Like replacing, but nobody new moves in. The number is free for a new apartment.                                                                                                                                                  |

Every change to an apartment takes its lock first, so two admins, or an admin and the resident booking, never interleave.

## Admins

| Action              | What happens                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add                 | A new account, or the resident's own account if the address lives in the organization. They are mailed to choose a password with a code, then set up an authenticator. A resident made admin is signed out everywhere first. |
| Remove              | A resident keeps the apartment and loses the password and authenticator; anyone else loses the account. An admin cannot remove themselves, and the last admin cannot be removed.                                             |
| Reset authenticator | For another admin who lost their phone. Their sessions end and they set up a new one at the next sign-in.                                                                                                                    |

An address belongs to one organization.

## Event log

Every admin write logs an event from its route through `logEvent` ([`server/src/event/event.service.ts`](../../server/src/event/event.service.ts)): who, what, and a subject the admin would recognise, such as an apartment number or a resource name. It is shown under Föreningen / Association, newest first: `GET /admin/events` answers 50 at a time with the event the next page comes after, narrowed to a part of the admin (`area`) on the server, and the clients show older pages when asked, each day under a heading that sticks while the day scrolls.

## Where to look

| What       | Where                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Apartments | [`server/src/apartment/apartment.service.ts`](../../server/src/apartment/apartment.service.ts)                                                                           |
| Admins     | [`server/src/admins/admins.service.ts`](../../server/src/admins/admins.service.ts)                                                                                       |
| Mail texts | [`server/src/mail/mail.service.ts`](../../server/src/mail/mail.service.ts)                                                                                               |
| Event log  | [`server/src/event/event.service.ts`](../../server/src/event/event.service.ts), [`core/src/admin/events.ts`](../../core/src/admin/events.ts)                             |
| Scripts    | [`server/scripts/create-organization.ts`](../../server/scripts/create-organization.ts), [`server/scripts/reset-two-factor.ts`](../../server/scripts/reset-two-factor.ts) |
