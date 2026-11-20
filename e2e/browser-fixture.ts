import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, inject, test as base } from 'vitest';

let browser: Browser;

const mode = process.env['E2E_MODE'];

export const test = base.extend<{ page: Page }>({
  page: async ({}, use) => {
    const context = await browser.newContext({
      baseURL: inject('baseURL'),
      viewport: { width: 1280, height: 720 },
    });
    try {
      const page = await context.newPage();
      if (mode === 'debug') await page.pause();
      await page.goto('/');
      await use(page);
    } finally {
      await context.close();
    }
  },
});

beforeAll(async () => {
  browser = await chromium.launch({ headless: mode !== 'headed' && mode !== 'debug' });
});

afterAll(async () => {
  await browser?.close();
});
