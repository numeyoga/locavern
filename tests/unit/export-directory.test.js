import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chooseExportDirectory,
  forgetExportDirectory,
  getDirectoryBackupInfo,
  getDirectoryTarget,
  initializeExportDirectory,
  supportsExportDirectory,
  checkDirectoryPermission,
  writeDirectoryBackup,
  recordDirectoryBackup,
} from '../../src/adapters/export-directory.js';
import { saveArchiveBlob } from '../../src/adapters/archive-file.js';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const write = vi.fn(async () => {});
  const close = vi.fn(async () => {});
  const abort = vi.fn(async () => {});
  const directory = {
    kind: 'directory',
    name: 'Sauvegardes',
    requestPermission: vi.fn(async () => 'granted'),
    queryPermission: vi.fn(async () => 'granted'),
    getFileHandle: vi.fn(async () => ({ createWritable: async () => ({ write, close, abort }) })),
  };
  const picker = vi.fn(async () => directory);
  vi.stubGlobal('window', { isSecureContext: true, showDirectoryPicker: picker });
  const db = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
  const initialize = () =>
    initializeExportDirectory(
      /** @type {import('idb').IDBPDatabase} */ (/** @type {unknown} */ (db)),
    );
  const target = () =>
    /** @type {NonNullable<ReturnType<typeof getDirectoryTarget>>} */ (getDirectoryTarget());
  return { write, close, abort, directory, picker, db, initialize, target };
}

describe('dossier de sauvegarde', () => {
  it('exige un navigateur compatible et un contexte sécurisé', () => {
    setup();
    expect(supportsExportDirectory()).toBe(true);
    vi.stubGlobal('window', { isSecureContext: false, showDirectoryPicker: vi.fn() });
    expect(supportsExportDirectory()).toBe(false);
  });
  it('mémorise le dossier et la date uniquement après une écriture réussie', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    expect(getDirectoryBackupInfo()).toEqual({
      name: 'Sauvegardes',
      lastSavedAt: null,
      remembered: true,
    });
    const blob = new Blob(['zip']);
    await writeDirectoryBackup(f.target(), blob);
    await recordDirectoryBackup(f.target(), '2026-11-16T12:00:00.000Z');
    expect(f.directory.getFileHandle).toHaveBeenCalledWith('locavern-sauvegarde.zip', {
      create: true,
    });
    expect(f.write).toHaveBeenCalledWith(blob);
    expect(f.close).toHaveBeenCalledOnce();
    expect(getDirectoryBackupInfo().lastSavedAt).toBe('2026-11-16T12:00:00.000Z');
    expect(f.db.put).toHaveBeenLastCalledWith(
      'meta',
      expect.objectContaining({ lastSavedAt: '2026-11-16T12:00:00.000Z' }),
    );
  });
  it('restaure le dossier sans demande d’autorisation et ne sollicite pas le disque en arrière-plan', async () => {
    const f = setup();
    f.db.get.mockResolvedValue({ value: f.directory, lastSavedAt: '2026-11-16T12:00:00.000Z' });
    await f.initialize();
    expect(f.directory.requestPermission).not.toHaveBeenCalled();
    await checkDirectoryPermission(f.target(), false);
    expect(f.directory.queryPermission).toHaveBeenCalledOnce();
    expect(f.directory.requestPermission).not.toHaveBeenCalled();
    await checkDirectoryPermission(f.target(), true);
    expect(f.directory.requestPermission).toHaveBeenCalledOnce();
  });
  it('conserve le dossier après annulation du sélecteur', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    f.picker.mockRejectedValue(new DOMException('Annulé', 'AbortError'));
    await expect(chooseExportDirectory()).rejects.toMatchObject({ name: 'AbortError' });
    expect(getDirectoryBackupInfo().name).toBe('Sauvegardes');
  });
  it('reste utilisable pour la session si la mémorisation est bloquée', async () => {
    const f = setup();
    await f.initialize();
    f.db.put.mockRejectedValue(new Error('Quota'));
    expect(await chooseExportDirectory()).toEqual({ remembered: false });
    await writeDirectoryBackup(f.target(), new Blob(['x']));
    expect(f.close).toHaveBeenCalledOnce();
  });
  it('annule le flux si le disque échoue, sans avancer la date', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    f.write.mockRejectedValue(new Error('Disque plein'));
    await expect(writeDirectoryBackup(f.target(), new Blob(['x']))).rejects.toThrow('Disque plein');
    expect(f.abort).toHaveBeenCalledOnce();
    expect(f.close).not.toHaveBeenCalled();
    expect(getDirectoryBackupInfo().lastSavedAt).toBeNull();
  });
  it('les exports ponctuels restent indépendants du dossier connecté', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    const fallbackDownload = vi.fn();
    await saveArchiveBlob(new Blob(['md']), 'note.md', { fallbackDownload });
    expect(fallbackDownload).toHaveBeenCalledOnce();
    expect(f.directory.getFileHandle).not.toHaveBeenCalled();
  });
  it('déconnecte le dossier sans supprimer les fichiers', async () => {
    const f = setup();
    await f.initialize();
    await chooseExportDirectory();
    await forgetExportDirectory();
    expect(f.db.delete).toHaveBeenCalledWith('meta', 'exportDirectory');
    expect(getDirectoryTarget()).toBeNull();
    expect(f.directory.getFileHandle).not.toHaveBeenCalled();
  });
});
