import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createStore,
  reduce,
  selectKanbanColumns,
  selectTasks,
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
    expect(cols.todo.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(cols.in_progress).toEqual([]);

    store.dispatch({
      type: 'move_task',
      id: 't1',
      targetStatus: 'in_progress',
      targetIndex: 0,
      now: T2,
    });

    cols = selectKanbanColumns(store.getState(), 'p1', '');
    expect(cols.todo.map((t) => [t.id, t.position])).toEqual([['t2', 0]]);
    expect(cols.in_progress.map((t) => [t.id, t.position])).toEqual([['t1', 0]]);
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

  it('supprime les tâches associées et délie les notes lors de la suppression d’un projet', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'create_project', id: 'p1', name: 'P1', now: T1 });
    store.dispatch({ type: 'create_task', id: 't1', projectId: 'p1', title: 'T1', now: T1 });
    store.dispatch({ type: 'create_note', id: 'n1', projectId: 'p1', title: 'N1', now: T1 });
    store.dispatch({ type: 'select_project', projectId: 'p1' });

    const result = store.dispatch({ type: 'delete_project', id: 'p1' });
    expect(store.getState().projects).toHaveLength(0);
    expect(selectTasks(store.getState(), {})).toHaveLength(0);
    expect(store.getState().notes[0]?.projectId).toBeNull();
    expect(store.getState().preferences.selectedProjectId).toBeNull();
    expect(result.effects.some((e) => e.type === 'remove_project')).toBe(true);
  });
});
