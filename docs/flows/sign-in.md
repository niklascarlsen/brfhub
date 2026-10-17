# Sign-in

Residents and admins sign in differently, because an admin's account opens every apartment. Authentication is Better Auth ([`server/src/auth/auth.ts`](../../server/src/auth/auth.ts)); the steps each screen walks through live in [`core/src/auth/`](../../core/src/auth), shared by both clients.

Nobody signs up. Accounts are created by an admin (apartments, other admins) or by `npm run org:create` (the first admin).

## Step one: the address

The login screen asks for an email address and calls `POST /sign-in/method`, which answers one of:

- `code`: a resident, or an unknown address. Unknown addresses get the same answer and no mail, so the screen cannot be used to find out who lives where.
- `password`: an admin with a password.
- `set-password`: an admin who has never chosen one.

## Residents: a mailed code

1. Better Auth's `emailOTP` mails a six-digit code, valid for 10 minutes.
2. The resident types it and is signed in for 180 days, extended while the app is in use.

**How often a code is mailed.** An address gets a code at most every 30 seconds, whoever asks, and one client (by IP) at most 10 an hour for one address, so whoever asks for someone else's codes uses up their own hour and not the resident's. Asked again while it holds, the same code is mailed and holds 10 more minutes (`resendStrategy: 'reuse'`, so codes are stored encrypted), and codes asked for by someone else never undo the one a resident has. It holds for the sign-in code and the admin's code to set the password, and for unknown addresses too, which are mailed nothing but wait the same, so the answer gives nothing away. The hook in `auth.ts` checks the wait before Better Auth looks the address up ([`server/src/auth/codeRequests.ts`](../../server/src/auth/codeRequests.ts)) and refuses with `429` and `retryAfter` in seconds: `CODE_RECENTLY_SENT` within the half minute, `TOO_MANY_CODES` with the hour used up. A code is counted once mailed, or once answered for an address with nobody to mail it to, so a refused request or a failed mail can be sent again at once, and a code spent signing in or setting the password ends the wait. The login screen counts down on "Skicka ny kod" / "Send a new code". Asked again within the half minute for an address, as after going back and typing it again, it goes on to the code step with the countdown, since that code still holds; with the hour used up it says so and stays. The 30 seconds reach the clients through `limits.ts`.

## Admins: password, then authenticator

1. The admin types the password.
2. If the device is trusted, they are in. Otherwise they type a code from their authenticator app, or one of their backup codes.
3. Ticking "Lita på den här enheten i 30 dagar / Trust this device for 30 days" skips step 2 on that device for 30 days, renewed at each such sign-in.

An admin's session ends 7 days after sign-in, however much it is used.

**First sign-in and forgotten passwords** both go through a code mailed to the admin. Setting the password that way ends every session and forgets every trusted device, then signs the admin in.

**Setting up the authenticator**: an admin without one can only read their own account. `AccountGate` shows `TwoFactorSetup`: confirm the password, scan the QR code, type the first code, save the backup codes. Only then does the admin app open.

## What an admin cannot do alone

These are refused on Better Auth's own routes by the hook in `auth.ts`, so a stolen trusted device plus password is not enough to lock the real admin out:

- turn the authenticator off, read its secret out, or make new backup codes
- change their own name (the admin forms do that, with the text checked)

Any admin can reset another admin's authenticator from the admin pages. For an organization's last admin there is `npm run admin:reset-2fa`.

## Accounts with both roles

One account can be a resident and an admin in the same organization, for example a board member who lives there. It signs in the admin way and switches between the apartment app and the admin app (`SwitchModeContext`). Making a resident an admin signs them out everywhere and sends them to choose a password at the next sign-in.

## Development

With `NODE_ENV=development`, every mailed code is `123456` and the screens fill in the address, password and codes from `GET /dev/codes`. `DEV_SIGN_IN=off` in `server/.env` turns that off to test the real flow with Mailpit and an authenticator app.

## Where to look

| What                             | Where                                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Better Auth setup and the hooks  | [`server/src/auth/auth.ts`](../../server/src/auth/auth.ts)                                                                                                                                                         |
| How often a code is mailed       | [`server/src/auth/codeRequests.ts`](../../server/src/auth/codeRequests.ts)                                                                                                                                         |
| Session lengths, trusted devices | [`server/src/auth/sessions.ts`](../../server/src/auth/sessions.ts)                                                                                                                                                 |
| `/sign-in/method`, dev codes     | [`server/src/auth/auth.route.ts`](../../server/src/auth/auth.route.ts)                                                                                                                                             |
| Who is signed in, per request    | [`server/src/lib/user.ts`](../../server/src/lib/user.ts)                                                                                                                                                           |
| Client steps                     | [`core/src/auth/signIn.ts`](../../core/src/auth/signIn.ts), [`core/src/auth/twoFactorSetup.ts`](../../core/src/auth/twoFactorSetup.ts), [`core/src/auth/changePassword.ts`](../../core/src/auth/changePassword.ts) |
| Better Auth errors as text       | [`core/src/auth/failures.ts`](../../core/src/auth/failures.ts)                                                                                                                                                     |
| Which app an account sees        | [`core/src/auth/account.ts`](../../core/src/auth/account.ts), [`app/src/auth/account.tsx`](../../app/src/auth/account.tsx), [`web/src/auth/account.tsx`](../../web/src/auth/account.tsx)                           |
