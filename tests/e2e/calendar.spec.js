import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** @param {Date} d */
function toIsoLocal(d) {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Vue Calendrier mensuelle & hebdomadaire (Todos 5 & 15)', () => {
  test('affiche échéances en mois/semaine, reporte par glisser-déposer et clavier, exporte en .ics, WCAG 2.2 AA', async ({
    page,
  }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day10Iso = toIsoLocal(new Date(year, month, 10));
    const day12Iso = toIsoLocal(new Date(year, month, 12));
    const day13Iso = toIsoLocal(new Date(year, month, 13));
    const day20Iso = toIsoLocal(new Date(year, month, 20));

    await page.goto('/');

    // Créer un projet et une tâche datée au 10 du mois courant
    await page.getByRole('button', { name: 'Créer un projet' }).click();
    await page.locator('#project-name-input').fill('Calendrier Projet');
    await page.locator('#modal-project button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Livraison Jalons');
    await page.locator('#task-due-input').fill(day10Iso);
    await page.locator('#drawer-task button[type="submit"]').click();

    // Aller sur la vue Calendrier
    await page.locator('[data-nav-view="calendar"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');

    const day10Cell = page.locator(`[data-cal-date="${day10Iso}"]`);
    const day12Cell = page.locator(`[data-cal-date="${day12Iso}"]`);
    await expect(day10Cell).toContainText('Livraison Jalons');

    // Accessibilité en thème clair (vue Mois)
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Glisser-déposer de day10Iso vers day12Iso
    const draggableTask = day10Cell.locator('.lc-cal-task').first();
    await draggableTask.dragTo(day12Cell);
    await expect(day12Cell).toContainText('Livraison Jalons');
    await expect(day10Cell).not.toContainText('Livraison Jalons');

    // Report au clavier avec Shift+ArrowRight (+1 jour -> day13Iso) en conservant le focus
    const openTaskBtn = day12Cell.locator('.lc-cal-task__btn').first();
    await openTaskBtn.focus();
    await page.keyboard.press('Shift+ArrowRight');
    const day13Cell = page.locator(`[data-cal-date="${day13Iso}"]`);
    await expect(day13Cell).toContainText('Livraison Jalons');
    await expect(day13Cell.locator('.lc-cal-task__btn').first()).toBeFocused();

    // Report avec Shift+ArrowDown (+7 jours -> day20Iso)
    await page.keyboard.press('Shift+ArrowDown');
    const day20Cell = page.locator(`[data-cal-date="${day20Iso}"]`);
    await expect(day20Cell).toContainText('Livraison Jalons');

    // Export iCalendar (.ics) des tâches datées
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-cal-export-ics').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^locavern-.*\.ics$/);
    const icsStream = await download.createReadStream();
    /** @type {string[]} */
    const icsChunks = [];
    for await (const chunk of icsStream) {
      icsChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const icsText = icsChunks.join('');
    expect(icsText).toContain('BEGIN:VCALENDAR');
    expect(icsText).toContain('BEGIN:VEVENT');
    expect(icsText).toContain(`DTSTART;VALUE=DATE:${day20Iso.replace(/-/g, '')}`);
    expect(icsText).toContain('SUMMARY:Livraison Jalons');
    expect(icsText).toContain('END:VCALENDAR');

    // Basculer en vue Semaine et vérifier la présence de la tâche
    await page.locator('input[name="calendar-view-mode"][value="week"]').check();
    await expect(page.locator(`[data-cal-date="${day20Iso}"]`)).toContainText('Livraison Jalons');

    // Thème sombre + audit axe-core
    await page.locator('#theme-switch').click();
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Persistance après rechargement
    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Calendrier');
    await expect(page.locator(`[data-cal-date="${day20Iso}"]`)).toContainText('Livraison Jalons');

    // Vérifier reflow 320 px sans débordement horizontal
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
  });
});
