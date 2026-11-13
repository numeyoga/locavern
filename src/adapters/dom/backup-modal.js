/** @import { AppCommand, AppState, StoreEffect } from '../../types.d.ts' */

import { buildBackupPayload } from '../../core/backup.js';
import { buildArchiveZipBlob, parseArchiveFile, triggerArchiveDownload } from '../archive-file.js';
import { inspectStorageStatus, loadAllAssetBlobs, replaceAllWithBlobs } from '../storage-idb.js';
import { closeDialogById, confirmAction, notify } from './app-shell.js';

/**
 * Format byte sizes into readable Kio / Mio labels.
 * @param {number | null} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === null) return 'Indisponible';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Kio`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mio`;
}

/**
 * Wire the Backup & Storage modal (#modal-backup).
 * @param {{
 *   db: import('idb').IDBPDatabase;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   appVersion: string;
 *   onBeforeReplace?: () => void;
 * }} opts
 */
export function wireBackupModal({ db, store, appVersion, onBeforeReplace }) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-backup'));
  const body = document.getElementById('modal-backup-body');
  if (!modal || !body) return;
  const modalBody = body;

  async function renderModalBody() {
    const state = store.getState();
    const storage = await inspectStorageStatus({ requestPersist: false });

    const statsSection = document.createElement('section');
    statsSection.className = 'lc-backup-section';

    const statsHead = document.createElement('div');
    statsHead.className = 'lc-view-header';
    const statsTitle = document.createElement('h3');
    statsTitle.className = 'cv-h4';
    statsTitle.style.margin = '0';
    statsTitle.textContent = 'État du stockage local';

    const persistBadge = document.createElement('span');
    persistBadge.className = storage.persisted
      ? 'cv-badge cv-badge--success'
      : 'cv-badge cv-badge--info';
    const dot = document.createElement('span');
    dot.className = 'cv-badge__dot';
    persistBadge.append(
      dot,
      document.createTextNode(storage.persisted ? 'Stockage persistant' : 'Stockage standard'),
    );
    statsHead.append(statsTitle, persistBadge);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'lc-backup-stats';

    /** @type {Array<[string, string]>} */
    const statItems = [
      ['Projets', String(state.projects.length)],
      ['Tâches', String(state.tasks.length)],
      ['Notes', String(state.notes.length)],
      ['Images locales', String(state.assets.length)],
      ['Espace utilisé', formatBytes(storage.usageBytes)],
      ['Quota estimé', formatBytes(storage.quotaBytes)],
    ];

    for (const [label, value] of statItems) {
      const box = document.createElement('div');
      box.className = 'lc-stat';
      const l = document.createElement('span');
      l.className = 'lc-stat__label';
      l.textContent = label;
      const v = document.createElement('span');
      v.className = 'lc-stat__value';
      v.textContent = value;
      box.append(l, v);
      statsGrid.append(box);
    }

    statsSection.append(statsHead, statsGrid);

    if (!storage.persisted && storage.supported && !state.readOnly) {
      const reqBtn = document.createElement('button');
      reqBtn.type = 'button';
      reqBtn.className = 'cv-btn cv-btn--sm';
      reqBtn.textContent = 'Demander la persistance au navigateur';
      reqBtn.addEventListener('click', async () => {
        const res = await inspectStorageStatus({ requestPersist: true });
        notify({
          status: res.persisted ? 'success' : 'info',
          title: res.persisted ? 'Persistance accordée' : 'Persistance non accordée',
          text: res.persisted
            ? 'Le navigateur protégera vos données locales contre l’effacement automatique.'
            : 'Le navigateur gère encore ce stockage comme standard. Pensez à exporter vos sauvegardes.',
        });
        await renderModalBody();
      });
      statsSection.append(reqBtn);
    }

    // Export section
    const exportSection = document.createElement('section');
    exportSection.className = 'lc-backup-section';
    const exportTitle = document.createElement('h3');
    exportTitle.className = 'cv-h4';
    exportTitle.style.margin = '0';
    exportTitle.textContent = 'Exporter une archive';
    const exportDesc = document.createElement('p');
    exportDesc.className = 'cv-caption';
    exportDesc.style.margin = '0';
    exportDesc.textContent =
      'Télécharge une archive ZIP contenant vos projets, tâches, notes et images locales en clair.';
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'cv-btn cv-btn--primary';
    exportBtn.id = 'btn-export-archive';
    const exportIcon = document.createElement('i');
    exportIcon.className = 'ph ph-download-simple cv-icon';
    exportIcon.setAttribute('aria-hidden', 'true');
    exportBtn.append(exportIcon, document.createTextNode(' Exporter l’archive ZIP'));
    exportBtn.addEventListener('click', async () => {
      try {
        const current = store.getState();
        const now = new Date().toISOString();
        const { manifest, data } = buildBackupPayload(current, { now, appVersion });
        const assetBlobs = await loadAllAssetBlobs(db);
        const zipBlob = await buildArchiveZipBlob({ manifest, data, assetBlobs });
        const datePart = now.slice(0, 10);
        triggerArchiveDownload(zipBlob, `locavern-sauvegarde-${datePart}.zip`);
        notify({
          status: 'success',
          title: 'Archive exportée',
          text: `${current.projects.length} projets, ${current.tasks.length} tâches et ${current.notes.length} notes inclus.`,
        });
      } catch {
        notify({
          status: 'danger',
          title: 'Échec de l’export',
          text: 'Impossible de générer l’archive ZIP depuis IndexedDB. Réessayez.',
        });
      }
    });
    exportSection.append(exportTitle, exportDesc, exportBtn);

    // Import section
    const importSection = document.createElement('section');
    importSection.className = 'lc-backup-section';
    const importTitle = document.createElement('h3');
    importTitle.className = 'cv-h4';
    importTitle.style.margin = '0';
    importTitle.textContent = 'Importer une archive';
    const importDesc = document.createElement('p');
    importDesc.className = 'cv-caption';
    importDesc.style.margin = '0';
    importDesc.textContent =
      'Restaure une sauvegarde ZIP validée et remplace les données actuelles après confirmation.';

    const fileField = document.createElement('div');
    fileField.className = 'cv-field';
    const fileLabel = document.createElement('label');
    fileLabel.className = 'cv-label';
    fileLabel.htmlFor = 'input-import-archive';
    fileLabel.textContent = 'Fichier de sauvegarde (.zip)';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'input-import-archive';
    fileInput.accept = '.zip,application/zip';
    fileInput.className = 'cv-input';
    fileInput.disabled = state.readOnly;
    fileField.append(fileLabel, fileInput);

    const importError = document.createElement('div');
    importError.className = 'cv-error';
    importError.hidden = true;

    fileInput.addEventListener('change', async () => {
      importError.hidden = true;
      importError.textContent = '';
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;

      const parsed = await parseArchiveFile(file);
      if (!parsed.ok) {
        importError.textContent = parsed.error;
        importError.hidden = false;
        return;
      }

      closeDialogById('modal-backup');
      const confirmed = await confirmAction({
        title: 'Remplacer les données locales ?',
        message: `Cette archive contient ${parsed.data.projects.length} projets, ${parsed.data.tasks.length} tâches, ${parsed.data.notes.length} notes et ${parsed.data.assets.length} images. Les données actuelles seront remplacées.`,
        confirmLabel: 'Importer et remplacer',
        danger: true,
      });
      if (!confirmed) return;

      onBeforeReplace?.();
      await replaceAllWithBlobs(db, parsed.data, parsed.blobs);
      store.dispatch({
        type: 'replace_all',
        payload: {
          projects: parsed.data.projects,
          tasks: parsed.data.tasks,
          notes: parsed.data.notes,
          assets: parsed.data.assets,
        },
      });
      notify({
        status: 'success',
        title: 'Sauvegarde restaurée',
        text: `${parsed.data.projects.length} projets et ${parsed.data.tasks.length} tâches importés.`,
      });
    });

    importSection.append(importTitle, importDesc, fileField, importError);

    // Reset section
    const resetSection = document.createElement('section');
    resetSection.className = 'lc-backup-section';
    const resetTitle = document.createElement('h3');
    resetTitle.className = 'cv-h4';
    resetTitle.style.margin = '0';
    resetTitle.textContent = 'Réinitialisation locale';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'cv-btn cv-btn--danger';
    resetBtn.id = 'btn-reset-all-data';
    resetBtn.disabled = state.readOnly;
    resetBtn.textContent = 'Effacer toutes les données locales';
    resetBtn.addEventListener('click', async () => {
      closeDialogById('modal-backup');
      const confirmed = await confirmAction({
        title: 'Effacer toutes les données locales ?',
        message:
          'Tous les projets, tâches, notes et images stockés sur cet appareil seront définitivement supprimés.',
        confirmLabel: 'Effacer tout',
        danger: true,
      });
      if (!confirmed) return;

      onBeforeReplace?.();
      const emptyPayload = { projects: [], tasks: [], notes: [], assets: [] };
      await replaceAllWithBlobs(db, emptyPayload, new Map());
      store.dispatch({ type: 'replace_all', payload: emptyPayload });
      notify({
        status: 'info',
        title: 'Données effacées',
        text: 'Le stockage local est maintenant vide.',
      });
    });
    resetSection.append(resetTitle, resetBtn);

    modalBody.replaceChildren(statsSection, exportSection, importSection, resetSection);
  }

  // Re-render whenever modal is opened
  const observer = new MutationObserver(() => {
    if (modal.open) {
      void renderModalBody();
    }
  });
  observer.observe(modal, { attributes: true, attributeFilter: ['open'] });

  modal.addEventListener('close', () => {
    modal.returnValue = '';
  });
}
