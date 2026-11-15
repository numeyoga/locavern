import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TASK_STATUSES,
  createInitialState,
  createStore,
  reduce,
  selectKanbanColumns,
  selectReferencedAssetIds,
  selectTasks,
  selectWhiteboards,
} from '../../src/core/store.js';

describe('store', () => {
  const T1 = '2026-11-13T10:00:00.000Z';
  const T2 = '2026-11-13T11:00:00.000Z';

  it('gère la création de projet, de tâches et le réordonnancement Kanban', () => {
    const store = createStore(createInitialState());

    store.dispatch({
      type: 'create_project',
      id: 'p1',
      name: 'Locavern',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't1',
      projectId: 'p1',
      title: 'Première tâche',
      priority: 'high',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't2',
      projectId: 'p1',
      title: 'Deuxième tâche',
      priority: 'low',
      now: T1,
    });

    let cols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(cols.todo?.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(cols.in_progress).toEqual([]);

    store.dispatch({
      type: 'move_task',
      id: 't1',
      targetStatus: 'in_progress',
      targetIndex: 0,
      now: T2,
    });

    cols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(cols.todo?.map((t) => [t.id, t.position])).toEqual([['t2', 0]]);
    expect(cols.in_progress?.map((t) => [t.id, t.position])).toEqual([['t1', 0]]);
  });

  it('bloque les commandes d’écriture en mode lecture seule (Web Locks)', () => {
    const s0 = createInitialState();
    const { nextState: s1 } = reduce(s0, { type: 'set_read_only', readOnly: true });
    expect(s1.readOnly).toBe(true);

    const { nextState: s2, effects } = reduce(s1, {
      type: 'create_project',
      id: 'p1',
      name: 'Interdit',
      now: T1,
    });
    expect(s2.projects).toHaveLength(0);
    expect(effects).toEqual([]);
  });

  it('supprime les tâches associées et délie notes et tableaux blancs lors de la suppression d’un projet', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({ type: 'create_task', id: 't1', projectId: 'p1', title: 'T1', now: T1 });
    store.dispatch({ type: 'create_note', id: 'n1', projectId: 'p1', title: 'N1', now: T1 });
    store.dispatch({
      type: 'create_whiteboard',
      id: 'wb1',
      projectId: 'p1',
      title: 'WB1',
      now: T1,
    });
    store.dispatch({ type: 'select_project', projectId: 'p1' });

    const result = store.dispatch({ type: 'delete_project', id: 'p1' });
    expect(store.getState().projects).toHaveLength(0);
    expect(selectTasks(store.getState(), {})).toHaveLength(0);
    expect(store.getState().notes[0]?.projectId).toBeNull();
    expect(store.getState().whiteboards[0]?.projectId).toBeNull();
    expect(store.getState().preferences.selectedProjectId).toBeNull();
    const removeEffect = result.effects.find((e) => e.type === 'remove_project');
    expect(removeEffect).toBeDefined();
    if (removeEffect?.type === 'remove_project') {
      expect(removeEffect.updatedWhiteboards).toHaveLength(1);
    }
  });

  it('gère le CRUD des tableaux blancs, la sélection, les filtres et les assetIds référencés', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'Design', now: T1 });

    const createRes = store.dispatch({
      type: 'create_whiteboard',
      id: 'wb-1',
      projectId: 'p1',
      title: 'Flux utilisateur',
      now: T1,
    });
    expect(createRes.effects.some((e) => e.type === 'persist_whiteboard')).toBe(true);
    expect(store.getState().preferences.selectedWhiteboardId).toBe('wb-1');

    store.dispatch({
      type: 'create_whiteboard',
      id: 'wb-2',
      projectId: null,
      title: 'Schéma libre',
      now: T2,
    });

    expect(selectWhiteboards(store.getState(), {}).map((w) => w.id)).toEqual(['wb-2', 'wb-1']);
    expect(selectWhiteboards(store.getState(), { projectId: 'p1' }).map((w) => w.id)).toEqual([
      'wb-1',
    ]);
    expect(selectWhiteboards(store.getState(), { query: 'flux' }).map((w) => w.id)).toEqual([
      'wb-1',
    ]);

    store.dispatch({
      type: 'update_whiteboard',
      id: 'wb-1',
      patch: {
        elements: [
          {
            id: 'img-el',
            type: 'image',
            x: 10,
            y: 10,
            width: 120,
            height: 90,
            color: 'neutral',
            assetId: 'asset-wb-1',
            zIndex: 0,
          },
        ],
      },
      now: T2,
    });
    expect(selectReferencedAssetIds(store.getState()).has('asset-wb-1')).toBe(true);

    const delRes = store.dispatch({ type: 'delete_whiteboard', id: 'wb-2' });
    expect(delRes.effects.some((e) => e.type === 'remove_whiteboard')).toBe(true);
    expect(store.getState().preferences.selectedWhiteboardId).toBe('wb-1');
  });

  it('paramètre et normalise le visuel de saisie par écran dans les préférences', () => {
    const s0 = createInitialState();
    expect(s0.preferences.inputPresentations).toEqual({
      tasks: 'drawer',
      projects: 'modal',
      notes: 'drawer',
      whiteboards: 'modal',
    });

    const store = createStore(s0);
    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          inputPresentations: {
            tasks: 'modal',
            // @ts-expect-error Vérifie la normalisation d’une valeur persistée invalide
            notes: 'invalid',
          },
        },
      },
    });
    expect(store.getState().preferences.inputPresentations).toEqual({
      tasks: 'modal',
      projects: 'modal',
      notes: 'drawer',
      whiteboards: 'modal',
    });

    const res1 = store.dispatch({
      type: 'set_input_presentation',
      screen: 'projects',
      presentation: 'drawer',
    });
    expect(store.getState().preferences.inputPresentations.projects).toBe('drawer');
    expect(res1.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    const resNoop = store.dispatch({
      type: 'set_input_presentation',
      screen: 'projects',
      presentation: 'drawer',
    });
    expect(resNoop.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: true });
    const resReadOnly = store.dispatch({
      type: 'set_input_presentation',
      screen: 'whiteboards',
      presentation: 'drawer',
    });
    expect(store.getState().preferences.inputPresentations.whiteboards).toBe('drawer');
    expect(resReadOnly.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: false });
    store.dispatch({
      type: 'replace_all',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
      },
    });
    expect(store.getState().preferences.inputPresentations).toEqual({
      tasks: 'modal',
      projects: 'drawer',
      notes: 'drawer',
      whiteboards: 'drawer',
    });
  });

  it('paramètre et normalise la durée des toasts en secondes dans les préférences', () => {
    const s0 = createInitialState();
    expect(s0.preferences.toastDurationSeconds).toBe(6);

    const store = createStore(s0);
    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          // @ts-expect-error Vérifie la normalisation d’une valeur persistée invalide
          toastDurationSeconds: 'invalid',
        },
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(6);

    store.dispatch({
      type: 'hydrate',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
        preferences: {
          toastDurationSeconds: 120,
        },
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(60);

    const res1 = store.dispatch({ type: 'set_toast_duration', seconds: 3 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(3);
    expect(res1.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    const resNoop = store.dispatch({ type: 'set_toast_duration', seconds: 3 });
    expect(resNoop.effects).toEqual([]);

    const resClamped = store.dispatch({ type: 'set_toast_duration', seconds: 0 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(1);
    expect(resClamped.effects).toHaveLength(1);

    const resInvalid = store.dispatch({ type: 'set_toast_duration', seconds: Number.NaN });
    expect(store.getState().preferences.toastDurationSeconds).toBe(1);
    expect(resInvalid.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: true });
    const resReadOnly = store.dispatch({ type: 'set_toast_duration', seconds: 10 });
    expect(store.getState().preferences.toastDurationSeconds).toBe(10);
    expect(resReadOnly.effects).toEqual([]);

    store.dispatch({ type: 'set_read_only', readOnly: false });
    store.dispatch({
      type: 'replace_all',
      payload: {
        projects: [],
        tasks: [],
        notes: [],
        whiteboards: [],
        assets: [],
      },
    });
    expect(store.getState().preferences.toastDurationSeconds).toBe(10);
  });

  it('paramètre les statuts Kanban et exclut du Kanban les tâches sans statut ou au statut inconnu tout en les affichant dans la liste', () => {
    const store = createStore(createInitialState());
    expect(store.getState().preferences.taskStatuses).toEqual(DEFAULT_TASK_STATUSES);

    store.dispatch({ type: 'create_project', id: 'p1', name: 'Projet Statuts', now: T1 });
    store.dispatch({
      type: 'create_task',
      id: 't-todo',
      projectId: 'p1',
      title: 'Tâche à faire',
      status: 'todo',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't-doing',
      projectId: 'p1',
      title: 'Tâche en cours',
      status: 'in_progress',
      now: T1,
    });
    store.dispatch({
      type: 'create_task',
      id: 't-none',
      projectId: 'p1',
      title: 'Tâche sans statut',
      status: null,
      now: T1,
    });

    // La tâche sans statut est présente dans la liste mais absente du Kanban
    const initialCols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(Object.keys(initialCols)).toEqual(['todo', 'in_progress', 'done']);
    expect(initialCols.todo?.map((t) => t.id)).toEqual(['t-todo']);
    expect(initialCols.in_progress?.map((t) => t.id)).toEqual(['t-doing']);
    expect(initialCols.done).toEqual([]);
    expect(selectTasks(store.getState(), { projectId: 'p1' }).map((t) => t.id)).toEqual([
      't-todo',
      't-doing',
      't-none',
    ]);
    expect(
      selectTasks(store.getState(), { projectId: 'p1', status: '__none__' }).map((t) => t.id),
    ).toEqual(['t-none']);

    // Personnalisation des statuts : renommage, ajout de "review", suppression de "in_progress"
    const setRes = store.dispatch({
      type: 'set_task_statuses',
      statuses: [
        { id: 'todo', label: 'À traiter' },
        { id: 'review', label: 'En revue' },
        { id: 'done', label: 'Terminé' },
      ],
    });
    expect(setRes.effects).toEqual([
      {
        type: 'persist_preferences',
        preferences: store.getState().preferences,
      },
    ]);

    // La tâche qui avait "in_progress" a désormais un statut inconnu :
    // absente du Kanban, mais visible dans la liste et filtrable via "__unknown__"
    const customCols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(Object.keys(customCols)).toEqual(['todo', 'review', 'done']);
    expect(customCols.todo?.map((t) => t.id)).toEqual(['t-todo']);
    expect(customCols.review?.map((t) => t.id)).toEqual([]);
    expect(customCols.done?.map((t) => t.id)).toEqual([]);

    expect(selectTasks(store.getState(), { projectId: 'p1' }).map((t) => t.id)).toEqual([
      't-todo',
      't-doing',
      't-none',
    ]);
    expect(
      selectTasks(store.getState(), { projectId: 'p1', status: '__unknown__' }).map((t) => t.id),
    ).toEqual(['t-doing']);

    // On peut modifier le titre d’une tâche au statut inconnu sans écraser son statut
    store.dispatch({
      type: 'update_task',
      id: 't-doing',
      patch: { title: 'Tâche en cours (orpheline)' },
      now: T2,
    });
    expect(store.getState().tasks.find((t) => t.id === 't-doing')?.status).toBe('in_progress');

    // Puis la réassigner au nouveau statut personnalisé "review"
    store.dispatch({
      type: 'update_task',
      id: 't-doing',
      patch: { status: 'review' },
      now: T2,
    });
    expect(selectKanbanColumns(store.getState(), 'p1', '').review?.map((t) => t.id)).toEqual([
      't-doing',
    ]);
    expect(selectTasks(store.getState(), { projectId: 'p1', status: '__unknown__' })).toHaveLength(
      0,
    );

    // En mode lecture seule, set_task_statuses est bloqué
    store.dispatch({ type: 'set_read_only', readOnly: true });
    const roRes = store.dispatch({
      type: 'set_task_statuses',
      statuses: [{ id: 'todo', label: 'Interdit' }],
    });
    expect(roRes.effects).toEqual([]);
    expect(store.getState().preferences.taskStatuses.map((s) => s.id)).toEqual([
      'todo',
      'review',
      'done',
    ]);
  });
});
