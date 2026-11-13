import { test, expect } from '@playwright/test';

test.describe('Persistance IndexedDB, Web Locks multi-onglets et sauvegarde ZIP (Étape 3)', () => {
  test('persiste après rechargement, verrouille le 2e onglet et restaure une archive ZIP', async ({
    context,
    page,
  }) => {
    await page.goto('/');

    // Créer un projet et une tâche dans l’onglet 1
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Persistance');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tâche durable');
    await page.locator('#drawer-task button[type="submit"]').click();
    await expect(page.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();

    // Ouvrir un 2e onglet pendant que le 1er détient le Web Lock
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#readonly-banner-slot')).toContainText('Mode lecture seule actif');
    await expect(page2.locator('#btn-new-task')).toBeDisabled();

    // Fermer le 1er onglet -> le 2e onglet reprend l’édition
    await page.close();
    await expect(page2.locator('#readonly-banner-slot')).toBeEmpty({ timeout: 5000 });
    await expect(page2.locator('#btn-new-task')).toBeEnabled();

    // Vérifier la persistance après rechargement sur l’onglet 2
    await page2.reload();
    await expect(page2.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();

    // Cycle complet Export ZIP -> Réinitialisation -> Import ZIP
    await page2.locator('#topbar-backup-btn').click();
    await expect(page2.locator('#modal-backup')).toHaveAttribute('open', '');

    const downloadPromise = page2.waitForEvent('download');
    await page2.locator('#btn-export-archive').click();
    const download = await downloadPromise;
    const zipPath = await download.path();
    expect(zipPath).toBeTruthy();

    // Réinitialiser toutes les données locales
    await page2.locator('#btn-reset-all-data').click();
    await page2.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();
    await expect(page2.getByText('Créez un premier projet pour commencer')).toBeVisible();

    // Importer l’archive ZIP précédemment exportée
    await page2.locator('#topbar-backup-btn').click();
    await page2.locator('#input-import-archive').setInputFiles(/** @type {string} */ (zipPath));
    await page2
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Importer et remplacer' })
      .click();

    await expect(page2.getByRole('button', { name: 'Tâche durable', exact: true })).toBeVisible();
  });
});
