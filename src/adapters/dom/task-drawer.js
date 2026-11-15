/** @import { AppCommand, AppState, ChecklistItem, RichTextDoc, StoreEffect, Task, TaskPriority, TaskStatus } from '../../types.d.ts' */

import { EMPTY_RICH_DOC, collectDocAssetIds, getTaskStatusMeta } from '../../core/model.js';
import { mountRichTextEditor } from '../rich-text-tiptap.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/**
 * Open the Covenant dialog (drawer or modal per user preference) to create or edit a task.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   task?: Task;
 *   defaultProjectId?: string | null;
 *   defaultStatus?: TaskStatus | null;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 * }} opts
 */
export function openTaskDrawer({
  store,
  task,
  defaultProjectId = null,
  defaultStatus,
  resolveAssetUrl,
  uploadLocalImage,
}) {
  const drawer = /** @type {HTMLDialogElement | null} */ (document.getElementById('drawer-task'));
  const titleEl = document.getElementById('drawer-task-title');
  const bodyEl = document.getElementById('drawer-task-body');
  const footerEl = document.getElementById('drawer-task-footer');
  if (!drawer || !titleEl || !bodyEl || !footerEl) return;

  const state = store.getState();
  applyDialogPresentation(drawer, state.preferences.inputPresentations.tasks);
  const isEdit = Boolean(task);
  const readOnly = state.readOnly;
  titleEl.textContent = isEdit ? 'Détails de la tâche' : 'Nouvelle tâche';

  const form = document.createElement('form');
  form.id = 'form-task-drawer';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  // Title field
  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'task-title-input';
  titleLabel.textContent = 'Titre';
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'task-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = task?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'task-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = 'Saisissez un titre de tâche.';
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  // Project select
  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'task-project-select';
  projectLabel.textContent = 'Projet';
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'task-project-select';
  projectSelect.className = 'cv-input';
  projectSelect.disabled = readOnly;
  for (const p of state.projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.archived ? `${p.name} (archivé)` : p.name;
    projectSelect.append(opt);
  }
  projectSelect.value =
    task?.projectId ??
    defaultProjectId ??
    state.preferences.selectedProjectId ??
    state.projects[0]?.id ??
    '';
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  // Status + Priority row
  const configuredStatuses = state.preferences.taskStatuses;
  const statusField = document.createElement('div');
  statusField.className = 'cv-field';
  const statusLabel = document.createElement('label');
  statusLabel.className = 'cv-label';
  statusLabel.htmlFor = 'task-status-select';
  statusLabel.textContent = 'Statut';
  const statusWrap = document.createElement('div');
  statusWrap.className = 'cv-select';
  const statusSelect = document.createElement('select');
  statusSelect.id = 'task-status-select';
  statusSelect.className = 'cv-input';
  statusSelect.disabled = readOnly;

  const currentStatusMeta = task ? getTaskStatusMeta(task.status, configuredStatuses) : null;
  if (currentStatusMeta?.kind === 'unknown' && task?.status) {
    const unknownOpt = document.createElement('option');
    unknownOpt.value = task.status;
    unknownOpt.textContent = currentStatusMeta.label;
    unknownOpt.disabled = true;
    statusSelect.append(unknownOpt);
  }

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'Sans statut';
  statusSelect.append(noneOpt);

  for (const statusCfg of configuredStatuses) {
    const opt = document.createElement('option');
    opt.value = statusCfg.id;
    opt.textContent = statusCfg.label;
    statusSelect.append(opt);
  }

  const fallbackDefaultStatus =
    defaultStatus !== undefined &&
    defaultStatus !== null &&
    configuredStatuses.some((s) => s.id === defaultStatus)
      ? defaultStatus
      : (configuredStatuses[0]?.id ?? '');
  statusSelect.value = task ? (task.status ?? '') : fallbackDefaultStatus;
  statusWrap.append(statusSelect);
  statusField.append(statusLabel, statusWrap);

  const priorityField = document.createElement('div');
  priorityField.className = 'cv-field';
  const priorityLabel = document.createElement('label');
  priorityLabel.className = 'cv-label';
  priorityLabel.htmlFor = 'task-priority-select';
  priorityLabel.textContent = 'Priorité';
  const priorityWrap = document.createElement('div');
  priorityWrap.className = 'cv-select';
  const prioritySelect = document.createElement('select');
  prioritySelect.id = 'task-priority-select';
  prioritySelect.className = 'cv-input';
  prioritySelect.disabled = readOnly;
  /** @type {Array<[TaskPriority, string]>} */
  const priorityOptions = [
    ['low', 'Basse'],
    ['medium', 'Moyenne'],
    ['high', 'Haute'],
  ];
  for (const [val, label] of priorityOptions) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    prioritySelect.append(opt);
  }
  prioritySelect.value = task?.priority ?? 'medium';
  priorityWrap.append(prioritySelect);
  priorityField.append(priorityLabel, priorityWrap);

  // Due date
  const dueField = document.createElement('div');
  dueField.className = 'cv-field';
  const dueLabel = document.createElement('label');
  dueLabel.className = 'cv-label';
  dueLabel.htmlFor = 'task-due-input';
  dueLabel.textContent = 'Échéance';
  const dueInput = document.createElement('input');
  dueInput.id = 'task-due-input';
  dueInput.type = 'date';
  dueInput.className = 'cv-input';
  dueInput.disabled = readOnly;
  dueInput.value = task?.dueDate ?? '';
  dueField.append(dueLabel, dueInput);

  // Checklist section
  /** @type {ChecklistItem[]} */
  let checklist = (task?.checklist ?? []).map((item) => ({ ...item }));
  const checklistFieldset = document.createElement('fieldset');
  checklistFieldset.className = 'cv-fieldset';
  const checklistLegend = document.createElement('legend');
  checklistLegend.className = 'cv-label';
  checklistLegend.textContent = 'Liste de contrôle';
  const checklistList = document.createElement('div');
  checklistList.className = 'lc-checklist';

  const checklistAddRow = document.createElement('div');
  checklistAddRow.className = 'lc-checklist__add';
  const checklistInput = document.createElement('input');
  checklistInput.id = 'task-checklist-new';
  checklistInput.type = 'text';
  checklistInput.className = 'cv-input';
  checklistInput.placeholder = 'Ajouter une étape';
  checklistInput.setAttribute('aria-label', 'Nouvelle étape de la liste de contrôle');
  checklistInput.disabled = readOnly;

  const checklistAddBtn = document.createElement('button');
  checklistAddBtn.type = 'button';
  checklistAddBtn.className = 'cv-btn';
  checklistAddBtn.textContent = 'Ajouter';
  checklistAddBtn.disabled = readOnly;

  function renderChecklist() {
    checklistList.replaceChildren();
    for (const item of checklist) {
      const row = document.createElement('div');
      row.className = 'lc-checklist__row';

      const checkLabel = document.createElement('label');
      checkLabel.className = 'cv-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.done;
      cb.disabled = readOnly;
      cb.addEventListener('change', () => {
        checklist = checklist.map((x) => (x.id === item.id ? { ...x, done: cb.checked } : x));
      });
      const textSpan = document.createElement('span');
      textSpan.textContent = item.text;
      checkLabel.append(cb, textSpan);

      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'cv-btn cv-btn--ghost cv-btn--icon cv-btn--sm';
      rmBtn.setAttribute('aria-label', `Retirer ${item.text}`);
      rmBtn.disabled = readOnly;
      const rmIcon = document.createElement('i');
      rmIcon.className = 'ph ph-x cv-icon';
      rmIcon.setAttribute('aria-hidden', 'true');
      rmBtn.append(rmIcon);
      rmBtn.addEventListener('click', () => {
        checklist = checklist.filter((x) => x.id !== item.id);
        renderChecklist();
      });

      row.append(checkLabel, rmBtn);
      checklistList.append(row);
    }
  }

  checklistAddBtn.addEventListener('click', () => {
    const text = checklistInput.value.trim();
    if (!text) return;
    checklist = [...checklist, { id: crypto.randomUUID(), text, done: false }];
    checklistInput.value = '';
    renderChecklist();
  });

  renderChecklist();
  checklistAddRow.append(checklistInput, checklistAddBtn);
  checklistFieldset.append(checklistLegend, checklistList, checklistAddRow);

  // Rich text description
  const descField = document.createElement('div');
  descField.className = 'cv-field';
  const descLabel = document.createElement('span');
  descLabel.className = 'cv-label';
  descLabel.id = 'task-desc-label';
  descLabel.textContent = 'Description';
  const editorHost = document.createElement('div');
  descField.append(descLabel, editorHost);

  /** @type {RichTextDoc} */
  const initialDoc = task?.descriptionDoc ?? EMPTY_RICH_DOC;
  const editorHandle = mountRichTextEditor({
    container: editorHost,
    initialDoc,
    editable: !readOnly,
    ariaLabel: 'Description de la tâche',
    resolveAssetUrl,
    onUploadImage: uploadLocalImage,
    onBlockedRemoteImage: () => {
      notify({
        status: 'warning',
        title: 'Image distante bloquée',
        text: 'Seules les images locales enregistrées sur cet appareil sont autorisées.',
      });
    },
    onRejectedLink: () => {
      notify({
        status: 'warning',
        title: 'Lien refusé',
        text: 'Seuls les liens https:// et mailto: sont acceptés.',
      });
    },
    onChange() {},
  });

  form.append(
    titleField,
    projectField,
    statusField,
    priorityField,
    dueField,
    checklistFieldset,
    descField,
  );
  bodyEl.replaceChildren(form);

  // Footer actions
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-task-drawer');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer la tâche';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && task && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.style.marginRight = 'auto';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('drawer-task');
      const confirmed = await confirmAction({
        title: `Supprimer « ${task.title} » ?`,
        message: 'Cette tâche sera définitivement supprimée de ce projet.',
        confirmLabel: 'Supprimer la tâche',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({ type: 'delete_task', id: task.id });
        notify({ status: 'info', title: 'Tâche supprimée', text: task.title });
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
      titleInput.setAttribute('aria-describedby', 'task-title-error');
      titleError.hidden = false;
      titleInput.focus();
      return;
    }
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
    titleError.hidden = true;

    const doc = editorHandle.getDoc();
    const assetIds = collectDocAssetIds(doc);
    const now = new Date().toISOString();
    const rawSelectedStatus = statusSelect.value;
    const status = rawSelectedStatus ? /** @type {TaskStatus} */ (rawSelectedStatus) : null;
    const priority = /** @type {TaskPriority} */ (prioritySelect.value);
    const dueDate = dueInput.value ? dueInput.value : null;

    if (isEdit && task) {
      /** @type {{
       *   title: string;
       *   projectId: string;
       *   status?: TaskStatus | null;
       *   priority: TaskPriority;
       *   dueDate: string | null;
       *   checklist: readonly ChecklistItem[];
       *   descriptionDoc: RichTextDoc;
       *   assetIds: readonly string[];
       * }} */
      const patch = {
        title: cleanTitle,
        projectId: projectSelect.value,
        priority,
        dueDate,
        checklist,
        descriptionDoc: doc,
        assetIds,
      };
      if (status !== task.status) {
        patch.status = status;
      }
      store.dispatch({
        type: 'update_task',
        id: task.id,
        patch,
        now,
      });
      notify({ status: 'success', title: 'Tâche enregistrée', text: cleanTitle });
    } else {
      store.dispatch({
        type: 'create_task',
        id: crypto.randomUUID(),
        projectId: projectSelect.value,
        title: cleanTitle,
        status,
        priority,
        dueDate,
        checklist,
        descriptionDoc: doc,
        assetIds,
        now,
      });
      notify({ status: 'success', title: 'Tâche créée', text: cleanTitle });
    }

    closeDialogById('drawer-task');
  });

  const onClose = () => {
    drawer.returnValue = '';
    editorHandle.destroy();
    bodyEl.replaceChildren();
    footerEl.replaceChildren();
    drawer.removeEventListener('close', onClose);
  };
  drawer.addEventListener('close', onClose);

  openDialogById('drawer-task');
  titleInput.focus();
}
