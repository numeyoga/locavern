import { describe, it, expect } from 'vitest';
import { buildBackupPayload } from '../../src/core/backup.js';
import { createInitialState, reduce } from '../../src/core/store.js';
import {
  buildArchiveZipBlob,
  parseArchiveFile,
  validateImageFile,
} from '../../src/adapters/archive-file.js';

describe('archive-file', () => {
  const NOW = '2026-11-13T10:00:00.000Z';

  it('effectue un aller-retour ZIP complet avec données et image binaire', async () => {
    let state = createInitialState();
    state = reduce(state, {
      type: 'create_project',
      id: 'p1',
      name: 'Projet ZIP',
      now: NOW,
    }).nextState;
    state = reduce(state, {
      type: 'register_asset',
      asset: {
        id: 'img-1',
        mimeType: 'image/png',
        sizeBytes: 4,
        filename: 'pixel.png',
        createdAt: NOW,
      },
    }).nextState;
    state = reduce(state, {
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Note',
      assetIds: ['img-1'],
      now: NOW,
    }).nextState;

    const { manifest, data } = buildBackupPayload(state, { now: NOW, appVersion: '0.1.0' });
    const imgBytes = new Uint8Array([137, 80, 78, 71]);
    const zipBlob = await buildArchiveZipBlob({
      manifest,
      data,
      assetBlobs: new Map([['img-1', new Blob([imgBytes], { type: 'image/png' })]]),
    });

    const parsed = await parseArchiveFile(zipBlob);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.projects).toHaveLength(1);
      expect(parsed.data.notes).toHaveLength(1);
      const restoredBlob = parsed.blobs.get('img-1');
      expect(restoredBlob).toBeInstanceOf(Blob);
      const restoredBytes = new Uint8Array(await /** @type {Blob} */ (restoredBlob).arrayBuffer());
      expect([...restoredBytes]).toEqual([...imgBytes]);
    }
  });

  it('rejette un fichier ZIP corrompu ou vide', async () => {
    const resEmpty = await parseArchiveFile(new Blob([]));
    expect(resEmpty.ok).toBe(false);

    const resCorrupt = await parseArchiveFile(new Blob(['not a zip'], { type: 'application/zip' }));
    expect(resCorrupt.ok).toBe(false);
  });

  it('valide les types MIME autorisés pour les images locales', () => {
    const okFile = new File([new Uint8Array([1, 2, 3])], 'photo.webp', { type: 'image/webp' });
    expect(validateImageFile(okFile).ok).toBe(true);

    const badFile = new File(['<svg/>'], 'xss.svg', { type: 'image/svg+xml' });
    expect(validateImageFile(badFile).ok).toBe(false);
  });
});
