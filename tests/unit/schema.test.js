import { describe, it, expect } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MAX_IMPORT_RECORDS,
  migrateBackupData,
  validateBackupData,
} from '../../src/core/schema.js';

describe('schema', () => {
  const NOW = '2026-11-13T10:00:00.000Z';

  it('valide un payload v1 conforme et assainit le texte enrichi', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: NOW,
      projects: [
        {
          id: 'p1',
          name: 'Projet 1',
          description: '',
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      tasks: [
        {
          id: 't1',
          projectId: 'p1',
          title: 'Tâche',
          status: 'todo',
          priority: 'medium',
          dueDate: '2026-11-20',
          position: 0,
          descriptionDoc: {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: 'https://evil.test/x.png' } }],
          },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      assets: [],
    };

    const result = migrateBackupData(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tasks[0]?.descriptionDoc.content).toEqual([{ type: 'paragraph' }]);
    }
  });

  it('rejette une version de schéma future inconnue', () => {
    const res = migrateBackupData({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(res.ok).toBe(false);
  });

  it('rejette une tâche orpheline dont le projet est absent', () => {
    const res = validateBackupData({
      schemaVersion: 1,
      exportedAt: NOW,
      projects: [],
      tasks: [
        {
          id: 't1',
          projectId: 'missing',
          title: 'Orpheline',
          status: 'todo',
          priority: 'low',
          dueDate: null,
          position: 0,
          descriptionDoc: { type: 'doc', content: [] },
          checklist: [],
          assetIds: [],
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      notes: [],
      assets: [],
    });
    expect(res.ok).toBe(false);
  });

  it('rejette un import dépassant la limite maximale d’enregistrements', () => {
    const projects = Array.from({ length: MAX_IMPORT_RECORDS + 1 }, (_, i) => ({
      id: `p-${i}`,
      name: `P ${i}`,
      description: '',
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    }));
    const res = validateBackupData({
      schemaVersion: 1,
      exportedAt: NOW,
      projects,
      tasks: [],
      notes: [],
      assets: [],
    });
    expect(res.ok).toBe(false);
  });
});
