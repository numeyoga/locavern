/** @import { AppCommand, AppState, StoreEffect, TaskStatusConfig } from '../../types.d.ts' */

import {
  DEFAULT_TASK_STATUSES,
  createTaskStatusId,
  normalizeTaskStatuses,
} from '../../core/model.js';
import { closeDialogById, notify, openDialogById } from './app-shell.js';
import { initTooltips, setTooltip } from './tooltip.js';

/**
 * Open the Kanban statuses configuration modal (`#modal-statuses`).
 */
export function openStatusModal() {
  openDialogById('modal-statuses');
}

/**
 * Wire the Kanban statuses configuration modal (`#modal-statuses`).
 * Allows adding, renaming, reordering, deleting, and resetting task statuses.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 * }} opts
 */
export function wireStatusModal({ store }) {
  const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('modal-statuses'));
  const bodyEl = document.getElementById('modal-statuses-body');
  const footerEl = document.getElementById('modal-statuses-footer');
  if (!modal || !bodyEl || !footerEl) return;

  const modalDialog = modal;
  const modalBody = bodyEl;
  const modalFooter = footerEl;

  /** @type {Array<{ id: string; label: string }>} */
  let draftStatuses = [];

  /**
   * Synchronize in-memory `draftStatuses` labels from currently rendered text inputs before list mutations.
   */
  function syncLabelsFromInputs() {
    const inputs = modalBody.querySelectorAll('input[data-status-index]');
    for (const input of inputs) {
      if (input instanceof HTMLInputElement) {
        const idx = Number.parseInt(input.dataset.statusIndex ?? '', 10);
        const item = draftStatuses[idx];
        if (!Number.isNaN(idx) && item) {
          item.label = input.value;
        }
      }
    }
  }

  /**
   * Render the modal body and footer from `draftStatuses`.
   * @param {{ focusSelector?: string }} [renderOpts]
   */
  function renderDraft(renderOpts = {}) {
    const state = store.getState();
    const readOnly = state.readOnly;

    const form = document.createElement('form');
    form.id = 'form-task-statuses';
    form.noValidate = true;
    form.className = 'lc-status-form';

    const intro = document.createElement('p');
    intro.className = 'cv-hint';
    intro.style.margin = '0';
    intro.textContent =
      'Définissez les colonnes affichées dans le Kanban. Les tâches sans statut ou associées à un statut supprimé restent visibles dans la liste des tâches avec un repère visuel.';

    const listGroup = document.createElement('div');
    listGroup.className = 'lc-status-list';
    listGroup.setAttribute('role', 'group');
    listGroup.setAttribute('aria-label', 'Colonnes du Kanban');

    if (draftStatuses.length === 0) {
      const emptyHint = document.createElement('p');
      emptyHint.className = 'cv-caption';
      emptyHint.style.margin = '0';
      emptyHint.textContent =
        'Aucun statut configuré. Ajoutez un statut ci-dessous ou restaurez les statuts par défaut.';
      listGroup.append(emptyHint);
    }

    draftStatuses.forEach((statusItem, idx) => {
      const row = document.createElement('div');
      row.className = 'lc-status-row';
      row.dataset.statusId = statusItem.id;

      const field = document.createElement('div');
      field.className = 'cv-field lc-status-row__field';

      const label = document.createElement('label');
      label.className = 'lc-sr-only';
      const inputId = `status-label-input-${statusItem.id}`;
      const errorId = `status-label-error-${statusItem.id}`;
      label.htmlFor = inputId;
      label.textContent = `Libellé du statut ${idx + 1}`;

      const input = document.createElement('input');
      input.id = inputId;
      input.type = 'text';
      input.className = 'cv-input';
      input.required = true;
      input.maxLength = 60;
      input.disabled = readOnly;
      input.value = statusItem.label;
      input.dataset.statusIndex = String(idx);
      input.dataset.statusId = statusItem.id;

      const errSpan = document.createElement('span');
      errSpan.id = errorId;
      errSpan.className = 'cv-error';
      errSpan.hidden = true;
      const errIcon = document.createElement('i');
      errIcon.className = 'ph ph-warning-circle cv-icon';
      errIcon.setAttribute('aria-hidden', 'true');
      const errText = document.createElement('span');
      errText.textContent = 'Saisissez un libellé de statut.';
      errSpan.append(errIcon, errText);

      input.addEventListener('input', () => {
        statusItem.label = input.value;
        if (input.value.trim()) {
          input.removeAttribute('aria-invalid');
          input.removeAttribute('aria-describedby');
          errSpan.hidden = true;
        }
      });

      field.append(label, input, errSpan);

      const actions = document.createElement('div');
      actions.className = 'lc-status-row__actions';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      upBtn.disabled = readOnly || idx === 0;
      upBtn.dataset.moveUp = statusItem.id;
      upBtn.setAttribute('aria-label', `Monter le statut ${statusItem.label || String(idx + 1)}`);
      setTooltip(upBtn, 'Monter le statut');
      const upIc = document.createElement('i');
      upIc.className = 'ph ph-arrow-up cv-icon';
      upIc.setAttribute('aria-hidden', 'true');
      upBtn.append(upIc);
      upBtn.addEventListener('click', () => {
        if (idx <= 0) return;
        syncLabelsFromInputs();
        const prev = draftStatuses[idx - 1];
        const curr = draftStatuses[idx];
        if (!prev || !curr) return;
        draftStatuses[idx - 1] = curr;
        draftStatuses[idx] = prev;
        renderDraft({ focusSelector: `[data-move-up="${CSS.escape(statusItem.id)}"]` });
      });

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      downBtn.disabled = readOnly || idx === draftStatuses.length - 1;
      downBtn.dataset.moveDown = statusItem.id;
      downBtn.setAttribute(
        'aria-label',
        `Descendre le statut ${statusItem.label || String(idx + 1)}`,
      );
      setTooltip(downBtn, 'Descendre le statut');
      const downIc = document.createElement('i');
      downIc.className = 'ph ph-arrow-down cv-icon';
      downIc.setAttribute('aria-hidden', 'true');
      downBtn.append(downIc);
      downBtn.addEventListener('click', () => {
        if (idx >= draftStatuses.length - 1) return;
        syncLabelsFromInputs();
        const next = draftStatuses[idx + 1];
        const curr = draftStatuses[idx];
        if (!next || !curr) return;
        draftStatuses[idx + 1] = curr;
        draftStatuses[idx] = next;
        renderDraft({ focusSelector: `[data-move-down="${CSS.escape(statusItem.id)}"]` });
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      delBtn.disabled = readOnly;
      delBtn.dataset.deleteStatus = statusItem.id;
      delBtn.setAttribute(
        'aria-label',
        `Supprimer le statut ${statusItem.label || String(idx + 1)}`,
      );
      setTooltip(delBtn, 'Supprimer le statut');
      const delIc = document.createElement('i');
      delIc.className = 'ph ph-trash cv-icon';
      delIc.setAttribute('aria-hidden', 'true');
      delBtn.append(delIc);
      delBtn.addEventListener('click', () => {
        syncLabelsFromInputs();
        draftStatuses = draftStatuses.filter((item) => item.id !== statusItem.id);
        renderDraft({ focusSelector: '#new-status-label-input' });
      });

      actions.append(upBtn, downBtn, delBtn);
      row.append(field, actions);
      listGroup.append(row);
    });

    // Add new status row
    const addField = document.createElement('div');
    addField.className = 'cv-field';
    const addLabel = document.createElement('label');
    addLabel.className = 'cv-label';
    addLabel.htmlFor = 'new-status-label-input';
    addLabel.textContent = 'Ajouter un statut';

    const addRow = document.createElement('div');
    addRow.className = 'lc-checklist__add';
    const addInput = document.createElement('input');
    addInput.id = 'new-status-label-input';
    addInput.type = 'text';
    addInput.className = 'cv-input';
    addInput.maxLength = 60;
    addInput.placeholder = 'Ex. En revue';
    addInput.disabled = readOnly;

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'btn-add-status';
    addBtn.className = 'cv-btn';
    addBtn.disabled = readOnly;
    addBtn.textContent = 'Ajouter';

    const addError = document.createElement('span');
    addError.id = 'new-status-label-error';
    addError.className = 'cv-error';
    addError.hidden = true;
    const addErrIcon = document.createElement('i');
    addErrIcon.className = 'ph ph-warning-circle cv-icon';
    addErrIcon.setAttribute('aria-hidden', 'true');
    const addErrText = document.createElement('span');
    addErrText.textContent = 'Saisissez un libellé pour ajouter un statut.';
    addError.append(addErrIcon, addErrText);

    function handleAddStatus() {
      syncLabelsFromInputs();
      const cleanLabel = addInput.value.trim();
      if (!cleanLabel) {
        addInput.setAttribute('aria-invalid', 'true');
        addInput.setAttribute('aria-describedby', 'new-status-label-error');
        addError.hidden = false;
        addInput.focus();
        return;
      }
      addInput.removeAttribute('aria-invalid');
      addInput.removeAttribute('aria-describedby');
      addError.hidden = true;
      const existingIds = [
        ...draftStatuses.map((s) => s.id),
        ...state.tasks.map((t) => t.status).filter((s) => typeof s === 'string'),
      ];
      const newId = createTaskStatusId(cleanLabel, existingIds);
      draftStatuses.push({ id: newId, label: cleanLabel.slice(0, 60) });
      renderDraft({ focusSelector: '#new-status-label-input' });
    }

    addBtn.addEventListener('click', handleAddStatus);
    addInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddStatus();
      }
    });
    addInput.addEventListener('input', () => {
      if (addInput.value.trim()) {
        addInput.removeAttribute('aria-invalid');
        addInput.removeAttribute('aria-describedby');
        addError.hidden = true;
      }
    });

    addRow.append(addInput, addBtn);
    addField.append(addLabel, addRow, addError);

    form.append(intro, listGroup, addField);
    modalBody.replaceChildren(form);
    initTooltips(modalBody);

    // Footer buttons
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'btn-reset-statuses';
    resetBtn.className = 'cv-btn cv-btn--ghost';
    resetBtn.style.marginRight = 'auto';
    resetBtn.disabled = readOnly;
    resetBtn.textContent = 'Valeurs par défaut';
    resetBtn.addEventListener('click', () => {
      draftStatuses = DEFAULT_TASK_STATUSES.map((s) => ({ id: s.id, label: s.label }));
      renderDraft({ focusSelector: '#btn-reset-statuses' });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cv-btn';
    cancelBtn.setAttribute('data-cv-close', '');
    cancelBtn.textContent = 'Annuler';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.setAttribute('form', 'form-task-statuses');
    saveBtn.className = 'cv-btn cv-btn--primary';
    saveBtn.id = 'btn-save-statuses';
    saveBtn.disabled = readOnly;
    saveBtn.textContent = 'Enregistrer';

    modalFooter.replaceChildren(resetBtn, cancelBtn, saveBtn);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (readOnly) return;
      syncLabelsFromInputs();

      // If the user typed a new status in the "Add" input without clicking "Ajouter", include it
      const pendingNew = addInput.value.trim();
      if (pendingNew) {
        const existingIds = [
          ...draftStatuses.map((s) => s.id),
          ...state.tasks.map((t) => t.status).filter((s) => typeof s === 'string'),
        ];
        const newId = createTaskStatusId(pendingNew, existingIds);
        draftStatuses.push({ id: newId, label: pendingNew.slice(0, 60) });
        addInput.value = '';
      }

      // Validate that every existing row has a non-empty label
      const inputs = modalBody.querySelectorAll('input[data-status-index]');
      for (const input of inputs) {
        if (!(input instanceof HTMLInputElement)) continue;
        if (!input.value.trim()) {
          const statusId = input.dataset.statusId ?? '';
          const errId = `status-label-error-${statusId}`;
          const errEl = document.getElementById(errId);
          input.setAttribute('aria-invalid', 'true');
          input.setAttribute('aria-describedby', errId);
          if (errEl) errEl.hidden = false;
          input.focus();
          return;
        }
      }

      /** @type {readonly TaskStatusConfig[]} */
      const cleaned = normalizeTaskStatuses(draftStatuses);
      store.dispatch({
        type: 'set_task_statuses',
        statuses: cleaned,
      });
      closeDialogById('modal-statuses');
      notify({
        status: 'success',
        title: 'Statuts mis à jour',
        text: `${cleaned.length} ${cleaned.length > 1 ? 'statuts configurés' : 'statut configuré'} pour le Kanban.`,
      });
    });

    if (renderOpts.focusSelector) {
      const target = /** @type {HTMLElement | null} */ (
        modalDialog.querySelector(renderOpts.focusSelector)
      );
      target?.focus();
    }
  }

  function resetDraftFromStore() {
    const current = store.getState().preferences.taskStatuses;
    draftStatuses = current.map((s) => ({ id: s.id, label: s.label }));
    renderDraft();
  }

  const observer = new MutationObserver(() => {
    if (modalDialog.open) {
      resetDraftFromStore();
    }
  });
  observer.observe(modalDialog, { attributes: true, attributeFilter: ['open'] });

  modalDialog.addEventListener('close', () => {
    modalDialog.returnValue = '';
  });
}
