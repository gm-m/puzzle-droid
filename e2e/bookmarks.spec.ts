import { expect, test } from '@playwright/test';

const bookmarkTitle = 'E2E Bookmark';
const updatedBookmarkTitle = 'E2E Bookmark Updated';
const bookmarkNote = 'Creato da Playwright';
const updatedBookmarkNote = 'Aggiornato da Playwright';

async function openAnalysisBookmarkModal(page: import('@playwright/test').Page) {
  const analysisPanel = page.locator('app-analysis-panel.analysis-workspace-panel');
  await analysisPanel.getByRole('button', { name: 'Salva la posizione nei bookmark' }).click();
  await expect(page.getByRole('dialog', { name: 'Salva bookmark posizione' })).toBeVisible();
}

async function goToBookmarksTab(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Libreria' }).click();
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole('heading', { name: 'Libreria', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bookmark', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bookmark', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto('/');
});

test('can create a bookmark from analysis and reopen it from library', async ({ page }) => {
  await openAnalysisBookmarkModal(page);

  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  await expect(dialog.getByLabel('Titolo')).toBeFocused();
  await dialog.getByLabel('Titolo').fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  await expect(page.getByText(bookmarkTitle)).toBeVisible();
  await expect(page.getByText(bookmarkNote)).toBeVisible();

  await page.locator('.bookmark-open').filter({ hasText: bookmarkTitle }).click();
  await expect(page).toHaveURL(/\/analysis/);
  await expect(page.getByRole('heading', { name: 'Varianti engine' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Analisi' })).toBeVisible();
});

test('can edit and delete a bookmark from library', async ({ page }) => {
  await openAnalysisBookmarkModal(page);

  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  await expect(dialog.getByLabel('Titolo')).toBeFocused();
  await dialog.getByLabel('Titolo').fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  const bookmarkCard = page.locator('.bookmark-card').filter({ hasText: bookmarkTitle });
  await bookmarkCard.getByRole('button', { name: 'Modifica' }).click();
  const editForm = page.locator('.bookmark-edit');
  await expect(editForm).toBeVisible();

  await editForm.getByLabel('Titolo').fill(updatedBookmarkTitle);
  await editForm.getByLabel('Nota breve').fill(updatedBookmarkNote);
  await editForm.getByRole('button', { name: 'Salva' }).click();

  await expect(page.getByText(updatedBookmarkTitle)).toBeVisible();
  await expect(page.getByText(updatedBookmarkNote)).toBeVisible();

  await page.locator('.bookmark-card').filter({ hasText: updatedBookmarkTitle }).getByRole('button', { name: 'Elimina' }).click();
  const confirmDialog = page.getByRole('dialog', { name: 'Eliminare il bookmark?' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Elimina' }).click();

  await expect(page.locator('.bookmark-card').filter({ hasText: updatedBookmarkTitle })).toHaveCount(0);
  await expect(page.getByText('Nessun bookmark', { exact: true })).toBeVisible();
});
