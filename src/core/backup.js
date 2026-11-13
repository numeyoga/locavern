/** @import { AppState, BackupData, BackupManifest } from '../types.d.ts' */

import {
  CURRENT_SCHEMA_VERSION,
  MAX_ARCHIVE_BYTES,
  MAX_ASSET_BYTES,
  migrateBackupData,
} from './schema.js';

/**
 * Build manifest.json and data.json payloads from the current store state.
 * @param {AppState} state
 * @param {{ now: string; appVersion: string }} opts
 * @returns {{ manifest: BackupManifest; data: BackupData }}
 */
export function buildBackupPayload(state, { now, appVersion }) {
  /** @type {BackupData} */
  const data = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: now,
    projects: [...state.projects],
    tasks: [...state.tasks],
    notes: [...state.notes],
    assets: [...state.assets],
  };

  /** @type {BackupManifest} */
  const manifest = {
    format: 'locavern-archive',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    counts: {
      projects: data.projects.length,
      tasks: data.tasks.length,
      notes: data.notes.length,
      assets: data.assets.length,
    },
  };

  return { manifest, data };
}

/**
 * Validate an extracted backup archive (manifest + data + binary asset map) before importing.
 * @param {unknown} rawManifest
 * @param {unknown} rawData
 * @param {ReadonlyMap<string, Uint8Array>} binaryAssets
 * @returns {{ ok: true; data: BackupData } | { ok: false; error: string }}
 */
export function validateArchiveContents(rawManifest, rawData, binaryAssets) {
  if (!rawManifest || typeof rawManifest !== 'object' || Array.isArray(rawManifest)) {
    return {
      ok: false,
      error: 'Impossible d’importer l’archive. Le fichier manifest.json est invalide.',
    };
  }
  const manifest = /** @type {Record<string, unknown>} */ (rawManifest);
  if (manifest.format !== 'locavern-archive') {
    return {
      ok: false,
      error: 'Archive non reconnue. Ce fichier n’est pas une sauvegarde Locavern.',
    };
  }
  if (
    typeof manifest.schemaVersion !== 'number' ||
    manifest.schemaVersion > CURRENT_SCHEMA_VERSION ||
    manifest.schemaVersion < 1
  ) {
    return {
      ok: false,
      error: `Version d’archive non prise en charge (${String(manifest.schemaVersion)}).`,
    };
  }

  const migrated = migrateBackupData(rawData);
  if (!migrated.ok) {
    return migrated;
  }

  let totalBinaryBytes = 0;
  for (const meta of migrated.data.assets) {
    const bytes = binaryAssets.get(meta.id);
    if (!bytes) {
      return {
        ok: false,
        error: `Image manquante dans l’archive (${meta.filename}). Restauration annulée.`,
      };
    }
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
      return {
        ok: false,
        error: `Taille de fichier invalide pour l’image ${meta.filename}.`,
      };
    }
    totalBinaryBytes += bytes.byteLength;
    if (totalBinaryBytes > MAX_ARCHIVE_BYTES) {
      return {
        ok: false,
        error: 'L’archive dépasse la taille totale maximale autorisée (25 Mio).',
      };
    }
  }

  return { ok: true, data: migrated.data };
}
