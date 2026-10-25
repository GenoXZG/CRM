import fs from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'node:http';
import { createApplication } from './app';
import { configuration, rootDirectory } from './config';
import { database } from './infrastructure/database/connection';
import { initializeAuthentication } from './auth';

export async function startServer() {
  await fs.mkdir(path.join(rootDirectory, 'public/uploads/tickets'), { recursive: true });
  await database.authenticate();
  await initializeAuthentication();
  const app = createApplication();
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(configuration.port, '0.0.0.0', () => {
      instance.off('error', reject);
      console.log(`Server listening on port ${configuration.port}`);
      resolve(instance);
    });
    instance.once('error', reject);
  });
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try {
        await database.close();
        clearTimeout(timeout);
        process.exit(0);
      } catch (error) {
        console.error('Shutdown failed:', error);
        process.exit(1);
      }
    });
  }
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () => {
      void close();
    });
  return server;
}
if (require.main === module) {
  void startServer().catch(async (error: unknown) => {
    console.error(
      'Application startup failed:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    await database.close();
    process.exitCode = 1;
  });
}
