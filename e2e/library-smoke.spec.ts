import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto('/');
});

test('can switch from analysis to library and see both library tabs', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Analisi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Engine lines' })).toBeVisible();

  await page.getByRole('button', { name: 'Libreria' }).click();

  await expect(page.getByRole('heading', { name: 'Libreria PGN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PGN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bookmark' })).toBeVisible();
});
