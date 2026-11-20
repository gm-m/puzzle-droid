import type { Page } from 'playwright';
import { expect } from 'vitest';
import { test } from './browser-fixture';

const bookmarkTitle = 'E2E Bookmark';
const updatedBookmarkTitle = 'E2E Bookmark Updated';
const bookmarkNote = 'Creato da Playwright';
const updatedBookmarkNote = 'Aggiornato da Playwright';

async function openAnalysisBookmarkModal(page: Page) {
  const analysisPanel = page.locator('app-analysis-panel.analysis-workspace-panel');
  await analysisPanel.getByRole('button', { name: 'Salva la posizione nei bookmark' }).click();
  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  await expect.poll(() => dialog.isVisible()).toBe(true);
}

async function goToBookmarksTab(page: Page) {
  await page.getByRole('link', { name: 'Libreria' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/library/);
  const heading = page.getByRole('heading', { name: 'Libreria', exact: true });
  const bookmarkTab = page.getByRole('button', { name: 'Bookmark', exact: true });
  await expect.poll(() => heading.isVisible()).toBe(true);
  await bookmarkTab.click();
  await expect.poll(() => bookmarkTab.getAttribute('aria-pressed')).toBe('true');
}

test('can create a bookmark from analysis and reopen it from library', async ({ page }) => {
  await openAnalysisBookmarkModal(page);

  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  const title = dialog.getByLabel('Titolo');
  await expect.poll(() => title.evaluate((element) => element.matches(':focus'))).toBe(true);
  await title.fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  await expect.poll(() => page.getByText(bookmarkTitle).isVisible()).toBe(true);
  await expect.poll(() => page.getByText(bookmarkNote).isVisible()).toBe(true);

  await page.locator('.bookmark-open').filter({ hasText: bookmarkTitle }).click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/analysis/);
  const engineHeading = page.getByRole('heading', { name: 'Varianti engine' });
  await expect.poll(() => engineHeading.isVisible()).toBe(true);
  await expect.poll(() => page.getByRole('link', { name: 'Analisi' }).isVisible()).toBe(true);
});

test('can edit and delete a bookmark from library', async ({ page }) => {
  await openAnalysisBookmarkModal(page);

  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  const title = dialog.getByLabel('Titolo');
  await expect.poll(() => title.evaluate((element) => element.matches(':focus'))).toBe(true);
  await title.fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  const bookmarkCard = page.locator('.bookmark-card').filter({ hasText: bookmarkTitle });
  await bookmarkCard.getByRole('button', { name: 'Modifica' }).click();
  const editForm = page.locator('.bookmark-edit');
  await expect.poll(() => editForm.isVisible()).toBe(true);

  await editForm.getByLabel('Titolo').fill(updatedBookmarkTitle);
  await editForm.getByLabel('Nota breve').fill(updatedBookmarkNote);
  await editForm.getByRole('button', { name: 'Salva' }).click();

  await expect.poll(() => page.getByText(updatedBookmarkTitle).isVisible()).toBe(true);
  await expect.poll(() => page.getByText(updatedBookmarkNote).isVisible()).toBe(true);

  const updatedCard = page.locator('.bookmark-card').filter({ hasText: updatedBookmarkTitle });
  await updatedCard.getByRole('button', { name: 'Elimina' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Eliminare il bookmark?' });
  await expect.poll(() => confirmDialog.isVisible()).toBe(true);
  await confirmDialog.getByRole('button', { name: 'Elimina' }).click();

  await expect.poll(() => updatedCard.count()).toBe(0);
  await expect.poll(() => page.getByText('Nessun bookmark', { exact: true }).isVisible()).toBe(true);
});
