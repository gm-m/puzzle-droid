import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    include: ['e2e/**/*.spec.ts'],
    globalSetup: ['./e2e/global-setup.ts'],
    testTimeout: mode === 'debug' ? 0 : 30_000,
    expect: { poll: { timeout: 5_000 } },
    retry: process.env['CI'] && mode !== 'debug' ? 2 : 0,
    maxWorkers: 1,
    env: {
      E2E_MODE: mode,
      ...(mode === 'debug' ? { PWDEBUG: '1' } : {}),
    },
  },
}));
