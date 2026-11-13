import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('AppShell Covenant & accessibilité (Étape 1)', () => {
  test('zéro requête externe, thème clair/sombre et 0 violation WCAG 2.2 AA', async ({ page }) => {
    /** @type {string[]} */
    const externalRequests = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (
        url.origin !== 'http://127.0.0.1:4173' &&
        url.protocol !== 'data:' &&
        url.protocol !== 'blob:'
      ) {
        externalRequests.push(req.url());
      }
    });

    await page.goto('/');
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');

    // Vérifier absence de requêtes externes
    expect(externalRequests).toEqual([]);

    // Vérifier thème clair avec axe-core
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const lightResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightResults.violations).toEqual([]);

    // Basculer en thème sombre
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const darkResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkResults.violations).toEqual([]);

    // Vérifier reflow à 320 px (aucun débordement horizontal)
    await page.setViewportSize({ width: 320, height: 640 });
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
