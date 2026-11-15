/** @import { AppCommand, AppPreferences, AppState, Note, Project, StoreEffect, Task, TaskPriority, TaskStatus, TaskStatusConfig, TaskStatusFilter, Whiteboard } from '../types.d.ts' */

import {
  ACTIVE_VIEWS,
  DEFAULT_INPUT_PRESENTATIONS,
  DEFAULT_TASK_STATUSES,
  DEFAULT_TOAST_DURATION_SECONDS,
  TASK_PRIORITIES,
  collectDocAssetIds,
  collectWhiteboardAssetIds,
  createNote,
  createProject,
  createTask,
  createWhiteboard,
  normalizeChecklist,
  normalizeDueDate,
  normalizeInputPresentations,
  normalizeTaskStatuses,
  normalizeToastDurationSeconds,
  sanitizeRichTextDoc,
  sanitizeWhiteboardElements,
  sanitizeWhiteboardViewport,
} from './model.js';

export { DEFAULT_TASK_STATUSES };

/** @type {AppPreferences} */
const DEFAULT_PREFERENCES = Object.freeze({
  activeView: 'tasks',
  taskDisplayMode: 'list',
  selectedProjectId: null,
  selectedNoteId: null,
  selectedWhiteboardId: null,
  inputPresentations: DEFAULT_INPUT_PRESENTATIONS,
  taskStatuses: DEFAULT_TASK_STATUSES,
  toastDurationSeconds: DEFAULT_TOAST_DURATION_SECONDS,
});

/**
 * Create the initial empty application state.
 * @returns {AppState}
 */
export function createInitialState() {
  return {
    schemaVersion: 2,
    readOnly: false,
    projects: [],
    tasks: [],
    notes: [],
    whiteboards: [],
    assets: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}

/**
 * Check if two status configuration lists are identical.
 * @param {readonly TaskStatusConfig[]} a
 * @param {readonly TaskStatusConfig[]} b
 * @returns {boolean}
 */
function areTaskStatusesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id || a[i]?.label !== b[i]?.label) return false;
  }
  return true;
}

/**
 * Re-index task positions sequentially inside each (projectId, status) bucket.
 * @param {readonly Task[]} tasks
 * @param {string} projectId
 * @returns {{ tasks: Task[]; updated: Task[] }}
 */
function reindexProjectColumns(tasks, projectId) {
  /** @type {Task[]} */
  const updated = [];
  /** @type {Map<string, Task>} */
  const replacementMap = new Map();

  /** @type {Set<string | null>} */
  const statusKeys = new Set();
  for (const t of tasks) {
    if (t.projectId === projectId) {
      statusKeys.add(t.status);
    }
  }

  for (const status of statusKeys) {
    const colTasks = tasks
      .filter((t) => t.projectId === projectId && t.status === status)
      .sort((a, b) => a.position - b.position);
    colTasks.forEach((task, idx) => {
      if (task.position !== idx) {
        const nextTask = Object.freeze({ ...task, position: idx });
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
      const inputPresentations = normalizeInputPresentations(
        command.payload.preferences?.inputPresentations,
      );
      const taskStatuses = normalizeTaskStatuses(command.payload.preferences?.taskStatuses);
      const toastDurationSeconds = normalizeToastDurationSeconds(
        command.payload.preferences?.toastDurationSeconds,
      );
      const preferences = {
        ...DEFAULT_PREFERENCES,
        ...command.payload.preferences,
        inputPresentations,
        taskStatuses,
        toastDurationSeconds,
      };
      return {
        nextState: {
          schemaVersion: 2,
          readOnly: Boolean(command.payload.readOnly),
          projects: [...command.payload.projects],
          tasks: [...command.payload.tasks],
          notes: [...command.payload.notes],
          whiteboards: [...(command.payload.whiteboards ?? [])],
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

    case 'set_input_presentation': {
      if (!ACTIVE_VIEWS.includes(command.screen)) {
        return { nextState: state, effects: [] };
      }
      const nextPresentation = command.presentation === 'modal' ? 'modal' : 'drawer';
      const currentMap = state.preferences.inputPresentations;
      if (currentMap[command.screen] === nextPresentation) {
        return { nextState: state, effects: [] };
      }
      const inputPresentations = Object.freeze({
        ...currentMap,
        [command.screen]: nextPresentation,
      });
      const preferences = { ...state.preferences, inputPresentations };
      return {
        nextState: { ...state, preferences },
        effects: state.readOnly ? [] : [{ type: 'persist_preferences', preferences }],
      };
    }

    case 'set_toast_duration': {
      if (typeof command.seconds !== 'number' || !Number.isFinite(command.seconds)) {
        return { nextState: state, effects: [] };
      }
      const nextDuration = normalizeToastDurationSeconds(command.seconds);
      if (state.preferences.toastDurationSeconds === nextDuration) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, toastDurationSeconds: nextDuration };
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

    case 'select_whiteboard': {
      if (state.preferences.selectedWhiteboardId === command.whiteboardId) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, selectedWhiteboardId: command.whiteboardId };
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
    case 'set_task_statuses': {
      const nextStatuses = normalizeTaskStatuses(command.statuses);
      if (areTaskStatusesEqual(state.preferences.taskStatuses, nextStatuses)) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, taskStatuses: nextStatuses };
      return {
        nextState: { ...state, preferences },
        effects: [{ type: 'persist_preferences', preferences }],
      };
    }

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
      /** @type {Whiteboard[]} */
      const updatedWhiteboards = [];
      const nextWhiteboards = state.whiteboards.map((w) => {
        if (w.projectId === command.id) {
          const next = Object.freeze({ ...w, projectId: null });
          updatedWhiteboards.push(next);
          return next;
        }
        return w;
      });
      const preferences =
        state.preferences.selectedProjectId === command.id
          ? { ...state.preferences, selectedProjectId: null }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [
        {
          type: 'remove_project',
          id: command.id,
          deletedTaskIds,
          updatedNotes,
          updatedWhiteboards,
        },
      ];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: state.projects.filter((p) => p.id !== command.id),
          tasks: state.tasks.filter((t) => t.projectId !== command.id),
          notes: nextNotes,
          whiteboards: nextWhiteboards,
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
      const allowedStatuses = state.preferences.taskStatuses.map((s) => s.id);
      const defaultStatus = state.preferences.taskStatuses[0]?.id ?? null;
      const targetStatus =
        command.status === undefined
          ? defaultStatus
          : typeof command.status === 'string'
            ? command.status.trim() || null
            : null;
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
        allowedStatuses,
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
      const allowedIds = state.preferences.taskStatuses.map((s) => s.id);
      let nextStatus = existing.status;
      if (command.patch.status !== undefined) {
        nextStatus =
          typeof command.patch.status === 'string' ? command.patch.status.trim() || null : null;
        if (nextStatus !== null && !allowedIds.includes(nextStatus)) {
          throw new Error(`Statut invalide : ${nextStatus}.`);
        }
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
      const allowedIds = state.preferences.taskStatuses.map((s) => s.id);
      if (!allowedIds.includes(command.targetStatus)) {
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

    case 'create_whiteboard': {
      if (command.projectId !== null && !state.projects.some((p) => p.id === command.projectId)) {
        throw new Error('Le projet associé au tableau blanc est introuvable.');
      }
      const whiteboard = createWhiteboard({
        id: command.id,
        projectId: command.projectId,
        title: command.title,
        viewport: command.viewport,
        elements: command.elements,
        assetIds: command.assetIds,
        now: command.now,
      });
      const preferences = { ...state.preferences, selectedWhiteboardId: whiteboard.id };
      return {
        nextState: {
          ...state,
          whiteboards: [whiteboard, ...state.whiteboards],
          preferences,
        },
        effects: [
          { type: 'persist_whiteboard', whiteboard },
          { type: 'persist_preferences', preferences },
        ],
      };
    }

    case 'update_whiteboard': {
      const existing = state.whiteboards.find((w) => w.id === command.id);
      if (!existing) return { nextState: state, effects: [] };
      const nextTitle =
        command.patch.title !== undefined ? command.patch.title.trim() : existing.title;
      if (!nextTitle) throw new Error('Le titre du tableau blanc ne peut pas être vide.');
      const nextProjectId =
        command.patch.projectId !== undefined ? command.patch.projectId : existing.projectId;
      if (nextProjectId !== null && !state.projects.some((p) => p.id === nextProjectId)) {
        throw new Error('Le projet associé au tableau blanc est introuvable.');
      }
      const nextViewport =
        command.patch.viewport !== undefined
          ? sanitizeWhiteboardViewport(command.patch.viewport)
          : existing.viewport;
      const nextElements =
        command.patch.elements !== undefined
          ? sanitizeWhiteboardElements(command.patch.elements)
          : existing.elements;
      const derivedAssets = collectWhiteboardAssetIds(nextElements);
      const nextAssets = [
        ...new Set([
          ...(command.patch.assetIds ??
            (command.patch.elements !== undefined ? [] : existing.assetIds)),
          ...derivedAssets,
        ]),
      ];

      const updatedWhiteboard = Object.freeze({
        ...existing,
        projectId: nextProjectId,
        title: nextTitle.slice(0, 200),
        viewport: nextViewport,
        elements: nextElements,
        assetIds: nextAssets,
        updatedAt: command.now,
      });

      return {
        nextState: {
          ...state,
          whiteboards: state.whiteboards.map((w) => (w.id === command.id ? updatedWhiteboard : w)),
        },
        effects: [{ type: 'persist_whiteboard', whiteboard: updatedWhiteboard }],
      };
    }

    case 'delete_whiteboard': {
      if (!state.whiteboards.some((w) => w.id === command.id)) {
        return { nextState: state, effects: [] };
      }
      const nextWhiteboards = state.whiteboards.filter((w) => w.id !== command.id);
      const nextSelectedWhiteboardId =
        state.preferences.selectedWhiteboardId === command.id
          ? (nextWhiteboards[0]?.id ?? null)
          : state.preferences.selectedWhiteboardId;
      const preferences =
        nextSelectedWhiteboardId !== state.preferences.selectedWhiteboardId
          ? { ...state.preferences, selectedWhiteboardId: nextSelectedWhiteboardId }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_whiteboard', id: command.id }];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: { ...state, whiteboards: nextWhiteboards, preferences },
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
      const taskStatuses =
        command.payload.taskStatuses !== undefined
          ? normalizeTaskStatuses(command.payload.taskStatuses)
          : state.preferences.taskStatuses;
      const preferences = {
        ...state.preferences,
        taskStatuses,
        selectedProjectId: command.payload.projects[0]?.id ?? null,
        selectedNoteId: command.payload.notes[0]?.id ?? null,
        selectedWhiteboardId: command.payload.whiteboards[0]?.id ?? null,
      };
      return {
        nextState: {
          schemaVersion: 2,
          readOnly: state.readOnly,
          projects: [...command.payload.projects],
          tasks: [...command.payload.tasks],
          notes: [...command.payload.notes],
          whiteboards: [...command.payload.whiteboards],
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
 * Supports special status filters:
 * - `'all'` (default): all tasks (including tasks with no status or unknown status)
 * - `'__none__'`: only tasks with `status === null`
 * - `'__unknown__'`: only tasks whose `status` is non-null and not in `state.preferences.taskStatuses`
 * - `<statusId>`: only tasks with `task.status === statusId`
 * @param {AppState} state
 * @param {{ projectId?: string | null; status?: TaskStatusFilter; priority?: TaskPriority | 'all'; query?: string; sortBy?: 'position' | 'dueDate' | 'priority' }} filters
 * @returns {Task[]}
 */
export function selectTasks(state, filters = {}) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const knownIds = new Set(state.preferences.taskStatuses.map((s) => s.id));

  const filtered = state.tasks.filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.status && filters.status !== 'all') {
      if (filters.status === '__none__') {
        if (task.status !== null) return false;
      } else if (filters.status === '__unknown__') {
        if (task.status === null || knownIds.has(task.status)) return false;
      } else if (task.status !== filters.status) {
        return false;
      }
    }
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
 * Group tasks by configured Kanban status columns.
 * Tasks with `status === null` or an unknown status not in `state.preferences.taskStatuses` are excluded from the Kanban board.
 * @param {AppState} state
 * @param {string | null} projectId
 * @param {string} [query]
 * @returns {Record<string, Task[]>}
 */
export function selectKanbanColumns(state, projectId, query = '') {
  const tasks = selectTasks(state, { projectId, query, sortBy: 'position' });
  const grouped = Object.groupBy(tasks, (task) => task.status ?? '__none__');
  /** @type {Record<string, Task[]>} */
  const columns = {};
  for (const statusCfg of state.preferences.taskStatuses) {
    columns[statusCfg.id] = [...(grouped[statusCfg.id] ?? [])].sort(
      (a, b) => a.position - b.position,
    );
  }
  return columns;
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
 * Select whiteboards matching project and search filters, sorted by most recently updated.
 * @param {AppState} state
 * @param {{ projectId?: string | null | 'all'; query?: string }} filters
 * @returns {Whiteboard[]}
 */
export function selectWhiteboards(state, filters = {}) {
  const query = (filters.query ?? '').trim().toLowerCase();
  const filtered = state.whiteboards.filter((wb) => {
    if (filters.projectId !== undefined && filters.projectId !== 'all') {
      if (wb.projectId !== filters.projectId) return false;
    }
    if (query && !wb.title.toLowerCase().includes(query)) return false;
    return true;
  });
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Collect every assetId currently referenced by tasks, notes or whiteboards.
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
  for (const wb of state.whiteboards) {
    for (const id of wb.assetIds) used.add(id);
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
