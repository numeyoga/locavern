/** @import { AppCommand, AppState, LocalRef, StoreEffect, Whiteboard, WhiteboardElement, WhiteboardViewport } from '../../types.d.ts' */

import { collectWhiteboardAssetIds } from '../../core/model.js';
import { selectProjectById, selectTemplates, selectWhiteboards } from '../../core/store.js';
import { instantiateWhiteboardTemplate } from '../../core/templates.js';
import { createTemplatePicker } from './template-picker.js';
import { triggerArchiveDownload } from '../archive-file.js';
import { mountWhiteboardCanvas } from '../whiteboard-canvas.js';
import { confirmAction, notify } from './app-shell.js';
import { createLinkEditor } from './link-editor.js';

/**
 * Sanitize a whiteboard title into a safe local filename stem.
 * @param {string} title
 * @returns {string}
 */
function toSafeFileStem(title) {
  const clean = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'tableau-blanc';
}

/**
 * Render the standalone Whiteboards view with native SVG canvas and local images.
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
 *   onOpenWhiteboardDialog?: (opts?: { whiteboard?: Whiteboard; defaultProjectId?: string | null }) => void;
 *   onNavigateLocalRef?: (ref: LocalRef) => void;
 * }} opts
 * @returns {{ flushAndDestroy: () => void; isDispatchingInline: () => boolean }}
 */
export function renderWhiteboardView({
  container,
  store,
  filters,
  resolveAssetUrl,
  uploadLocalImage,
  onOpenWhiteboardDialog,
  onNavigateLocalRef,
}) {
  const initialState = store.getState();

  const header = document.createElement('div');
  header.className = 'lc-view-header';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'lc-view-header__group';

  const projectWrap = document.createElement('div');
  projectWrap.className = 'cv-select';
  const projectFilter = document.createElement('select');
  projectFilter.id = 'whiteboards-project-filter';
  projectFilter.className = 'cv-input';
  projectFilter.setAttribute('aria-label', 'Filtrer les tableaux blancs par projet');

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Tous les tableaux';
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
  searchInput.id = 'whiteboards-search-input';
  searchInput.type = 'search';
  searchInput.className = 'cv-input';
  searchInput.placeholder = 'Rechercher titre ou texte du tableau';
  searchInput.setAttribute('aria-label', 'Rechercher un tableau blanc');
  searchInput.value = filters.query;
  searchGroup.append(searchIcon, searchInput);

  leftGroup.append(projectWrap, searchGroup);

  const newWbBtn = document.createElement('button');
  newWbBtn.type = 'button';
  newWbBtn.className = 'cv-btn cv-btn--primary';
  newWbBtn.id = 'btn-new-whiteboard';
  newWbBtn.disabled = initialState.readOnly;
  const plusIc = document.createElement('i');
  plusIc.className = 'ph ph-plus cv-icon';
  plusIc.setAttribute('aria-hidden', 'true');
  newWbBtn.append(plusIc, document.createTextNode(' Nouveau tableau blanc'));

  header.append(leftGroup, newWbBtn);

  const bodySlot = document.createElement('div');

  /** @type {ReturnType<typeof mountWhiteboardCanvas> | null} */
  let canvasHandle = null;
  /** @type {number | null} */
  let saveTimer = null;
  /** @type {(() => void) | null} */
  let flushPending = null;
  let dispatchingInlineUpdate = false;

  function cleanupCanvas() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    canvasHandle?.destroy();
    canvasHandle = null;
  }

  function openNewWhiteboardDialog() {
    flushPending?.();
    const state = store.getState();
    const defaultProjId =
      filters.projectId === 'all' ? state.preferences.selectedProjectId : filters.projectId;
    onOpenWhiteboardDialog?.({ defaultProjectId: defaultProjId ?? null });
  }

  newWbBtn.addEventListener('click', openNewWhiteboardDialog);

  function renderBody() {
    cleanupCanvas();
    flushPending = null;

    const state = store.getState();
    const readOnly = state.readOnly;
    const filteredWhiteboards = selectWhiteboards(state, filters);
    const activeWb =
      filteredWhiteboards.find((w) => w.id === state.preferences.selectedWhiteboardId) ??
      filteredWhiteboards[0] ??
      null;

    if (filteredWhiteboards.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cv-empty';
      const iconBox = document.createElement('span');
      iconBox.className = 'cv-empty__icon';
      const ic = document.createElement('i');
      ic.className = 'ph ph-chalkboard-simple cv-icon';
      ic.setAttribute('aria-hidden', 'true');
      iconBox.append(ic);
      const title = document.createElement('p');
      title.className = 'cv-empty__title';
      title.textContent = 'Aucun tableau blanc disponible';
      const desc = document.createElement('p');
      desc.textContent =
        'Créez des schémas, post-it, tracés libres et images locales stockés dans IndexedDB.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'cv-btn cv-btn--primary';
      cta.disabled = readOnly;
      cta.textContent = 'Créer un tableau blanc';
      cta.addEventListener('click', openNewWhiteboardDialog);
      empty.append(iconBox, title, desc, cta);
      bodySlot.replaceChildren(empty);
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'lc-notes-layout';

    const listEl = document.createElement('div');
    listEl.className = 'lc-notes-list';
    listEl.setAttribute('role', 'navigation');
    listEl.setAttribute('aria-label', 'Liste des tableaux blancs');

    /** @type {Map<string, HTMLElement>} */
    const listTitleEls = new Map();

    for (const wb of filteredWhiteboards) {
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'lc-note-item';
      if (activeWb && wb.id === activeWb.id) {
        itemBtn.setAttribute('aria-current', 'true');
      }
      const tSpan = document.createElement('span');
      tSpan.className = 'lc-note-item__title';
      tSpan.textContent = wb.title;
      listTitleEls.set(wb.id, tSpan);

      const mSpan = document.createElement('span');
      mSpan.className = 'lc-note-item__meta';
      const projName = wb.projectId ? selectProjectById(state, wb.projectId)?.name : null;
      mSpan.textContent = projName
        ? `${projName} · ${wb.updatedAt.slice(0, 10)}`
        : wb.updatedAt.slice(0, 10);

      itemBtn.append(tSpan, mSpan);
      itemBtn.addEventListener('click', () => {
        flushPending?.();
        store.dispatch({ type: 'select_whiteboard', whiteboardId: wb.id });
      });
      listEl.append(itemBtn);
    }

    const editorCard = document.createElement('section');
    editorCard.className = 'cv-card';
    editorCard.setAttribute('aria-label', 'Éditeur de tableau blanc');

    if (activeWb) {
      const currentWb = activeWb;
      const metaRow = document.createElement('div');
      metaRow.className = 'lc-view-header';

      const titleField = document.createElement('div');
      titleField.className = 'cv-field';
      titleField.style.flex = '1 1 15rem';
      const titleLabel = document.createElement('label');
      titleLabel.className = 'cv-label';
      titleLabel.htmlFor = 'whiteboard-title-input';
      titleLabel.textContent = 'Titre du tableau blanc';
      const titleInput = document.createElement('input');
      titleInput.id = 'whiteboard-title-input';
      titleInput.type = 'text';
      titleInput.className = 'cv-input';
      titleInput.maxLength = 200;
      titleInput.disabled = readOnly;
      titleInput.value = currentWb.title;
      titleField.append(titleLabel, titleInput);

      const projField = document.createElement('div');
      projField.className = 'cv-field';
      projField.style.minWidth = 'min(100%, 11.25rem)';
      const projLabel = document.createElement('label');
      projLabel.className = 'cv-label';
      projLabel.htmlFor = 'whiteboard-project-select';
      projLabel.textContent = 'Projet associé';
      const projSelectWrap = document.createElement('div');
      projSelectWrap.className = 'cv-select';
      const projSelect = document.createElement('select');
      projSelect.id = 'whiteboard-project-select';
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
      projSelect.value = currentWb.projectId ?? '';
      projSelectWrap.append(projSelect);
      projField.append(projLabel, projSelectWrap);

      metaRow.append(titleField, projField);

      const linkEditor = createLinkEditor({
        idPrefix: 'whiteboard-links',
        state,
        currentRef: { kind: 'whiteboard', id: currentWb.id },
        initialLinks: currentWb.links ?? [],
        readOnly,
        onChange() {
          saveNow(false);
        },
        onNavigate(ref) {
          flushPending?.();
          onNavigateLocalRef?.(ref);
        },
      });

      const canvasHost = document.createElement('div');
      /** @type {WhiteboardViewport} */
      let latestViewport = currentWb.viewport;
      /** @type {readonly WhiteboardElement[]} */
      let latestElements = currentWb.elements;
      let dirty = false;

      const statusEl = document.createElement('span');
      statusEl.className = 'cv-caption';
      statusEl.id = 'whiteboard-save-status';
      statusEl.textContent = 'Enregistré localement';

      function saveNow(showToast = false) {
        if (readOnly) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        const cleanTitle = titleInput.value.trim() || currentWb.title;
        const snapshot = canvasHandle
          ? canvasHandle.getSnapshot()
          : { viewport: latestViewport, elements: [...latestElements] };
        const links = linkEditor.getLinks();
        const assetIds = collectWhiteboardAssetIds(snapshot.elements);
        const projectId = projSelect.value ? projSelect.value : null;
        dirty = false;
        statusEl.textContent = 'Enregistré localement';
        const listTitle = listTitleEls.get(currentWb.id);
        if (listTitle) listTitle.textContent = cleanTitle;
        dispatchingInlineUpdate = true;
        try {
          store.dispatch({
            type: 'update_whiteboard',
            id: currentWb.id,
            patch: {
              title: cleanTitle,
              projectId,
              viewport: snapshot.viewport,
              elements: snapshot.elements,
              links,
              assetIds,
            },
            now: new Date().toISOString(),
          });
        } finally {
          dispatchingInlineUpdate = false;
        }
        if (showToast) {
          notify({ status: 'success', title: 'Tableau blanc enregistré', text: cleanTitle });
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
        statusEl.textContent = 'Modifications en cours';
        if (saveTimer !== null) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveNow(false), 200);
      }

      canvasHandle = mountWhiteboardCanvas({
        container: canvasHost,
        initialViewport: currentWb.viewport,
        initialElements: currentWb.elements,
        editable: !readOnly,
        ariaLabel: `Canevas du tableau blanc ${currentWb.title}`,
        resolveAssetUrl,
        onUploadImage: uploadLocalImage,
        onBlockedRemoteImage: () => {
          notify({
            status: 'warning',
            title: 'Image distante bloquée',
            text: 'Seules les images locales enregistrées sur cet appareil sont autorisées.',
          });
        },
        onChange(next) {
          latestViewport = next.viewport;
          latestElements = next.elements;
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
      openDialogBtn.id = 'btn-open-whiteboard-dialog';
      openDialogBtn.className = 'cv-btn cv-btn--sm';
      openDialogBtn.textContent = 'Ouvrir la saisie';
      openDialogBtn.setAttribute('aria-label', `Ouvrir la saisie pour « ${currentWb.title} »`);
      openDialogBtn.addEventListener('click', () => {
        flushPending?.();
        const freshWb =
          store.getState().whiteboards.find((w) => w.id === currentWb.id) ?? currentWb;
        onOpenWhiteboardDialog?.({ whiteboard: freshWb });
      });

      const exportSvgBtn = document.createElement('button');
      exportSvgBtn.type = 'button';
      exportSvgBtn.id = 'btn-export-wb-svg';
      exportSvgBtn.className = 'cv-btn cv-btn--sm';
      exportSvgBtn.textContent = 'Exporter SVG';
      exportSvgBtn.addEventListener('click', async () => {
        if (!canvasHandle) return;
        try {
          const blob = await canvasHandle.exportSvgBlob();
          const stem = toSafeFileStem(titleInput.value.trim() || currentWb.title);
          triggerArchiveDownload(blob, `${stem}.svg`);
          notify({ status: 'success', title: 'Export SVG prêt', text: `${stem}.svg` });
        } catch {
          notify({
            status: 'danger',
            title: 'Échec de l’export SVG',
            text: 'Impossible de générer le fichier SVG.',
          });
        }
      });

      const exportPngBtn = document.createElement('button');
      exportPngBtn.type = 'button';
      exportPngBtn.id = 'btn-export-wb-png';
      exportPngBtn.className = 'cv-btn cv-btn--sm';
      exportPngBtn.textContent = 'Exporter PNG';
      exportPngBtn.addEventListener('click', async () => {
        if (!canvasHandle) return;
        try {
          const blob = await canvasHandle.exportPngBlob();
          const stem = toSafeFileStem(titleInput.value.trim() || currentWb.title);
          triggerArchiveDownload(blob, `${stem}.png`);
          notify({ status: 'success', title: 'Export PNG prêt', text: `${stem}.png` });
        } catch {
          notify({
            status: 'danger',
            title: 'Échec de l’export PNG',
            text: 'Impossible de générer l’image PNG.',
          });
        }
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.id = 'btn-save-whiteboard';
      saveBtn.className = 'cv-btn cv-btn--primary cv-btn--sm';
      saveBtn.disabled = readOnly;
      saveBtn.textContent = 'Enregistrer';
      saveBtn.addEventListener('click', () => saveNow(true));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.id = 'btn-delete-whiteboard';
      deleteBtn.className = 'cv-btn cv-btn--danger cv-btn--sm';
      deleteBtn.disabled = readOnly;
      deleteBtn.textContent = 'Supprimer';
      deleteBtn.addEventListener('click', async () => {
        const confirmed = await confirmAction({
          title: `Supprimer « ${currentWb.title} » ?`,
          message: 'Ce tableau blanc sera déplacé dans la corbeille locale.',
          confirmLabel: 'Supprimer le tableau blanc',
          danger: true,
        });
        if (!confirmed) return;
        if (saveTimer !== null) {
          window.clearTimeout(saveTimer);
          saveTimer = null;
        }
        dirty = false;
        store.dispatch({
          type: 'trash_whiteboard',
          id: currentWb.id,
          trashId: crypto.randomUUID(),
          now: new Date().toISOString(),
        });
        notify({
          status: 'info',
          title: 'Tableau blanc placé dans la corbeille',
          text: currentWb.title,
        });
      });

      const wbTemplatePicker = createTemplatePicker({
        idPrefix: 'wb-tpl',
        labelText: 'Modèles de canevas',
        templates: selectTemplates(store.getState(), 'whiteboard'),
        readOnly,
        showSave: true,
        async onApply(tpl) {
          const snapshot = canvasHandle
            ? canvasHandle.getSnapshot()
            : { viewport: latestViewport, elements: [...latestElements] };
          if (snapshot.elements.length > 0) {
            const confirmed = await confirmAction({
              title: `Appliquer le modèle « ${tpl.name} » ?`,
              message: 'Les éléments actuels du tableau blanc seront remplacés par ceux du modèle.',
              confirmLabel: 'Appliquer le modèle',
            });
            if (!confirmed) return;
          }
          if (saveTimer !== null) {
            window.clearTimeout(saveTimer);
            saveTimer = null;
          }
          dirty = false;
          const cleanTitle = titleInput.value.trim() || currentWb.title;
          const projectId = projSelect.value ? projSelect.value : null;
          const links = linkEditor.getLinks();
          const instantiated = instantiateWhiteboardTemplate(tpl, () => crypto.randomUUID());
          store.dispatch({
            type: 'update_whiteboard',
            id: currentWb.id,
            patch: {
              title: cleanTitle,
              projectId,
              viewport: instantiated.viewport,
              elements: instantiated.elements,
              links,
              assetIds: [],
            },
            now: new Date().toISOString(),
          });
          notify({ status: 'success', title: 'Modèle de canevas appliqué', text: tpl.name });
        },
        onSaveNew(name) {
          const snapshot = canvasHandle
            ? canvasHandle.getSnapshot()
            : { viewport: latestViewport, elements: [...latestElements] };
          const reusable = snapshot.elements.filter((el) => el.type !== 'image');
          if (reusable.length === 0) {
            notify({
              status: 'warning',
              title: 'Canevas vide',
              text: 'Ajoutez au moins une forme, un post-it ou une flèche avant d’enregistrer un modèle.',
            });
            return false;
          }
          const id = crypto.randomUUID();
          store.dispatch({
            type: 'create_template',
            id,
            kind: 'whiteboard',
            name,
            elements: reusable,
            viewport: snapshot.viewport,
            now: new Date().toISOString(),
          });
          wbTemplatePicker.setTemplates(selectTemplates(store.getState(), 'whiteboard'), id);
          notify({ status: 'success', title: 'Modèle de canevas enregistré', text: name });
          return id;
        },
        onDeleteCustom(tpl) {
          store.dispatch({ type: 'delete_template', id: tpl.id });
          wbTemplatePicker.setTemplates(selectTemplates(store.getState(), 'whiteboard'));
          notify({ status: 'info', title: 'Modèle supprimé', text: tpl.name });
        },
      });

      actions.append(openDialogBtn, exportSvgBtn, exportPngBtn, deleteBtn, saveBtn);
      footer.append(statusEl, actions);
      editorCard.append(metaRow, linkEditor.element, canvasHost, footer, wbTemplatePicker.element);
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
      cleanupCanvas();
    },
    isDispatchingInline() {
      return dispatchingInlineUpdate;
    },
  };
}
