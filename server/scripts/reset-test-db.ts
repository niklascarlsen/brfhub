import {sql} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';

// drizzle-kit push keeps asking to truncate members on a database that
// already has the schema, and without a terminal it gives up and leaves
// the old schema in place. The test database holds nothing worth keeping,
// so every run pushes onto an empty schema instead.
try {
  const [connection] = (
    await db.execute<{name: string}>(sql`select current_database() as name`)
  ).rows;

  if (!connection?.name.endsWith('_test')) {
    throw new Error(
      `Refusing to reset ${connection?.name ?? 'unknown database'}, expected a _test database`,
    );
  }

  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
} finally {
  await pool.end();
}
