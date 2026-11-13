(() => {
  const STORAGE_KEY = 'locavern-color-scheme';
  /** @type {string | null} */
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  const override = stored === 'light' || stored === 'dark' ? stored : null;
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', override ?? 'light dark');
  }
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = override ?? (prefersDark ? 'dark' : 'light');
})();
