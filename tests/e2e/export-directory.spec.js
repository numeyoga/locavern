import { test, expect } from '@playwright/test';
import { parseArchiveFile } from '../../src/adapters/archive-file.js';

/** @param {import('@playwright/test').Page} page */
async function installFolderPicker(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () =>
        (await navigator.storage.getDirectory()).getDirectoryHandle('Sauvegardes-test', {
          create: true,
        }),
    });
    const query =
      /** @type {FileSystemHandle & { queryPermission: (options: unknown) => Promise<string> }} */ (
        FileSystemHandle.prototype
      ).queryPermission;
    Object.defineProperty(FileSystemHandle.prototype, 'queryPermission', {
      value: function (/** @type {unknown} */ options) {
        return localStorage.getItem('test-permission') === 'prompt'
          ? Promise.resolve('prompt')
          : query.call(this, options);
      },
    });
    Object.defineProperty(FileSystemHandle.prototype, 'requestPermission', {
      value: async () => {
        localStorage.removeItem('test-permission');
        return 'granted';
      },
    });
  });
}
/** @param {import('@playwright/test').Page} page */
async function readBackup(page) {
  const bytes = await page.evaluate(async () => {
    const folder = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle('Sauvegardes-test');
    const file = await (await folder.getFileHandle('locavern-sauvegarde.zip')).getFile();
    return Array.from(new Uint8Array(await file.arrayBuffer()));
  });
  const parsed = await parseArchiveFile(new Blob([new Uint8Array(bytes)]));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

test('copie immédiatement les données, sauvegarde les modifications et conserve la connexion après rechargement', async ({
  page,
}) => {
  await installFolderPicker(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.locator('#project-name-input').fill('Projet local');
  await page.locator('#modal-project button[type="submit"]').click();
  await page.locator('[data-nav-view="notes"]').click();
  await page.getByRole('button', { name: 'Créer une note' }).click();
  await page.locator('#note-dialog-title-input').fill('Note locale');
  await page.locator('#dialog-note button[type="submit"]').click();
  await page.locator('#nav-backup-btn').click();
  await page.locator('#btn-choose-export-directory').click();
  await expect(page.locator('#export-directory-status')).toHaveAttribute('data-status', 'saved');
  const first = await readBackup(page);
  expect(first.projects[0]?.name).toBe('Projet local');
  expect(first.notes[0]?.title).toBe('Note locale');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.locator('#note-title-input').fill('Modification automatique');
  await page.locator('#note-title-input').blur();
  await expect
    .poll(async () => (await readBackup(page)).notes[0]?.title, { timeout: 10000 })
    .toBe('Modification automatique');
  await page.locator('#note-title-input').fill('Sauvegarde immédiate');
  await page.locator('#topbar-backup-btn').click();
  await expect(page.locator('#modal-backup')).not.toBeVisible();
  await expect
    .poll(async () => (await readBackup(page)).notes[0]?.title)
    .toBe('Sauvegarde immédiate');
  await expect(page.locator('#topbar-backup-btn i')).toHaveClass(/ph-floppy-disk/);

  await page.reload();
  await expect(page.locator('#topbar-backup-status')).toBeVisible();
  await page.locator('#nav-backup-btn').click();
  await expect(page.locator('#export-directory-status')).toContainText('Sauvegardes-test');
  await expect(page.locator('#export-directory-status')).toContainText('Dernière écriture réussie');
  // A one-off archive is independent of the automatic backup file.
  const download = page.waitForEvent('download');
  await page.locator('#btn-export-archive').click();
  expect((await download).suggestedFilename()).not.toBe('locavern-sauvegarde.zip');
  await page.locator('#btn-forget-export-directory').click();
  await expect(page.locator('#export-directory-status')).toHaveAttribute(
    'data-status',
    'disconnected',
  );
  expect((await readBackup(page)).notes[0]?.title).toBe('Sauvegarde immédiate');
});

test('suspend sans boîte de dialogue en arrière-plan puis réautorise au clic', async ({ page }) => {
  await installFolderPicker(page);
  await page.goto('/');
  await page.locator('#nav-backup-btn').click();
  await page.locator('#btn-choose-export-directory').click();
  await expect(page.locator('#export-directory-status')).toHaveAttribute('data-status', 'saved');
  await page.evaluate(() => localStorage.setItem('test-permission', 'prompt'));
  await page.reload();
  await expect(page.locator('#topbar-backup-status')).toContainText('réautoriser', {
    timeout: 10000,
  });
  await page.locator('#nav-backup-btn').click();
  await expect(page.locator('#btn-save-directory-now')).toHaveText('Réautoriser et sauvegarder');
  await page.locator('#btn-save-directory-now').click();
  await expect(page.locator('#export-directory-status')).toHaveAttribute('data-status', 'saved');
});

test('explique le téléchargement classique lorsque les dossiers sont indisponibles', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });
  });
  await page.goto('/');
  await page.locator('#topbar-backup-btn').click();
  await expect(page.locator('#export-directory-status')).toContainText('téléchargement classique');
  await expect(page.locator('#btn-choose-export-directory')).toHaveCount(0);
});

test('restaure aussi modèles, corbeille, préférences et liens dans IndexedDB après rechargement', async ({
  page,
}) => {
  await installFolderPicker(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Créer un projet' })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise(
      /** @param {(db: IDBDatabase) => void} resolve */ (resolve) => {
        const request = indexedDB.open('locavern-db');
        request.onsuccess = () => resolve(request.result);
      },
    );
    const now = new Date().toISOString();
    const project = {
      id: 'p',
      name: 'Projet complet',
      description: '',
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    const task = {
      id: 't',
      projectId: 'p',
      title: 'Tâche liée',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      position: 0,
      descriptionDoc: { type: 'doc', content: [] },
      checklist: [],
      tags: [],
      links: [],
      assetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const note = {
      id: 'n',
      projectId: 'p',
      title: 'Note complète',
      contentDoc: { type: 'doc', content: [] },
      tags: ['important'],
      links: [{ kind: 'task', id: 't' }],
      assetIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const tx = db.transaction(
      ['projects', 'tasks', 'notes', 'templates', 'trash', 'meta'],
      'readwrite',
    );
    tx.objectStore('projects').put(project);
    tx.objectStore('tasks').put(task);
    tx.objectStore('notes').put(note);
    tx.objectStore('templates').put({
      id: 'model',
      kind: 'checklist',
      name: 'Modèle conservé',
      checklistItems: ['Étape'],
      createdAt: now,
    });
    tx.objectStore('trash').put({
      id: 'trash',
      kind: 'note',
      title: 'Note supprimée',
      deletedAt: now,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      projectId: null,
      assetIds: [],
      note: { ...note, id: 'deleted', projectId: null },
    });
    tx.objectStore('meta').put({
      key: 'preferences',
      value: {
        activeView: 'notes',
        toastDurationSeconds: 9,
        trashRetentionDays: 90,
        selectedNoteId: 'n',
      },
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  });
  await page.reload();
  await page.locator('#nav-backup-btn').click();
  await page.locator('#btn-choose-export-directory').click();
  await expect(page.locator('#export-directory-status')).toHaveAttribute('data-status', 'saved');
  const saved = await readBackup(page);
  expect(saved.templates?.[0]?.name).toBe('Modèle conservé');
  expect(saved.trash).toHaveLength(1);
  const bytes = await page.evaluate(async () => {
    const folder = await (
      await navigator.storage.getDirectory()
    ).getDirectoryHandle('Sauvegardes-test');
    return Array.from(
      new Uint8Array(
        await (
          await (await folder.getFileHandle('locavern-sauvegarde.zip')).getFile()
        ).arrayBuffer(),
      ),
    );
  });
  await page.locator('#btn-forget-export-directory').click();
  await page.locator('#btn-reset-all-data').click();
  await page.locator('#modal-confirm').getByRole('button', { name: 'Effacer tout' }).click();
  await page.locator('#nav-backup-btn').click();
  await page.locator('#input-import-archive').evaluate((input, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(bytes)], 'sauvegarde.zip', { type: 'application/zip' }),
    );
    /** @type {HTMLInputElement} */ (input).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, bytes);
  await page.locator('#btn-confirm-import-archive').click();
  await page
    .locator('#modal-confirm')
    .getByRole('button', { name: 'Importer et remplacer' })
    .click();
  await expect(page.locator('#note-title-input')).toHaveValue('Note complète');
  await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');
  await page.reload();
  const stored = await page.evaluate(async () => {
    const db = await new Promise(
      /** @param {(db: IDBDatabase) => void} resolve */ (resolve) => {
        const request = indexedDB.open('locavern-db');
        request.onsuccess = () => resolve(request.result);
      },
    );
    const tx = db.transaction(['notes', 'templates', 'trash', 'meta'], 'readonly');
    const read = (/** @type {string} */ store, /** @type {string} */ key) =>
      new Promise(
        /** @param {(record: any) => void} resolve */ (resolve) => {
          const request = tx.objectStore(store).get(key);
          request.onsuccess = () => resolve(request.result);
        },
      );
    const [note, template, trash, preferences] = await Promise.all([
      read('notes', 'n'),
      read('templates', 'model'),
      read('trash', 'trash'),
      read('meta', 'preferences'),
    ]);
    db.close();
    return { note, template, trash, preferences };
  });
  expect(stored.note.tags).toEqual(['important']);
  expect(stored.note.links).toEqual([{ kind: 'task', id: 't' }]);
  expect(stored.template.name).toBe('Modèle conservé');
  expect(stored.trash.note.title).toBe('Note complète');
  expect(stored.preferences.value.toastDurationSeconds).toBe(9);
  expect(stored.preferences.value.trashRetentionDays).toBe(90);
});
