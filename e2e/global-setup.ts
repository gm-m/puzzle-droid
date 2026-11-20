import { preview } from 'vite';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  interface ProvidedContext {
    baseURL: string;
  }
}

export default async function setup(project: TestProject) {
  const server = await preview({
    configFile: false,
    build: { outDir: 'dist/chess-app/browser' },
    preview: { host: '127.0.0.1', port: 0 },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') {
    await server.close();
    throw new Error('Could not determine the address of the E2E preview server.');
  }
  project.provide('baseURL', `http://127.0.0.1:${address.port}`);
  return () => server.close();
}
