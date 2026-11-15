import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/bold';
import './styles/app.css';

/** @import { ActiveView, AssetMeta, Note, Task, TaskPriority, TaskStatus, TaskStatusFilter, Whiteboard } from './types.d.ts' */

import { createStore } from './core/store.js';
import { validateImageFile } from './adapters/archive-file.js';
import {
  acquireWriteLock,
  applyStoreEffects,
  inspectStorageStatus,
  loadAssetBlob,
  loadHydrationPayload,
  onWriteLockReleased,
  openLocavernDb,
  saveAssetBlob,
  waitForWriteLock,
} from './adapters/storage-idb.js';
import {
  initCovenant,
  notify,
  openDialogById,
  renderReadOnlyBanner,
  setToastDurationSeconds,
  syncNavigationChrome,
  toggleColorScheme,
  wireAppShell,
} from './adapters/dom/app-shell.js';
import { wireBackupModal } from './adapters/dom/backup-modal.js';
import { renderKanbanView } from './adapters/dom/kanban-view.js';
import { openNoteDialog } from './adapters/dom/note-dialog.js';
import { renderNotesView } from './adapters/dom/notes-view.js';
import { wirePreferencesModal } from './adapters/dom/preferences-modal.js';
import { openProjectModal, renderProjectsView } from './adapters/dom/project-view.js';
import { wireStatusModal } from './adapters/dom/status-modal.js';
import { openTaskDrawer } from './adapters/dom/task-drawer.js';
import { renderTaskListView } from './adapters/dom/task-list-view.js';
import { openWhiteboardDialog } from './adapters/dom/whiteboard-dialog.js';
import { renderWhiteboardView } from './adapters/dom/whiteboard-view.js';

const APP_VERSION = '0.2.0';

async function bootstrap() {
  const viewContainer = document.getElementById('app-view');
  if (!viewContainer) return;
  const rootView = viewContainer;

  const db = await openLocavernDb();
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

  function revokeAllAssetUrls() {
    for (const url of assetUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    assetUrlCache.clear();
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

  /** @type {{ query: string; status: TaskStatusFilter; priority: TaskPriority | 'all'; sortBy: 'position' | 'dueDate' | 'priority' }} */
  const taskListFilters = {
    query: '',
    status: 'all',
    priority: 'all',
    sortBy: 'position',
  };
  let kanbanQuery = '';
  /** @type {{ projectId: string | null | 'all'; query: string }} */
  const notesFilters = {
    projectId: 'all',
    query: '',
  };
  /** @type {{ projectId: string | null | 'all'; query: string }} */
  const whiteboardsFilters = {
    projectId: 'all',
    query: '',
  };

  /** @type {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
  let notesViewHandle = null;
  /** @type {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean } | null} */
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
   * @param {Task} [task]
   * @param {TaskStatus | null} [defaultStatus]
   */
  function handleOpenTaskDrawer(task, defaultStatus) {
    openTaskDrawer({
      store,
      task,
      defaultStatus,
      resolveAssetUrl,
      uploadLocalImage,
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

  function renderCurrentView() {
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

    if (activeView === 'projects') {
      renderProjectsView({
        container: rootView,
        store,
        onOpenProjectNotes(projectId) {
          notesFilters.projectId = projectId;
          notesFilters.query = '';
          store.dispatch({ type: 'select_project', projectId });
          store.dispatch({ type: 'set_view', view: 'notes' });
        },
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
      });
      return;
    }

    if (state.preferences.taskDisplayMode === 'kanban') {
      renderKanbanView({
        container: rootView,
        store,
        query: kanbanQuery,
        onQueryChange(next) {
          kanbanQuery = next;
        },
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
    }

    if (command.type === 'delete_project') {
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
      whiteboardsFilters.projectId = 'all';
      whiteboardsFilters.query = '';
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
      command.type === 'set_input_presentation' ||
      command.type === 'set_toast_duration'
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
    onCommand(commandId) {
      const state = store.getState();
      switch (commandId) {
        case 'view:tasks':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'tasks' });
          break;
        case 'view:projects':
          flushActiveViewHandles();
          store.dispatch({ type: 'set_view', view: 'projects' });
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
        case 'action:open-preferences':
          openDialogById('modal-preferences');
          break;
        case 'action:toggle-theme':
          toggleColorScheme();
          break;
      }
    },
  });

  wireBackupModal({
    db,
    store,
    appVersion: APP_VERSION,
    onBeforeReplace() {
      flushActiveViewHandles();
      revokeAllAssetUrls();
    },
  });

  wirePreferencesModal({ store });
  wireStatusModal({ store });

  window.addEventListener('beforeunload', () => {
    flushActiveViewHandles();
    cancelLockWait();
    stopLockListener();
    lockHandle.release();
    revokeAllAssetUrls();
  });

  initCovenant(document);
  renderCurrentView();

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const registerSw = () => {
      void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    };
    if (document.readyState === 'complete') {
      registerSw();
    } else {
      window.addEventListener('load', registerSw, { once: true });
    }
  }
}

void bootstrap();
