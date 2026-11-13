/** @import { AllowedImageMimeType, ChecklistItem, Note, Project, RichTextDoc, RichTextMark, RichTextNode, Task, TaskPriority, TaskStatus } from '../types.d.ts' */

/** @type {readonly TaskStatus[]} */
export const TASK_STATUSES = Object.freeze(['todo', 'in_progress', 'done']);

/** @type {readonly TaskPriority[]} */
export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

/** @type {ReadonlySet<AllowedImageMimeType>} */
export const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** @type {RichTextDoc} */
export const EMPTY_RICH_DOC = Object.freeze({
  type: 'doc',
  content: Object.freeze([{ type: 'paragraph' }]),
});

const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'hardBreak',
  'localImage',
]);

const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'code', 'strike', 'link']);

/**
 * Validate and sanitize a link URL (only https: and mailto: allowed).
 * @param {unknown} rawHref
 * @returns {string | null}
 */
export function sanitizeLinkHref(rawHref) {
  if (typeof rawHref !== 'string') return null;
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sanitize a single ProseMirror/Tiptap mark.
 * @param {unknown} raw
 * @returns {RichTextMark | null}
 */
function sanitizeMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = /** @type {Record<string, unknown>} */ (raw);
  if (typeof candidate.type !== 'string' || !ALLOWED_MARK_TYPES.has(candidate.type)) {
    return null;
  }
  if (candidate.type === 'link') {
    const attrs =
      candidate.attrs && typeof candidate.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (candidate.attrs)
        : null;
    const safeHref = sanitizeLinkHref(attrs?.href);
    if (!safeHref) return null;
    return {
      type: 'link',
      attrs: {
        href: safeHref,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  }
  return { type: candidate.type };
}

/**
 * Sanitize a single ProseMirror/Tiptap node recursively.
 * @param {unknown} raw
 * @returns {RichTextNode | null}
 */
function sanitizeNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const node = /** @type {Record<string, unknown>} */ (raw);
  if (typeof node.type !== 'string' || !ALLOWED_NODE_TYPES.has(node.type)) {
    return null;
  }

  if (node.type === 'text') {
    if (typeof node.text !== 'string') return null;
    const rawMarks = Array.isArray(node.marks) ? node.marks : [];
    /** @type {RichTextMark[]} */
    const marks = [];
    for (const m of rawMarks) {
      const cleanMark = sanitizeMark(m);
      if (cleanMark) marks.push(cleanMark);
    }
    return node.marks !== undefined
      ? { type: 'text', text: node.text, marks }
      : { type: 'text', text: node.text };
  }

  if (node.type === 'localImage') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const assetId = typeof attrs?.assetId === 'string' ? attrs.assetId.trim() : '';
    if (!assetId) return null;
    const alt = typeof attrs?.alt === 'string' ? attrs.alt.slice(0, 200) : '';
    return {
      type: 'localImage',
      attrs: { assetId, alt },
    };
  }

  /** @type {Record<string, unknown> | undefined} */
  let cleanAttrs;
  if (node.type === 'heading') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    const level =
      typeof attrs?.level === 'number' && [1, 2, 3].includes(attrs.level) ? attrs.level : 2;
    cleanAttrs = { level };
  } else if (node.type === 'taskItem') {
    const attrs =
      node.attrs && typeof node.attrs === 'object'
        ? /** @type {Record<string, unknown>} */ (node.attrs)
        : null;
    cleanAttrs = { checked: Boolean(attrs?.checked) };
  }

  const rawContent = Array.isArray(node.content) ? node.content : undefined;
  /** @type {RichTextNode[] | undefined} */
  let cleanContent;
  if (rawContent) {
    cleanContent = [];
    for (const child of rawContent) {
      const sanitized = sanitizeNode(child);
      if (sanitized) cleanContent.push(sanitized);
    }
  }

  /** @type {RichTextNode} */
  const out = { type: node.type };
  if (cleanAttrs) {
    return cleanContent !== undefined
      ? { ...out, attrs: cleanAttrs, content: cleanContent }
      : { ...out, attrs: cleanAttrs };
  }
  return cleanContent !== undefined ? { ...out, content: cleanContent } : out;
}

/**
 * Sanitize an arbitrary Tiptap JSON document and remove remote images / unsafe links.
 * @param {unknown} rawDoc
 * @returns {RichTextDoc}
 */
export function sanitizeRichTextDoc(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') {
    return EMPTY_RICH_DOC;
  }
  const candidate = /** @type {Record<string, unknown>} */ (rawDoc);
  if (candidate.type !== 'doc' || !Array.isArray(candidate.content)) {
    return EMPTY_RICH_DOC;
  }
  /** @type {RichTextNode[]} */
  const cleanContent = [];
  for (const child of candidate.content) {
    if (
      child &&
      typeof child === 'object' &&
      /** @type {Record<string, unknown>} */ (child).type === 'doc'
    ) {
      continue;
    }
    const clean = sanitizeNode(child);
    if (clean) cleanContent.push(clean);
  }
  if (cleanContent.length === 0) {
    return EMPTY_RICH_DOC;
  }
  return { type: 'doc', content: cleanContent };
}

/**
 * Extract all unique localImage assetIds referenced in a RichTextDoc.
 * @param {RichTextDoc} doc
 * @returns {string[]}
 */
export function collectDocAssetIds(doc) {
  /** @type {Set<string>} */
  const ids = new Set();

  /** @param {readonly RichTextNode[] | undefined} nodes */
  function walk(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === 'localImage' && typeof node.attrs?.assetId === 'string') {
        const assetId = node.attrs.assetId.trim();
        if (assetId) ids.add(assetId);
      }
      if (node.content) walk(node.content);
    }
  }

  walk(doc.content);
  return [...ids];
}

/**
 * Normalize an optional due date (YYYY-MM-DD or null).
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function normalizeDueDate(value) {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return trimmed;
    }
  }
  throw new Error('Date d’échéance invalide. Utilisez le format AAAA-MM-JJ.');
}

/**
 * Normalize a checklist array.
 * @param {readonly ChecklistItem[] | undefined} items
 * @returns {readonly ChecklistItem[]}
 */
export function normalizeChecklist(items) {
  if (!items) return [];
  return items
    .map((item) => ({
      id: item.id.trim(),
      text: item.text.trim(),
      done: Boolean(item.done),
    }))
    .filter((item) => item.id.length > 0 && item.text.length > 0);
}

/**
 * Create a validated Project record.
 * @param {{ id: string; name: string; description?: string; archived?: boolean; now: string }} input
 * @returns {Project}
 */
export function createProject({ id, name, description = '', archived = false, now }) {
  const cleanId = id.trim();
  const cleanName = name.trim();
  if (!cleanId) {
    throw new Error('Identifiant de projet requis.');
  }
  if (!cleanName) {
    throw new Error('Le nom du projet ne peut pas être vide.');
  }
  if (cleanName.length > 120) {
    throw new Error('Le nom du projet ne peut pas dépasser 120 caractères.');
  }
  return Object.freeze({
    id: cleanId,
    name: cleanName,
    description: description.trim().slice(0, 1000),
    archived: Boolean(archived),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Create a validated Task record.
 * @param {{
 *   id: string;
 *   projectId: string;
 *   title: string;
 *   status?: TaskStatus;
 *   priority?: TaskPriority;
 *   dueDate?: string | null;
 *   position?: number;
 *   descriptionDoc?: RichTextDoc;
 *   checklist?: readonly ChecklistItem[];
 *   assetIds?: readonly string[];
 *   now: string;
 * }} input
 * @returns {Task}
 */
export function createTask({
  id,
  projectId,
  title,
  status = 'todo',
  priority = 'medium',
  dueDate = null,
  position = 0,
  descriptionDoc,
  checklist = [],
  assetIds,
  now,
}) {
  const cleanId = id.trim();
  const cleanProjectId = projectId.trim();
  const cleanTitle = title.trim();
  if (!cleanId) throw new Error('Identifiant de tâche requis.');
  if (!cleanProjectId) throw new Error('Une tâche doit être rattachée à un projet.');
  if (!cleanTitle) throw new Error('Le titre de la tâche ne peut pas être vide.');
  if (cleanTitle.length > 200) {
    throw new Error('Le titre de la tâche ne peut pas dépasser 200 caractères.');
  }
  if (!TASK_STATUSES.includes(status)) {
    throw new Error(`Statut de tâche invalide : ${status}.`);
  }
  if (!TASK_PRIORITIES.includes(priority)) {
    throw new Error(`Priorité de tâche invalide : ${priority}.`);
  }

  const cleanDoc = sanitizeRichTextDoc(descriptionDoc);
  const derivedAssetIds = collectDocAssetIds(cleanDoc);
  const mergedAssets = [...new Set([...(assetIds ?? []), ...derivedAssetIds])];

  return Object.freeze({
    id: cleanId,
    projectId: cleanProjectId,
    title: cleanTitle,
    status,
    priority,
    dueDate: normalizeDueDate(dueDate),
    position: Number.isFinite(position) && position >= 0 ? Math.trunc(position) : 0,
    descriptionDoc: cleanDoc,
    checklist: normalizeChecklist(checklist),
    assetIds: mergedAssets,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Create a validated Note record.
 * @param {{
 *   id: string;
 *   projectId: string | null;
 *   title: string;
 *   contentDoc?: RichTextDoc;
 *   assetIds?: readonly string[];
 *   now: string;
 * }} input
 * @returns {Note}
 */
export function createNote({ id, projectId, title, contentDoc, assetIds, now }) {
  const cleanId = id.trim();
  const cleanTitle = title.trim();
  if (!cleanId) throw new Error('Identifiant de note requis.');
  if (!cleanTitle) throw new Error('Le titre de la note ne peut pas être vide.');
  if (cleanTitle.length > 200) {
    throw new Error('Le titre de la note ne peut pas dépasser 200 caractères.');
  }
  const cleanDoc = sanitizeRichTextDoc(contentDoc);
  const derivedAssetIds = collectDocAssetIds(cleanDoc);
  const mergedAssets = [...new Set([...(assetIds ?? []), ...derivedAssetIds])];

  return Object.freeze({
    id: cleanId,
    projectId: projectId ? projectId.trim() : null,
    title: cleanTitle,
    contentDoc: cleanDoc,
    assetIds: mergedAssets,
    createdAt: now,
    updatedAt: now,
  });
}
