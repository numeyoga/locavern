/** @import { AllowedImageMimeType, AssetMeta, BackupData, ChecklistItem, Note, Project, Task, TaskPriority, TaskStatus } from '../types.d.ts' */

import {
  ALLOWED_IMAGE_MIMES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  collectDocAssetIds,
  normalizeDueDate,
  sanitizeRichTextDoc,
} from './model.js';

export const CURRENT_SCHEMA_VERSION = 1;
export const MAX_IMPORT_RECORDS = 10_000;
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * @param {unknown} raw
 * @returns {Project | null}
 */
function parseProject(raw) {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.id);
  const name = asNonEmptyString(raw.name);
  const createdAt = asNonEmptyString(raw.createdAt);
  const updatedAt = asNonEmptyString(raw.updatedAt);
  if (!id || !name || !createdAt || !updatedAt) return null;
  return Object.freeze({
    id,
    name: name.slice(0, 120),
    description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 1000) : '',
    archived: Boolean(raw.archived),
    createdAt,
    updatedAt,
  });
}

/**
 * @param {unknown} raw
 * @returns {ChecklistItem[] | null}
 */
function parseChecklist(raw) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  /** @type {ChecklistItem[]} */
  const items = [];
  for (const item of raw) {
    if (!isRecord(item)) return null;
    const id = asNonEmptyString(item.id);
    const text = asNonEmptyString(item.text);
    if (!id || !text) return null;
    items.push({ id, text: text.slice(0, 200), done: Boolean(item.done) });
  }
  return items;
}

/**
 * @param {unknown} raw
 * @returns {Task | null}
 */
function parseTask(raw) {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.id);
  const projectId = asNonEmptyString(raw.projectId);
  const title = asNonEmptyString(raw.title);
  const createdAt = asNonEmptyString(raw.createdAt);
  const updatedAt = asNonEmptyString(raw.updatedAt);
  if (!id || !projectId || !title || !createdAt || !updatedAt) return null;

  const status = /** @type {TaskStatus} */ (raw.status);
  if (!TASK_STATUSES.includes(status)) return null;

  const priority = /** @type {TaskPriority} */ (raw.priority);
  if (!TASK_PRIORITIES.includes(priority)) return null;

  let dueDate;
  try {
    dueDate = normalizeDueDate(
      raw.dueDate === null || raw.dueDate === undefined ? null : String(raw.dueDate),
    );
  } catch {
    return null;
  }

  const checklist = parseChecklist(raw.checklist);
  if (!checklist) return null;

  const descriptionDoc = sanitizeRichTextDoc(raw.descriptionDoc);
  const rawAssetIds = Array.isArray(raw.assetIds)
    ? raw.assetIds.filter((a) => typeof a === 'string' && a.trim().length > 0)
    : [];
  const assetIds = [...new Set([...rawAssetIds, ...collectDocAssetIds(descriptionDoc)])];

  return Object.freeze({
    id,
    projectId,
    title: title.slice(0, 200),
    status,
    priority,
    dueDate,
    position: typeof raw.position === 'number' && raw.position >= 0 ? Math.trunc(raw.position) : 0,
    descriptionDoc,
    checklist,
    assetIds,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {unknown} raw
 * @returns {Note | null}
 */
function parseNote(raw) {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.id);
  const title = asNonEmptyString(raw.title);
  const createdAt = asNonEmptyString(raw.createdAt);
  const updatedAt = asNonEmptyString(raw.updatedAt);
  if (!id || !title || !createdAt || !updatedAt) return null;

  let projectId = null;
  if (raw.projectId !== null && raw.projectId !== undefined) {
    projectId = asNonEmptyString(raw.projectId);
    if (!projectId) return null;
  }

  const contentDoc = sanitizeRichTextDoc(raw.contentDoc);
  const rawAssetIds = Array.isArray(raw.assetIds) ? rawAssetIdsFrom(raw.assetIds) : [];
  const assetIds = [...new Set([...rawAssetIds, ...collectDocAssetIds(contentDoc)])];

  return Object.freeze({
    id,
    projectId,
    title: title.slice(0, 200),
    contentDoc,
    assetIds,
    createdAt,
    updatedAt,
  });
}

/**
 * @param {unknown[]} arr
 * @returns {string[]}
 */
function rawAssetIdsFrom(arr) {
  /** @type {string[]} */
  const out = [];
  for (const entry of arr) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry.trim());
    }
  }
  return out;
}

/**
 * @param {unknown} raw
 * @returns {AssetMeta | null}
 */
function parseAssetMeta(raw) {
  if (!isRecord(raw)) return null;
  const id = asNonEmptyString(raw.id);
  const filename = asNonEmptyString(raw.filename);
  const createdAt = asNonEmptyString(raw.createdAt);
  const mimeType = /** @type {AllowedImageMimeType} */ (raw.mimeType);
  if (!id || !filename || !createdAt) return null;
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) return null;
  if (typeof raw.sizeBytes !== 'number' || raw.sizeBytes <= 0 || raw.sizeBytes > MAX_ASSET_BYTES) {
    return null;
  }
  return Object.freeze({
    id,
    mimeType,
    sizeBytes: Math.trunc(raw.sizeBytes),
    filename: filename.slice(0, 255),
    createdAt,
  });
}

/**
 * Validate a schema v1 BackupData object strictly.
 * @param {unknown} raw
 * @returns {{ ok: true; data: BackupData } | { ok: false; error: string }}
 */
export function validateBackupData(raw) {
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: 'Impossible de lire la sauvegarde. Le contenu JSON est invalide.',
    };
  }
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Version de schéma non prise en charge (${String(raw.schemaVersion)}).`,
    };
  }
  const exportedAt = asNonEmptyString(raw.exportedAt);
  if (!exportedAt) {
    return {
      ok: false,
      error: 'Impossible de valider la sauvegarde. La date d’export est absente.',
    };
  }
  if (
    !Array.isArray(raw.projects) ||
    !Array.isArray(raw.tasks) ||
    !Array.isArray(raw.notes) ||
    !Array.isArray(raw.assets)
  ) {
    return {
      ok: false,
      error: 'Impossible de valider la sauvegarde. Collections attendues manquantes.',
    };
  }

  const totalCount = raw.projects.length + raw.tasks.length + raw.notes.length + raw.assets.length;
  if (totalCount > MAX_IMPORT_RECORDS) {
    return {
      ok: false,
      error: `La sauvegarde dépasse la limite de ${MAX_IMPORT_RECORDS} enregistrements.`,
    };
  }

  /** @type {Project[]} */
  const projects = [];
  /** @type {Set<string>} */
  const projectIds = new Set();
  for (const item of raw.projects) {
    const p = parseProject(item);
    if (!p || projectIds.has(p.id)) {
      return { ok: false, error: 'Données de projet invalides ou dupliquées dans la sauvegarde.' };
    }
    projectIds.add(p.id);
    projects.push(p);
  }

  /** @type {Task[]} */
  const tasks = [];
  /** @type {Set<string>} */
  const taskIds = new Set();
  for (const item of raw.tasks) {
    const t = parseTask(item);
    if (!t || taskIds.has(t.id) || !projectIds.has(t.projectId)) {
      return {
        ok: false,
        error: 'Données de tâche invalides ou rattachées à un projet inexistant.',
      };
    }
    taskIds.add(t.id);
    tasks.push(t);
  }

  /** @type {Note[]} */
  const notes = [];
  /** @type {Set<string>} */
  const noteIds = new Set();
  for (const item of raw.notes) {
    const n = parseNote(item);
    if (!n || noteIds.has(n.id) || (n.projectId !== null && !projectIds.has(n.projectId))) {
      return {
        ok: false,
        error: 'Données de note invalides ou rattachées à un projet inexistant.',
      };
    }
    noteIds.add(n.id);
    notes.push(n);
  }

  /** @type {AssetMeta[]} */
  const assets = [];
  /** @type {Set<string>} */
  const assetIds = new Set();
  for (const item of raw.assets) {
    const a = parseAssetMeta(item);
    if (!a || assetIds.has(a.id)) {
      return {
        ok: false,
        error: 'Métadonnées d’image invalides ou type MIME non autorisé dans la sauvegarde.',
      };
    }
    assetIds.add(a.id);
    assets.push(a);
  }

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      exportedAt,
      projects,
      tasks,
      notes,
      assets,
    },
  };
}

/**
 * Pure migration pipeline from older supported schema versions to CURRENT_SCHEMA_VERSION.
 * Rejects unknown future versions or corrupted payloads cleanly.
 * @param {unknown} raw
 * @returns {{ ok: true; data: BackupData } | { ok: false; error: string }}
 */
export function migrateBackupData(raw) {
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: 'Impossible de lire les données. Le document JSON est mal formé.',
    };
  }
  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      error: 'Version de schéma absente ou invalide dans la sauvegarde.',
    };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Cette sauvegarde utilise une version de schéma future (${version}) non supportée par cette version de Locavern.`,
    };
  }
  return validateBackupData(raw);
}
