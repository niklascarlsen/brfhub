# Announcements and languages

## Announcements

An admin writes a notice for every apartment, such as "The laundry room is being painted next week".

1. The admin writes a title and body in each of the organization's languages, with an optional last day.
2. It is published today, and every apartment's devices get a push on the `announcements` channel. If the admin ticks "Skicka även som e-post / Also send by email", every resident is mailed it too, each in the language they last used, and the event log notes it. That is for important information everyone needs to see, whether or not they get push.
3. Residents see it on the booking screen until its last day, or until it is removed. A resident can hide it on their device.
4. Editing it shows it again to those who hid it, and pushes again, unless it has ended. An edit is never mailed again.

Tapping the push opens the booking screen, where announcements are shown.

| What  | Where                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------- |
| Rules | [`server/src/announcement/announcement.service.ts`](../../server/src/announcement/announcement.service.ts)           |
| Push  | [`server/src/announcement/announcement.notification.ts`](../../server/src/announcement/announcement.notification.ts) |
| Mail  | [`server/src/mail/mail.service.ts`](../../server/src/mail/mail.service.ts) (`sendAnnouncement`)                      |

## Languages

The clients speak Swedish and English. An organization picks which of them it uses (`locales`), and its apartments only see those.

**The device's language** is, in order: the one picked under Lägenhet / Apartment or Föreningen / Association, else the first device language the organization uses, else English if it uses it, else the organization's first language. The device sends it as `Accept-Language` on every request and with its push token, so push is written in it. The server also remembers it on the account, so mail sent later (a cancelled booking, an invitation) is written in the language the person last used. A new resident's welcome mail, sent before they have used the app, is in the organization's first language.

**The organization's own text** (resource and kind names, tags, house rules, announcements, closing notes) is stored as JSON with one value per language. Member endpoints resolve it to a plain string; admin endpoints return the whole object so the forms can edit every language. Text that is missing in one language falls back to one it is written in.

**The UI strings** live in [`core/src/i18n/sv.ts`](../../core/src/i18n/sv.ts) and `en.ts`. TypeScript refuses an English catalog that lacks a Swedish key.

| What                               | Where                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Resolving languages on the server  | [`server/src/lib/locale.ts`](../../server/src/lib/locale.ts)                                                         |
| Catalogs                           | [`core/src/i18n/`](../../core/src/i18n)                                                                              |
| The picker and the device's choice | `src/i18n/LocaleProvider.tsx` and `src/lib/locale.ts` in [`app/src/`](../../app/src) and [`web/src/`](../../web/src) |
