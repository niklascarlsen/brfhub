import {eq, lt, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {codeRequests} from '../db/schema.js';

// An address is mailed a code at most this often, whoever asks, so no
// number of clients can fill an inbox. A client is mailed at most this
// many codes an hour for one address: counted per client, so whoever
// asks for someone else's codes uses up their own hour, not the
// resident's.
export const CODE_RESEND_SECONDS = 30;
export const CODES_PER_HOUR = 10;

export type CodeWait = {
  // Moments after the last code, which still holds, or the client's hour
  // used up.
  reason: 'recent' | 'hour';
  seconds: number;
};

// Whether a code for the address may be mailed to the client now, or how
// long it waits. Asked before Better Auth decides whether it has anyone to
// mail it to: an unknown address waits like a known one. The database's
// clock, so every server instance counts alike.
export async function codeWait(
  email: string,
  client: string,
): Promise<CodeWait | null> {
  const address = email.toLowerCase();
  const {sentAt, hourFrom, count} = codeRequests;

  const [row] = await db
    .select({
      sinceLast: sql<string>`extract(epoch from now() - max(${sentAt}))`,
      untilHourEnds: sql<string>`max(extract(epoch from ${hourFrom} + interval '1 hour' - now())) filter (where ${codeRequests.client} = ${client} and ${count} >= ${CODES_PER_HOUR})`,
    })
    .from(codeRequests)
    .where(eq(codeRequests.email, address));

  const untilHourEnds = Number(row?.untilHourEnds ?? 0);
  if (untilHourEnds > 0) {
    return {reason: 'hour', seconds: Math.ceil(untilHourEnds)};
  }

  const sinceLast = row?.sinceLast === null ? null : Number(row?.sinceLast);
  if (sinceLast !== null && sinceLast < CODE_RESEND_SECONDS) {
    return {
      reason: 'recent',
      seconds: Math.max(1, Math.ceil(CODE_RESEND_SECONDS - sinceLast)),
    };
  }

  return null;
}

// Counts a code asked for the address by the client, once Better Auth has
// answered it: a request it refused, or whose mail failed, is not counted
// and can be sent again at once. Two requests at the same instant can both
// pass codeWait before either is counted, which mails the code twice.
export async function countCode(email: string, client: string) {
  const address = email.toLowerCase();
  const {sentAt, hourFrom, count} = codeRequests;
  const hourOver = sql`${hourFrom} <= now() - interval '1 hour'`;

  await db
    .delete(codeRequests)
    .where(lt(sentAt, sql`now() - interval '1 hour'`));

  await db
    .insert(codeRequests)
    .values({
      email: address,
      client,
      sentAt: sql`now()`,
      hourFrom: sql`now()`,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [codeRequests.email, codeRequests.client],
      set: {
        sentAt: sql`now()`,
        hourFrom: sql`case when ${hourOver} then now() else ${hourFrom} end`,
        count: sql`case when ${hourOver} then 1 else ${count} + 1 end`,
      },
    });
}

// A code spent signing in or setting the password: the next may be asked
// for at once, as nothing mailed is left to wait on.
export async function codeUsed(email: string) {
  await db
    .delete(codeRequests)
    .where(eq(codeRequests.email, email.toLowerCase()));
}
