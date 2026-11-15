/** @import { ActiveView, AppCommand, AppState, InputPresentation, StoreEffect } from '../../types.d.ts' */

import {
  ACTIVE_VIEWS,
  MAX_TOAST_DURATION_SECONDS,
  MIN_TOAST_DURATION_SECONDS,
} from '../../core/model.js';
import { closeDialogById, openDialogById } from './app-shell.js';

/**
 * Parse and validate a raw duration string in seconds (integer between 1 and 60).
 * @param {string} raw
 * @returns {{ ok: true; value: number } | { ok: false }}
 */
function parseToastDurationInput(raw) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false };
  }
  const value = Number.parseInt(trimmed, 10);
  if (
    !Number.isInteger(value) ||
    value < MIN_TOAST_DURATION_SECONDS ||
    value > MAX_TOAST_DURATION_SECONDS
  ) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * Wire display preferences controls inside #modal-preferences
 * (per-screen input presentation and toast auto-dismiss duration).
 * @param {{
 *   store: {
 *     getState: () => AppState;
 *     dispatch: (cmd: AppCommand) => { state: AppState; effects: StoreEffect[] };
 *     subscribe: (
 *       listener: (info: {
 *         state: AppState;
 *         prevState: AppState;
 *         command: AppCommand;
 *         effects: StoreEffect[];
 *       }) => void,
 *     ) => () => void;
 *   };
 * }} opts
 */
export function wirePreferencesModal({ store }) {
  const modal = document.getElementById('modal-preferences');
  if (!modal) return;
  const modalEl = modal;

  const durationInput = /** @type {HTMLInputElement | null} */ (
    modalEl.querySelector('#pref-toast-duration')
  );
  const durationError = modalEl.querySelector('#pref-toast-duration-error');
  const openStatusesBtn = modalEl.querySelector('#btn-pref-open-statuses');

  openStatusesBtn?.addEventListener('click', () => {
    closeDialogById('modal-preferences');
    openDialogById('modal-statuses');
  });

  function clearDurationError() {
    if (!durationInput) return;
    durationInput.removeAttribute('aria-invalid');
    durationInput.setAttribute('aria-describedby', 'pref-toast-duration-hint');
    if (durationError instanceof HTMLElement) {
      durationError.hidden = true;
      durationError.replaceChildren();
    }
  }

  function showDurationError() {
    if (!durationInput) return;
    durationInput.setAttribute('aria-invalid', 'true');
    durationInput.setAttribute(
      'aria-describedby',
      'pref-toast-duration-error pref-toast-duration-hint',
    );
    if (durationError instanceof HTMLElement) {
      const icon = document.createElement('i');
      icon.className = 'ph ph-warning-circle cv-icon';
      icon.setAttribute('aria-hidden', 'true');
      durationError.replaceChildren(
        icon,
        document.createTextNode(
          `Durée invalide : valeur hors plage ou non entière. Saisissez un entier entre ${MIN_TOAST_DURATION_SECONDS} et ${MAX_TOAST_DURATION_SECONDS} secondes.`,
        ),
      );
      durationError.hidden = false;
    }
  }

  /**
   * Synchronize preference controls with current store state.
   * @param {{ forceDuration?: boolean }} [opts]
   */
  function syncControls({ forceDuration = false } = {}) {
    const { inputPresentations, toastDurationSeconds } = store.getState().preferences;
    for (const fieldset of modalEl.querySelectorAll('fieldset[data-input-screen]')) {
      const screenAttr = fieldset.getAttribute('data-input-screen');
      if (!screenAttr || !ACTIVE_VIEWS.includes(/** @type {ActiveView} */ (screenAttr))) {
        continue;
      }
      const screen = /** @type {ActiveView} */ (screenAttr);
      const activePresentation = inputPresentations[screen];
      for (const radio of fieldset.querySelectorAll('input[type="radio"]')) {
        if (radio instanceof HTMLInputElement) {
          radio.checked = radio.value === activePresentation;
        }
      }
    }

    if (durationInput && (forceDuration || document.activeElement !== durationInput)) {
      durationInput.value = String(toastDurationSeconds);
      clearDurationError();
    }
  }

  function commitDurationInput() {
    if (!durationInput) return;
    const parsed = parseToastDurationInput(durationInput.value);
    if (!parsed.ok) {
      showDurationError();
      return;
    }
    clearDurationError();
    durationInput.value = String(parsed.value);
    if (store.getState().preferences.toastDurationSeconds !== parsed.value) {
      store.dispatch({ type: 'set_toast_duration', seconds: parsed.value });
    }
  }

  modalEl.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target === durationInput) {
      commitDurationInput();
      return;
    }

    if (target.type !== 'radio') return;
    const fieldset = target.closest('fieldset[data-input-screen]');
    if (!fieldset) return;
    const screenAttr = fieldset.getAttribute('data-input-screen');
    if (!screenAttr || !ACTIVE_VIEWS.includes(/** @type {ActiveView} */ (screenAttr))) {
      return;
    }
    const screen = /** @type {ActiveView} */ (screenAttr);
    const presentation = /** @type {InputPresentation} */ (
      target.value === 'modal' ? 'modal' : 'drawer'
    );
    store.dispatch({ type: 'set_input_presentation', screen, presentation });
  });

  durationInput?.addEventListener('input', () => {
    if (durationInput.getAttribute('aria-invalid') === 'true') {
      const parsed = parseToastDurationInput(durationInput.value);
      if (parsed.ok) {
        clearDurationError();
      }
    }
  });

  durationInput?.addEventListener('blur', () => {
    commitDurationInput();
  });

  modalEl.addEventListener('close', () => {
    syncControls({ forceDuration: true });
  });

  syncControls({ forceDuration: true });
  store.subscribe(({ command }) => {
    const forceDuration =
      command.type === 'hydrate' ||
      command.type === 'set_toast_duration' ||
      command.type === 'replace_all';
    syncControls({ forceDuration });
  });
}
