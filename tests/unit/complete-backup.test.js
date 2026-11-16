import { describe, expect, it } from 'vitest';
import { buildBackupPayload, prepareBackupMerge } from '../../src/core/backup.js';
import { buildArchiveZipBlob, parseArchiveFile } from '../../src/adapters/archive-file.js';
import { createInitialState, reduce } from '../../src/core/store.js';
import { validateBackupData } from '../../src/core/schema.js';

const now = '2026-11-16T12:00:00.000Z';
function fixture() {
  let state = createInitialState();
  state = reduce(state, { type: 'create_project', id: 'p', name: 'Projet', now }).nextState;
  state = reduce(state, {
    type: 'create_task',
    id: 't',
    projectId: 'p',
    title: 'Tâche',
    now,
  }).nextState;
  state = reduce(state, {
    type: 'create_note',
    id: 'n',
    projectId: 'p',
    title: 'Note',
    tags: ['important'],
    links: [{ kind: 'task', id: 't' }],
    now,
  }).nextState;
  state = reduce(state, {
    type: 'create_note',
    id: 'deleted',
    projectId: null,
    title: 'À restaurer',
    now,
  }).nextState;
  state = reduce(state, { type: 'trash_note', id: 'deleted', now }).nextState;
  return {
    ...state,
    templates: [
      {
        id: 'custom',
        kind: /** @type {const} */ ('checklist'),
        name: 'Mon modèle',
        checklistItems: ['Étape'],
        createdAt: now,
      },
    ],
    preferences: { ...state.preferences, toastDurationSeconds: 9, trashRetentionDays: 90 },
  };
}

describe('sauvegarde complète', () => {
  it('préserve étiquettes, liens, modèles, préférences et corbeille sur un aller-retour ZIP', async () => {
    const state = fixture();
    const payload = buildBackupPayload(state, { now, appVersion: '0.2.0' });
    const zip = await buildArchiveZipBlob({ ...payload, assetBlobs: new Map() });
    const parsed = await parseArchiveFile(zip);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    const restored = reduce(createInitialState(), {
      type: 'replace_all',
      payload: parsed.data,
    }).nextState;
    expect(restored.notes[0]?.tags).toEqual(['important']);
    expect(restored.notes[0]?.links).toEqual([{ kind: 'task', id: 't' }]);
    expect(restored.templates).toEqual(state.templates);
    expect(restored.trash).toEqual(state.trash);
    expect(restored.preferences).toEqual(state.preferences);
  });
  it('réattribue les liens internes en cas de collision lors d’une fusion', () => {
    const state = fixture();
    const { data } = buildBackupPayload(state, { now, appVersion: '0.2.0' });
    let nextId = 0;
    const merged = prepareBackupMerge(state, data, new Map(), {
      mode: 'merge',
      generateId: () => `new-${++nextId}`,
    });
    expect(merged.tasks[0]?.id).not.toBe('t');
    expect(merged.notes[0]?.links).toEqual([{ kind: 'task', id: merged.tasks[0]?.id }]);
    expect(merged.notes[0]?.tags).toEqual(['important']);
  });
  it('refuse les collections additionnelles invalides avant une restauration', () => {
    const { data } = buildBackupPayload(fixture(), { now, appVersion: '0.2.0' });
    expect(validateBackupData({ ...data, templates: [{ id: 'broken' }] }).ok).toBe(false);
    expect(validateBackupData({ ...data, trash: [{ id: 'broken' }] }).ok).toBe(false);
    expect(validateBackupData({ ...data, preferences: 'broken' }).ok).toBe(false);
  });
  it('refuse de créer une copie annoncée complète si une image est manquante', async () => {
    const state = fixture();
    const payload = buildBackupPayload(
      {
        ...state,
        assets: [
          {
            id: 'asset',
            mimeType: 'image/png',
            filename: 'image.png',
            sizeBytes: 1,
            createdAt: now,
          },
        ],
      },
      { now, appVersion: '0.2.0' },
    );
    await expect(buildArchiveZipBlob({ ...payload, assetBlobs: new Map() })).rejects.toThrow(
      'Image locale manquante',
    );
  });
});
