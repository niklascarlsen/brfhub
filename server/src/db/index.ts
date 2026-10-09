import 'dotenv/config';

import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';

import * as schema from './schema.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (copy .env.example to .env)');
}

export const pool = new Pool({connectionString: process.env.DATABASE_URL});
export const db = drizzle(pool, {schema});

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Either the pool or an open transaction, for writes that must commit
// together with the caller's.
export type Executor = typeof db | Transaction;
