/** @import { AppCommand, AppState, LocalRef, Note, RichTextDoc, StoreEffect } from '../../types.d.ts' */

import { EMPTY_RICH_DOC, collectDocAssetIds } from '../../core/model.js';
import {
  selectAllTags,
  selectOrphanedAssetIds,
  selectProjects,
  selectTemplates,
} from '../../core/store.js';
import { instantiateNoteTemplate } from '../../core/templates.js';
import { createTemplatePicker } from './template-picker.js';
import { mountRichTextEditor } from '../rich-text-tiptap.js';
import { createLinkEditor } from './link-editor.js';
import { createTagEditor } from './tag-editor.js';
import {
  applyDialogPresentation,
  closeDialogById,
  confirmAction,
  notify,
  openDialogById,
} from './app-shell.js';

/**
 * Open the Covenant dialog (drawer or modal per user preference) to create or edit a note.
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   note?: Note;
 *   defaultProjectId?: string | null;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onAfterCreate?: (noteId: string) => void;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 */
export function openNoteDialog({
  store,
  note,
  defaultProjectId = null,
  resolveAssetUrl,
  uploadLocalImage,
  onAfterCreate,
  onNavigateLocalRef,
}) {
  const dialog = /** @type {HTMLDialogElement | null} */ (document.getElementById('dialog-note'));
  const titleEl = document.getElementById('dialog-note-title');
  const bodyEl = document.getElementById('dialog-note-body');
  const footerEl = document.getElementById('dialog-note-footer');
  if (!dialog || !titleEl || !bodyEl || !footerEl) return;

  const state = store.getState();
  applyDialogPresentation(dialog, state.preferences.inputPresentations.notes);
  const isEdit = Boolean(note);
  const readOnly = state.readOnly;
  titleEl.textContent = isEdit ? 'Modifier la note' : 'Nouvelle note';

  const form = document.createElement('form');
  form.id = 'form-note-dialog';
  form.noValidate = true;
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = 'var(--cv-space-4)';

  const titleField = document.createElement('div');
  titleField.className = 'cv-field';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'cv-label';
  titleLabel.htmlFor = 'note-dialog-title-input';
  titleLabel.textContent = 'Titre de la note';
  const req = document.createElement('span');
  req.className = 'cv-required';
  req.setAttribute('aria-hidden', 'true');
  req.textContent = '*';
  titleLabel.append(req);

  const titleInput = document.createElement('input');
  titleInput.id = 'note-dialog-title-input';
  titleInput.type = 'text';
  titleInput.className = 'cv-input';
  titleInput.required = true;
  titleInput.maxLength = 200;
  titleInput.disabled = readOnly;
  titleInput.value = note?.title ?? '';

  const titleError = document.createElement('span');
  titleError.id = 'note-dialog-title-error';
  titleError.className = 'cv-error';
  titleError.hidden = true;
  const titleErrIcon = document.createElement('i');
  titleErrIcon.className = 'ph ph-warning-circle cv-icon';
  titleErrIcon.setAttribute('aria-hidden', 'true');
  const titleErrText = document.createElement('span');
  titleErrText.textContent = 'Saisissez un titre de note.';
  titleError.append(titleErrIcon, titleErrText);
  titleField.append(titleLabel, titleInput, titleError);

  const activeProjects = selectProjects(state);
  const projectChoices =
    note?.projectId && !activeProjects.some((p) => p.id === note.projectId)
      ? [...activeProjects, ...state.projects.filter((p) => p.id === note.projectId)]
      : activeProjects;

  const projectField = document.createElement('div');
  projectField.className = 'cv-field';
  const projectLabel = document.createElement('label');
  projectLabel.className = 'cv-label';
  projectLabel.htmlFor = 'note-dialog-project-select';
  projectLabel.textContent = 'Projet associé';
  const projectSelectWrap = document.createElement('div');
  projectSelectWrap.className = 'cv-select';
  const projectSelect = document.createElement('select');
  projectSelect.id = 'note-dialog-project-select';
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
    note !== undefined ? (note.projectId ?? '') : (defaultProjectId ?? preferredProj);
  projectSelectWrap.append(projectSelect);
  projectField.append(projectLabel, projectSelectWrap);

  const tagEditor = createTagEditor({
    idPrefix: 'note-dialog-tags',
    labelText: 'Étiquettes',
    initialTags: note?.tags ?? [],
    suggestions: selectAllTags(state),
    readOnly,
  });

  const linkEditor = createLinkEditor({
    idPrefix: 'note-dialog-links',
    state,
    currentRef: note ? { kind: 'note', id: note.id } : null,
    initialLinks: note?.links ?? [],
    readOnly,
    onNavigate(ref) {
      closeDialogById('dialog-note');
      onClose();
      onNavigateLocalRef?.(ref);
    },
  });

  const contentField = document.createElement('div');
  contentField.className = 'cv-field';
  const contentLabel = document.createElement('span');
  contentLabel.className = 'cv-label';
  contentLabel.id = 'note-dialog-content-label';
  contentLabel.textContent = 'Contenu';
  const editorHost = document.createElement('div');
  contentField.append(contentLabel, editorHost);

  /** @type {Set<string>} */
  const stagedAssetIds = new Set();
  /** @param {File} file */
  async function handleUploadImage(file) {
    const res = await uploadLocalImage(file);
    if (res) stagedAssetIds.add(res.assetId);
    return res;
  }

  /** @type {RichTextDoc} */
  const initialDoc = note?.contentDoc ?? EMPTY_RICH_DOC;
  const editorHandle = mountRichTextEditor({
    container: editorHost,
    initialDoc,
    editable: !readOnly,
    ariaLabel: 'Contenu de la note',
    resolveAssetUrl,
    onUploadImage: handleUploadImage,
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

  const noteDialogTemplatePicker = createTemplatePicker({
    idPrefix: 'note-dialog-tpl',
    labelText: 'Modèles de trame',
    templates: selectTemplates(state, 'note'),
    readOnly,
    showSave: true,
    onApply(tpl) {
      editorHandle.setDoc(instantiateNoteTemplate(tpl));
      notify({ status: 'success', title: 'Trame appliquée', text: tpl.name });
    },
    onSaveNew(name) {
      const id = crypto.randomUUID();
      store.dispatch({
        type: 'create_template',
        id,
        kind: 'note',
        name,
        contentDoc: editorHandle.getDoc(),
        now: new Date().toISOString(),
      });
      noteDialogTemplatePicker.setTemplates(selectTemplates(store.getState(), 'note'), id);
      notify({ status: 'success', title: 'Modèle de note enregistré', text: name });
      return id;
    },
    onDeleteCustom(tpl) {
      store.dispatch({ type: 'delete_template', id: tpl.id });
      noteDialogTemplatePicker.setTemplates(selectTemplates(store.getState(), 'note'));
      notify({ status: 'info', title: 'Modèle supprimé', text: tpl.name });
    },
  });

  form.append(
    titleField,
    projectField,
    tagEditor.element,
    linkEditor.element,
    noteDialogTemplatePicker.element,
    contentField,
  );
  bodyEl.replaceChildren(form);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cv-btn';
  cancelBtn.setAttribute('data-cv-close', '');
  cancelBtn.textContent = 'Annuler';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.setAttribute('form', 'form-note-dialog');
  saveBtn.className = 'cv-btn cv-btn--primary';
  saveBtn.disabled = readOnly;
  saveBtn.textContent = isEdit ? 'Enregistrer' : 'Créer la note';

  /** @type {HTMLElement[]} */
  const footerButtons = [];
  if (isEdit && note && !readOnly) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cv-btn cv-btn--danger';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      closeDialogById('dialog-note');
      const confirmed = await confirmAction({
        title: `Supprimer « ${note.title} » ?`,
        message: 'Cette note sera déplacée dans la corbeille locale.',
        confirmLabel: 'Supprimer la note',
        danger: true,
      });
      if (confirmed) {
        store.dispatch({
          type: 'trash_note',
          id: note.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({ status: 'info', title: 'Note placée dans la corbeille', text: note.title });
      }
    });

    const archiveBtn = document.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.id = 'btn-dialog-archive-note';
    archiveBtn.className = 'cv-btn';
    archiveBtn.style.marginRight = 'auto';
    archiveBtn.textContent = note.archived ? 'Désarchiver' : 'Archiver';
    archiveBtn.addEventListener('click', () => {
      const nextArchived = !note.archived;
      store.dispatch({
        type: 'toggle_archive_note',
        id: note.id,
        archived: nextArchived,
        now: new Date().toISOString(),
      });
      closeDialogById('dialog-note');
      onClose();
      notify({
        status: 'info',
        title: nextArchived ? 'Note archivée' : 'Note désarchivée',
        text: nextArchived ? `${note.title} déplacée vers les archives.` : note.title,
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
      titleInput.setAttribute('aria-describedby', 'note-dialog-title-error');
      titleError.hidden = false;
      titleInput.focus();
      return;
    }
    titleInput.removeAttribute('aria-invalid');
    titleInput.removeAttribute('aria-describedby');
    titleError.hidden = true;

    const tags = tagEditor.commitPending();
    const links = linkEditor.getLinks();
    const doc = editorHandle.getDoc();
    const assetIds = collectDocAssetIds(doc);
    const projectId = projectSelect.value ? projectSelect.value : null;
    const now = new Date().toISOString();

    try {
      if (isEdit && note) {
        store.dispatch({
          type: 'update_note',
          id: note.id,
          patch: {
            title: cleanTitle,
            projectId,
            contentDoc: doc,
            tags,
            links,
            assetIds,
          },
          now,
        });
        notify({ status: 'success', title: 'Note enregistrée', text: cleanTitle });
      } else {
        const id = crypto.randomUUID();
        store.dispatch({
          type: 'create_note',
          id,
          projectId,
          title: cleanTitle,
          contentDoc: doc,
          tags,
          links,
          assetIds,
          now,
        });
        notify({ status: 'success', title: 'Note créée', text: cleanTitle });
        onAfterCreate?.(id);
      }
    } catch (err) {
      notify({
        status: 'danger',
        title: 'Enregistrement impossible',
        text: err instanceof Error ? err.message : 'Erreur de validation.',
      });
      return;
    }

    const orphanedStaged = selectOrphanedAssetIds(store.getState(), stagedAssetIds);
    for (const id of orphanedStaged) {
      store.dispatch({ type: 'delete_asset', id });
    }
    stagedAssetIds.clear();
    closeDialogById('dialog-note');
    onClose();
  });

  let closed = false;
  const onClose = () => {
    if (closed) return;
    closed = true;
    dialog.returnValue = '';
    if (stagedAssetIds.size > 0 && !store.getState().readOnly) {
      const orphanedStaged = selectOrphanedAssetIds(store.getState(), stagedAssetIds);
      for (const id of orphanedStaged) {
        store.dispatch({ type: 'delete_asset', id });
      }
      stagedAssetIds.clear();
    }
    editorHandle.destroy();
    bodyEl.replaceChildren();
    footerEl.replaceChildren();
    dialog.removeEventListener('close', onClose);
  };
  dialog.addEventListener('close', onClose);

  openDialogById('dialog-note');
  titleInput.focus();
}
