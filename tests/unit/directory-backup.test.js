import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDirectoryBackup } from '../../src/core/directory-backup.js';

afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const deps = {
    getTarget: vi.fn(() => /** @type {string | null} */ ('folder')),
    canWrite: vi.fn(() => true),
    checkPermission: vi.fn(async () => /** @type {PermissionState} */ ('granted')),
    buildSnapshot: vi.fn(async () => new Blob(['state'])),
    write: vi.fn(async () => {}),
    recordSuccess: vi.fn(async () => {}),
    delay: 3000,
  };
  const backup = createDirectoryBackup(deps);
  return { deps, backup };
}

describe('sauvegarde automatique dans le dossier', () => {
  it('crée une première copie, puis regroupe les modifications rapprochées', async () => {
    const { backup, deps } = setup();
    backup.directoryChanged();
    await backup.saveNow();
    expect(deps.checkPermission).toHaveBeenCalledWith('folder', true);
    expect(backup.getState().status).toBe('saved');
    backup.markChanged();
    await vi.advanceTimersByTimeAsync(2000);
    backup.markChanged();
    await vi.advanceTimersByTimeAsync(2999);
    expect(deps.write).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.write).toHaveBeenCalledTimes(2);
    expect(deps.checkPermission).toHaveBeenLastCalledWith('folder', false);
    expect(backup.getState().status).toBe('saved');
    backup.dispose();
  });
  it('suspend une sauvegarde sans autorisation et reprend après un clic explicite', async () => {
    const { backup, deps } = setup();
    deps.checkPermission.mockResolvedValue('prompt');
    backup.directoryChanged();
    await vi.advanceTimersByTimeAsync(3000);
    expect(backup.getState().status).toBe('suspended');
    expect(deps.write).not.toHaveBeenCalled();
    backup.markChanged();
    await vi.advanceTimersByTimeAsync(10000);
    expect(deps.checkPermission).toHaveBeenCalledTimes(1);
    deps.checkPermission.mockResolvedValue('granted');
    await backup.saveNow();
    expect(backup.getState().status).toBe('saved');
    backup.dispose();
  });
  it('préserve la date de dernière réussite si l’écriture échoue', async () => {
    const { backup, deps } = setup();
    backup.directoryChanged();
    await backup.saveNow();
    const previous = backup.getState().lastSavedAt;
    deps.write.mockRejectedValue(new Error('Disque plein'));
    backup.markChanged();
    await vi.advanceTimersByTimeAsync(3000);
    expect(backup.getState()).toMatchObject({
      status: 'error',
      error: 'Disque plein',
      lastSavedAt: previous,
    });
    expect(deps.recordSuccess).toHaveBeenCalledTimes(1);
    backup.dispose();
  });
  it('sérialise les écritures et resauvegarde si des données changent pendant une écriture', async () => {
    const { backup, deps } = setup();
    /** @type {() => void} */ let finish = () => {};
    deps.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    backup.directoryChanged();
    const saving = backup.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(deps.write).toHaveBeenCalledTimes(1);
    backup.markChanged();
    await vi.advanceTimersByTimeAsync(3000);
    expect(deps.write).toHaveBeenCalledTimes(1);
    finish();
    await saving;
    expect(backup.getState().status).toBe('pending');
    await vi.advanceTimersByTimeAsync(3000);
    expect(deps.write).toHaveBeenCalledTimes(2);
    expect(backup.getState().status).toBe('saved');
    backup.dispose();
  });
  it('ignore une préparation devenue obsolète après déconnexion', async () => {
    const { backup, deps } = setup();
    /** @type {(blob: Blob) => void} */ let finish = () => {};
    deps.buildSnapshot.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    backup.directoryChanged();
    const saving = backup.saveNow();
    await vi.advanceTimersByTimeAsync(0);
    deps.getTarget.mockReturnValue(null);
    backup.directoryChanged();
    finish(new Blob(['old']));
    await saving;
    expect(deps.write).not.toHaveBeenCalled();
    expect(backup.getState().status).toBe('disconnected');
    backup.dispose();
  });
  it('ne sauvegarde pas depuis un onglet en lecture seule', async () => {
    const { backup, deps } = setup();
    deps.canWrite.mockReturnValue(false);
    backup.directoryChanged();
    await backup.saveNow();
    await vi.advanceTimersByTimeAsync(5000);
    expect(backup.getState().status).toBe('readonly');
    expect(deps.write).not.toHaveBeenCalled();
    backup.dispose();
  });
});
