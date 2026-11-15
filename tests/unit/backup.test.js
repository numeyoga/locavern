import { describe, it, expect } from 'vitest';
import { buildBackupPayload, validateArchiveContents } from '../../src/core/backup.js';
import { createInitialState, reduce } from '../../src/core/store.js';

describe('backup', () => {
  const NOW = '2026-11-13T10:00:00.000Z';

  it('construit un manifeste et des données cohérents avec tableaux blancs puis valide la restauration', () => {
    let state = createInitialState();
    state = reduce(state, {
      type: 'set_task_statuses',
      statuses: [
        { id: 'todo', label: 'À faire' },
        { id: 'review', label: 'En revue' },
      ],
    }).nextState;
    state = reduce(state, { type: 'create_project', id: 'p1', name: 'Alpha', now: NOW }).nextState;
    state = reduce(state, {
      type: 'register_asset',
      asset: {
        id: 'a1',
        mimeType: 'image/png',
        sizeBytes: 4,
        filename: 'img.png',
        createdAt: NOW,
      },
    }).nextState;
    state = reduce(state, {
      type: 'create_note',
      id: 'n1',
      projectId: 'p1',
      title: 'Note avec image',
      assetIds: ['a1'],
      now: NOW,
    }).nextState;
    state = reduce(state, {
      type: 'create_whiteboard',
      id: 'wb1',
      projectId: 'p1',
      title: 'Tableau architecture',
      elements: [
        {
          id: 'el1',
          type: 'image',
          x: 20,
          y: 20,
          width: 120,
          height: 80,
          color: 'neutral',
          assetId: 'a1',
          zIndex: 0,
        },
      ],
      now: NOW,
    }).nextState;

    const { manifest, data } = buildBackupPayload(state, { now: NOW, appVersion: '0.2.0' });
    expect(manifest.format).toBe('locavern-archive');
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.counts).toEqual({
      projects: 1,
      tasks: 0,
      notes: 1,
      whiteboards: 1,
      assets: 1,
    });
    expect(data.whiteboards).toHaveLength(1);
    expect(data.taskStatuses).toEqual([
      { id: 'todo', label: 'À faire' },
      { id: 'review', label: 'En revue' },
    ]);

    const checkOk = validateArchiveContents(
      manifest,
      data,
      new Map([['a1', new Uint8Array([1, 2, 3, 4])]]),
    );
    expect(checkOk.ok).toBe(true);

    const checkMissingBlob = validateArchiveContents(manifest, data, new Map());
    expect(checkMissingBlob.ok).toBe(false);
  });

  it('rejette un type MIME non autorisé dans les métadonnées d’asset', () => {
    const { manifest, data } = buildBackupPayload(createInitialState(), {
      now: NOW,
      appVersion: '0.2.0',
    });
    const forged = {
      ...data,
      assets: [
        {
          id: 'a1',
          mimeType: 'image/svg+xml',
          sizeBytes: 10,
          filename: 'bad.svg',
          createdAt: NOW,
        },
      ],
    };
    const res = validateArchiveContents(manifest, forged, new Map([['a1', new Uint8Array(10)]]));
    expect(res.ok).toBe(false);
  });
});
