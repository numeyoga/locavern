import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import './styles/app.css';

/** @import { LocalRef, ActiveView, AssetMeta, Note, Task, TaskDueFilter, TaskPriority, TaskStatus, TaskStatusFilter, Whiteboard } from './types.d.ts' */

import { getTodayIsoDate } from './core/dates.js';
import { getTaskStatusMeta } from './core/model.js';
import {
  extractNoteSearchText,
  extractTaskSearchText,
  extractWhiteboardSearchText,
} from './core/search.js';
import {
  createStore,
  selectOrphanedAssetIds,
  selectProjectById,
  selectReferencedAssetIds,
} from './core/store.js';
import { buildArchiveZipBlob, validateImageFile } from './adapters/archive-file.js';
import { buildBackupPayload } from './core/backup.js';
import { createDirectoryBackup } from './core/directory-backup.js';
import { MAX_ARCHIVE_BYTES, validateBackupData } from './core/schema.js';
import {
  checkDirectoryPermission,
  getDirectoryBackupInfo,
  getDirectoryTarget,
  initializeExportDirectory,
  recordDirectoryBackup,
  subscribeExportDirectory,
  writeDirectoryBackup,
} from './adapters/export-directory.js';
import {
  acquireWriteLock,
  applyStoreEffects,
  inspectStorageStatus,
  loadAssetBlob,
  loadAllAssetBlobs,
  loadHydrationPayload,
  onWriteLockReleased,
  openLocavernDb,
  saveAssetBlob,
  waitForWriteLock,
} from './adapters/storage-idb.js';
import { setupServiceWorkerUpdates } from './adapters/sw-update.js';
import { hideAllTooltips, initTooltips, setTooltip } from './adapters/dom/tooltip.js';
import {
  initCovenant,
  notify,
  openDialogById,
  renderReadOnlyBanner,
  renderSwUpdateBanner,
  setToastDurationSeconds,
  syncNavigationChrome,
  toggleColorScheme,
  wireAppShell,
} from './adapters/dom/app-shell.js';
import { wireBackupModal } from './adapters/dom/backup-modal.js';
import { renderCalendarView } from './adapters/dom/calendar-view.js';
import { renderKanbanView } from './adapters/dom/kanban-view.js';
import { openNoteDialog } from './adapters/dom/note-dialog.js';
import { renderNotesView } from './adapters/dom/notes-view.js';
import { wirePreferencesModal } from './adapters/dom/preferences-modal.js';
import { openProjectModal, renderProjectsView } from './adapters/dom/project-view.js';
import { wireStatusModal } from './adapters/dom/status-modal.js';
import { wireTrashModal } from './adapters/dom/trash-modal.js';
import { openTaskDrawer } from './adapters/dom/task-drawer.js';
import { renderTaskListView } from './adapters/dom/task-list-view.js';
import { renderTodayView } from './adapters/dom/today-view.js';
import { openWhiteboardDialog } from './adapters/dom/whiteboard-dialog.js';
import { renderWhiteboardView } from './adapters/dom/whiteboard-view.js';

const APP_VERSION = '0.2.0';

async function bootstrap() {
  const viewContainer = document.getElementById('app-view');
  if (!viewContainer) return;
  const rootView = viewContainer;

  const db = await openLocavernDb();
  await initializeExportDirectory(db);
  let lockHandle = await acquireWriteLock();
  const payload = await loadHydrationPayload(db);
  await inspectStorageStatus({ requestPersist: lockHandle.acquired });

  const store = createStore();
  store.dispatch({
    type: 'hydrate',
    payload: {
      ...payload,
      readOnly: !lockHandle.acquired,
    },
  });
  setToastDurationSeconds(store.getState().preferences.toastDurationSeconds);

  /** @type {Map<string, string>} */
  const assetUrlCache = new Map();

  /** @param {string} assetId */
  function revokeAssetUrl(assetId) {
    const cachedUrl = assetUrlCache.get(assetId);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      assetUrlCache.delete(assetId);
    }
  }

  function revokeAllAssetUrls() {
    for (const url of assetUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    assetUrlCache.clear();
  }

  /** @type {ReadonlySet<string>} */
  const ASSET_MUTATING_COMMANDS = new Set([
    'delete_project',
    'delete_task',
    'update_task',
    'delete_note',
    'update_note',
    'delete_whiteboard',
    'update_whiteboard',
    'purge_trash_item',
    'empty_trash',
    'purge_expired_trash',
  ]);

  /**
   * Purge unreferenced local assets from store state and IndexedDB.
   * @param {Iterable<string>} [candidateIds]
   */
  function purgeOrphanedAssets(candidateIds) {
    const current = store.getState();
    if (current.readOnly || current.assets.length === 0) return;
    const orphaned = selectOrphanedAssetIds(current, candidateIds);
    for (const id of orphaned) {
      revokeAssetUrl(id);
      store.dispatch({ type: 'delete_asset', id });
    }
  }

  /**
   * Resolve a local IndexedDB assetId into an object URL (never external).
   * @param {string} assetId
   * @returns {Promise<string | null>}
   */
  async function resolveAssetUrl(assetId) {
    const cached = assetUrlCache.get(assetId);
    if (cached) return cached;
    const blob = await loadAssetBlob(db, assetId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    assetUrlCache.set(assetId, url);
    return url;
  }

  /**
   * Validate, store in IndexedDB, and register a local image File.
   * @param {File} file
   * @returns {Promise<{ assetId: string; alt: string } | null>}
   */
  async function uploadLocalImage(file) {
    if (store.getState().readOnly) {
      notify({
        status: 'warning',
        title: 'Mode lecture seule',
        text: 'Impossible d’ajouter une image tant qu’un autre onglet détient le verrou.',
      });
      return null;
    }
    const validation = validateImageFile(file);
    if (!validation.ok) {
      notify({
        status: 'danger',
        title: 'Image refusée',
        text: validation.error,
      });
      return null;
    }
    const assetId = crypto.randomUUID();
    const now = new Date().toISOString();
    /** @type {AssetMeta} */
    const meta = Object.freeze({
      id: assetId,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
      filename: (file.name || 'image-locale').slice(0, 255),
      createdAt: now,
    });
    await saveAssetBlob(db, meta, file);
    assetUrlCache.set(assetId, URL.createObjectURL(file));
    store.dispatch({ type: 'register_asset', asset: meta });
    return { assetId, alt: meta.filename };
  }

  /** @type {{ archiveFilter: 'all' | 'active' | 'archived' }} */
  const projectsFilters = {
    archiveFilter: 'all',
  };
  /** @type {{ query: string; status: TaskStatusFilter; priority: TaskPriority | 'all'; tag: string | 'all'; sortBy: 'position' | 'dueDate' | 'priority' }} */
  const taskListFilters = {
    query: '',
    status: 'all',
    priority: 'all',
    tag: 'all',
    sortBy: 'position',
  };
  /** @type {{ query: string; priority: TaskPriority | 'all'; due: TaskDueFilter; tag: string | 'all' }} */
  const kanbanFilters = {
    query: '',
    priority: 'all',
    due: 'all',
    tag: 'all',
  };
  /** @type {{ projectId: string | null | 'all'; query: string; tag: string | 'all' }} */
  const notesFilters = {
    projectId: 'all',
    query: '',
    tag: 'all',
  };
  /** @type {{ projectId: string | null | 'all'; query: string }} */
  const whiteboardsFilters = {
    projectId: 'all',
    query: '',
  };
  /** @type {{ mode: 'month' | 'week'; anchorDate: string; focusTaskId: string | null }} */
  const calendarState = {
    mode: 'month',
    anchorDate: getTodayIsoDate(),
    focusTaskId: null,
  };

  /** @type {{ flush: () => void; flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
  let notesViewHandle = null;
  /** @type {{ flush: () => void; flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
  let whiteboardViewHandle = null;

  function flushActiveViewHandles() {
    if (notesViewHandle) {
      notesViewHandle.flushAndDestroy();
      notesViewHandle = null;
    }
    if (whiteboardViewHandle) {
      whiteboardViewHandle.flushAndDestroy();
      whiteboardViewHandle = null;
    }
  }

  /**
   * Jump directly to a linked local Task, Note, or Whiteboard across projects and views.
   * @param {LocalRef} ref
   */
  function handleNavigateLocalRef(ref) {
    const s = store.getState();
    flushActiveViewHandles();
    if (ref.kind === 'task') {
      const target = s.tasks.find((t) => t.id === ref.id);
      if (!target) return;
      if (s.preferences.selectedProjectId && s.preferences.selectedProjectId !== target.projectId) {
        store.dispatch({ type: 'select_project', projectId: target.projectId });
      }
      store.dispatch({ type: 'set_view', view: 'tasks' });
      handleOpenTaskDrawer(target);
      return;
    }
    if (ref.kind === 'note') {
      const target = s.notes.find((n) => n.id === ref.id);
      if (!target) return;
      notesFilters.projectId = 'all';
      notesFilters.query = '';
      notesFilters.tag = 'all';
      store.dispatch({ type: 'select_note', noteId: target.id });
      store.dispatch({ type: 'set_view', view: 'notes' });
      return;
    }
    if (ref.kind === 'whiteboard') {
      const target = s.whiteboards.find((w) => w.id === ref.id);
      if (!target) return;
      whiteboardsFilters.projectId = 'all';
      whiteboardsFilters.query = '';
      store.dispatch({ type: 'select_whiteboard', whiteboardId: target.id });
      store.dispatch({ type: 'set_view', view: 'whiteboards' });
    }
  }

  /**
   * @param {Task} [task]
   * @param {TaskStatus | null} [defaultStatus]
   * @param {string | null} [defaultDueDate]
   */
  function handleOpenTaskDrawer(task, defaultStatus, defaultDueDate) {
    openTaskDrawer({
      store,
      task,
      defaultStatus,
      defaultDueDate,
      resolveAssetUrl,
      uploadLocalImage,
      onNavigateLocalRef: handleNavigateLocalRef,
    });
  }

  /**
   * @param {{ note?: Note; defaultProjectId?: string | null }} [opts]
   */
  function handleOpenNoteDialog(opts = {}) {
    openNoteDialog({
      store,
      note: opts.note,
      defaultProjectId: opts.defaultProjectId,
      resolveAssetUrl,
      uploadLocalImage,
      onNavigateLocalRef: handleNavigateLocalRef,
      onAfterCreate() {
        if (store.getState().preferences.activeView !== 'notes') {
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'notes' });
        }
      },
    });
  }

  /**
   * @param {{ whiteboard?: Whiteboard; defaultProjectId?: string | null }} [opts]
   */
  function handleOpenWhiteboardDialog(opts = {}) {
    openWhiteboardDialog({
      store,
      whiteboard: opts.whiteboard,
      defaultProjectId: opts.defaultProjectId,
      onAfterCreate() {
        if (store.getState().preferences.activeView !== 'whiteboards') {
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        }
      },
    });
  }

  function renderCurrentViewContent() {
    const state = store.getState();
    const activeView = state.preferences.activeView;
    syncNavigationChrome(activeView);
    renderReadOnlyBanner(state.readOnly, () => {
      void retryAcquireLock();
    });

    if (activeView !== 'notes' && notesViewHandle) {
      notesViewHandle.flushAndDestroy();
      notesViewHandle = null;
    }
    if (activeView !== 'whiteboards' && whiteboardViewHandle) {
      whiteboardViewHandle.flushAndDestroy();
      whiteboardViewHandle = null;
    }

    if (activeView === 'today') {
      renderTodayView({
        container: rootView,
        store,
        onOpenTask: (task) => handleOpenTaskDrawer(task),
        onOpenNote(note) {
          flushActiveViewHandles();
          notesFilters.projectId = 'all';
          notesFilters.query = '';
          store.dispatch({ type: 'select_note', noteId: note.id });
          store.dispatch({ type: 'set_view', view: 'notes' });
        },
        onOpenWhiteboard(wb) {
          flushActiveViewHandles();
          whiteboardsFilters.projectId = 'all';
          whiteboardsFilters.query = '';
          store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        },
        onNewTask() {
          if (store.getState().readOnly) return;
          if (store.getState().projects.length === 0) {
            openProjectModal({ store });
          } else {
            handleOpenTaskDrawer(
              undefined,
              store.getState().preferences.taskStatuses[0]?.id ?? null,
            );
          }
        },
        onNewNote() {
          if (store.getState().readOnly) return;
          handleOpenNoteDialog({
            defaultProjectId: store.getState().preferences.selectedProjectId ?? null,
          });
        },
        onNewWhiteboard() {
          if (store.getState().readOnly) return;
          handleOpenWhiteboardDialog({
            defaultProjectId: store.getState().preferences.selectedProjectId ?? null,
          });
        },
      });
      return;
    }

    if (activeView === 'projects') {
      renderProjectsView({
        container: rootView,
        store,
        filters: projectsFilters,
        onOpenProjectNotes(projectId) {
          notesFilters.projectId = projectId;
          notesFilters.query = '';
          store.dispatch({ type: 'select_project', projectId });
          store.dispatch({ type: 'set_view', view: 'notes' });
        },
        onOpenProjectWhiteboards(projectId) {
          whiteboardsFilters.projectId = projectId;
          whiteboardsFilters.query = '';
          store.dispatch({ type: 'select_project', projectId });
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
        },
      });
      return;
    }

    if (activeView === 'calendar') {
      renderCalendarView({
        container: rootView,
        store,
        calendarState,
        onOpenTask: (task) => handleOpenTaskDrawer(task),
        onNewTask: (defaultDueDate) => {
          handleOpenTaskDrawer(
            undefined,
            store.getState().preferences.taskStatuses[0]?.id ?? null,
            defaultDueDate ?? null,
          );
        },
        onOpenNewProject: () => openProjectModal({ store }),
      });
      return;
    }

    if (activeView === 'notes') {
      notesViewHandle?.flushAndDestroy();
      notesViewHandle = renderNotesView({
        container: rootView,
        store,
        filters: notesFilters,
        resolveAssetUrl,
        uploadLocalImage,
        onOpenNoteDialog: handleOpenNoteDialog,
        onNavigateLocalRef: handleNavigateLocalRef,
      });
      return;
    }

    if (activeView === 'whiteboards') {
      whiteboardViewHandle?.flushAndDestroy();
      whiteboardViewHandle = renderWhiteboardView({
        container: rootView,
        store,
        filters: whiteboardsFilters,
        resolveAssetUrl,
        uploadLocalImage,
        onOpenWhiteboardDialog: handleOpenWhiteboardDialog,
        onNavigateLocalRef: handleNavigateLocalRef,
      });
      return;
    }

    if (state.preferences.taskDisplayMode === 'kanban') {
      renderKanbanView({
        container: rootView,
        store,
        filters: kanbanFilters,
        onOpenNewProject: () => openProjectModal({ store }),
        onOpenTaskDrawer: handleOpenTaskDrawer,
      });
      return;
    }

    renderTaskListView({
      container: rootView,
      store,
      filters: taskListFilters,
      onOpenNewProject: () => openProjectModal({ store }),
      onOpenTaskDrawer: handleOpenTaskDrawer,
    });
  }

  function renderCurrentView() {
    hideAllTooltips();
    renderCurrentViewContent();
    initTooltips(rootView);
  }

  /** @type {() => void} */
  let cancelLockWait = () => {};

  /**
   * Promote this tab from read-only to editable once the exclusive write lock is held.
   * @param {{ acquired: boolean; release: () => void }} nextLock
   */
  async function promoteWithLock(nextLock) {
    if (lockHandle.acquired) {
      nextLock.release();
      return;
    }
    lockHandle = nextLock;
    cancelLockWait();
    cancelLockWait = () => {};
    const fresh = await loadHydrationPayload(db);
    await initializeExportDirectory(db);
    directoryBackup.directoryChanged(getDirectoryBackupInfo().lastSavedAt);
    store.dispatch({
      type: 'hydrate',
      payload: { ...fresh, readOnly: false },
    });
    notify({
      status: 'success',
      title: 'Édition rétablie',
      text: 'Cet onglet détient maintenant le verrou d’écriture.',
    });
  }

  async function retryAcquireLock() {
    if (lockHandle.acquired) return;
    const nextLock = await acquireWriteLock();
    if (!nextLock.acquired) {
      notify({
        status: 'warning',
        title: 'Verrou toujours actif',
        text: 'Un autre onglet utilise encore Locavern en écriture.',
      });
      return;
    }
    await promoteWithLock(nextLock);
  }

  if (!lockHandle.acquired) {
    cancelLockWait = waitForWriteLock((grantedLock) => {
      void promoteWithLock(grantedLock);
    });
  }

  const stopLockListener = onWriteLockReleased(() => {
    if (store.getState().readOnly) {
      void retryAcquireLock();
    }
  });

  // Serialize IndexedDB effect writes sequentially so rapid edits preserve order.
  let persistChain = Promise.resolve();
  let pendingWrites = 0;

  const directoryBackup = createDirectoryBackup({
    getTarget: getDirectoryTarget,
    canWrite: () => !store.getState().readOnly,
    checkPermission: checkDirectoryPermission,
    async buildSnapshot() {
      notesViewHandle?.flush();
      whiteboardViewHandle?.flush();
      await persistChain;
      const { manifest, data } = buildBackupPayload(store.getState(), {
        now: new Date().toISOString(),
        appVersion: APP_VERSION,
      });
      const checked = validateBackupData(data);
      if (!checked.ok) throw new Error(checked.error);
      const assetBlobs = await loadAllAssetBlobs(db);
      const blob = await buildArchiveZipBlob({ manifest, data, assetBlobs });
      if (blob.size > MAX_ARCHIVE_BYTES)
        throw new Error('La sauvegarde dépasse la limite de restauration de 25 Mio.');
      return blob;
    },
    write: writeDirectoryBackup,
    recordSuccess: recordDirectoryBackup,
  });
  const stopDirectoryListener = subscribeExportDirectory(() => directoryBackup.directoryChanged());
  const topbarBackupBtn = /** @type {HTMLButtonElement | null} */ (
    document.getElementById('topbar-backup-btn')
  );
  const topbarBackupStatus = document.getElementById('topbar-backup-status');
  function updateDirectoryBackupUi() {
    const { name } = getDirectoryBackupInfo();
    const state = directoryBackup.getState();
    const messages = {
      disconnected: 'Aucun dossier connecté',
      pending: 'Modifications à sauvegarder',
      saving: 'Sauvegarde en cours',
      saved: 'Sauvegardé dans le dossier',
      suspended: 'Accès au dossier à réautoriser',
      error: 'Échec de la sauvegarde',
      readonly: 'Sauvegarde gérée par l’onglet actif',
    };
    if (topbarBackupStatus) {
      topbarBackupStatus.textContent = name ? messages[state.status] : '';
      topbarBackupStatus.hidden = !name;
    }
    if (!topbarBackupBtn) return;
    const label = name
      ? `Sauvegarder maintenant — ${messages[state.status]}`
      : 'Sauvegardes et import/export';
    topbarBackupBtn.removeAttribute('data-cv-open');
    topbarBackupBtn.setAttribute('aria-label', label);
    topbarBackupBtn.disabled =
      Boolean(name) && (state.status === 'saving' || store.getState().readOnly);
    setTooltip(topbarBackupBtn, label);
    const icon = topbarBackupBtn.querySelector('i');
    if (icon) icon.className = `ph ${name ? 'ph-floppy-disk' : 'ph-export'} cv-icon`;
  }
  directoryBackup.subscribe(updateDirectoryBackupUi);
  directoryBackup.directoryChanged(getDirectoryBackupInfo().lastSavedAt);
  topbarBackupBtn?.addEventListener('click', async () => {
    if (!getDirectoryTarget()) {
      openDialogById('modal-backup');
      return;
    }
    const saved = await directoryBackup.saveNow();
    const state = directoryBackup.getState();
    notify({
      status: saved ? 'success' : 'warning',
      title: saved ? 'Sauvegarde enregistrée' : 'Sauvegarde suspendue ou en échec',
      text: saved
        ? 'Vos données ont été copiées dans le dossier connecté.'
        : state.error || 'Autorisez l’accès au dossier pour reprendre la sauvegarde.',
    });
  });

  store.subscribe(({ state, prevState, command, effects }) => {
    setToastDurationSeconds(state.preferences.toastDurationSeconds);

    if (effects.length > 0) {
      pendingWrites += 1;
      document.documentElement.dataset.persisting = 'true';
      persistChain = persistChain
        .then(() => applyStoreEffects(db, effects))
        .catch(() => {
          notify({
            status: 'danger',
            title: 'Erreur de persistance',
            text: 'Impossible d’enregistrer la modification dans IndexedDB.',
          });
        })
        .finally(() => {
          pendingWrites -= 1;
          if (pendingWrites <= 0) {
            pendingWrites = 0;
            delete document.documentElement.dataset.persisting;
          }
        });
      directoryBackup.markChanged();
    }
    if (command.type === 'set_read_only' || command.type === 'hydrate')
      directoryBackup.markChanged();
    updateDirectoryBackupUi();

    if (command.type === 'delete_project' || command.type === 'trash_project') {
      if (notesFilters.projectId === command.id) {
        notesFilters.projectId = 'all';
      }
      if (whiteboardsFilters.projectId === command.id) {
        whiteboardsFilters.projectId = 'all';
      }
    }

    if (command.type === 'replace_all') {
      notesFilters.projectId = 'all';
      notesFilters.query = '';
      notesFilters.tag = 'all';
      taskListFilters.tag = 'all';
      kanbanFilters.tag = 'all';
      whiteboardsFilters.projectId = 'all';
      whiteboardsFilters.query = '';
    }

    if (command.type === 'delete_asset') {
      revokeAssetUrl(command.id);
    } else if (ASSET_MUTATING_COMMANDS.has(command.type) && !state.readOnly) {
      purgeOrphanedAssets(selectReferencedAssetIds(prevState));
    }

    if (
      command.type === 'update_note' &&
      state.preferences.activeView === 'notes' &&
      prevState.preferences.activeView === 'notes' &&
      notesViewHandle?.isDispatchingInline()
    ) {
      // Notes inline autosave already preserves cursor/focus and updates sidebar title in place.
      return;
    }

    if (
      command.type === 'update_whiteboard' &&
      state.preferences.activeView === 'whiteboards' &&
      prevState.preferences.activeView === 'whiteboards' &&
      whiteboardViewHandle?.isDispatchingInline()
    ) {
      // Whiteboard inline autosave already preserves SVG focus and updates sidebar title in place.
      return;
    }

    if (
      command.type === 'register_asset' ||
      command.type === 'delete_asset' ||
      command.type === 'set_input_presentation' ||
      command.type === 'set_toast_duration' ||
      command.type === 'set_trash_retention_days' ||
      command.type === 'create_template' ||
      command.type === 'delete_template'
    ) {
      return;
    }

    renderCurrentView();
  });

  wireAppShell({
    onSelectView(/** @type {ActiveView} */ view) {
      flushActiveViewHandles();
      store.dispatch({ type: 'set_view', view });
    },
    getCommandItems() {
      const state = store.getState();
      const statuses = state.preferences.taskStatuses;
      const items = [];

      for (const project of state.projects) {
        items.push({
          value: `open:project:${project.id}`,
          label: project.name,
          meta: project.archived ? 'Projet (archivé)' : 'Projet',
          icon: 'ph-folder-open',
          searchText: `${project.name} ${project.description}`,
        });
      }

      for (const task of state.tasks) {
        const projName = selectProjectById(state, task.projectId)?.name ?? 'Projet';
        const statusLabel = getTaskStatusMeta(task.status, statuses).label;
        items.push({
          value: `open:task:${task.id}`,
          label: task.title,
          meta: `Tâche · ${projName} · ${statusLabel}`,
          icon: 'ph-check-square',
          searchText: `${extractTaskSearchText(task)} ${projName} ${statusLabel}`,
        });
      }

      for (const note of state.notes) {
        const projName = note.projectId ? selectProjectById(state, note.projectId)?.name : null;
        items.push({
          value: `open:note:${note.id}`,
          label: note.title,
          meta: projName ? `Note · ${projName}` : 'Note',
          icon: 'ph-notebook',
          searchText: `${extractNoteSearchText(note)} ${projName ?? ''}`,
        });
      }

      for (const wb of state.whiteboards) {
        const projName = wb.projectId ? selectProjectById(state, wb.projectId)?.name : null;
        items.push({
          value: `open:whiteboard:${wb.id}`,
          label: wb.title,
          meta: projName ? `Tableau blanc · ${projName}` : 'Tableau blanc',
          icon: 'ph-chalkboard-simple',
          searchText: `${extractWhiteboardSearchText(wb)} ${projName ?? ''}`,
        });
      }

      return items;
    },
    onCommand(commandId) {
      const state = store.getState();
      if (commandId.startsWith('open:project:')) {
        const id = commandId.slice('open:project:'.length);
        const project = state.projects.find((p) => p.id === id);
        if (!project) return;
        flushActiveViewHandles();
        store.dispatch({ type: 'select_project', projectId: project.id });
        store.dispatch({ type: 'set_view', view: 'tasks' });
        return;
      }
      if (commandId.startsWith('open:task:')) {
        const id = commandId.slice('open:task:'.length);
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        flushActiveViewHandles();
        if (
          state.preferences.selectedProjectId &&
          state.preferences.selectedProjectId !== task.projectId
        ) {
          store.dispatch({ type: 'select_project', projectId: task.projectId });
        }
        if (state.preferences.activeView !== 'tasks') {
          store.dispatch({ type: 'set_view', view: 'tasks' });
        }
        handleOpenTaskDrawer(task);
        return;
      }
      if (commandId.startsWith('open:note:')) {
        const id = commandId.slice('open:note:'.length);
        const note = state.notes.find((n) => n.id === id);
        if (!note) return;
        flushActiveViewHandles();
        if (notesFilters.projectId !== 'all' && notesFilters.projectId !== note.projectId) {
          notesFilters.projectId = 'all';
        }
        notesFilters.query = '';
        store.dispatch({ type: 'select_note', noteId: note.id });
        store.dispatch({ type: 'set_view', view: 'notes' });
        return;
      }
      if (commandId.startsWith('open:whiteboard:')) {
        const id = commandId.slice('open:whiteboard:'.length);
        const wb = state.whiteboards.find((w) => w.id === id);
        if (!wb) return;
        flushActiveViewHandles();
        if (
          whiteboardsFilters.projectId !== 'all' &&
          whiteboardsFilters.projectId !== wb.projectId
        ) {
          whiteboardsFilters.projectId = 'all';
        }
        whiteboardsFilters.query = '';
        store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
        store.dispatch({ type: 'set_view', view: 'whiteboards' });
        return;
      }

      switch (commandId) {
        case 'view:today':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'today' });
          break;
        case 'view:tasks':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'tasks' });
          break;
        case 'view:projects':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'projects' });
          break;
        case 'view:calendar':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'calendar' });
          break;
        case 'view:notes':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'notes' });
          break;
        case 'view:whiteboards':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'whiteboards' });
          break;
        case 'action:new-task':
          if (state.readOnly) return;
          if (state.projects.length === 0) {
            openProjectModal({ store });
          } else {
            handleOpenTaskDrawer(undefined, state.preferences.taskStatuses[0]?.id ?? null);
          }
          break;
        case 'action:new-project':
          if (state.readOnly) return;
          openProjectModal({ store });
          break;
        case 'action:new-note':
          if (state.readOnly) return;
          handleOpenNoteDialog({ defaultProjectId: state.preferences.selectedProjectId ?? null });
          break;
        case 'action:new-whiteboard':
          if (state.readOnly) return;
          handleOpenWhiteboardDialog({
            defaultProjectId: state.preferences.selectedProjectId ?? null,
          });
          break;
        case 'action:open-statuses':
          openDialogById('modal-statuses');
          break;
        case 'action:open-backup':
          openDialogById('modal-backup');
          break;
        case 'action:open-trash':
          openDialogById('modal-trash');
          break;
        case 'action:open-preferences':
          openDialogById('modal-preferences');
          break;
        case 'action:toggle-theme':
          toggleColorScheme();
          break;
      }
    },
  });

  if (!store.getState().readOnly) {
    const expiredBefore = store.getState().trash.length;
    const { state: afterPurge } = store.dispatch({
      type: 'purge_expired_trash',
      now: new Date().toISOString(),
    });
    if (afterPurge.trash.length < expiredBefore) {
      purgeOrphanedAssets();
    }
  }

  wireBackupModal({
    db,
    store,
    appVersion: APP_VERSION,
    directoryBackup,
    async onBeforeReplace() {
      flushActiveViewHandles();
      await persistChain;
      revokeAllAssetUrls();
    },
  });

  wirePreferencesModal({ store });
  wireStatusModal({ store });
  wireTrashModal({ store });

  /** @type {() => void} */
  let cleanupSwUpdates = () => {};

  window.addEventListener('beforeunload', () => {
    directoryBackup.dispose();
    stopDirectoryListener();
    cleanupSwUpdates();
    flushActiveViewHandles();
    cancelLockWait();
    stopLockListener();
    lockHandle.release();
    revokeAllAssetUrls();
  });

  initCovenant(document);
  purgeOrphanedAssets();
  renderCurrentView();

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const registerSw = () => {
      void setupServiceWorkerUpdates({
        register: () => navigator.serviceWorker.register('./sw.js', { scope: './' }),
        onUpdateReady(applyUpdate) {
          renderSwUpdateBanner(true, {
            onReload() {
              flushActiveViewHandles();
              applyUpdate();
            },
          });
        },
      }).then((dispose) => {
        cleanupSwUpdates = dispose;
      });
    };
    if (document.readyState === 'complete') {
      registerSw();
    } else {
      window.addEventListener('load', registerSw, { once: true });
    }
  }
}

void bootstrap();
