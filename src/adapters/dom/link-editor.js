/** @import { AppState, LocalEntityKind, LocalRef } from '../../types.d.ts' */

import { normalizeLocalRefs } from '../../core/model.js';
import { selectEntityLinkEntries } from '../../core/store.js';
import { initTooltips, setTooltip } from './tooltip.js';

/** @type {Readonly<Record<LocalEntityKind, { icon: string; label: string }>>} */
const KIND_META = {
  task: { icon: 'ph-check-square', label: 'Tâche' },
  note: { icon: 'ph-notebook', label: 'Note' },
  whiteboard: { icon: 'ph-chalkboard-simple', label: 'Tableau' },
};

/**
 * Create a local-reference linker component for Tasks, Notes, and Whiteboards.
 * Displays outgoing links (editable), incoming backlinks (read-only navigation),
 * and a grouped target selector.
 *
 * @param {{
 *   idPrefix: string;
 *   state: AppState;
 *   currentRef: LocalRef | null;
 *   initialLinks?: readonly LocalRef[];
 *   readOnly: boolean;
 *   onChange?: (links: readonly LocalRef[]) => void;
 *   onNavigate?: (ref: LocalRef) => void;
 * }} opts
 * @returns {{
 *   element: HTMLElement;
 *   getLinks: () => readonly LocalRef[];
 *   setLinks: (nextLinks: readonly LocalRef[]) => void;
 * }}
 */
export function createLinkEditor({
  idPrefix,
  state,
  currentRef,
  initialLinks = [],
  readOnly,
  onChange,
  onNavigate,
}) {
  /** @type {LocalRef[]} */
  let links = [...normalizeLocalRefs(initialLinks, currentRef)];

  const wrapper = document.createElement('div');
  wrapper.className = 'cv-field lc-links-field';

  const label = document.createElement('label');
  label.className = 'cv-label';
  label.htmlFor = `${idPrefix}-select`;
  label.textContent = 'Éléments liés';

  const outgoingList = document.createElement('div');
  outgoingList.id = `${idPrefix}-list`;
  outgoingList.className = 'lc-links-list';
  outgoingList.setAttribute('aria-live', 'polite');

  const backlinksWrap = document.createElement('div');
  backlinksWrap.id = `${idPrefix}-backlinks`;
  backlinksWrap.className = 'lc-links-backlinks';

  const addRow = document.createElement('div');
  addRow.className = 'lc-checklist__add';

  const select = document.createElement('select');
  select.id = `${idPrefix}-select`;
  select.className = 'cv-input';
  select.disabled = readOnly;
  select.setAttribute('aria-label', 'Sélectionner une tâche, note ou tableau blanc à lier');

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.id = `${idPrefix}-add`;
  addBtn.className = 'cv-btn cv-btn--sm';
  addBtn.disabled = readOnly;
  addBtn.textContent = 'Lier';

  /**
   * Build a clickable link pill (and optional remove button).
   * @param {{ kind: LocalEntityKind; id: string; title: string; projectName: string | null }} entry
   * @param {boolean} removable
   * @returns {HTMLElement}
   */
  function makeLinkPill(entry, removable) {
    const meta = KIND_META[entry.kind];
    const chip = document.createElement('div');
    chip.className = 'lc-link-chip';
    chip.dataset.linkKind = entry.kind;
    chip.dataset.linkId = entry.id;

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'cv-btn cv-btn--ghost cv-btn--sm lc-link-chip__open';
    const ic = document.createElement('i');
    ic.className = `ph ${meta.icon} cv-icon`;
    ic.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = entry.projectName
      ? `${meta.label} · ${entry.title} (${entry.projectName})`
      : `${meta.label} · ${entry.title}`;
    openBtn.append(ic, txt);
    openBtn.setAttribute('aria-label', `Ouvrir ${meta.label.toLowerCase()} « ${entry.title} »`);
    openBtn.addEventListener('click', () => {
      onNavigate?.({ kind: entry.kind, id: entry.id });
    });

    chip.append(openBtn);

    if (removable && !readOnly) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'lc-tag-chip__remove';
      removeBtn.setAttribute('aria-label', `Retirer le lien vers « ${entry.title} »`);
      setTooltip(removeBtn, 'Retirer le lien');
      const xIc = document.createElement('i');
      xIc.className = 'ph ph-x cv-icon';
      xIc.setAttribute('aria-hidden', 'true');
      removeBtn.append(xIc);
      removeBtn.addEventListener('click', () => {
        links = links.filter((r) => !(r.kind === entry.kind && r.id === entry.id));
        render();
        onChange?.([...links]);
      });
      chip.append(removeBtn);
    }

    return chip;
  }

  function renderSelectOptions() {
    const linkedKeys = new Set(links.map((r) => `${r.kind}:${r.id}`));
    if (currentRef) linkedKeys.add(`${currentRef.kind}:${currentRef.id}`);

    select.replaceChildren();
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = 'Choisir un élément à lier…';
    select.append(emptyOpt);

    const groups = /** @type {const} */ ([
      ['Tâches', 'task', state.tasks],
      ['Notes', 'note', state.notes],
      ['Tableaux blancs', 'whiteboard', state.whiteboards],
    ]);

    let availableCount = 0;
    for (const [groupLabel, kind, items] of groups) {
      const candidates = items.filter((it) => !linkedKeys.has(`${kind}:${it.id}`));
      if (candidates.length === 0) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupLabel;
      for (const it of candidates) {
        const opt = document.createElement('option');
        opt.value = `${kind}:${it.id}`;
        opt.textContent = it.title;
        optgroup.append(opt);
        availableCount += 1;
      }
      select.append(optgroup);
    }

    addBtn.disabled = readOnly || availableCount === 0;
    select.disabled = readOnly || availableCount === 0;
  }

  function render() {
    const resolved = currentRef
      ? selectEntityLinkEntries(state, currentRef.kind, currentRef.id, links)
      : selectEntityLinkEntries(state, 'task', '__new__', links);

    outgoingList.replaceChildren();
    if (resolved.outgoing.length === 0) {
      outgoingList.hidden = true;
    } else {
      outgoingList.hidden = false;
      for (const entry of resolved.outgoing) {
        outgoingList.append(makeLinkPill(entry, true));
      }
    }

    backlinksWrap.replaceChildren();
    if (resolved.incoming.length === 0) {
      backlinksWrap.hidden = true;
    } else {
      backlinksWrap.hidden = false;
      const backLabel = document.createElement('span');
      backLabel.className = 'cv-caption';
      backLabel.textContent = 'Lié depuis :';
      backlinksWrap.append(backLabel);
      for (const entry of resolved.incoming) {
        backlinksWrap.append(makeLinkPill(entry, false));
      }
    }

    initTooltips(outgoingList);
    renderSelectOptions();
  }

  addBtn.addEventListener('click', () => {
    if (readOnly || !select.value) return;
    const colonIdx = select.value.indexOf(':');
    if (colonIdx === -1) return;
    const kind = /** @type {LocalEntityKind} */ (select.value.slice(0, colonIdx));
    const id = select.value.slice(colonIdx + 1);
    const next = [...normalizeLocalRefs([...links, { kind, id }], currentRef)];
    const changed = next.length !== links.length;
    links = next;
    render();
    if (changed) {
      onChange?.([...links]);
    }
  });

  render();

  addRow.append(select, addBtn);
  wrapper.append(label, outgoingList, backlinksWrap, addRow);

  return {
    element: wrapper,
    getLinks() {
      return [...links];
    },
    setLinks(nextLinks) {
      links = [...normalizeLocalRefs(nextLinks, currentRef)];
      render();
    },
  };
}
