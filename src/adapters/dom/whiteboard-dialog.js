/** @import { AppCommand, AppState, StoreEffect, Whiteboard } from '../../types.d.ts' */

import { DEFAULT_WHITEBOARD_VIEWPORT } from '../../core/model.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/**
 * Open the Covenant dialog (modal or drawer per user preference) to create or edit a whiteboard.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   whiteboard?: Whiteboard;
 *   defaultProjectId?: string | null;
 *   onAfterCreate?: (whiteboardId: string) => void;
 * }} opts
 */
export function openWhiteboardDialog({
  store,
  whiteboard,
  defaultProjectId = null,
  onAfterCreate,
}) {
  const dialog = /** @type {HTMLDialogElement | null} */ (
    document.getElementById('dialog-whiteboard')
  );
  const titleEl = document.getElementById('dialog-whiteboard-title');
  const bodyEl = document.getElementById('dialog-whiteboard-body');
  const footerEl = document.getElementById('dialog-whiteboard-footer');
  if (!dialog || !titleEl || !bodyEl || !footerEl) return;

  const state = store.getState();
  applyDialogPresentation(dialog, state.preferences.inputPresentations.whiteboards);
  const isEdit = Boolean(whiteboard);
  const readOnly = state.readOnly;
  titleEl.textContent = isEdit ? 'Modifier le tableau blanc' : 'Nouveau tableau blanc';

  const form = document.createElement('form');
  form.id = 'form-whiteboard-dialog';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'whiteboard-dialog-title-input';
  titleLabel.textContent = 'Titre du tableau blanc';
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'whiteboard-dialog-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = whiteboard?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'whiteboard-dialog-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = 'Saisissez un titre de tableau blanc.';
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'whiteboard-dialog-project-select';
  projectLabel.textContent = 'Projet associé';
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'whiteboard-dialog-project-select';
  projectSelect.className = 'cv-input';
  projectSelect.disabled = readOnly;
  const noProjOpt = document.createElement('option');
  noProjOpt.value = '';
  noProjOpt.textContent = 'Sans projet';
  projectSelect.append(noProjOpt);
  for (const p of state.projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
    projectSelect.append(opt);
  }
  projectSelect.value =
    whiteboard !== undefined
      ? (whiteboard.projectId ?? '')
      : (defaultProjectId ?? state.preferences.selectedProjectId ?? '');
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  form.append(titleField, projectField);
  bodyEl.replaceChildren(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-whiteboard-dialog');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer le tableau blanc';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && whiteboard && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.style.marginRight = 'auto';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('dialog-whiteboard');
      const confirmed = await confirmAction({
        title: `Supprimer « ${whiteboard.title} » ?`,
        message: 'Ce tableau blanc sera définitivement supprimé.',
        confirmLabel: 'Supprimer le tableau blanc',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({ type: 'delete_whiteboard', id: whiteboard.id });
        notify({ status: 'info', title: 'Tableau blanc supprimé', text: whiteboard.title });
      }
    });
    footerButtons.push(deleteBtn);
  }
  footerButtons.push(cancelBtn, saveBtn);
  footerEl.replaceChildren(...footerButtons);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (readOnly) return;

    const cleanTitle = titleInput.value.trim();
    if (!cleanTitle) {
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.setAttribute('aria-describedby', 'whiteboard-dialog-title-error');
      titleError.hidden = false;
      titleInput.focus();
      return;
    }
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
    titleError.hidden = true;

    const projectId = projectSelect.value ? projectSelect.value : null;
    const now = new Date().toISOString();

    if (isEdit && whiteboard) {
      store.dispatch({
        type: 'update_whiteboard',
        id: whiteboard.id,
        patch: {
          title: cleanTitle,
          projectId,
        },
        now,
      });
      notify({ status: 'success', title: 'Tableau blanc enregistré', text: cleanTitle });
    } else {
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_whiteboard',
        id,
        projectId,
        title: cleanTitle,
        viewport: DEFAULT_WHITEBOARD_VIEWPORT,
        elements: [],
        assetIds: [],
        now,
      });
      notify({ status: 'success', title: 'Tableau blanc créé', text: cleanTitle });
      onAfterCreate?.(id);
    }

    closeDialogById('dialog-whiteboard');
  });

  const onClose = () => {
    dialog.returnValue = '';
    bodyEl.replaceChildren();
    footerEl.replaceChildren();
    dialog.removeEventListener('close', onClose);
  };
  dialog.addEventListener('close', onClose);

  openDialogById('dialog-whiteboard');
  titleInput.focus();
}
