import { describe, it, expect } from 'vitest';
import {
  EMPTY_RICH_DOC,
  collectDocAssetIds,
  createNote,
  createProject,
  createTask,
  sanitizeRichTextDoc,
} from '../../src/core/model.js';

describe('model', () => {
  const NOW = '2026-11-13T22:00:00.000Z';

  it('crée un projet valide et nettoie les espaces', () => {
    const project = createProject({
      id: 'proj-1',
      name: '  Refonte Locavern  ',
      description: '  Description  ',
      now: NOW,
    });

    expect(project).toEqual({
      id: 'proj-1',
      name: 'Refonte Locavern',
      description: 'Description',
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('rejette un projet sans nom', () => {
    expect(() => createProject({ id: 'proj-1', name: '   ', now: NOW })).toThrow();
  });

  it('crée une tâche avec les valeurs par défaut attendues', () => {
    const task = createTask({
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Écrire les tests',
      now: NOW,
    });

    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.descriptionDoc).toEqual(EMPTY_RICH_DOC);
    expect(task.checklist).toEqual([]);
  });

  it('rejette une tâche avec un statut invalide ou un titre vide', () => {
    expect(() => createTask({ id: 't1', projectId: 'p1', title: '', now: NOW })).toThrow();
    expect(() =>
      createTask({
        id: 't1',
        projectId: 'p1',
        title: 'Valide',
        // @ts-expect-error test invariant runtime
        status: 'archived',
        now: NOW,
      }),
    ).toThrow();
  });

  it('assainit un document Tiptap en supprimant les URL dangereuses et les images distantes', () => {
    const dirtyDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Lien sûr',
              marks: [{ type: 'link', attrs: { href: 'https://example.org/' } }],
            },
            {
              type: 'text',
              text: 'Lien XSS',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: 'https://tracker.example/pixel.png', alt: 'distant' },
        },
        {
          type: 'localImage',
          attrs: { assetId: 'asset-1', alt: 'Capture locale' },
        },
      ],
    };

    const clean = sanitizeRichTextDoc(dirtyDoc);
    expect(clean.content).toHaveLength(2);
    expect(clean.content?.[0]?.content?.[0]?.marks).toEqual([
      {
        type: 'link',
        attrs: { href: 'https://example.org/', target: '_blank', rel: 'noopener noreferrer' },
      },
    ]);
    expect(clean.content?.[0]?.content?.[1]?.marks).toEqual([]);
    expect(clean.content?.[1]).toEqual({
      type: 'localImage',
      attrs: { assetId: 'asset-1', alt: 'Capture locale' },
    });
    expect(collectDocAssetIds(clean)).toEqual(['asset-1']);
  });

  it('crée une note autonome sans projet', () => {
    const note = createNote({
      id: 'note-1',
      projectId: null,
      title: 'Idées MVP',
      now: NOW,
    });
    expect(note.projectId).toBeNull();
    expect(note.contentDoc).toEqual(EMPTY_RICH_DOC);
    expect(note.assetIds).toEqual([]);
  });
});
