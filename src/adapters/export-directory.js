/**
 * @typedef {FileSystemDirectoryHandle & {
 *   requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
 *   queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
 * }} ExportDirectoryHandle
 */

const META_KEY = 'exportDirectory';
export const DIRECTORY_BACKUP_FILENAME = 'locavern-sauvegarde.zip';
/** @type {ExportDirectoryHandle | null} */
let directory = null;
/** @type {import('idb').IDBPDatabase | null} */
let database = null;
let remembered = true;
/** @type {string | null} */
let lastSavedAt = null;
/** @type {Set<() => void>} */
const listeners = new Set();

export function supportsExportDirectory() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof (/** @type {{ showDirectoryPicker?: unknown }} */ (window).showDirectoryPicker) ===
      'function'
  );
}

/** @param {import('idb').IDBPDatabase} db */
export async function initializeExportDirectory(db) {
  database = db;
  directory = null;
  lastSavedAt = null;
  remembered = true;
  if (!supportsExportDirectory()) return;
  try {
    const row = await db.get('meta', META_KEY);
    if (row?.value?.kind === 'directory') {
      directory = row.value;
      lastSavedAt = typeof row.lastSavedAt === 'string' ? row.lastSavedAt : null;
    }
  } catch {
    /* The app remains usable when directory persistence is unavailable. */
  }
}

export function getExportDirectoryName() {
  return directory?.name ?? null;
}
export function getDirectoryTarget() {
  return directory;
}
export function getDirectoryBackupInfo() {
  return { name: getExportDirectoryName(), lastSavedAt, remembered };
}

/** @param {() => void} listener */
export function subscribeExportDirectory(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Invoked directly from a click. Selecting a folder enables automatic backups. */
export async function chooseExportDirectory() {
  if (!supportsExportDirectory())
    throw new Error('La sauvegarde dans un dossier est indisponible.');
  const picker =
    /** @type {{ showDirectoryPicker: (options: unknown) => Promise<ExportDirectoryHandle> }} */ (
      /** @type {unknown} */ (window)
    );
  const selected = await picker.showDirectoryPicker({ id: 'locavern-exports', mode: 'readwrite' });
  directory = selected;
  lastSavedAt = null;
  remembered = false;
  try {
    if (database) {
      await database.put('meta', { key: META_KEY, value: selected, lastSavedAt: null });
      remembered = true;
    }
  } catch {
    /* Keep the chosen folder available for this session. */
  }
  for (const listener of listeners) listener();
  return { remembered };
}

export async function forgetExportDirectory() {
  if (database) await database.delete('meta', META_KEY);
  directory = null;
  lastSavedAt = null;
  for (const listener of listeners) listener();
}

/** Background backups only query access; prompting requires an explicit click.
 * @param {ExportDirectoryHandle} target
 * @param {boolean} interactive
 */
export function checkDirectoryPermission(target, interactive) {
  return interactive
    ? target.requestPermission({ mode: 'readwrite' })
    : target.queryPermission({ mode: 'readwrite' });
}

/** @param {ExportDirectoryHandle} target
 * @param {Blob} blob
 */
export async function writeDirectoryBackup(target, blob) {
  const handle = await target.getFileHandle(DIRECTORY_BACKUP_FILENAME, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      /* Preserve the write error. */
    }
    throw error;
  }
}

/** @param {ExportDirectoryHandle} target
 * @param {string} timestamp
 */
export async function recordDirectoryBackup(target, timestamp) {
  if (target !== directory) return;
  lastSavedAt = timestamp;
  if (database && remembered) {
    try {
      await database.put('meta', { key: META_KEY, value: target, lastSavedAt: timestamp });
    } catch {
      /* The disk write succeeded; keep its timestamp for this session. */
    }
  }
}
