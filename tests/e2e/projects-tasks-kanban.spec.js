import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Projets, Tâches (Liste & Kanban) et accessibilité (Étape 4)', () => {
  test('cycle complet projets, tâches, vue liste, Kanban D&D + clavier et axe-core', async ({
    page,
  }) => {
    await page.goto('/');

    // État initial sans projet
    await expect(page.getByText('Créez un premier projet pour commencer')).toBeVisible();

    // Aller dans Projets et créer un projet
    await page.locator('[data-nav-view="projects"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Projets');

    await page.locator('#btn-new-project').click();
    await page.locator('#project-name-input').fill('Refonte site');
    await page.locator('#project-desc-input').fill('Projet vitrine local');
    await page.locator('#modal-project button[type="submit"]').click();

    await expect(page.getByRole('heading', { name: 'Refonte site' })).toBeVisible();

    // Modifier puis archiver/désarchiver le projet
    await page.getByRole('button', { name: 'Modifier Refonte site' }).click();
    await page.locator('#project-name-input').fill('Refonte web');
    await page.locator('#modal-project button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: 'Refonte web' })).toBeVisible();

    await page.getByRole('button', { name: 'Archiver Refonte web' }).click();
    await expect(page.getByText('Archivé')).toBeVisible();
    await page.getByRole('button', { name: 'Désarchiver Refonte web' }).click();
    await expect(page.getByText('Actif')).toBeVisible();

    // Ouvrir les tâches du projet
    await page.getByRole('button', { name: 'Ouvrir les tâches de Refonte web' }).click();
    await expect(page.locator('#topbar-title')).toHaveText('Tâches');

    // Créer 2 tâches via le Drawer
    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Maquette accueil');
    await page.locator('#task-priority-select').selectOption('high');
    await page.locator('#task-due-input').fill('2026-12-01');
    await page.locator('#task-checklist-new').fill('Valider entête');
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.locator('#drawer-task .ProseMirror').click();
    await page.keyboard.type('Description détaillée');
    await page.locator('#drawer-task button[type="submit"]').click();

    await page.locator('#btn-new-task').click();
    await page.locator('#task-title-input').fill('Tests E2E');
    await page.locator('#drawer-task button[type="submit"]').click();

    // Vérifier DataTable en vue Liste
    await expect(page.locator('table.cv-table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maquette accueil', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tests E2E', exact: true })).toBeVisible();

    // Filtrer par recherche dans la vue Liste
    await page.locator('#list-search-input').fill('Maquette');
    await expect(page.getByRole('button', { name: 'Maquette accueil', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tests E2E', exact: true })).toHaveCount(0);
    await page.locator('#list-search-input').fill('');

    // Basculer en vue Kanban
    await page.locator('input[name="task-display-mode"][value="kanban"]').check();
    await expect(page.locator('.lc-kanban')).toBeVisible();

    const todoCol = page.locator('[data-kanban-status="todo"]');
    const inProgressCol = page.locator('[data-kanban-status="in_progress"]');
    const doneCol = page.locator('[data-kanban-status="done"]');

    await expect(todoCol.getByText('Maquette accueil')).toBeVisible();
    await expect(todoCol.getByText('Tests E2E')).toBeVisible();

    // Déplacement accessible au clavier via Menu Covenant
    await page.getByRole('button', { name: 'Actions pour « Maquette accueil »' }).click();
    await page.getByRole('menuitem', { name: 'Déplacer vers En cours' }).click();
    await expect(inProgressCol.getByText('Maquette accueil')).toBeVisible();

    // Déplacement par Drag & Drop natif HTML
    const dragCard = todoCol.locator('[data-kanban-task-id]', { hasText: 'Tests E2E' });
    await dragCard.dragTo(doneCol);
    await expect(doneCol.getByText('Tests E2E')).toBeVisible();

    // Accessibilité WCAG 2.2 AA en clair et sombre sur Kanban
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Reflow 320 px
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // Suppression de projet avec confirmation modale
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-nav-view="projects"]').click();
    await page.getByRole('button', { name: 'Supprimer Refonte web' }).click();
    await page
      .locator('#modal-confirm')
      .getByRole('button', { name: 'Supprimer le projet' })
      .click();
    await expect(page.getByText('Aucun projet pour le moment')).toBeVisible();
  });
});
