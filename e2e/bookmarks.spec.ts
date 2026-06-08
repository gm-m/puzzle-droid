import { expect, test } from '@playwright/test';

const bookmarkTitle = 'E2E Bookmark';
const updatedBookmarkTitle = 'E2E Bookmark Updated';
const bookmarkNote = 'Creato da Playwright';
const updatedBookmarkNote = 'Aggiornato da Playwright';

async function openAnalysisBookmarkModal(page: import('@playwright/test').Page) {
  const desktopPanel = page.locator('app-analysis-panel.analysis-panel-desktop');
  await desktopPanel.locator('button.engine-cog').click();
  await desktopPanel.getByRole('button', { name: 'Salva bookmark' }).click();
  await expect(page.getByRole('dialog', { name: 'Salva bookmark posizione' })).toBeVisible();
}

async function goToBookmarksTab(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Libreria' }).click();
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole('heading', { name: 'Libreria PGN' })).toBeVisible();
  await page.getByRole('button', { name: 'Bookmark' }).click();
  await expect(page.getByText('Consulta le posizioni salvate e riaprile rapidamente dalla libreria.')).toBeVisible();
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
  await dialog.getByLabel('Titolo').fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  await expect(page.getByText(bookmarkTitle)).toBeVisible();
  await expect(page.getByText(bookmarkNote)).toBeVisible();

  await page.locator('.bookmark-library-open').filter({ hasText: bookmarkTitle }).click();
  await expect(page).toHaveURL(/\/analysis/);
  await expect(page.getByRole('heading', { name: 'Engine lines' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analisi' })).toBeVisible();
});

test('can edit and delete a bookmark from library', async ({ page }) => {
  await openAnalysisBookmarkModal(page);

  const dialog = page.getByRole('dialog', { name: 'Salva bookmark posizione' });
  await dialog.getByLabel('Titolo').fill(bookmarkTitle);
  await dialog.getByLabel('Nota breve').fill(bookmarkNote);
  await page.getByRole('button', { name: 'Salva posizione corrente' }).click();

  await goToBookmarksTab(page);
  const bookmarkCard = page.locator('.bookmark-library-item').filter({ hasText: bookmarkTitle });
  await bookmarkCard.getByRole('button', { name: 'Modifica' }).click();
  const editForm = page.locator('.bookmark-library-edit');
  await expect(editForm).toBeVisible();

  await editForm.getByLabel('Titolo').fill(updatedBookmarkTitle);
  await editForm.getByLabel('Nota breve').fill(updatedBookmarkNote);
  await editForm.getByRole('button', { name: 'Salva' }).click();

  await expect(page.getByText(updatedBookmarkTitle)).toBeVisible();
  await expect(page.getByText(updatedBookmarkNote)).toBeVisible();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.locator('.bookmark-library-item').filter({ hasText: updatedBookmarkTitle }).getByRole('button', { name: 'Elimina' }).click();
  await expect(page.locator('.bookmark-library-item').filter({ hasText: updatedBookmarkTitle })).toHaveCount(0);
  await expect(page.getByText('Nessun bookmark salvato.')).toBeVisible();
});
