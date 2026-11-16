/** @import { AppCommand, AppPreferences, AppState, LocalEntityKind, LocalRef, LocalTemplate, Note, Project, StoreEffect, Task, TaskDueFilter, TaskPriority, TaskStatus, TaskStatusConfig, TaskStatusFilter, TemplateKind, TrashItem, Whiteboard } from '../types.d.ts' */

import {
  INPUT_PRESENTATION_SCREENS,
  DEFAULT_INPUT_PRESENTATIONS,
  DEFAULT_TASK_STATUSES,
  DEFAULT_TOAST_DURATION_SECONDS,
  DEFAULT_TRASH_RETENTION_DAYS,
  computeTrashExpiresAt,
  normalizeTrashRetentionDays,
  TASK_PRIORITIES,
  collectDocAssetIds,
  collectWhiteboardAssetIds,
  createNote,
  createProject,
  createTask,
  createWhiteboard,
  normalizeChecklist,
  normalizeLocalRefs,
  normalizeTags,
  normalizeDueDate,
  normalizeInputPresentations,
  normalizeTaskRecurrence,
  normalizeTaskStatuses,
  normalizeToastDurationSeconds,
  sanitizeRichTextDoc,
  sanitizeWhiteboardElements,
  sanitizeWhiteboardViewport,
} from './model.js';
import {
  extractNoteSearchText,
  extractTaskSearchText,
  extractWhiteboardSearchText,
  matchesSearchTokens,
  tokenizeSearchQuery,
} from './search.js';
import {
  classifyDueDateUrgency,
  computeNextRecurrenceDueDate,
  getTodayIsoDate,
  shiftIsoDate,
} from './dates.js';
import { createLocalTemplate, getTemplatesForKind } from './templates.js';

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
  trashRetentionDays: DEFAULT_TRASH_RETENTION_DAYS,
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
    trash: [],
    templates: [],
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
 * Collect entity keys ("kind:id") belonging to a TrashItem so dangling LocalRefs can be pruned on permanent purge.
 * @param {TrashItem} item
 * @param {Set<string>} target
 */
function collectTrashItemRemovedKeys(item, target) {
  if (item.kind === 'task' && item.task) {
    target.add(`task:${item.task.id}`);
  } else if (item.kind === 'note' && item.note) {
    target.add(`note:${item.note.id}`);
  } else if (item.kind === 'whiteboard' && item.whiteboard) {
    target.add(`whiteboard:${item.whiteboard.id}`);
  } else if (item.kind === 'project' && item.tasks) {
    for (const t of item.tasks) {
      target.add(`task:${t.id}`);
    }
  }
}

/**
 * Resolve a non-colliding ID when restoring an entity from the trash.
 * @param {string} preferredId
 * @param {ReadonlySet<string>} existingIds
 * @returns {string}
 */
function resolveRestoredId(preferredId, existingIds) {
  if (!existingIds.has(preferredId)) return preferredId;
  let suffix = 2;
  while (existingIds.has(`${preferredId}-restored-${suffix}`)) {
    suffix += 1;
  }
  return `${preferredId}-restored-${suffix}`;
}

/**
 * Prune links referencing any deleted entity keys (e.g. "task:id") from tasks, notes and whiteboards.
 * @param {{ tasks: readonly Task[]; notes: readonly Note[]; whiteboards: readonly Whiteboard[] }} collections
 * @param {ReadonlySet<string>} removedKeys
 * @returns {{
 *   tasks: readonly Task[];
 *   notes: readonly Note[];
 *   whiteboards: readonly Whiteboard[];
 *   changedTasks: Task[];
 *   changedNotes: Note[];
 *   changedWhiteboards: Whiteboard[];
 * }}
 */
function pruneDeletedLinks(collections, removedKeys) {
  if (removedKeys.size === 0) {
    return {
      tasks: collections.tasks,
      notes: collections.notes,
      whiteboards: collections.whiteboards,
      changedTasks: [],
      changedNotes: [],
      changedWhiteboards: [],
    };
  }
  /** @type {Task[]} */
  const changedTasks = [];
  const tasks = collections.tasks.map((t) => {
    const links = t.links ?? [];
    const kept = links.filter((ref) => !removedKeys.has(`${ref.kind}:${ref.id}`));
    if (kept.length === links.length) return t;
    const next = Object.freeze({ ...t, links: Object.freeze(kept) });
    changedTasks.push(next);
    return next;
  });
  /** @type {Note[]} */
  const changedNotes = [];
  const notes = collections.notes.map((n) => {
    const links = n.links ?? [];
    const kept = links.filter((ref) => !removedKeys.has(`${ref.kind}:${ref.id}`));
    if (kept.length === links.length) return n;
    const next = Object.freeze({ ...n, links: Object.freeze(kept) });
    changedNotes.push(next);
    return next;
  });
  /** @type {Whiteboard[]} */
  const changedWhiteboards = [];
  const whiteboards = collections.whiteboards.map((w) => {
    const links = w.links ?? [];
    const kept = links.filter((ref) => !removedKeys.has(`${ref.kind}:${ref.id}`));
    if (kept.length === links.length) return w;
    const next = Object.freeze({ ...w, links: Object.freeze(kept) });
    changedWhiteboards.push(next);
    return next;
  });
  return { tasks, notes, whiteboards, changedTasks, changedNotes, changedWhiteboards };
}

/**
 * Generate the next local occurrence of a recurring task upon completion.
 * @param {Task} completedTask
 * @param {readonly Task[]} currentTasks
 * @param {readonly TaskStatusConfig[]} configuredStatuses
 * @param {{ nextOccurrenceId?: string; todayIso?: string; now: string }} opts
 * @returns {Task | null}
 */
function buildNextRecurringTask(completedTask, currentTasks, configuredStatuses, opts) {
  const recurrence = normalizeTaskRecurrence(completedTask.recurrence);
  if (!recurrence) return null;
  const initialStatus = configuredStatuses.find((s) => s.id !== 'done')?.id ?? null;
  const nextDueDate = computeNextRecurrenceDueDate(
    completedTask.dueDate,
    recurrence,
    opts.todayIso ?? getTodayIsoDate(),
  );
  const takenIds = new Set(currentTasks.map((t) => t.id));
  let nextId = opts.nextOccurrenceId?.trim() || '';
  if (!nextId || takenIds.has(nextId)) {
    nextId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${completedTask.id}-next-${currentTasks.length + 1}`;
    while (takenIds.has(nextId)) {
      nextId = `${nextId}-x`;
    }
  }
  const nextChecklist = completedTask.checklist.map((item, idx) => ({
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${nextId}-step-${idx + 1}`,
    text: item.text,
    done: false,
  }));
  const position = currentTasks.filter(
    (t) => t.projectId === completedTask.projectId && t.status === initialStatus,
  ).length;
  const allowedStatuses = configuredStatuses.map((s) => s.id);
  return createTask({
    id: nextId,
    projectId: completedTask.projectId,
    title: completedTask.title,
    status: initialStatus,
    priority: completedTask.priority,
    dueDate: nextDueDate,
    recurrence,
    position,
    descriptionDoc: structuredClone(completedTask.descriptionDoc),
    checklist: nextChecklist,
    tags: [...(completedTask.tags ?? [])],
    links: [...(completedTask.links ?? [])],
    assetIds: [...completedTask.assetIds],
    allowedStatuses,
    now: opts.now,
  });
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
      const trashRetentionDays = normalizeTrashRetentionDays(
        command.payload.preferences?.trashRetentionDays,
      );
      const preferences = {
        ...DEFAULT_PREFERENCES,
        ...command.payload.preferences,
        inputPresentations,
        taskStatuses,
        toastDurationSeconds,
        trashRetentionDays,
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
          trash: [...(command.payload.trash ?? [])],
          templates: [...(command.payload.templates ?? [])],
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
      if (!INPUT_PRESENTATION_SCREENS.includes(command.screen)) {
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

    case 'set_trash_retention_days': {
      if (typeof command.days !== 'number' || !Number.isFinite(command.days)) {
        return { nextState: state, effects: [] };
      }
      const nextDays = normalizeTrashRetentionDays(command.days);
      if (state.preferences.trashRetentionDays === nextDays) {
        return { nextState: state, effects: [] };
      }
      const preferences = { ...state.preferences, trashRetentionDays: nextDays };
      const updatedTrash = state.trash.map((item) =>
        Object.freeze({
          ...item,
          expiresAt: computeTrashExpiresAt(item.deletedAt, nextDays),
        }),
      );
      /** @type {StoreEffect[]} */
      const effects = state.readOnly ? [] : [{ type: 'persist_preferences', preferences }];
      if (!state.readOnly && updatedTrash.length > 0) {
        effects.push({ type: 'persist_trash_items', items: updatedTrash });
      }
      return {
        nextState: { ...state, trash: updatedTrash, preferences },
        effects,
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
      const remainingTasks = state.tasks.filter((t) => t.projectId !== command.id);
      const removedKeys = new Set(deletedTaskIds.map((tid) => `task:${tid}`));
      const pruned = pruneDeletedLinks(
        { tasks: remainingTasks, notes: nextNotes, whiteboards: nextWhiteboards },
        removedKeys,
      );
      /** @type {Map<string, Note>} */
      const finalUpdatedNotesMap = new Map(updatedNotes.map((n) => [n.id, n]));
      for (const cn of pruned.changedNotes) finalUpdatedNotesMap.set(cn.id, cn);
      /** @type {Map<string, Whiteboard>} */
      const finalUpdatedWbsMap = new Map(updatedWhiteboards.map((w) => [w.id, w]));
      for (const cw of pruned.changedWhiteboards) finalUpdatedWbsMap.set(cw.id, cw);

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
          updatedNotes: [...finalUpdatedNotesMap.values()],
          updatedWhiteboards: [...finalUpdatedWbsMap.values()],
        },
      ];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: state.projects.filter((p) => p.id !== command.id),
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
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
        recurrence: command.recurrence ?? null,
        position: columnCount,
        descriptionDoc: command.descriptionDoc,
        checklist: command.checklist,
        tags: command.tags,
        links: command.links,
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

      const nextTags =
        command.patch.tags !== undefined
          ? normalizeTags(command.patch.tags)
          : (existing.tags ?? []);
      const nextLinks =
        command.patch.links !== undefined
          ? normalizeLocalRefs(command.patch.links, { kind: 'task', id: existing.id })
          : (existing.links ?? []);
      const nextRecurrence =
        command.patch.recurrence !== undefined
          ? normalizeTaskRecurrence(command.patch.recurrence)
          : normalizeTaskRecurrence(existing.recurrence);

      const { recurrence: _prevRec, ...existingBase } = existing;
      const updatedTask = Object.freeze({
        ...existingBase,
        projectId: nextProjectId,
        title: nextTitle.slice(0, 200),
        status: nextStatus,
        priority: nextPriority,
        dueDate:
          command.patch.dueDate !== undefined
            ? normalizeDueDate(command.patch.dueDate)
            : existing.dueDate,
        ...(nextRecurrence ? { recurrence: nextRecurrence } : {}),
        position: nextPosition,
        descriptionDoc: nextDoc,
        checklist:
          command.patch.checklist !== undefined
            ? normalizeChecklist(command.patch.checklist)
            : existing.checklist,
        tags: nextTags,
        links: nextLinks,
        assetIds: nextAssets,
        updatedAt: command.now,
      });

      let replaced = state.tasks.map((t) => (t.id === command.id ? updatedTask : t));
      const completedNow = existing.status !== 'done' && nextStatus === 'done';
      const spawned = completedNow
        ? buildNextRecurringTask(updatedTask, replaced, state.preferences.taskStatuses, {
            nextOccurrenceId: command.nextOccurrenceId,
            todayIso: command.todayIso,
            now: command.now,
          })
        : null;
      if (spawned) {
        replaced = [...replaced, spawned];
      }

      const { tasks: reindexed, updated: extraUpdated } = reindexProjectColumns(
        replaced,
        existing.projectId,
      );
      /** @type {Map<string, Task>} */
      const persistedMap = new Map([[updatedTask.id, updatedTask]]);
      if (spawned) {
        const finalSpawned = reindexed.find((t) => t.id === spawned.id) ?? spawned;
        persistedMap.set(finalSpawned.id, finalSpawned);
      }
      for (const extra of extraUpdated) {
        if (extra.id !== updatedTask.id) {
          persistedMap.set(extra.id, extra);
        }
      }
      const persisted = [...persistedMap.values()];
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

      let nextTasks = state.tasks.map((t) => nextMap.get(t.id) ?? t);
      const changedTasks = nextTasks.filter((t, i) => t !== state.tasks[i]);
      const completedNow = task.status !== 'done' && command.targetStatus === 'done';
      const spawned = completedNow
        ? buildNextRecurringTask(movedTask, nextTasks, state.preferences.taskStatuses, {
            nextOccurrenceId: command.nextOccurrenceId,
            todayIso: command.todayIso,
            now: command.now,
          })
        : null;
      if (spawned) {
        nextTasks = [...nextTasks, spawned];
        changedTasks.push(spawned);
      }

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
      const pruned = pruneDeletedLinks(
        { tasks: reindexed, notes: state.notes, whiteboards: state.whiteboards },
        new Set([`task:${command.id}`]),
      );
      /** @type {Map<string, Task>} */
      const taskUpdates = new Map(updated.map((t) => [t.id, t]));
      for (const ct of pruned.changedTasks) taskUpdates.set(ct.id, ct);
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_task', id: command.id }];
      if (taskUpdates.size > 0) {
        effects.push({ type: 'persist_tasks', tasks: [...taskUpdates.values()] });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
        },
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
        tags: command.tags,
        links: command.links,
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
      const nextTags =
        command.patch.tags !== undefined
          ? normalizeTags(command.patch.tags)
          : (existing.tags ?? []);
      const nextLinks =
        command.patch.links !== undefined
          ? normalizeLocalRefs(command.patch.links, { kind: 'note', id: existing.id })
          : (existing.links ?? []);
      const derivedAssets = collectDocAssetIds(nextDoc);
      const nextAssets = [...new Set([...(command.patch.assetIds ?? []), ...derivedAssets])];

      const updatedNote = Object.freeze({
        ...existing,
        projectId: nextProjectId,
        title: nextTitle.slice(0, 200),
        contentDoc: nextDoc,
        tags: nextTags,
        links: nextLinks,
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
      const pruned = pruneDeletedLinks(
        { tasks: state.tasks, notes: nextNotes, whiteboards: state.whiteboards },
        new Set([`note:${command.id}`]),
      );
      const nextSelectedNoteId =
        state.preferences.selectedNoteId === command.id
          ? (pruned.notes[0]?.id ?? null)
          : state.preferences.selectedNoteId;
      const preferences =
        nextSelectedNoteId !== state.preferences.selectedNoteId
          ? { ...state.preferences, selectedNoteId: nextSelectedNoteId }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_note', id: command.id }];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
          preferences,
        },
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
        links: command.links,
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
      const nextLinks =
        command.patch.links !== undefined
          ? normalizeLocalRefs(command.patch.links, { kind: 'whiteboard', id: existing.id })
          : (existing.links ?? []);
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
        links: nextLinks,
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
      const pruned = pruneDeletedLinks(
        { tasks: state.tasks, notes: state.notes, whiteboards: nextWhiteboards },
        new Set([`whiteboard:${command.id}`]),
      );
      const nextSelectedWhiteboardId =
        state.preferences.selectedWhiteboardId === command.id
          ? (pruned.whiteboards[0]?.id ?? null)
          : state.preferences.selectedWhiteboardId;
      const preferences =
        nextSelectedWhiteboardId !== state.preferences.selectedWhiteboardId
          ? { ...state.preferences, selectedWhiteboardId: nextSelectedWhiteboardId }
          : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_whiteboard', id: command.id }];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
          preferences,
        },
        effects,
      };
    }

    case 'trash_project': {
      const target = state.projects.find((p) => p.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const projectTasks = state.tasks.filter((t) => t.projectId === command.id);
      const deletedTaskIds = projectTasks.map((t) => t.id);
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
      const assetSet = new Set();
      for (const t of projectTasks) {
        for (const aid of t.assetIds) assetSet.add(aid);
      }
      const trashId = command.trashId ?? `trash:project:${target.id}:${command.now}`;
      /** @type {TrashItem} */
      const trashItem = Object.freeze({
        id: trashId,
        kind: 'project',
        title: target.name,
        deletedAt: command.now,
        expiresAt: computeTrashExpiresAt(command.now, state.preferences.trashRetentionDays),
        projectId: target.id,
        projectName: target.name,
        project: target,
        tasks: Object.freeze(projectTasks),
        assetIds: Object.freeze([...assetSet]),
      });
      const remainingTasks = state.tasks.filter((t) => t.projectId !== command.id);
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
        { type: 'persist_trash_item', item: trashItem },
      ];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: state.projects.filter((p) => p.id !== command.id),
          tasks: remainingTasks,
          notes: nextNotes,
          whiteboards: nextWhiteboards,
          trash: [trashItem, ...state.trash],
          preferences,
        },
        effects,
      };
    }

    case 'trash_task': {
      const target = state.tasks.find((t) => t.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const projectName = state.projects.find((p) => p.id === target.projectId)?.name ?? null;
      const trashId = command.trashId ?? `trash:task:${target.id}:${command.now}`;
      /** @type {TrashItem} */
      const trashItem = Object.freeze({
        id: trashId,
        kind: 'task',
        title: target.title,
        deletedAt: command.now,
        expiresAt: computeTrashExpiresAt(command.now, state.preferences.trashRetentionDays),
        projectId: target.projectId,
        projectName,
        task: target,
        assetIds: Object.freeze([...target.assetIds]),
      });
      const remaining = state.tasks.filter((t) => t.id !== command.id);
      const { tasks: reindexed, updated } = reindexProjectColumns(remaining, target.projectId);
      /** @type {StoreEffect[]} */
      const effects = [
        { type: 'remove_task', id: command.id },
        { type: 'persist_trash_item', item: trashItem },
      ];
      if (updated.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: updated });
      }
      return {
        nextState: {
          ...state,
          tasks: reindexed,
          trash: [trashItem, ...state.trash],
        },
        effects,
      };
    }

    case 'trash_note': {
      const target = state.notes.find((n) => n.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const projectName = target.projectId
        ? (state.projects.find((p) => p.id === target.projectId)?.name ?? null)
        : null;
      const trashId = command.trashId ?? `trash:note:${target.id}:${command.now}`;
      /** @type {TrashItem} */
      const trashItem = Object.freeze({
        id: trashId,
        kind: 'note',
        title: target.title,
        deletedAt: command.now,
        expiresAt: computeTrashExpiresAt(command.now, state.preferences.trashRetentionDays),
        projectId: target.projectId,
        projectName,
        note: target,
        assetIds: Object.freeze([...target.assetIds]),
      });
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
      const effects = [
        { type: 'remove_note', id: command.id },
        { type: 'persist_trash_item', item: trashItem },
      ];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          notes: nextNotes,
          trash: [trashItem, ...state.trash],
          preferences,
        },
        effects,
      };
    }

    case 'trash_whiteboard': {
      const target = state.whiteboards.find((w) => w.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const projectName = target.projectId
        ? (state.projects.find((p) => p.id === target.projectId)?.name ?? null)
        : null;
      const trashId = command.trashId ?? `trash:whiteboard:${target.id}:${command.now}`;
      /** @type {TrashItem} */
      const trashItem = Object.freeze({
        id: trashId,
        kind: 'whiteboard',
        title: target.title,
        deletedAt: command.now,
        expiresAt: computeTrashExpiresAt(command.now, state.preferences.trashRetentionDays),
        projectId: target.projectId,
        projectName,
        whiteboard: target,
        assetIds: Object.freeze([...target.assetIds]),
      });
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
      const effects = [
        { type: 'remove_whiteboard', id: command.id },
        { type: 'persist_trash_item', item: trashItem },
      ];
      if (preferences !== state.preferences) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          whiteboards: nextWhiteboards,
          trash: [trashItem, ...state.trash],
          preferences,
        },
        effects,
      };
    }

    case 'restore_trash_item': {
      const item = state.trash.find((entry) => entry.id === command.id);
      if (!item) return { nextState: state, effects: [] };
      const remainingTrash = state.trash.filter((entry) => entry.id !== command.id);

      if (item.kind === 'project' && item.project) {
        const takenProjectIds = new Set(state.projects.map((p) => p.id));
        const restoredProjectId = resolveRestoredId(item.project.id, takenProjectIds);
        const restoredProject = Object.freeze({
          ...item.project,
          id: restoredProjectId,
          updatedAt: command.now,
        });
        const takenTaskIds = new Set(state.tasks.map((t) => t.id));
        const restoredTasks = (item.tasks ?? []).map((t) => {
          const nextTaskId = resolveRestoredId(t.id, takenTaskIds);
          takenTaskIds.add(nextTaskId);
          return Object.freeze({
            ...t,
            id: nextTaskId,
            projectId: restoredProjectId,
            updatedAt: command.now,
          });
        });
        const preferences =
          state.preferences.selectedProjectId === null
            ? { ...state.preferences, selectedProjectId: restoredProjectId }
            : state.preferences;
        /** @type {StoreEffect[]} */
        const effects = [
          { type: 'persist_project', project: restoredProject },
          { type: 'remove_trash_item', id: item.id },
        ];
        if (restoredTasks.length > 0) {
          effects.push({ type: 'persist_tasks', tasks: restoredTasks });
        }
        if (preferences !== state.preferences) {
          effects.push({ type: 'persist_preferences', preferences });
        }
        return {
          nextState: {
            ...state,
            projects: [...state.projects, restoredProject],
            tasks: [...state.tasks, ...restoredTasks],
            trash: remainingTrash,
            preferences,
          },
          effects,
        };
      }

      if (item.kind === 'task' && item.task) {
        const activeProjectExists = state.projects.some((p) => p.id === item.task?.projectId);
        const targetProjectId = activeProjectExists
          ? item.task.projectId
          : (state.projects[0]?.id ?? null);
        if (!targetProjectId) {
          throw new Error(
            'Impossible de restaurer cette tâche : créez ou restaurez d’abord un projet actif.',
          );
        }
        const takenTaskIds = new Set(state.tasks.map((t) => t.id));
        const restoredTaskId = resolveRestoredId(item.task.id, takenTaskIds);
        const nextPosition = state.tasks.filter(
          (t) => t.projectId === targetProjectId && t.status === item.task?.status,
        ).length;
        const restoredTask = Object.freeze({
          ...item.task,
          id: restoredTaskId,
          projectId: targetProjectId,
          position: nextPosition,
          updatedAt: command.now,
        });
        return {
          nextState: {
            ...state,
            tasks: [...state.tasks, restoredTask],
            trash: remainingTrash,
          },
          effects: [
            { type: 'persist_task', task: restoredTask },
            { type: 'remove_trash_item', id: item.id },
          ],
        };
      }

      if (item.kind === 'note' && item.note) {
        const activeProjectExists =
          item.note.projectId !== null && state.projects.some((p) => p.id === item.note?.projectId);
        const takenNoteIds = new Set(state.notes.map((n) => n.id));
        const restoredNoteId = resolveRestoredId(item.note.id, takenNoteIds);
        const restoredNote = Object.freeze({
          ...item.note,
          id: restoredNoteId,
          projectId: activeProjectExists ? item.note.projectId : null,
          updatedAt: command.now,
        });
        const preferences = { ...state.preferences, selectedNoteId: restoredNoteId };
        return {
          nextState: {
            ...state,
            notes: [restoredNote, ...state.notes],
            trash: remainingTrash,
            preferences,
          },
          effects: [
            { type: 'persist_note', note: restoredNote },
            { type: 'remove_trash_item', id: item.id },
            { type: 'persist_preferences', preferences },
          ],
        };
      }

      if (item.kind === 'whiteboard' && item.whiteboard) {
        const activeProjectExists =
          item.whiteboard.projectId !== null &&
          state.projects.some((p) => p.id === item.whiteboard?.projectId);
        const takenWbIds = new Set(state.whiteboards.map((w) => w.id));
        const restoredWbId = resolveRestoredId(item.whiteboard.id, takenWbIds);
        const restoredWb = Object.freeze({
          ...item.whiteboard,
          id: restoredWbId,
          projectId: activeProjectExists ? item.whiteboard.projectId : null,
          updatedAt: command.now,
        });
        const preferences = { ...state.preferences, selectedWhiteboardId: restoredWbId };
        return {
          nextState: {
            ...state,
            whiteboards: [restoredWb, ...state.whiteboards],
            trash: remainingTrash,
            preferences,
          },
          effects: [
            { type: 'persist_whiteboard', whiteboard: restoredWb },
            { type: 'remove_trash_item', id: item.id },
            { type: 'persist_preferences', preferences },
          ],
        };
      }

      return { nextState: state, effects: [] };
    }

    case 'purge_trash_item': {
      const target = state.trash.find((entry) => entry.id === command.id);
      if (!target) return { nextState: state, effects: [] };
      const removedKeys = new Set();
      collectTrashItemRemovedKeys(target, removedKeys);
      const pruned = pruneDeletedLinks(
        { tasks: state.tasks, notes: state.notes, whiteboards: state.whiteboards },
        removedKeys,
      );
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_trash_item', id: command.id }];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
          trash: state.trash.filter((entry) => entry.id !== command.id),
        },
        effects,
      };
    }

    case 'empty_trash': {
      if (state.trash.length === 0) return { nextState: state, effects: [] };
      const removedKeys = new Set();
      const ids = state.trash.map((entry) => {
        collectTrashItemRemovedKeys(entry, removedKeys);
        return entry.id;
      });
      const pruned = pruneDeletedLinks(
        { tasks: state.tasks, notes: state.notes, whiteboards: state.whiteboards },
        removedKeys,
      );
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_trash_items', ids }];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
          trash: [],
        },
        effects,
      };
    }

    case 'purge_expired_trash': {
      const nowMs = Date.parse(command.now);
      if (Number.isNaN(nowMs) || state.trash.length === 0) {
        return { nextState: state, effects: [] };
      }
      /** @type {TrashItem[]} */
      const kept = [];
      /** @type {string[]} */
      const expiredIds = [];
      const removedKeys = new Set();
      for (const entry of state.trash) {
        const expMs = Date.parse(entry.expiresAt);
        if (!Number.isNaN(expMs) && expMs <= nowMs) {
          expiredIds.push(entry.id);
          collectTrashItemRemovedKeys(entry, removedKeys);
        } else {
          kept.push(entry);
        }
      }
      if (expiredIds.length === 0) {
        return { nextState: state, effects: [] };
      }
      const pruned = pruneDeletedLinks(
        { tasks: state.tasks, notes: state.notes, whiteboards: state.whiteboards },
        removedKeys,
      );
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'remove_trash_items', ids: expiredIds }];
      if (pruned.changedTasks.length > 0) {
        effects.push({ type: 'persist_tasks', tasks: pruned.changedTasks });
      }
      for (const cn of pruned.changedNotes) {
        effects.push({ type: 'persist_note', note: cn });
      }
      for (const cw of pruned.changedWhiteboards) {
        effects.push({ type: 'persist_whiteboard', whiteboard: cw });
      }
      return {
        nextState: {
          ...state,
          tasks: pruned.tasks,
          notes: pruned.notes,
          whiteboards: pruned.whiteboards,
          trash: kept,
        },
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

    case 'create_template': {
      const template = createLocalTemplate({
        id: command.id,
        kind: command.kind,
        name: command.name,
        checklistItems: command.checklistItems,
        contentDoc: command.contentDoc,
        elements: command.elements,
        viewport: command.viewport,
        now: command.now,
      });
      return {
        nextState: {
          ...state,
          templates: [template, ...state.templates],
        },
        effects: [{ type: 'persist_template', template }],
      };
    }

    case 'delete_template': {
      if (!state.templates.some((t) => t.id === command.id && !t.builtin)) {
        return { nextState: state, effects: [] };
      }
      return {
        nextState: {
          ...state,
          templates: state.templates.filter((t) => t.id !== command.id),
        },
        effects: [{ type: 'remove_template', id: command.id }],
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
          : (command.payload.preferences?.taskStatuses ?? state.preferences.taskStatuses);
      const preferences = {
        ...state.preferences,
        ...command.payload.preferences,
        taskStatuses,
        selectedProjectId: command.payload.preferences
          ? command.payload.preferences.selectedProjectId
          : (command.payload.projects[0]?.id ?? null),
        selectedNoteId: command.payload.preferences
          ? command.payload.preferences.selectedNoteId
          : (command.payload.notes[0]?.id ?? null),
        selectedWhiteboardId: command.payload.preferences
          ? command.payload.preferences.selectedWhiteboardId
          : (command.payload.whiteboards[0]?.id ?? null),
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
          trash: [...(command.payload.trash ?? [])],
          templates: command.payload.templates ? [...command.payload.templates] : state.templates,
          preferences,
        },
        effects: [
          { type: 'persist_replace_all', payload: command.payload },
          { type: 'persist_preferences', preferences },
        ],
      };
    }

    case 'merge_backup': {
      const taskStatuses =
        command.payload.taskStatuses !== undefined
          ? normalizeTaskStatuses(command.payload.taskStatuses)
          : state.preferences.taskStatuses;
      const selectedProjectId =
        state.preferences.selectedProjectId ?? command.payload.projects[0]?.id ?? null;
      const selectedNoteId =
        state.preferences.selectedNoteId ?? command.payload.notes[0]?.id ?? null;
      const selectedWhiteboardId =
        state.preferences.selectedWhiteboardId ?? command.payload.whiteboards[0]?.id ?? null;
      const preferencesChanged =
        taskStatuses !== state.preferences.taskStatuses ||
        selectedProjectId !== state.preferences.selectedProjectId ||
        selectedNoteId !== state.preferences.selectedNoteId ||
        selectedWhiteboardId !== state.preferences.selectedWhiteboardId;
      const preferences = preferencesChanged
        ? {
            ...state.preferences,
            taskStatuses,
            selectedProjectId,
            selectedNoteId,
            selectedWhiteboardId,
          }
        : state.preferences;
      /** @type {StoreEffect[]} */
      const effects = [{ type: 'persist_merge', payload: command.payload }];
      if (preferencesChanged) {
        effects.push({ type: 'persist_preferences', preferences });
      }
      return {
        nextState: {
          ...state,
          projects: [...state.projects, ...command.payload.projects],
          tasks: [...state.tasks, ...command.payload.tasks],
          notes: [...state.notes, ...command.payload.notes],
          whiteboards: [...state.whiteboards, ...command.payload.whiteboards],
          assets: [...state.assets, ...command.payload.assets],
          preferences,
        },
        effects,
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
 * Check whether a task matches a due-date filter preset.
 * @param {Task} task
 * @param {TaskDueFilter | undefined} dueFilter
 * @param {string} todayIso
 * @returns {boolean}
 */
export function matchesTaskDueFilter(task, dueFilter, todayIso) {
  if (!dueFilter || dueFilter === 'all') return true;
  if (dueFilter === 'undated') return !task.dueDate;
  const urgency = classifyDueDateUrgency(task.dueDate, todayIso, task.status);
  if (dueFilter === 'overdue') return urgency === 'overdue';
  if (dueFilter === 'today') return urgency === 'today';
  if (dueFilter === 'week') return urgency === 'today' || urgency === 'this_week';
  return true;
}

/**
 * Select tasks matching optional filters.
 * Supports special status filters:
 * - `'all'` (default): all tasks (including tasks with no status or unknown status)
 * - `'__none__'`: only tasks with `status === null`
 * - `'__unknown__'`: only tasks whose `status` is non-null and not in `state.preferences.taskStatuses`
 * - `<statusId>`: only tasks with `task.status === statusId`
 * @param {AppState} state
 * @param {{ projectId?: string | null; status?: TaskStatusFilter; priority?: TaskPriority | 'all'; due?: TaskDueFilter; tag?: string | 'all'; todayIso?: string; query?: string; sortBy?: 'position' | 'dueDate' | 'priority' }} filters
 * @returns {Task[]}
 */
export function selectTasks(state, filters = {}) {
  const tokens = tokenizeSearchQuery(filters.query ?? '');
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const knownIds = new Set(state.preferences.taskStatuses.map((s) => s.id));
  const todayIso = filters.todayIso ?? getTodayIsoDate();
  const tagFilterNorm =
    filters.tag && filters.tag !== 'all' ? filters.tag.trim().toLowerCase() : null;

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
    if (!matchesTaskDueFilter(task, filters.due, todayIso)) {
      return false;
    }
    if (tagFilterNorm && !(task.tags ?? []).some((tag) => tag.toLowerCase() === tagFilterNorm)) {
      return false;
    }
    if (tokens.length > 0 && !matchesSearchTokens(extractTaskSearchText(task), tokens)) {
      return false;
    }
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
 * @param {{ priority?: TaskPriority | 'all'; due?: TaskDueFilter; tag?: string | 'all'; todayIso?: string }} [filters]
 * @returns {Record<string, Task[]>}
 */
export function selectKanbanColumns(state, projectId, query = '', filters = {}) {
  const tasks = selectTasks(state, {
    projectId,
    query,
    priority: filters.priority,
    due: filters.due,
    tag: filters.tag,
    todayIso: filters.todayIso,
    sortBy: 'position',
  });
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
 * Select tasks matching active scope/filters whose status is missing (`null`) or unknown to the Kanban columns.
 * @param {AppState} state
 * @param {string | null} projectId
 * @param {{ query?: string; priority?: TaskPriority | 'all'; due?: TaskDueFilter; tag?: string | 'all'; todayIso?: string }} [filters]
 * @returns {Task[]}
 */
export function selectUnmappedKanbanTasks(state, projectId, filters = {}) {
  const knownIds = new Set(state.preferences.taskStatuses.map((s) => s.id));
  const tasks = selectTasks(state, {
    projectId,
    query: filters.query,
    priority: filters.priority,
    due: filters.due,
    tag: filters.tag,
    todayIso: filters.todayIso,
    sortBy: 'position',
  });
  return tasks.filter((task) => task.status === null || !knownIds.has(task.status));
}

/**
 * Select notes matching project and search filters, sorted by most recently updated.
 * @param {AppState} state
 * @param {{ projectId?: string | null | 'all'; query?: string; tag?: string | 'all' }} filters
 * @returns {Note[]}
 */
export function selectNotes(state, filters = {}) {
  const tokens = tokenizeSearchQuery(filters.query ?? '');
  const tagFilterNorm =
    filters.tag && filters.tag !== 'all' ? filters.tag.trim().toLowerCase() : null;
  const filtered = state.notes.filter((note) => {
    if (filters.projectId !== undefined && filters.projectId !== 'all') {
      if (note.projectId !== filters.projectId) return false;
    }
    if (tagFilterNorm && !(note.tags ?? []).some((tag) => tag.toLowerCase() === tagFilterNorm)) {
      return false;
    }
    if (tokens.length > 0 && !matchesSearchTokens(extractNoteSearchText(note), tokens)) {
      return false;
    }
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
  const tokens = tokenizeSearchQuery(filters.query ?? '');
  const filtered = state.whiteboards.filter((wb) => {
    if (filters.projectId !== undefined && filters.projectId !== 'all') {
      if (wb.projectId !== filters.projectId) return false;
    }
    if (tokens.length > 0 && !matchesSearchTokens(extractWhiteboardSearchText(wb), tokens)) {
      return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Return all distinct tags used across tasks and notes, sorted alphabetically.
 * @param {AppState} state
 * @returns {string[]}
 */
export function selectAllTags(state) {
  /** @type {Map<string, string>} */
  const unique = new Map();
  for (const task of state.tasks) {
    for (const tag of task.tags ?? []) {
      const key = tag.toLowerCase();
      if (!unique.has(key)) unique.set(key, tag);
    }
  }
  for (const note of state.notes) {
    for (const tag of note.tags ?? []) {
      const key = tag.toLowerCase();
      if (!unique.has(key)) unique.set(key, tag);
    }
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

/**
 * Resolve outgoing local links and incoming backlinks for a given entity (task, note or whiteboard).
 * @param {AppState} state
 * @param {LocalEntityKind} kind
 * @param {string} id
 * @param {readonly LocalRef[]} [overrideOutgoing]
 * @returns {{
 *   outgoing: Array<{ kind: LocalEntityKind; id: string; title: string; projectName: string | null }>;
 *   incoming: Array<{ kind: LocalEntityKind; id: string; title: string; projectName: string | null }>;
 * }}
 */
export function selectEntityLinkEntries(state, kind, id, overrideOutgoing) {
  const projectsById = new Map(state.projects.map((p) => [p.id, p.name]));
  const tasksById = new Map(state.tasks.map((t) => [t.id, t]));
  const notesById = new Map(state.notes.map((n) => [n.id, n]));
  const wbsById = new Map(state.whiteboards.map((w) => [w.id, w]));

  /** @param {LocalRef} ref */
  function resolveRef(ref) {
    if (ref.kind === 'task') {
      const t = tasksById.get(ref.id);
      if (!t) return null;
      return {
        kind: /** @type {const} */ ('task'),
        id: t.id,
        title: t.title,
        projectName: projectsById.get(t.projectId) ?? null,
      };
    }
    if (ref.kind === 'note') {
      const n = notesById.get(ref.id);
      if (!n) return null;
      return {
        kind: /** @type {const} */ ('note'),
        id: n.id,
        title: n.title,
        projectName: n.projectId ? (projectsById.get(n.projectId) ?? null) : null,
      };
    }
    const w = wbsById.get(ref.id);
    if (!w) return null;
    return {
      kind: /** @type {const} */ ('whiteboard'),
      id: w.id,
      title: w.title,
      projectName: w.projectId ? (projectsById.get(w.projectId) ?? null) : null,
    };
  }

  let rawOutgoing = overrideOutgoing;
  if (!rawOutgoing) {
    if (kind === 'task') rawOutgoing = tasksById.get(id)?.links ?? [];
    else if (kind === 'note') rawOutgoing = notesById.get(id)?.links ?? [];
    else rawOutgoing = wbsById.get(id)?.links ?? [];
  }

  /** @type {Array<{ kind: LocalEntityKind; id: string; title: string; projectName: string | null }>} */
  const outgoing = [];
  const outgoingKeys = new Set();
  for (const ref of rawOutgoing) {
    if (ref.kind === kind && ref.id === id) continue;
    const key = `${ref.kind}:${ref.id}`;
    if (outgoingKeys.has(key)) continue;
    const resolved = resolveRef(ref);
    if (resolved) {
      outgoingKeys.add(key);
      outgoing.push(resolved);
    }
  }

  /** @type {Array<{ kind: LocalEntityKind; id: string; title: string; projectName: string | null }>} */
  const incoming = [];
  const scanIncoming = (
    /** @type {LocalEntityKind} */ srcKind,
    /** @type {{ id: string; title: string; projectId: string | null; links?: readonly LocalRef[] }} */ item,
  ) => {
    if (srcKind === kind && item.id === id) return;
    if (outgoingKeys.has(`${srcKind}:${item.id}`)) return;
    if ((item.links ?? []).some((ref) => ref.kind === kind && ref.id === id)) {
      incoming.push({
        kind: srcKind,
        id: item.id,
        title: item.title,
        projectName: item.projectId ? (projectsById.get(item.projectId) ?? null) : null,
      });
    }
  };
  for (const t of state.tasks) scanIncoming('task', t);
  for (const n of state.notes) scanIncoming('note', n);
  for (const w of state.whiteboards) scanIncoming('whiteboard', w);

  return { outgoing, incoming };
}

/**
 * Collect every assetId currently referenced by tasks, notes or whiteboards.
 * @param {AppState} state
 * @returns {Set<string>}
 */
/**
 * Select built-in + custom local templates, optionally filtered by kind.
 * @param {AppState} state
 * @param {TemplateKind} [kind]
 * @returns {LocalTemplate[]}
 */
export function selectTemplates(state, kind) {
  if (kind) return getTemplatesForKind(state.templates, kind);
  return [...state.templates];
}

/**
 * Select all items currently in the local trash sorted newest deleted first.
 * @param {AppState} state
 * @returns {TrashItem[]}
 */
export function selectTrashItems(state) {
  return [...state.trash].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * Collect every assetId currently referenced by active entities or items in the trash.
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
  for (const item of state.trash) {
    for (const id of item.assetIds) used.add(id);
    if (item.task) {
      for (const id of item.task.assetIds) used.add(id);
    }
    if (item.tasks) {
      for (const t of item.tasks) {
        for (const id of t.assetIds) used.add(id);
      }
    }
    if (item.note) {
      for (const id of item.note.assetIds) used.add(id);
    }
    if (item.whiteboard) {
      for (const id of item.whiteboard.assetIds) used.add(id);
    }
  }
  return used;
}

/**
 * Return asset IDs from candidateIds (or state.assets) that are no longer referenced anywhere.
 * @param {AppState} state
 * @param {Iterable<string>} [candidateIds]
 * @returns {string[]}
 */
export function selectOrphanedAssetIds(state, candidateIds) {
  const referenced = selectReferencedAssetIds(state);
  const existingIds = new Set(state.assets.map((a) => a.id));
  const pool = candidateIds ?? existingIds;
  /** @type {string[]} */
  const orphaned = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const id of pool) {
    if (!seen.has(id) && existingIds.has(id) && !referenced.has(id)) {
      seen.add(id);
      orphaned.push(id);
    }
  }
  return orphaned;
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

/**
 * Build the summary dataset for the "Aujourd’hui" dashboard view.
 * @param {AppState} state
 * @param {string} [todayIso]
 * @returns {{
 *   todayIso: string;
 *   overdueTasks: Task[];
 *   dueTodayTasks: Task[];
 *   upcomingTasks: Task[];
 *   highPriorityTasks: Task[];
 *   recentItems: Array<{ kind: 'task' | 'note' | 'whiteboard'; id: string; title: string; projectId: string | null; updatedAt: string }>;
 * }}
 */
export function selectTodaySummary(state, todayIso = getTodayIsoDate()) {
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const weekLimitIso = shiftIsoDate(todayIso, 7);

  /**
   * @param {Task} a
   * @param {Task} b
   */
  const compareDueAndPrio = (a, b) => {
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const prioDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
    if (prioDiff !== 0) return prioDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  };

  const openTasks = state.tasks.filter((task) => task.status !== 'done');
  const overdueTasks = openTasks
    .filter((task) => Boolean(task.dueDate && task.dueDate < todayIso))
    .sort(compareDueAndPrio);
  const dueTodayTasks = openTasks
    .filter((task) => task.dueDate === todayIso)
    .sort(compareDueAndPrio);
  const upcomingTasks = openTasks
    .filter((task) =>
      Boolean(task.dueDate && task.dueDate > todayIso && task.dueDate <= weekLimitIso),
    )
    .sort(compareDueAndPrio);
  const highPriorityTasks = openTasks
    .filter((task) => task.priority === 'high')
    .sort(compareDueAndPrio);

  /** @type {Array<{ kind: 'task' | 'note' | 'whiteboard'; id: string; title: string; projectId: string | null; updatedAt: string }>} */
  const allRecent = [
    ...state.tasks.map((t) => ({
      kind: /** @type {const} */ ('task'),
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      updatedAt: t.updatedAt,
    })),
    ...state.notes.map((n) => ({
      kind: /** @type {const} */ ('note'),
      id: n.id,
      title: n.title,
      projectId: n.projectId,
      updatedAt: n.updatedAt,
    })),
    ...state.whiteboards.map((w) => ({
      kind: /** @type {const} */ ('whiteboard'),
      id: w.id,
      title: w.title,
      projectId: w.projectId,
      updatedAt: w.updatedAt,
    })),
  ];

  const recentItems = allRecent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  return {
    todayIso,
    overdueTasks,
    dueTodayTasks,
    upcomingTasks,
    highPriorityTasks,
    recentItems,
  };
}
