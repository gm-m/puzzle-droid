import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto('/');
});

test('can switch from analysis to library and see both library tabs', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Navigazione principale' });
  const currentPage = navigation.locator('[aria-current="page"]');
  await expect(currentPage).toHaveText('Analisi');
  await expect(page.locator('app-analysis-panel')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Varianti engine' })).toBeVisible();
  await expect(page.locator('.engine-state')).toContainText(/Pronto|Analisi in corso/);

  await navigation.getByRole('link', { name: 'Libreria' }).click();

  await expect(currentPage).toHaveText('Libreria');
  await expect(page.getByRole('heading', { name: 'Libreria', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'PGN', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bookmark', exact: true })).toBeVisible();
});

test('keeps a single analysis panel and prioritizes the board on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/analysis');

  const board = page.locator('.board-section');
  const engine = page.locator('.analysis-engine-region');
  await expect(page.locator('app-analysis-panel')).toHaveCount(1);
  await expect(board).toBeVisible();
  await expect(engine).toBeVisible();

  const boardBox = await board.boundingBox();
  const engineBox = await engine.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(engineBox).not.toBeNull();
  expect(engineBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height);
});
