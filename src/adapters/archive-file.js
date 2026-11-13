/** @import { AllowedImageMimeType, BackupData, BackupManifest } from '../types.d.ts' */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { ALLOWED_IMAGE_MIMES } from '../core/model.js';
import { MAX_ARCHIVE_BYTES, MAX_ASSET_BYTES } from '../core/schema.js';
import { validateArchiveContents } from '../core/backup.js';

/**
 * Create a ZIP archive Blob containing manifest.json, data.json and assets/*.
 * @param {{
 *   manifest: BackupManifest;
 *   data: BackupData;
 *   assetBlobs: ReadonlyMap<string, Blob>;
 * }} input
 * @returns {Promise<Blob>}
 */
export async function buildArchiveZipBlob({ manifest, data, assetBlobs }) {
  /** @type {Record<string, Uint8Array>} */
  const files = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(data, null, 2)),
  };

  for (const meta of data.assets) {
    const blob = assetBlobs.get(meta.id);
    if (blob) {
      const buf = await blob.arrayBuffer();
      files[`assets/${meta.id}`] = new Uint8Array(buf);
    }
  }

  const zipped = zipSync(files, { level: 6 });
  const copy = new Uint8Array(zipped.byteLength);
  copy.set(zipped);
  return new Blob([copy.buffer], { type: 'application/zip' });
}

/**
 * Trigger a browser download for an archive Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerArchiveDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Read, extract and validate a backup ZIP archive from a Blob or File.
 * @param {Blob} file
 * @returns {Promise<
 *   | { ok: true; manifest: BackupManifest; data: BackupData; blobs: Map<string, Blob> }
 *   | { ok: false; error: string }
 * >}
 */
export async function parseArchiveFile(file) {
  if (file.size === 0) {
    return { ok: false, error: 'Impossible d’importer l’archive. Le fichier est vide.' };
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return {
      ok: false,
      error: 'Impossible d’importer l’archive. Le fichier dépasse la limite de 25 Mio.',
    };
  }

  /** @type {Record<string, Uint8Array>} */
  let entries;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    entries = unzipSync(bytes);
  } catch {
    return {
      ok: false,
      error: 'Impossible d’ouvrir l’archive. Le fichier ZIP est corrompu ou invalide.',
    };
  }

  const manifestBytes = entries['manifest.json'];
  const dataBytes = entries['data.json'];
  if (!manifestBytes || !dataBytes) {
    return {
      ok: false,
      error: 'Archive incomplète. Les fichiers manifest.json et data.json sont requis.',
    };
  }

  /** @type {unknown} */
  let rawManifest;
  /** @type {unknown} */
  let rawData;
  try {
    rawManifest = JSON.parse(strFromU8(manifestBytes));
    rawData = JSON.parse(strFromU8(dataBytes));
  } catch {
    return {
      ok: false,
      error: 'Impossible de lire les données. Le contenu JSON de l’archive est invalide.',
    };
  }

  /** @type {Map<string, Uint8Array>} */
  const binaryAssets = new Map();
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.startsWith('assets/') && bytes.byteLength > 0) {
      const id = path.slice('assets/'.length);
      if (id && !id.includes('/')) {
        binaryAssets.set(id, bytes);
      }
    }
  }

  const validated = validateArchiveContents(rawManifest, rawData, binaryAssets);
  if (!validated.ok) {
    return validated;
  }

  /** @type {Map<string, Blob>} */
  const blobs = new Map();
  for (const meta of validated.data.assets) {
    const bytes = binaryAssets.get(meta.id);
    if (bytes) {
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      blobs.set(meta.id, new Blob([copy.buffer], { type: meta.mimeType }));
    }
  }

  return {
    ok: true,
    manifest: /** @type {BackupManifest} */ (rawManifest),
    data: validated.data,
    blobs,
  };
}

/**
 * Validate a user-selected or pasted image File before storing it locally.
 * @param {File} file
 * @returns {{ ok: true; mimeType: AllowedImageMimeType } | { ok: false; error: string }}
 */
export function validateImageFile(file) {
  const mimeType = /** @type {AllowedImageMimeType} */ (file.type);
  if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
    return {
      ok: false,
      error: 'Format d’image non pris en charge. Utilisez PNG, JPEG, WebP ou GIF.',
    };
  }
  if (file.size === 0 || file.size > MAX_ASSET_BYTES) {
    return {
      ok: false,
      error: 'L’image doit être non vide et ne pas dépasser 5 Mio.',
    };
  }
  return { ok: true, mimeType };
}
