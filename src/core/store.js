/** @import { AppCommand, AppPreferences, AppState, Note, Project, StoreEffect, Task, TaskPriority, TaskStatus } from '../types.d.ts' */

import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  collectDocAssetIds,
  createNote,
  createProject,
  createTask,
  normalizeChecklist,
  normalizeDueDate,
  sanitizeRichTextDoc,
} from './model.js';

/** @type {AppPreferences} */
const DEFAULT_PREFERENCES = Object.freeze({
  activeView: 'tasks',
  taskDisplayMode: 'list',
  selectedProjectId: null,
  selectedNoteId: null,
});

/**
 * Create the initial empty application state.
 * @returns {AppState}
 */
export function createInitialState() {
  return {
    schemaVersion: 1,
    readOnly: false,
    projects: [],
    tasks: [],
    notes: [],
    assets: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/**
 * Re-index task positions sequentially inside each (projectId, status) column.
 * @param {readonly Task[]} tasks
 * @param {string} projectId
 * @returns {{ tasks: Task[]; updated: Task[] }}
 */
function reindexProjectColumns(tasks, projectId) {
  /** @type {Task[]} */
  const updated = [];
  /** @type {Map<string, Task>} */
  const replacementMap = new Map();

  for (const status of TASK_STATUSES) {
    const colTasks = tasks
      .filter((t) => t.projectId === projectId && t.status === status)
      .sort((a, b) => a.position - b.position);
    colTasks.forEach((task, idx) => {
      if (task.position !== idx) {
        const nextTask = { ...task, position: idx };
        replacementMap.set(task.id, nextTask);
        updated.push(nextTask);
      }
    });
  }

  return {
    tasks: tasks.map((t) => replacementMap.get(t.id) ?? t),
    updated,
  };
}

/**
 * Pure state reducer returning the next immutable state and explicit persistence effects.
 * @param {AppState} state
 * @param {AppCommand} command
 * @returns {{ nextState: AppState; effects: StoreEffect[] }}
 */
export function reduce(state, command) {
  switch (command.type) {
    case 'hydrate': {
      const preferences = {
        ...DEFAULT_PREFERENCES,
        ...command.payload.preferences,
      };
      return {
        nextState: {
          schemaVersion: 1,
          readOnly: Boolean(command.payload.readOnly),
          projects: [...command.payload.projects],
          tasks: [...command.payload.tasks],
          notes: [...command.payload.notes],
          assets: [...command.payload.assets],
          preferences,
        },
        effects: [],
      };
    }

    case 'set_read_only': {
      if (state.readOnly === command.readOnly) {
        return { nextState: state, effects: [] };
      }
      return {
        nextState: { ...state, readOnly: command.readOnly },
        effects: [],
      };
    }

    case 'set_view': {
      if (state.preferences.activeView === command.view) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, activeView: command.view };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    case 'set_task_display_mode': {
      if (state.preferences.taskDisplayMode === command.mode) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, taskDisplayMode: command.mode };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    case 'select_project': {
      if (state.preferences.selectedProjectId === command.projectId) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, selectedProjectId: command.projectId };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    case 'select_note': {
      if (state.preferences.selectedNoteId === command.noteId) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, selectedNoteId: command.noteId };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    default:
      break;
  }

  if (state.readOnly) {
    return { nextState: state, effects: [] };
  }

  switch (command.type) {
    case 'create_project': {
      const project = createProject({
        id: command.id,
        name: command.name,
        description: command.description ?? '',
        now: command.now,
      });
      const selectedProjectId = state.preferences.selectedProjectId ?? project.id;
      const preferences =
        selectedProjectId !== state.preferences.selectedProjectId
          ? { ...state.preferences, selectedProjectId }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'persist_project', project }];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: [...state.projects, project],
          preferences,
        },
        effects,
      };
    }

    case 'update_project': {
      const existing = state.projects.find((p) => p.id === command.id);
      if (!existing) return { nextState: state, effects: [] };
      const cleanName = command.name.trim();
      if (!cleanName) throw new Error('Le nom du projet ne peut pas être vide.');
      const updated = Object.freeze({
        ...existing,
        name: cleanName.slice(0, 120),
        description: command.description.trim().slice(0, 1000),
        updatedAt: command.now,
      });
      return {
        nextState: {
          ...state,
          projects: state.projects.map((p) => (p.id === command.id ? updated : p)),
        },
        effects: [{ type: 'persist_project', project: updated }],
      };
    }

    case 'toggle_archive_project': {
      const existing = state.projects.find((p) => p.id === command.id);
      if (!existing) return { nextState: state, effects: [] };
      const updated = Object.freeze({
        ...existing,
        archived: command.archived,
        updatedAt: command.now,
      });
      return {
        nextState: {
          ...state,
          projects: state.projects.map((p) => (p.id === command.id ? updated : p)),
        },
        effects: [{ type: 'persist_project', project: updated }],
      };
    }

    case 'delete_project': {
      const exists = state.projects.some((p) => p.id === command.id);
      if (!exists) return { nextState: state, effects: [] };
      const deletedTaskIds = state.tasks.filter((t) => t.projectId === command.id).map((t) => t.id);
      /** @type {Note[]} */
      const updatedNotes = [];
      const nextNotes = state.notes.map((n) => {
        if (n.projectId === command.id) {
          const next = Object.freeze({ ...n, projectId: null });
          updatedNotes.push(next);
          return next;
        }
        return n;
      });
      const preferences =
        state.preferences.selectedProjectId === command.id
          ? { ...state.preferences, selectedProjectId: null }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_project', id: command.id, deletedTaskIds, updatedNotes }];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: state.projects.filter((p) => p.id !== command.id),
          tasks: state.tasks.filter((t) => t.projectId !== command.id),
          notes: nextNotes,
          preferences,
        },
        effects,
      };
    }

    case 'create_task': {
      const projectExists = state.projects.some((p) => p.id === command.projectId);
      if (!projectExists) {
        throw new Error('Le projet sélectionné est introuvable.');
      }
      const targetStatus = command.status ?? 'todo';
      const columnCount = state.tasks.filter(
        (t) => t.projectId === command.projectId && t.status === targetStatus,
      ).length;
      const task = createTask({
        id: command.id,
        projectId: command.projectId,
        title: command.title,
        status: targetStatus,
        priority: command.priority ?? 'medium',
        dueDate: command.dueDate ?? null,
        position: columnCount,
        descriptionDoc: command.descriptionDoc,
        checklist: command.checklist,
        assetIds: command.assetIds,
        now: command.now,
      });
      return {
        nextState: {
          ...state,
          tasks: [...state.tasks, task],
        },
        effects: [{ type: 'persist_task', task }],
      };
    }

    case 'update_task': {
      const existing = state.tasks.find((t) => t.id === command.id);
      if (!existing) return { nextState: state, effects: [] };

      const nextTitle =
        command.patch.title !== undefined ? command.patch.title.trim() : existing.title;
      if (!nextTitle) throw new Error('Le titre de la tâche ne peut pas être vide.');
      const nextProjectId = command.patch.projectId ?? existing.projectId;
      if (!state.projects.some((p) => p.id === nextProjectId)) {
        throw new Error('Le projet sélectionné est introuvable.');
      }
      const nextStatus = command.patch.status ?? existing.status;
      if (!TASK_STATUSES.includes(nextStatus)) {
        throw new Error(`Statut invalide : ${nextStatus}.`);
      }
      const nextPriority = command.patch.priority ?? existing.priority;
      if (!TASK_PRIORITIES.includes(nextPriority)) {
        throw new Error(`Priorité invalide : ${nextPriority}.`);
      }
      const nextDoc =
        command.patch.descriptionDoc !== undefined
          ? sanitizeRichTextDoc(command.patch.descriptionDoc)
          : existing.descriptionDoc;
      const derivedAssets = collectDocAssetIds(nextDoc);
      const nextAssets = [
        ...new Set([...(command.patch.assetIds ?? existing.assetIds), ...derivedAssets]),
      ];

      const statusChanged = nextStatus !== existing.status || nextProjectId !== existing.projectId;
      const nextPosition = statusChanged
        ? state.tasks.filter((t) => t.projectId === nextProjectId && t.status === nextStatus).length
        : existing.position;

      const updatedTask = Object.freeze({
        ...existing,
        projectId: nextProjectId,
        title: nextTitle.slice(0, 200),
        status: nextStatus,
        priority: nextPriority,
        dueDate:
          command.patch.dueDate !== undefined
            ? normalizeDueDate(command.patch.dueDate)
            : existing.dueDate,
        position: nextPosition,
        descriptionDoc: nextDoc,
        checklist:
          command.patch.checklist !== undefined
            ? normalizeChecklist(command.patch.checklist)
            : existing.checklist,
        assetIds: nextAssets,
        updatedAt: command.now,
      });

      const replaced = state.tasks.map((t) => (t.id === command.id ? updatedTask : t));
      const { tasks: reindexed, updated: extraUpdated } = reindexProjectColumns(
        replaced,
        existing.projectId,
      );
      const persisted = [updatedTask, ...extraUpdated.filter((t) => t.id !== updatedTask.id)];
      return {
        nextState: { ...state, tasks: reindexed },
        effects: [
          persisted.length === 1
            ? { type: 'persist_task', task: updatedTask }
            : { type: 'persist_tasks', tasks: persisted },
        ],
      };
    }

    case 'move_task': {
      const task = state.tasks.find((t) => t.id === command.id);
      if (!task) return { nextState: state, effects: [] };
      if (!TASK_STATUSES.includes(command.targetStatus)) {
        throw new Error(`Statut cible invalide : ${command.targetStatus}.`);
      }

      const projectId = task.projectId;
      const targetSiblings = state.tasks
        .filter(
          (t) => t.projectId === projectId && t.status === command.targetStatus && t.id !== task.id,
        )
        .sort((a, b) => a.position - b.position);

      const clampedIndex = Math.max(0, Math.min(command.targetIndex, targetSiblings.length));
      const movedTask = Object.freeze({
        ...task,
        status: command.targetStatus,
        position: clampedIndex,
        updatedAt: command.now,
      });
      targetSiblings.splice(clampedIndex, 0, movedTask);

      /** @type {Map<string, Task>} */
      const nextMap = new Map();
      targetSiblings.forEach((t, idx) => {
        nextMap.set(t.id, t.position === idx ? t : Object.freeze({ ...t, position: idx }));
      });

      if (task.status !== command.targetStatus) {
        const sourceSiblings = state.tasks
          .filter((t) => t.projectId === projectId && t.status === task.status && t.id !== task.id)
          .sort((a, b) => a.position - b.position);
        sourceSiblings.forEach((t, idx) => {
          nextMap.set(t.id, t.position === idx ? t : Object.freeze({ ...t, position: idx }));
        });
      }

      const nextTasks = state.tasks.map((t) => nextMap.get(t.id) ?? t);
      const changedTasks = nextTasks.filter((t, i) => t !== state.tasks[i]);

      return {
        nextState: { ...state, tasks: nextTasks },
        effects: changedTasks.length > 0 ? [{ type: 'persist_tasks', tasks: changedTasks }] : [],
      };
    }

    case 'delete_task': {
      const target = state.tasks.find((t) => t.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const remaining = state.tasks.filter((t) => t.id !== command.id);
      const { tasks: reindexed, updated } = reindexProjectColumns(remaining, target.projectId);
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_task', id: command.id }];
      if (updated.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: updated });
      }
      return {
        nextState: { ...state, tasks: reindexed },
        effects,
      };
    }

    case 'create_note': {
      if (command.projectId !== null && !state.projects.some((p) => p.id === command.projectId)) {
        throw new Error('Le projet associé à la note est introuvable.');
      }
      const note = createNote({
        id: command.id,
        projectId: command.projectId,
        title: command.title,
        contentDoc: command.contentDoc,
        assetIds: command.assetIds,
        now: command.now,
      });
      const preferences = { ...state.preferences, selectedNoteId: note.id };
      return {
        nextState: {
          ...state,
          notes: [note, ...state.notes],
          preferences,
        },
        effects: [
          { type: 'persist_note', note },
          { type: 'persist_preferences', preferences },
        ],
      };
    }

    case 'update_note': {
      const existing = state.notes.find((n) => n.id === command.id);
      if (!existing) return { nextState: state, effects: [] };
      const nextTitle =
        command.patch.title !== undefined ? command.patch.title.trim() : existing.title;
      if (!nextTitle) throw new Error('Le titre de la note ne peut pas être vide.');
      const nextProjectId =
        command.patch.projectId !== undefined ? command.patch.projectId : existing.projectId;
      if (nextProjectId !== null && !state.projects.some((p) => p.id === nextProjectId)) {
        throw new Error('Le projet associé à la note est introuvable.');
      }
      const nextDoc =
        command.patch.contentDoc !== undefined
          ? sanitizeRichTextDoc(command.patch.contentDoc)
          : existing.contentDoc;
      const derivedAssets = collectDocAssetIds(nextDoc);
      const nextAssets = [...new Set([...(command.patch.assetIds ?? []), ...derivedAssets])];

      const updatedNote = Object.freeze({
        ...existing,
        projectId: nextProjectId,
        title: nextTitle.slice(0, 200),
        contentDoc: nextDoc,
        assetIds: nextAssets,
        updatedAt: command.now,
      });

      return {
        nextState: {
          ...state,
          notes: state.notes.map((n) => (n.id === command.id ? updatedNote : n)),
        },
        effects: [{ type: 'persist_note', note: updatedNote }],
      };
    }

    case 'delete_note': {
      if (!state.notes.some((n) => n.id === command.id)) {
        return { nextState: state, effects: [] };
      }
      const nextNotes = state.notes.filter((n) => n.id !== command.id);
      const nextSelectedNoteId =
        state.preferences.selectedNoteId === command.id
          ? (nextNotes[0]?.id ?? null)
          : state.preferences.selectedNoteId;
      const preferences =
        nextSelectedNoteId !== state.preferences.selectedNoteId
          ? { ...state.preferences, selectedNoteId: nextSelectedNoteId }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_note', id: command.id }];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: { ...state, notes: nextNotes, preferences },
        effects,
      };
    }

    case 'register_asset': {
      const exists = state.assets.some((a) => a.id === command.asset.id);
      const nextAssets = exists
        ? state.assets.map((a) => (a.id === command.asset.id ? command.asset : a))
        : [...state.assets, command.asset];
      return {
        nextState: { ...state, assets: nextAssets },
        effects: [{ type: 'persist_asset_meta', asset: command.asset }],
      };
    }

    case 'delete_asset': {
      if (!state.assets.some((a) => a.id === command.id)) {
        return { nextState: state, effects: [] };
      }
      return {
        nextState: {
          ...state,
          assets: state.assets.filter((a) => a.id !== command.id),
        },
        effects: [{ type: 'remove_asset', id: command.id }],
      };
    }

    case 'replace_all': {
      const preferences = {
        ...state.preferences,
        selectedProjectId: command.payload.projects[0]?.id ?? null,
        selectedNoteId: command.payload.notes[0]?.id ?? null,
      };
      return {
        nextState: {
          schemaVersion: 1,
          readOnly: state.readOnly,
          projects: [...command.payload.projects],
          tasks: [...command.payload.tasks],
          notes: [...command.payload.notes],
          assets: [...command.payload.assets],
          preferences,
        },
        effects: [
          { type: 'persist_replace_all', payload: command.payload },
          { type: 'persist_preferences', preferences },
        ],
      };
    }
  }
}

/**
 * Create an observable immutable store.
 * @param {AppState} initialState
 */
export function createStore(initialState = createInitialState()) {
  let state = initialState;
  /** @type {Set<(info: { state: AppState; prevState: AppState; command: AppCommand; effects: StoreEffect[] }) => void>} */
  const listeners = new Set();

  return {
    /** @returns {AppState} */
    getState() {
      return state;
    },

    /**
     * @param {AppCommand} command
     * @returns {{ state: AppState; effects: StoreEffect[] }}
     */
    dispatch(command) {
      const prevState = state;
      const { nextState, effects } = reduce(prevState, command);
      state = nextState;
      for (const listener of listeners) {
        listener({ state, prevState, command, effects });
      }
      return { state, effects };
    },

    /**
     * @param {(info: { state: AppState; prevState: AppState; command: AppCommand; effects: StoreEffect[] }) => void} listener
     * @returns {() => void}
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Select tasks matching optional filters.
 * @param {AppState} state
 * @param {{ projectId?: string | null; status?: TaskStatus | 'all'; priority?: TaskPriority | 'all'; query?: string; sortBy?: 'position' | 'dueDate' | 'priority' }} filters
 * @returns {Task[]}
 */
export function selectTasks(state, filters = {}) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  const filtered = state.tasks.filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.status && filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority && filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }
    if (query && !task.title.toLowerCase().includes(query)) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === 'dueDate') {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
    }
    if (filters.sortBy === 'priority') {
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
    }
    return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Group tasks by Kanban status column using ES2024 Object.groupBy.
 * @param {AppState} state
 * @param {string | null} projectId
 * @param {string} [query]
 * @returns {{ todo: Task[]; in_progress: Task[]; done: Task[] }}
 */
export function selectKanbanColumns(state, projectId, query = '') {
  const tasks = selectTasks(state, { projectId, query, sortBy: 'position' });
  const grouped = Object.groupBy(tasks, (task) => task.status);
  return {
    todo: [...(grouped.todo ?? [])].sort((a, b) => a.position - b.position),
    in_progress: [...(grouped.in_progress ?? [])].sort((a, b) => a.position - b.position),
    done: [...(grouped.done ?? [])].sort((a, b) => a.position - b.position),
  };
}

/**
 * Select notes matching project and search filters, sorted by most recently updated.
 * @param {AppState} state
 * @param {{ projectId?: string | null | 'all'; query?: string }} filters
 * @returns {Note[]}
 */
export function selectNotes(state, filters = {}) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const filtered = state.notes.filter((note) => {
    if (filters.projectId !== undefined && filters.projectId !== 'all') {
      if (note.projectId !== filters.projectId) return false;
    }
    if (query && !note.title.toLowerCase().includes(query)) return false;
    return true;
  });
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Collect every assetId currently referenced by tasks or notes.
 * @param {AppState} state
 * @returns {Set<string>}
 */
export function selectReferencedAssetIds(state) {
  /** @type {Set<string>} */
  const used = new Set();
  for (const task of state.tasks) {
    for (const id of task.assetIds) used.add(id);
  }
  for (const note of state.notes) {
    for (const id of note.assetIds) used.add(id);
  }
  return used;
}

/**
 * Find a project by id.
 * @param {AppState} state
 * @param {string | null} projectId
 * @returns {Project | undefined}
 */
export function selectProjectById(state, projectId) {
  if (!projectId) return undefined;
  return state.projects.find((p) => p.id === projectId);
}
