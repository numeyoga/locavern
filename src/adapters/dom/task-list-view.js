/** @import { AppCommand, AppState, StoreEffect, Task, TaskPriority, TaskStatus } from '../../types.d.ts' */

import { selectProjectById, selectTasks } from '../../core/store.js';
import { confirmAction, notify } from './app-shell.js';
import { createTaskWorkspaceHeader } from './task-workspace-header.js';

/** @type {Record<TaskStatus, { label: string; badgeClass: string }>} */
const STATUS_META = {
  todo: { label: 'À faire', badgeClass: 'cv-badge' },
  in_progress: { label: 'En cours', badgeClass: 'cv-badge cv-badge--info' },
  done: { label: 'Terminé', badgeClass: 'cv-badge cv-badge--success' },
};

/** @type {Record<TaskPriority, { label: string; badgeClass: string }>} */
const PRIORITY_META = {
  low: { label: 'Basse', badgeClass: 'cv-badge' },
  medium: { label: 'Moyenne', badgeClass: 'cv-badge cv-badge--warning' },
  high: { label: 'Haute', badgeClass: 'cv-badge cv-badge--danger' },
};

/**
 * Create a Covenant badge element.
 * @param {string} label
 * @param {string} badgeClass
 * @returns {HTMLSpanElement}
 */
function makeBadge(label, badgeClass) {
  const badge = document.createElement('span');
  badge.className = badgeClass;
  const dot = document.createElement('span');
  dot.className = 'cv-badge__dot';
  badge.append(dot, document.createTextNode(label));
  return badge;
}

/**
 * Render the Task List view (Covenant DataTable, filters, sorting).
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     query: string;
 *     status: TaskStatus | 'all';
 *     priority: TaskPriority | 'all';
 *     sortBy: 'position' | 'dueDate' | 'priority';
 *   };
 *   onOpenNewProject: () => void;
 *   onOpenTaskDrawer: (task?: Task) => void;
 * }} opts
 */
export function renderTaskListView({
  container,
  store,
  filters,
  onOpenNewProject,
  onOpenTaskDrawer,
}) {
  const state = store.getState();

  const header = createTaskWorkspaceHeader({
    state,
    dispatch: store.dispatch,
    onOpenNewTask: () => onOpenTaskDrawer(undefined),
  });

  if (state.projects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cv-empty';
    const iconBox = document.createElement('span');
    iconBox.className = 'cv-empty__icon';
    const ic = document.createElement('i');
    ic.className = 'ph ph-folder-plus cv-icon';
    ic.setAttribute('aria-hidden', 'true');
    iconBox.append(ic);

    const title = document.createElement('p');
    title.className = 'cv-empty__title';
    title.textContent = 'Créez un premier projet pour commencer';

    const desc = document.createElement('p');
    desc.textContent = 'Chaque tâche est rattachée à un projet local sur cet appareil.';

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'cv-btn cv-btn--primary';
    cta.disabled = state.readOnly;
    cta.textContent = 'Créer un projet';
    cta.addEventListener('click', onOpenNewProject);

    empty.append(iconBox, title, desc, cta);
    container.replaceChildren(header, empty);
    return;
  }

  // Filters bar
  const filtersBar = document.createElement('div');
  filtersBar.className = 'lc-filters';

  const searchField = document.createElement('div');
  searchField.className = 'cv-field';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'cv-label';
  searchLabel.htmlFor = 'list-search-input';
  searchLabel.textContent = 'Rechercher';
  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'list-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Filtrer par titre';
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);
  searchField.append(searchLabel, searchGroup);

  const statusField = document.createElement('div');
  statusField.className = 'cv-field';
  const statusLabel = document.createElement('label');
  statusLabel.className = 'cv-label';
  statusLabel.htmlFor = 'list-status-filter';
  statusLabel.textContent = 'Statut';
  const statusWrap = document.createElement('div');
  statusWrap.className = 'cv-select';
  const statusSelect = document.createElement('select');
  statusSelect.id = 'list-status-filter';
  statusSelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const statusOptions = [
    ['all', 'Tous les statuts'],
    ['todo', 'À faire'],
    ['in_progress', 'En cours'],
    ['done', 'Terminé'],
  ];
  for (const [val, lbl] of statusOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    statusSelect.append(opt);
  }
  statusSelect.value = filters.status;
  statusWrap.append(statusSelect);
  statusField.append(statusLabel, statusWrap);

  const priorityField = document.createElement('div');
  priorityField.className = 'cv-field';
  const priorityLabel = document.createElement('label');
  priorityLabel.className = 'cv-label';
  priorityLabel.htmlFor = 'list-priority-filter';
  priorityLabel.textContent = 'Priorité';
  const priorityWrap = document.createElement('div');
  priorityWrap.className = 'cv-select';
  const prioritySelect = document.createElement('select');
  prioritySelect.id = 'list-priority-filter';
  prioritySelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const priorityOptions = [
    ['all', 'Toutes les priorités'],
    ['high', 'Haute'],
    ['medium', 'Moyenne'],
    ['low', 'Basse'],
  ];
  for (const [val, lbl] of priorityOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    prioritySelect.append(opt);
  }
  prioritySelect.value = filters.priority;
  priorityWrap.append(prioritySelect);
  priorityField.append(priorityLabel, priorityWrap);

  const sortField = document.createElement('div');
  sortField.className = 'cv-field';
  const sortLabel = document.createElement('label');
  sortLabel.className = 'cv-label';
  sortLabel.htmlFor = 'list-sort-select';
  sortLabel.textContent = 'Tri';
  const sortWrap = document.createElement('div');
  sortWrap.className = 'cv-select';
  const sortSelect = document.createElement('select');
  sortSelect.id = 'list-sort-select';
  sortSelect.className = 'cv-input';
  /** @type {Array<[string, string]>} */
  const sortOptions = [
    ['position', 'Ordre Kanban'],
    ['dueDate', 'Échéance'],
    ['priority', 'Priorité'],
  ];
  for (const [val, lbl] of sortOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = lbl;
    sortSelect.append(opt);
  }
  sortSelect.value = filters.sortBy;
  sortWrap.append(sortSelect);
  sortField.append(sortLabel, sortWrap);

  filtersBar.append(searchField, statusField, priorityField, sortField);

  const tableSlot = document.createElement('div');

  function renderTable() {
    const currentState = store.getState();
    const tasks = selectTasks(currentState, {
      projectId: currentState.preferences.selectedProjectId,
      status: filters.status,
      priority: filters.priority,
      query: filters.query,
      sortBy: filters.sortBy,
    });

    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-list-checks cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = 'Aucune tâche trouvée';
      const desc = document.createElement('p');
      desc.textContent =
        'Ajoutez une nouvelle tâche ou ajustez les filtres actifs pour afficher vos éléments.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = currentState.readOnly;
      cta.textContent = 'Nouvelle tâche';
      cta.addEventListener('click', () => onOpenTaskDrawer(undefined));
      empty.append(iconBox, title, desc, cta);
      tableSlot.replaceChildren(empty);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'cv-table-wrap';
    const table = document.createElement('table');
    table.className = 'cv-table';

    const selectedProject = selectProjectById(
      currentState,
      currentState.preferences.selectedProjectId,
    );
    const caption = document.createElement('caption');
    caption.textContent = selectedProject
      ? `Tâches — ${selectedProject.name} (${tasks.length})`
      : `Toutes les tâches (${tasks.length})`;
    table.append(caption);

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    /** @type {Array<[string, boolean]>} */
    const cols = [
      ['Tâche', false],
      ['Projet', false],
      ['Statut', false],
      ['Priorité', false],
      ['Échéance', true],
      ['Actions', false],
    ];
    for (const [label, isNum] of cols) {
      const th = document.createElement('th');
      th.scope = 'col';
      if (isNum) th.className = 'cv-num';
      th.textContent = label;
      headRow.append(th);
    }
    thead.append(headRow);

    const tbody = document.createElement('tbody');
    for (const task of tasks) {
      const tr = document.createElement('tr');

      const tdTitle = document.createElement('td');
      const titleBtn = document.createElement('button');
      titleBtn.type = 'button';
      titleBtn.className = 'lc-row-title-btn';
      titleBtn.textContent = task.title;
      titleBtn.addEventListener('click', () => onOpenTaskDrawer(task));
      tdTitle.append(titleBtn);

      const tdProject = document.createElement('td');
      tdProject.textContent = selectProjectById(currentState, task.projectId)?.name ?? 'Projet';

      const tdStatus = document.createElement('td');
      const statusInfo = STATUS_META[task.status];
      tdStatus.append(makeBadge(statusInfo.label, statusInfo.badgeClass));

      const tdPriority = document.createElement('td');
      const priorityInfo = PRIORITY_META[task.priority];
      tdPriority.append(makeBadge(priorityInfo.label, priorityInfo.badgeClass));

      const tdDue = document.createElement('td');
      tdDue.className = 'cv-num';
      tdDue.textContent = task.dueDate ?? '—';

      const tdActions = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'lc-table-actions';

      const quickStatus = document.createElement('select');
      quickStatus.className = 'cv-input';
      quickStatus.style.width = 'auto';
      quickStatus.style.minHeight = 'var(--cv-row-sm)';
      quickStatus.setAttribute('aria-label', `Changer le statut de « ${task.title} »`);
      quickStatus.disabled = currentState.readOnly;
      /** @type {Array<[TaskStatus, string]>} */
      const quickOptions = [
        ['todo', 'À faire'],
        ['in_progress', 'En cours'],
        ['done', 'Terminé'],
      ];
      for (const [val, lbl] of quickOptions) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = lbl;
        quickStatus.append(opt);
      }
      quickStatus.value = task.status;
      quickStatus.addEventListener('change', () => {
        const nextStatus = /** @type {TaskStatus} */ (quickStatus.value);
        store.dispatch({
          type: 'update_task',
          id: task.id,
          patch: { status: nextStatus },
          now: new Date().toISOString(),
        });
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      editBtn.textContent = 'Ouvrir';
      editBtn.setAttribute('aria-label', `Ouvrir « ${task.title} »`);
      editBtn.addEventListener('click', () => onOpenTaskDrawer(task));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
      delBtn.disabled = currentState.readOnly;
      delBtn.textContent = 'Supprimer';
      delBtn.setAttribute('aria-label', `Supprimer « ${task.title} »`);
      delBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: `Supprimer « ${task.title} » ?`,
          message: 'Cette tâche sera définitivement supprimée.',
          confirmLabel: 'Supprimer',
          danger: true,
        });
        if (!confirmed) return;
        store.dispatch({ type: 'delete_task', id: task.id });
        notify({ status: 'info', title: 'Tâche supprimée', text: task.title });
      });

      actions.append(quickStatus, editBtn, delBtn);
      tdActions.append(actions);

      tr.append(tdTitle, tdProject, tdStatus, tdPriority, tdDue, tdActions);
      tbody.append(tr);
    }

    table.append(thead, tbody);
    wrap.append(table);
    tableSlot.replaceChildren(wrap);
  }

  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderTable();
  });
  statusSelect.addEventListener('change', () => {
    filters.status = /** @type {TaskStatus | 'all'} */ (statusSelect.value);
    renderTable();
  });
  prioritySelect.addEventListener('change', () => {
    filters.priority = /** @type {TaskPriority | 'all'} */ (prioritySelect.value);
    renderTable();
  });
  sortSelect.addEventListener('change', () => {
    filters.sortBy = /** @type {'position' | 'dueDate' | 'priority'} */ (sortSelect.value);
    renderTable();
  });

  renderTable();
  container.replaceChildren(header, filtersBar, tableSlot);
}
