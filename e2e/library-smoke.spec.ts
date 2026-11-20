import { expect } from 'vitest';
import { test } from './browser-fixture';

test('can switch from analysis to library and see both library tabs', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Navigazione principale' });
  const currentPage = navigation.locator('[aria-current="page"]');
  const engineHeading = page.getByRole('heading', { name: 'Varianti engine' });
  const engineState = page.locator('.engine-state');
  await expect.poll(async () => (await currentPage.textContent())?.trim()).toBe('Analisi');
  await expect.poll(() => page.locator('app-analysis-panel').count()).toBe(1);
  await expect.poll(() => engineHeading.isVisible()).toBe(true);
  await expect.poll(() => engineState.textContent()).toMatch(/Pronto|Analisi in corso/);

  await navigation.getByRole('link', { name: 'Libreria' }).click();

  const libraryHeading = page.getByRole('heading', { name: 'Libreria', exact: true });
  await expect.poll(async () => (await currentPage.textContent())?.trim()).toBe('Libreria');
  await expect.poll(() => libraryHeading.isVisible()).toBe(true);
  await expect.poll(() => page.getByRole('button', { name: 'PGN', exact: true }).isVisible()).toBe(true);
  await expect.poll(() => page.getByRole('button', { name: 'Bookmark', exact: true }).isVisible()).toBe(true);
});

test('keeps a single analysis panel and prioritizes the board on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/analysis');

  const board = page.locator('.board-section');
  const engine = page.locator('.analysis-engine-region');
  await expect.poll(() => page.locator('app-analysis-panel').count()).toBe(1);
  await expect.poll(() => board.isVisible()).toBe(true);
  await expect.poll(() => engine.isVisible()).toBe(true);

  const boardBox = await board.boundingBox();
  const engineBox = await engine.boundingBox();
  expect(boardBox).not.toBeNull();
  expect(engineBox).not.toBeNull();
  expect(engineBox!.y).toBeGreaterThanOrEqual(boardBox!.y + boardBox!.height);
});
