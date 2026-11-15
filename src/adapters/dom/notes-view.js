/** @import { AppCommand, AppState, Note, RichTextDoc, StoreEffect } from '../../types.d.ts' */

import { collectDocAssetIds } from '../../core/model.js';
import { selectNotes, selectProjectById } from '../../core/store.js';
import { mountRichTextEditor } from '../rich-text-tiptap.js';
import { confirmAction, notify } from './app-shell.js';

/**
 * Render the standalone Notes view with Tiptap rich text and local images.
 * Keeps header controls mounted when filtering so search input never loses focus.
 * @param {{
 *   container: HTMLElement;
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *   };
 *   filters: {
 *     projectId: string | null | 'all';
 *     query: string;
 *   };
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   uploadLocalImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onOpenNoteDialog?: (opts?: { note?: Note; defaultProjectId?: string | null }) => void;
 * }} opts
 * @returns {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean }}
 */
export function renderNotesView({
  container,
  store,
  filters,
  resolveAssetUrl,
  uploadLocalImage,
  onOpenNoteDialog,
}) {
  const initialState = store.getState();

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projectWrap = document.createElement('div');
  projectWrap.className = 'cv-select';
  const projectFilter = document.createElement('select');
  projectFilter.id = 'notes-project-filter';
  projectFilter.className = 'cv-input';
  projectFilter.setAttribute('aria-label', 'Filtrer les notes par projet');

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Toutes les notes';
  const optNone = document.createElement('option');
  optNone.value = 'none';
  optNone.textContent = 'Sans projet';
  projectFilter.append(optAll, optNone);
  for (const p of initialState.projects) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    projectFilter.append(opt);
  }
  projectFilter.value = filters.projectId === 'all' ? 'all' : (filters.projectId ?? 'none');
  projectWrap.append(projectFilter);

  const searchGroup = document.createElement('div');
  searchGroup.className = 'cv-input-group';
  const searchIcon = document.createElement('i');
  searchIcon.className = 'ph ph-magnifying-glass cv-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  const searchInput = document.createElement('input');
  searchInput.id = 'notes-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Rechercher une note';
  searchInput.setAttribute('aria-label', 'Rechercher une note');
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);

  leftGroup.append(projectWrap, searchGroup);

  const newNoteBtn = document.createElement('button');
  newNoteBtn.type = 'button';
  newNoteBtn.className = 'cv-btn cv-btn--primary';
  newNoteBtn.id = 'btn-new-note';
  newNoteBtn.disabled = initialState.readOnly;
  const plusIc = document.createElement('i');
  plusIc.className = 'ph ph-plus cv-icon';
  plusIc.setAttribute('aria-hidden', 'true');
  newNoteBtn.append(plusIc, document.createTextNode(' Nouvelle note'));

  header.append(leftGroup, newNoteBtn);

  const bodySlot = document.createElement('div');

  /** @type {ReturnType<typeof mountRichTextEditor> | null} */
  let editorHandle = null;
  /** @type {number | null} */
  let saveTimer = null;
  /** @type {(() => void) | null} */
  let flushPending = null;
  let dispatchingInlineUpdate = false;

  function cleanupEditor() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    editorHandle?.destroy();
    editorHandle = null;
  }

  function openNewNoteDialog() {
    flushPending?.();
    const state = store.getState();
    const defaultProjId =
      filters.projectId === 'all' ? state.preferences.selectedProjectId : filters.projectId;
    onOpenNoteDialog?.({ defaultProjectId: defaultProjId ?? null });
  }

  newNoteBtn.addEventListener('click', openNewNoteDialog);

  function renderBody() {
    cleanupEditor();
    flushPending = null;

    const state = store.getState();
    const readOnly = state.readOnly;
    const filteredNotes = selectNotes(state, filters);
    const activeNote =
      filteredNotes.find((n) => n.id === state.preferences.selectedNoteId) ??
      filteredNotes[0] ??
      null;

    if (filteredNotes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-notebook cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = 'Aucune note disponible';
      const desc = document.createElement('p');
      desc.textContent =
        'Rédigez des notes locales avec mise en forme, listes de contrôle et images stockées dans IndexedDB.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = readOnly;
      cta.textContent = 'Créer une note';
      cta.addEventListener('click', openNewNoteDialog);
      empty.append(iconBox, title, desc, cta);
      bodySlot.replaceChildren(empty);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'lc-notes-layout';

    const listEl = document.createElement('div');
    listEl.className = 'lc-notes-list';
    listEl.setAttribute('role', 'navigation');
    listEl.setAttribute('aria-label', 'Liste des notes');

    /** @type {Map<string, HTMLElement>} */
    const listTitleEls = new Map();

    for (const note of filteredNotes) {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'lc-note-item';
      if (activeNote && note.id === activeNote.id) {
        itemBtn.setAttribute('aria-current', 'true');
      }
      const tSpan = document.createElement('span');
      tSpan.className = 'lc-note-item__title';
      tSpan.textContent = note.title;
      listTitleEls.set(note.id, tSpan);

      const mSpan = document.createElement('span');
      mSpan.className = 'lc-note-item__meta';
      const projName = note.projectId ? selectProjectById(state, note.projectId)?.name : null;
      mSpan.textContent = projName
        ? `${projName} · ${note.updatedAt.slice(0, 10)}`
        : note.updatedAt.slice(0, 10);

      itemBtn.append(tSpan, mSpan);
      itemBtn.addEventListener('click', () => {
        flushPending?.();
        store.dispatch({ type: 'select_note', noteId: note.id });
      });
      listEl.append(itemBtn);
    }

    const editorCard = document.createElement('section');
    editorCard.className = 'cv-card';
    editorCard.setAttribute('aria-label', 'Éditeur de note');

    if (activeNote) {
      const currentNote = activeNote;
      const metaRow = document.createElement('div');
      metaRow.className = 'lc-view-header';

      const titleField = document.createElement('div');
      titleField.className = 'cv-field';
      titleField.style.flex = '1 1 15rem';
      const titleLabel = document.createElement('label');
      titleLabel.className = 'cv-label';
      titleLabel.htmlFor = 'note-title-input';
      titleLabel.textContent = 'Titre de la note';
      const titleInput = document.createElement('input');
      titleInput.id = 'note-title-input';
      titleInput.type = 'text';
      titleInput.className = 'cv-input';
      titleInput.maxLength = 200;
      titleInput.disabled = readOnly;
      titleInput.value = currentNote.title;
      titleField.append(titleLabel, titleInput);

      const projField = document.createElement('div');
      projField.className = 'cv-field';
      projField.style.minWidth = 'min(100%, 11.25rem)';
      const projLabel = document.createElement('label');
      projLabel.className = 'cv-label';
      projLabel.htmlFor = 'note-project-select';
      projLabel.textContent = 'Projet associé';
      const projWrap = document.createElement('div');
      projWrap.className = 'cv-select';
      const projSelect = document.createElement('select');
      projSelect.id = 'note-project-select';
      projSelect.className = 'cv-input';
      projSelect.disabled = readOnly;
      const noProjOpt = document.createElement('option');
      noProjOpt.value = '';
      noProjOpt.textContent = 'Sans projet';
      projSelect.append(noProjOpt);
      for (const p of state.projects) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        projSelect.append(opt);
      }
      projSelect.value = currentNote.projectId ?? '';
      projWrap.append(projSelect);
      projField.append(projLabel, projWrap);

      metaRow.append(titleField, projField);

      const editorHost = document.createElement('div');
      /** @type {RichTextDoc} */
      let latestDoc = currentNote.contentDoc;
      let dirty = false;

      const statusNote = document.createElement('span');
      statusNote.className = 'cv-caption';
      statusNote.id = 'note-save-status';
      statusNote.textContent = 'Enregistrée localement';

      function saveNow(showToast = false) {
        if (readOnly) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        const cleanTitle = titleInput.value.trim() || currentNote.title;
        const doc = editorHandle ? editorHandle.getDoc() : latestDoc;
        const assetIds = collectDocAssetIds(doc);
        const projectId = projSelect.value ? projSelect.value : null;
        dirty = false;
        statusNote.textContent = 'Enregistrée localement';
        const listTitle = listTitleEls.get(currentNote.id);
        if (listTitle) listTitle.textContent = cleanTitle;
        dispatchingInlineUpdate = true;
        try {
          store.dispatch({
            type: 'update_note',
            id: currentNote.id,
            patch: {
              title: cleanTitle,
              projectId,
              contentDoc: doc,
              assetIds,
            },
            now: new Date().toISOString(),
          });
        } finally {
          dispatchingInlineUpdate = false;
        }
        if (showToast) {
          notify({ status: 'success', title: 'Note enregistrée', text: cleanTitle });
        }
      }

      flushPending = () => {
        if (dirty || saveTimer !== null) {
          saveNow(false);
        }
      };

      function scheduleSave() {
        if (readOnly) return;
        dirty = true;
        statusNote.textContent = 'Modifications en cours';
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveNow(false), 200);
      }

      editorHandle = mountRichTextEditor({
        container: editorHost,
        initialDoc: currentNote.contentDoc,
        editable: !readOnly,
        ariaLabel: `Contenu de la note ${currentNote.title}`,
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
        onChange(nextDoc) {
          latestDoc = nextDoc;
          scheduleSave();
        },
      });

      titleInput.addEventListener('input', scheduleSave);
      titleInput.addEventListener('blur', () => {
        if (dirty) saveNow(false);
      });
      projSelect.addEventListener('change', () => saveNow(false));

      const footer = document.createElement('div');
      footer.className = 'cv-card__footer';
      footer.style.flexWrap = 'wrap';
      footer.style.gap = 'var(--cv-space-3)';

      const actions = document.createElement('div');
      actions.className = 'lc-table-actions';
      actions.style.flexWrap = 'wrap';

      const openDialogBtn = document.createElement('button');
      openDialogBtn.type = 'button';
      openDialogBtn.id = 'btn-open-note-dialog';
      openDialogBtn.className = 'cv-btn cv-btn--sm';
      openDialogBtn.textContent = 'Ouvrir la saisie';
      openDialogBtn.setAttribute('aria-label', `Ouvrir la saisie pour « ${currentNote.title} »`);
      openDialogBtn.addEventListener('click', () => {
        flushPending?.();
        const freshNote =
          store.getState().notes.find((n) => n.id === currentNote.id) ?? currentNote;
        onOpenNoteDialog?.({ note: freshNote });
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'btn-save-note';
      saveBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
      saveBtn.disabled = readOnly;
      saveBtn.textContent = 'Enregistrer';
      saveBtn.addEventListener('click', () => saveNow(true));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.id = 'btn-delete-note';
      deleteBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
      deleteBtn.disabled = readOnly;
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: `Supprimer « ${currentNote.title} » ?`,
          message: 'Cette note sera définitivement supprimée.',
          confirmLabel: 'Supprimer la note',
          danger: true,
        });
        if (!confirmed) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        dirty = false;
        store.dispatch({ type: 'delete_note', id: currentNote.id });
        notify({ status: 'info', title: 'Note supprimée', text: currentNote.title });
      });

      actions.append(openDialogBtn, deleteBtn, saveBtn);
      footer.append(statusNote, actions);
      editorCard.append(metaRow, editorHost, footer);
    }

    layout.append(listEl, editorCard);
    bodySlot.replaceChildren(layout);
  }

  projectFilter.addEventListener('change', () => {
    flushPending?.();
    filters.projectId =
      projectFilter.value === 'all'
        ? 'all'
        : projectFilter.value === 'none'
          ? null
          : projectFilter.value;
    renderBody();
  });

  searchInput.addEventListener('input', () => {
    flushPending?.();
    filters.query = searchInput.value;
    renderBody();
  });

  renderBody();
  container.replaceChildren(header, bodySlot);

  return {
    flushAndDestroy() {
      flushPending?.();
      cleanupEditor();
    },
    isDispatchingInline() {
      return dispatchingInlineUpdate;
    },
  };
}
