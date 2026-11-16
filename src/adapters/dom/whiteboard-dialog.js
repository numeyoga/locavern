/** @import { AppCommand, AppState, StoreEffect, Whiteboard } from '../../types.d.ts' */

import { DEFAULT_WHITEBOARD_VIEWPORT } from '../../core/model.js';
import { selectProjects, selectTemplates } from '../../core/store.js';
import { instantiateWhiteboardTemplate } from '../../core/templates.js';
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

  const activeProjects = selectProjects(state);
  const projectChoices =
    whiteboard?.projectId && !activeProjects.some((p) => p.id === whiteboard.projectId)
      ? [...activeProjects, ...state.projects.filter((p) => p.id === whiteboard.projectId)]
      : activeProjects;

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
  for (const p of projectChoices) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
    projectSelect.append(opt);
  }
  const preferredProj =
    state.preferences.selectedProjectId &&
    projectChoices.some((p) => p.id === state.preferences.selectedProjectId)
      ? state.preferences.selectedProjectId
      : '';
  projectSelect.value =
    whiteboard !== undefined ? (whiteboard.projectId ?? '') : (defaultProjectId ?? preferredProj);
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  /** @type {HTMLSelectElement | null} */
  let templateSelect = null;
  if (!isEdit) {
    const tplField = document.createElement('div');
    tplField.className = 'cv-field';
    const tplLabel = document.createElement('label');
    tplLabel.className = 'cv-label';
    tplLabel.htmlFor = 'whiteboard-dialog-template-select';
    tplLabel.textContent = 'Modèle de canevas';
    const tplWrap = document.createElement('div');
    tplWrap.className = 'cv-select';
    templateSelect = document.createElement('select');
    templateSelect.id = 'whiteboard-dialog-template-select';
    templateSelect.className = 'cv-input';
    templateSelect.disabled = readOnly;
    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = 'Canevas vierge';
    templateSelect.append(blankOpt);
    for (const tpl of selectTemplates(state, 'whiteboard')) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.builtin ? tpl.name : `${tpl.name} (modèle local)`;
      templateSelect.append(opt);
    }
    tplWrap.append(templateSelect);
    tplField.append(tplLabel, tplWrap);
    form.append(titleField, projectField, tplField);
  } else {
    form.append(titleField, projectField);
  }
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
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('dialog-whiteboard');
      const confirmed = await confirmAction({
        title: `Supprimer « ${whiteboard.title} » ?`,
        message: 'Ce tableau blanc sera déplacé dans la corbeille locale.',
        confirmLabel: 'Supprimer le tableau blanc',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({
          type: 'trash_whiteboard',
          id: whiteboard.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: 'Tableau blanc placé dans la corbeille',
          text: whiteboard.title,
        });
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.id = 'btn-dialog-archive-whiteboard';
    archiveBtn.className = 'cv-btn';
    archiveBtn.style.marginRight = 'auto';
    archiveBtn.textContent = whiteboard.archived ? 'Désarchiver' : 'Archiver';
    archiveBtn.addEventListener('click', () => {
      const nextArchived = !whiteboard.archived;
      store.dispatch({
        type: 'toggle_archive_whiteboard',
        id: whiteboard.id,
        archived: nextArchived,
        now: new Date().toISOString(),
      });
      closeDialogById('dialog-whiteboard');
      notify({
        status: 'info',
        title: nextArchived ? 'Tableau blanc archivé' : 'Tableau blanc désarchivé',
        text: nextArchived ? `${whiteboard.title} déplacé vers les archives.` : whiteboard.title,
      });
    });

    footerButtons.push(deleteBtn, archiveBtn);
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
      const selectedTplId = templateSelect?.value ?? '';
      const selectedTpl = selectedTplId
        ? selectTemplates(store.getState(), 'whiteboard').find((t) => t.id === selectedTplId)
        : undefined;
      const instantiated = selectedTpl
        ? instantiateWhiteboardTemplate(selectedTpl, () => crypto.randomUUID())
        : { viewport: DEFAULT_WHITEBOARD_VIEWPORT, elements: [] };
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_whiteboard',
        id,
        projectId,
        title: cleanTitle,
        viewport: instantiated.viewport,
        elements: instantiated.elements,
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
