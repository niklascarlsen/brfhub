import 'dotenv/config';

import closeWithGrace from 'close-with-grace';

import {buildApp} from './app.js';
import {pool} from './db/index.js';
import {PUSH_TIMEOUT_MS} from './lib/push.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = await buildApp({
  logger: process.stdout.isTTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: {translateTime: 'HH:MM:ss', ignore: 'pid,hostname'},
        },
      }
    : true,
});

// Long enough for push still on its way to be sent or give up first.
closeWithGrace({delay: PUSH_TIMEOUT_MS + 2000}, async ({signal, err}) => {
  if (err) {
    server.log.error({err}, 'shutting down after error');
  } else {
    server.log.info(`${signal} received, shutting down`);
  }

  await server.close();
  await pool.end();
});

await server.listen({port, host});
server.log.info(`Docs http://localhost:${port}/docs`);
