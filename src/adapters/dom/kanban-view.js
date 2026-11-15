/** @import { AppCommand, AppState, StoreEffect, Task, TaskPriority, TaskStatus } from '../../types.d.ts' */
import { selectKanbanColumns, selectProjectById } from '../../core/store.js';
import { confirmAction, initCovenant, notify } from './app-shell.js';
import { openStatusModal } from './status-modal.js';
import { createTaskWorkspaceHeader } from './task-workspace-header.js';

/** @type {Record<TaskPriority, { label: string; badgeClass: string }>} */
const PRIORITY_META = {
  low: { label: 'Basse', badgeClass: 'cv-badge' },
  medium: { label: 'Moyenne', badgeClass: 'cv-badge cv-badge--warning' },
  high: { label: 'Haute', badgeClass: 'cv-badge cv-badge--danger' },
};

/**
 * Render the Kanban Board view with native drag-and-drop and full keyboard move controls.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   query: string;
 *   onQueryChange: (nextQuery: string) => void;
 *   onOpenNewProject: () => void;
 *   onOpenTaskDrawer: (task?: Task, defaultStatus?: TaskStatus | null) => void;
 * }} opts
 */
export function renderKanbanView({
  container,
  store,
  query,
  onQueryChange,
  onOpenNewProject,
  onOpenTaskDrawer,
}) {
  const state = store.getState();
  const initialDefaultStatus = state.preferences.taskStatuses[0]?.id ?? null;

  const header = createTaskWorkspaceHeader({
    state,
    dispatch: store.dispatch,
    onOpenNewTask: () => onOpenTaskDrawer(undefined, initialDefaultStatus),
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
    desc.textContent =
      'Le tableau Kanban organise les tâches de vos projets par colonnes de statut.';
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

  const filtersBar = document.createElement('div');
  filtersBar.className = 'lc-filters';

  const searchField = document.createElement('div');
  searchField.className = 'cv-field';
  const searchLabel = document.createElement('label');
  searchLabel.className = 'cv-label';
  searchLabel.htmlFor = 'kanban-search-input';
  searchLabel.textContent = 'Rechercher sur le tableau';
  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'kanban-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Filtrer les cartes';
  searchInput.value = query;
  searchGroup.append(searchIcon, searchInput);
  searchField.append(searchLabel, searchGroup);

  const hint = document.createElement('p');
  hint.className = 'cv-hint';
  hint.style.margin = '0';
  hint.textContent =
    'Glissez-déposez une carte ou utilisez son menu Actions (ou Alt + flèches) pour la déplacer au clavier.';

  filtersBar.append(searchField, hint);

  const boardSlot = document.createElement('div');
  /** @type {string | null} */
  let draggedTaskId = null;

  /**
   * Move a task to a target status and target position index within its project.
   * @param {string} taskId
   * @param {TaskStatus} targetStatus
   * @param {number} targetIndex
   * @param {boolean} [refocusAfterMove]
   */
  function dispatchMove(taskId, targetStatus, targetIndex, refocusAfterMove = false) {
    store.dispatch({
      type: 'move_task',
      id: taskId,
      targetStatus,
      targetIndex,
      now: new Date().toISOString(),
    });
    if (refocusAfterMove) {
      requestAnimationFrame(() => {
        const movedEl = /** @type {HTMLElement | null} */ (
          document.querySelector(`[data-kanban-task-id="${CSS.escape(taskId)}"]`)
        );
        movedEl?.focus();
      });
    }
  }

  function renderBoard() {
    const currentState = store.getState();
    const configuredStatuses = currentState.preferences.taskStatuses;
    const statusIds = configuredStatuses.map((s) => s.id);

    if (configuredStatuses.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-columns cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = 'Aucun statut configuré pour le Kanban';
      const desc = document.createElement('p');
      desc.textContent =
        'Ajoutez au moins un statut ou restaurez les colonnes par défaut pour utiliser le tableau Kanban.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = currentState.readOnly;
      cta.textContent = 'Configurer les statuts';
      cta.addEventListener('click', openStatusModal);
      empty.append(iconBox, title, desc, cta);
      boardSlot.replaceChildren(empty);
      return;
    }

    const columnsData = selectKanbanColumns(
      currentState,
      currentState.preferences.selectedProjectId,
      query,
    );

    const board = document.createElement('div');
    board.className = 'lc-kanban';

    for (const colMeta of configuredStatuses) {
      const colTasks = columnsData[colMeta.id] ?? [];
      const colEl = document.createElement('section');
      colEl.className = 'lc-kanban__col';
      colEl.dataset.kanbanStatus = colMeta.id;
      colEl.setAttribute('aria-labelledby', `kanban-col-${colMeta.id}`);

      const colHead = document.createElement('div');
      colHead.className = 'lc-kanban__col-header';

      const colTitle = document.createElement('h2');
      colTitle.id = `kanban-col-${colMeta.id}`;
      colTitle.className = 'lc-kanban__col-title';
      colTitle.textContent = colMeta.label;

      const colControls = document.createElement('div');
      colControls.className = 'lc-table-actions';
      const countBadge = document.createElement('span');
      countBadge.className = 'cv-badge cv-num';
      countBadge.textContent = String(colTasks.length);

      const quickAddBtn = document.createElement('button');
      quickAddBtn.type = 'button';
      quickAddBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      quickAddBtn.disabled = currentState.readOnly;
      quickAddBtn.setAttribute('aria-label', `Ajouter une tâche dans ${colMeta.label}`);
      const addIc = document.createElement('i');
      addIc.className = 'ph ph-plus cv-icon';
      addIc.setAttribute('aria-hidden', 'true');
      quickAddBtn.append(addIc);
      quickAddBtn.addEventListener('click', () => onOpenTaskDrawer(undefined, colMeta.id));

      colControls.append(countBadge, quickAddBtn);
      colHead.append(colTitle, colControls);

      const listEl = document.createElement('div');
      listEl.className = 'lc-kanban__list';

      colEl.addEventListener('dragover', (event) => {
        if (currentState.readOnly) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        colEl.dataset.dropActive = 'true';
      });

      colEl.addEventListener('dragleave', (event) => {
        const related = /** @type {Node | null} */ (event.relatedTarget);
        if (!related || !colEl.contains(related)) {
          delete colEl.dataset.dropActive;
        }
      });

      colEl.addEventListener('drop', (event) => {
        if (currentState.readOnly) return;
        event.preventDefault();
        delete colEl.dataset.dropActive;
        const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId;
        if (!taskId) return;
        const droppedTask = currentState.tasks.find((t) => t.id === taskId);
        if (!droppedTask) return;

        const projectColTasks = currentState.tasks
          .filter(
            (t) =>
              t.projectId === droppedTask.projectId &&
              t.status === colMeta.id &&
              t.id !== droppedTask.id,
          )
          .sort((a, b) => a.position - b.position);
        dispatchMove(taskId, colMeta.id, projectColTasks.length);
      });

      for (const task of colTasks) {
        const projectSiblings = currentState.tasks
          .filter((t) => t.projectId === task.projectId && t.status === colMeta.id)
          .sort((a, b) => a.position - b.position);
        const siblingIndex = projectSiblings.findIndex((t) => t.id === task.id);

        const card = document.createElement('article');
        card.className = 'cv-card lc-kanban__card';
        card.tabIndex = 0;
        card.draggable = !currentState.readOnly;
        card.dataset.kanbanTaskId = task.id;
        card.setAttribute('aria-label', `${task.title}, ${colMeta.label}`);

        card.addEventListener('dragstart', (event) => {
          if (currentState.readOnly) {
            event.preventDefault();
            return;
          }
          draggedTaskId = task.id;
          card.dataset.dragging = 'true';
          if (event.dataTransfer) {
            event.dataTransfer.setData('text/plain', task.id);
            event.dataTransfer.effectAllowed = 'move';
          }
        });

        card.addEventListener('dragend', () => {
          draggedTaskId = null;
          delete card.dataset.dragging;
          boardSlot.querySelectorAll('[data-drop-active]').forEach((el) => {
            if (el instanceof HTMLElement) delete el.dataset.dropActive;
          });
        });

        card.addEventListener('dragover', (event) => {
          if (currentState.readOnly) return;
          event.preventDefault();
        });

        card.addEventListener('drop', (event) => {
          if (currentState.readOnly) return;
          event.preventDefault();
          event.stopPropagation();
          delete colEl.dataset.dropActive;
          const taskId = event.dataTransfer?.getData('text/plain') || draggedTaskId;
          if (!taskId || taskId === task.id) return;
          const droppedTask = currentState.tasks.find((t) => t.id === taskId);
          if (!droppedTask) return;

          if (droppedTask.projectId === task.projectId) {
            const targetSiblings = currentState.tasks
              .filter(
                (t) =>
                  t.projectId === task.projectId &&
                  t.status === colMeta.id &&
                  t.id !== droppedTask.id,
              )
              .sort((a, b) => a.position - b.position);
            const idx = targetSiblings.findIndex((t) => t.id === task.id);
            dispatchMove(taskId, colMeta.id, idx >= 0 ? idx : targetSiblings.length);
          } else {
            const endLen = currentState.tasks.filter(
              (t) => t.projectId === droppedTask.projectId && t.status === colMeta.id,
            ).length;
            dispatchMove(taskId, colMeta.id, endLen);
          }
        });

        // Keyboard shortcuts on focused card: Alt + ArrowLeft / ArrowRight / ArrowUp / ArrowDown
        card.addEventListener('keydown', (event) => {
          if (currentState.readOnly || !event.altKey) return;
          const statusIdx = task.status ? statusIds.indexOf(task.status) : -1;
          if (statusIdx === -1) return;
          const nextStatus = statusIds[statusIdx + 1];
          const prevStatus = statusIds[statusIdx - 1];
          if (event.key === 'ArrowRight' && nextStatus) {
            event.preventDefault();
            const endPos = currentState.tasks.filter(
              (t) => t.projectId === task.projectId && t.status === nextStatus,
            ).length;
            dispatchMove(task.id, nextStatus, endPos, true);
          } else if (event.key === 'ArrowLeft' && prevStatus) {
            event.preventDefault();
            const endPos = currentState.tasks.filter(
              (t) => t.projectId === task.projectId && t.status === prevStatus,
            ).length;
            dispatchMove(task.id, prevStatus, endPos, true);
          } else if (event.key === 'ArrowUp' && siblingIndex > 0) {
            event.preventDefault();
            dispatchMove(task.id, colMeta.id, siblingIndex - 1, true);
          } else if (event.key === 'ArrowDown' && siblingIndex < projectSiblings.length - 1) {
            event.preventDefault();
            dispatchMove(task.id, colMeta.id, siblingIndex + 1, true);
          }
        });

        const cardHead = document.createElement('div');
        cardHead.className = 'lc-kanban__card-head';

        const titleBtn = document.createElement('button');
        titleBtn.type = 'button';
        titleBtn.className = 'lc-kanban__card-title-btn';
        titleBtn.textContent = task.title;
        titleBtn.addEventListener('click', () => onOpenTaskDrawer(task));

        const menuId = `menu-task-${task.id}`;
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
        menuBtn.setAttribute('popovertarget', menuId);
        menuBtn.setAttribute('aria-haspopup', 'menu');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.setAttribute('aria-label', `Actions pour « ${task.title} »`);
        const dotsIc = document.createElement('i');
        dotsIc.className = 'ph ph-dots-three-vertical cv-icon';
        dotsIc.setAttribute('aria-hidden', 'true');
        menuBtn.append(dotsIc);

        const menu = document.createElement('div');
        menu.className = 'cv-menu';
        menu.id = menuId;
        menu.setAttribute('popover', '');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', `Actions sur ${task.title}`);

        /**
         * @param {string} label
         * @param {() => void} handler
         * @param {{ danger?: boolean; disabled?: boolean }} [cfg]
         */
        const addMenuItem = (label, handler, cfg = {}) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = cfg.danger ? 'cv-menu__item cv-menu__item--danger' : 'cv-menu__item';
          item.setAttribute('role', 'menuitem');
          if (cfg.disabled) {
            item.setAttribute('aria-disabled', 'true');
            item.disabled = true;
          }
          item.textContent = label;
          item.addEventListener('click', handler);
          menu.append(item);
        };

        addMenuItem('Ouvrir les détails', () => onOpenTaskDrawer(task));

        if (!currentState.readOnly) {
          const sep1 = document.createElement('hr');
          sep1.className = 'cv-menu__sep';
          menu.append(sep1);

          for (const targetCol of configuredStatuses) {
            if (targetCol.id !== task.status) {
              addMenuItem(`Déplacer vers ${targetCol.label}`, () => {
                const endPos = currentState.tasks.filter(
                  (t) => t.projectId === task.projectId && t.status === targetCol.id,
                ).length;
                dispatchMove(task.id, targetCol.id, endPos, true);
              });
            }
          }

          if (siblingIndex > 0) {
            addMenuItem('Monter dans la colonne', () => {
              dispatchMove(task.id, colMeta.id, siblingIndex - 1, true);
            });
          }
          if (siblingIndex < projectSiblings.length - 1) {
            addMenuItem('Descendre dans la colonne', () => {
              dispatchMove(task.id, colMeta.id, siblingIndex + 1, true);
            });
          }

          const sep2 = document.createElement('hr');
          sep2.className = 'cv-menu__sep';
          menu.append(sep2);

          addMenuItem(
            'Supprimer',
            async () => {
              const confirmed = await confirmAction({
                title: `Supprimer « ${task.title} » ?`,
                message: 'Cette tâche sera définitivement supprimée.',
                confirmLabel: 'Supprimer',
                danger: true,
              });
              if (!confirmed) return;
              store.dispatch({ type: 'delete_task', id: task.id });
              notify({ status: 'info', title: 'Tâche supprimée', text: task.title });
            },
            { danger: true },
          );
        }

        cardHead.append(titleBtn, menuBtn, menu);

        const metaRow = document.createElement('div');
        metaRow.className = 'lc-kanban__card-meta';

        const prioInfo = PRIORITY_META[task.priority];
        const prioBadge = document.createElement('span');
        prioBadge.className = prioInfo.badgeClass;
        const prioDot = document.createElement('span');
        prioDot.className = 'cv-badge__dot';
        prioBadge.append(prioDot, document.createTextNode(prioInfo.label));
        metaRow.append(prioBadge);

        if (task.dueDate) {
          const dueTag = document.createElement('span');
          dueTag.className = 'cv-tag cv-tag--mono';
          dueTag.textContent = task.dueDate;
          metaRow.append(dueTag);
        }

        if (task.checklist.length > 0) {
          const doneCount = task.checklist.filter((c) => c.done).length;
          const checkTag = document.createElement('span');
          checkTag.className = 'cv-tag cv-tag--mono';
          checkTag.textContent = `${doneCount}/${task.checklist.length}`;
          metaRow.append(checkTag);
        }

        if (!currentState.preferences.selectedProjectId) {
          const projName = selectProjectById(currentState, task.projectId)?.name;
          if (projName) {
            const projTag = document.createElement('span');
            projTag.className = 'cv-tag';
            projTag.textContent = projName;
            metaRow.append(projTag);
          }
        }

        card.append(cardHead, metaRow);
        listEl.append(card);
      }

      colEl.append(colHead, listEl);
      board.append(colEl);
    }

    boardSlot.replaceChildren(board);
    initCovenant(boardSlot);
  }

  searchInput.addEventListener('input', () => {
    onQueryChange(searchInput.value);
    renderBoard();
  });

  renderBoard();
  container.replaceChildren(header, filtersBar, boardSlot);
}
