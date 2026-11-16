/**
 * Serialized, debounced directory snapshots. It never prompts in the background.
 * @template Target
 * @param {{
 *   getTarget: () => Target | null;
 *   canWrite: () => boolean;
 *   checkPermission: (target: Target, interactive: boolean) => Promise<PermissionState>;
 *   buildSnapshot: () => Promise<Blob>;
 *   write: (target: Target, blob: Blob) => Promise<void>;
 *   recordSuccess: (target: Target, timestamp: string) => Promise<void>;
 *   delay?: number;
 * }} deps
 */
export function createDirectoryBackup(deps) {
  const delay = deps.delay ?? 3000;
  /** @type {'disconnected' | 'pending' | 'saving' | 'saved' | 'suspended' | 'error' | 'readonly'} */
  let status = 'disconnected';
  let error = '';
  /** @type {string | null} */
  let lastSavedAt = null;
  let revision = 0;
  let generation = 0;
  let disposed = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  /** @type {Promise<boolean> | null} */
  let running = null;
  /** @type {Set<() => void>} */
  const listeners = new Set();
  function publish() {
    for (const listener of listeners) listener();
  }
  function cancelTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }
  function schedule() {
    cancelTimer();
    if (
      !disposed &&
      deps.getTarget() &&
      deps.canWrite() &&
      status !== 'suspended' &&
      status !== 'error'
    ) {
      timer = setTimeout(() => {
        timer = null;
        void save(false);
      }, delay);
    }
  }
  /** @param {boolean} interactive */
  function save(interactive) {
    cancelTimer();
    if (disposed || !deps.getTarget()) return Promise.resolve(false);
    if (!deps.canWrite()) {
      status = 'readonly';
      publish();
      return Promise.resolve(false);
    }
    if (running) return running;
    const target = /** @type {Target} */ (deps.getTarget());
    const startedGeneration = generation;
    const startedRevision = revision;
    // Start a permission request synchronously in the click handler.
    let permission;
    try {
      permission = deps.checkPermission(target, interactive);
    } catch (cause) {
      permission = Promise.reject(cause);
    }
    status = 'saving';
    error = '';
    publish();
    running = (async () => {
      try {
        if ((await permission) !== 'granted') {
          if (generation === startedGeneration) {
            status = 'suspended';
            publish();
          }
          return false;
        }
        const blob = await deps.buildSnapshot();
        if (disposed || generation !== startedGeneration || !deps.canWrite()) return false;
        await deps.write(target, blob);
        const timestamp = new Date().toISOString();
        await deps.recordSuccess(target, timestamp);
        if (generation !== startedGeneration) return false;
        lastSavedAt = timestamp;
        status = revision === startedRevision ? 'saved' : 'pending';
        publish();
        return true;
      } catch (cause) {
        if (generation === startedGeneration) {
          const name = cause instanceof Error ? cause.name : '';
          status = name === 'NotAllowedError' || name === 'SecurityError' ? 'suspended' : 'error';
          error = cause instanceof Error ? cause.message : 'Impossible d’écrire la sauvegarde.';
          publish();
        }
        return false;
      } finally {
        running = null;
        if (generation !== startedGeneration || status === 'pending') schedule();
      }
    })();
    return running;
  }
  return {
    getState() {
      return { status, error, lastSavedAt };
    },
    /** @param {() => void} listener */
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** @param {string | null} [previousSavedAt] */
    directoryChanged(previousSavedAt = null) {
      generation++;
      revision++;
      lastSavedAt = previousSavedAt;
      error = '';
      status = deps.getTarget() ? (deps.canWrite() ? 'pending' : 'readonly') : 'disconnected';
      publish();
      schedule();
    },
    markChanged() {
      revision++;
      if (!deps.getTarget()) return;
      if (!deps.canWrite()) {
        status = 'readonly';
        publish();
        cancelTimer();
        return;
      }
      if (status !== 'suspended' && status !== 'error' && status !== 'saving') status = 'pending';
      publish();
      schedule();
    },
    saveNow() {
      return save(true);
    },
    dispose() {
      disposed = true;
      cancelTimer();
      listeners.clear();
    },
  };
}
