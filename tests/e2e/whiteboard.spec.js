import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TINY_PNG_PATH = new URL('./fixtures/tiny.png', import.meta.url).pathname;

test.describe('Tableaux blancs SVG, persistance IndexedDB & accessibilité WCAG 2.2 AA', () => {
  test('cycle complet : création, outil persistant, superposition, fond transparent, déplacement clavier, image locale, blocage distant, reload, export et axe-core', async ({
    page,
  }) => {
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
    await page.locator('[data-nav-view="whiteboards"]').click();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');

    // Créer un tableau blanc via la fenêtre de saisie dédiée
    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await expect(page.locator('#dialog-whiteboard')).toBeVisible();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma architecture');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Schéma architecture');

    // Ajouter un Post-it via la barre d’outils et saisir son texte au clavier
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();
    // L’outil sélectionné reste actif tant que l’utilisateur n’en change pas
    await expect(page.locator('[data-wb-tool="sticky"]')).toHaveAttribute('aria-pressed', 'true');

    const stickyEl = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    await expect(stickyEl).toBeVisible();
    await stickyEl.focus();

    const initialX = Number(await stickyEl.getAttribute('data-x'));
    const initialY = Number(await stickyEl.getAttribute('data-y'));

    // Édition de texte accessible via F2
    await stickyEl.press('F2');
    const textEditor = page.locator('.lc-wb-text-editor textarea');
    await expect(textEditor).toBeVisible();
    await textEditor.fill('Idée locale');
    await textEditor.press('Enter');
    await expect(stickyEl).toContainText('Idée locale');

    // Déplacement au clavier (ArrowRight + ArrowDown => +10 sur X et Y)
    await stickyEl.focus();
    await stickyEl.press('ArrowRight');
    await stickyEl.press('ArrowDown');
    await expect(stickyEl).toHaveAttribute('data-x', String(initialX + 10));
    await expect(stickyEl).toHaveAttribute('data-y', String(initialY + 10));

    // Sélectionner Rectangle et vérifier qu’il reste actif pour plusieurs dessins successifs
    const rectBtn = page.locator('[data-wb-tool="rect"]');
    await rectBtn.click();
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      // Premier dessin par glisser-déposer sur le canevas
      await page.mouse.move(svgBox.x + 40, svgBox.y + 40);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 140, svgBox.y + 110);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(1);
      await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

      // Deuxième dessin sans re-cliquer sur l’outil Rectangle (même en démarrant sur le premier rectangle)
      await page.mouse.move(svgBox.x + 90, svgBox.y + 75);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 210, svgBox.y + 160);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(2);
      await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');
    }

    // Troisième ajout au centre avec fond transparent activé (pour encadrer un autre élément)
    const transparentBtn = page.locator('[data-wb-action="toggle-transparent-bg"]');
    await transparentBtn.click();
    await expect(transparentBtn).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-wb-action="add-center"]').click();
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(3);
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'true');

    const transparentRect = page.locator(
      '.lc-wb-el[data-el-type="rect"][data-transparent-bg="true"]',
    );
    await expect(transparentRect).toHaveCount(1);
    const transparentFill = await transparentRect
      .locator('.lc-wb-shape')
      .evaluate((el) => getComputedStyle(el).fill);
    expect(transparentFill).toBe('none');

    // Revenir à Sélectionner et tester la superposition (reculer / avancer d’un niveau à la fois)
    await page.locator('[data-wb-tool="select"]').click();
    await expect(page.locator('[data-wb-tool="select"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(rectBtn).toHaveAttribute('aria-pressed', 'false');

    const stickyId = await stickyEl.getAttribute('data-el-id');
    const transparentRectId = await transparentRect.getAttribute('data-el-id');
    expect(stickyId).toBeTruthy();
    expect(transparentRectId).toBeTruthy();

    // Le rectangle transparent vient d’être créé en dernier : il est tout devant
    const getDomOrder = () =>
      page
        .locator('.lc-wb-elements > .lc-wb-el')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-el-id')));

    let order = await getDomOrder();
    expect(order[order.length - 1]).toBe(transparentRectId);

    const bringForwardBtn = page.locator('[data-wb-action="bring-forward"]');
    const sendBackwardBtn = page.locator('[data-wb-action="send-backward"]');
    await transparentRect.focus();
    await expect(bringForwardBtn).toBeDisabled();
    await expect(sendBackwardBtn).toBeEnabled();

    // Reculer d’un seul niveau
    await sendBackwardBtn.click();
    order = await getDomOrder();
    expect(order[order.length - 2]).toBe(transparentRectId);
    await expect(bringForwardBtn).toBeEnabled();

    // Avancer d’un niveau via PageUp au clavier
    await transparentRect.focus();
    await transparentRect.press('PageUp');
    order = await getDomOrder();
    expect(order[order.length - 1]).toBe(transparentRectId);

    // Basculer le fond transparent sur le Post-it puis le rétablir
    await stickyEl.focus();
    await expect(transparentBtn).toHaveAttribute('aria-pressed', 'false');
    await transparentBtn.click();
    await expect(stickyEl).toHaveAttribute('data-transparent-bg', 'true');
    await transparentBtn.click();
    await expect(stickyEl).not.toHaveAttribute('data-transparent-bg', 'true');

    // Ajouter une image locale
    await page.locator('.lc-wb-container .lc-file-input-hidden').setInputFiles(TINY_PNG_PATH);
    const svgImg = page.locator('.lc-wb-el[data-el-type="image"] image[data-asset-id]');
    await expect(svgImg).toBeVisible();
    await expect(svgImg).toHaveAttribute('href', /^blob:/);

    // Tester le blocage du collage d’une image distante HTML
    await page.evaluate(() => {
      const container = document.querySelector('.lc-wb-container');
      if (!container) return;
      const dt = new DataTransfer();
      dt.setData('text/html', '<img src="https://evil.example/remote.png" alt="Externe" />');
      container.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await expect(page.locator('.cv-toast-region')).toContainText('Image distante bloquée');
    expect(externalRequests).toEqual([]);

    // Enregistrer et recharger la page
    await page.locator('#btn-save-whiteboard').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Tableau blanc enregistré');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    await page.reload();
    await expect(page.locator('#topbar-title')).toHaveText('Tableaux blancs');
    await expect(page.locator('#whiteboard-title-input')).toHaveValue('Schéma architecture');

    const restoredSticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    await expect(restoredSticky).toContainText('Idée locale');
    await expect(restoredSticky).toHaveAttribute('data-x', String(initialX + 10));
    await expect(restoredSticky).toHaveAttribute('data-y', String(initialY + 10));
    await expect(page.locator('.lc-wb-el[data-el-type="rect"]')).toHaveCount(3);
    await expect(
      page.locator('.lc-wb-el[data-el-type="rect"][data-transparent-bg="true"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.lc-wb-el[data-el-type="image"] image[data-asset-id]'),
    ).toHaveAttribute('href', /^blob:/);

    // Export SVG et PNG (téléchargements locaux, zéro requête externe)
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-svg').click();
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toBe('schema-architecture.svg');
    const svgStream = await svgDownload.createReadStream();
    /** @type {string[]} */
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    expect(svgChunks.join('')).toContain('fill="none"');

    const pngDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-png').click();
    const pngDownload = await pngDownloadPromise;
    expect(pngDownload.suggestedFilename()).toBe('schema-architecture.png');

    // Audit axe-core WCAG 2.2 AA en thème clair
    const lightAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(lightAxe.violations).toEqual([]);

    // Basculer en thème sombre et vérifier axe-core
    await page.locator('#theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(darkAxe.violations).toEqual([]);

    // Vérifier reflow à 320 px
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow320 = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow320).toBe(false);
    expect(externalRequests).toEqual([]);
  });

  test('sélection multiple (Maj+clic & zone), duplication Ctrl+D et ajustement à la vue', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Tableau multi-sélection');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    // Créer un Post-it et dessiner un Rectangle distinct à côté
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.locator('[data-wb-action="add-center"]').click();
    await page.locator('[data-wb-tool="rect"]').click();
    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      await page.mouse.move(svgBox.x + 24, svgBox.y + 24);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 124, svgBox.y + 104);
      await page.mouse.up();
    }

    await page.locator('[data-wb-tool="select"]').click();
    const sticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();

    // Sélectionner les deux via Maj+clic
    await sticky.click();
    await rect.click({ modifiers: ['Shift'] });
    await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(2);

    // Déplacer les deux simultanément au clavier (+10 px)
    const sX0 = Number(await sticky.getAttribute('data-x'));
    const rX0 = Number(await rect.getAttribute('data-x'));
    await rect.press('ArrowRight');
    await expect(sticky).toHaveAttribute('data-x', String(sX0 + 10));
    await expect(rect).toHaveAttribute('data-x', String(rX0 + 10));

    // Dupliquer la sélection avec Ctrl+D -> 4 éléments au total, dont 2 nouveaux sélectionnés
    await page.keyboard.press('Control+d');
    await expect(page.locator('.lc-wb-el')).toHaveCount(4);
    await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(2);

    // Sélection par zone (outil marquee)
    if (svgBox) {
      await page.locator('[data-wb-tool="marquee"]').click();
      await page.mouse.move(svgBox.x + 6, svgBox.y + 6);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + svgBox.width - 6, svgBox.y + svgBox.height - 6);
      await page.mouse.up();
      await expect(page.locator('.lc-wb-el[data-selected="true"]')).toHaveCount(4);
    }

    // Zoomer puis cliquer sur Ajuster à la vue -> transforme le viewport pour recentrer les éléments
    await page.locator('[data-wb-action="zoom-in"]').click();
    await page.locator('[data-wb-action="zoom-in"]').click();
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveText('140 %');

    await page.locator('[data-wb-action="fit-to-view"]').click();
    await expect(page.locator('[data-wb-action="zoom-reset"]')).toHaveText('100 %');

    const worldTransform = await page.locator('.lc-wb-world').getAttribute('transform');
    expect(worldTransform).toContain('translate(');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('flèches aimantées aux formes : attachement, suivi des déplacements, persistance et détachement', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Schéma flèches aimantées');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (!svgBox) return;

    // Créer un Post-it à gauche et un Rectangle à droite
    await page.locator('[data-wb-tool="sticky"]').click();
    await page.mouse.move(svgBox.x + 60, svgBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 200, svgBox.y + 180);
    await page.mouse.up();

    await page.locator('[data-wb-tool="rect"]').click();
    await page.mouse.move(svgBox.x + 360, svgBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 500, svgBox.y + 180);
    await page.mouse.up();

    const sticky = page.locator('.lc-wb-el[data-el-type="sticky"]').first();
    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();
    const stickyId = await sticky.getAttribute('data-el-id');
    const rectId = await rect.getAttribute('data-el-id');
    expect(stickyId).toBeTruthy();
    expect(rectId).toBeTruthy();

    // Dessiner une flèche reliant le Post-it au Rectangle
    await page.locator('[data-wb-tool="arrow"]').click();
    await page.mouse.move(svgBox.x + 195, svgBox.y + 130);
    await page.mouse.down();
    await page.mouse.move(svgBox.x + 365, svgBox.y + 130);
    await page.mouse.up();

    const arrow = page.locator('.lc-wb-el[data-el-type="arrow"]').first();
    await expect(arrow).toHaveAttribute('data-start-bound', String(stickyId));
    await expect(arrow).toHaveAttribute('data-end-bound', String(rectId));

    const arrowInitialW = Number(await arrow.getAttribute('data-w'));

    // Déplacer le Rectangle vers la droite (+40 px au clavier) -> la flèche s'allonge pour suivre
    await page.locator('[data-wb-tool="select"]').click();
    await rect.focus();
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');
    await rect.press('ArrowRight');

    const arrowUpdatedW = Number(await arrow.getAttribute('data-w'));
    expect(arrowUpdatedW).toBeGreaterThanOrEqual(arrowInitialW + 30);

    // Sauvegarder et recharger : les liaisons et coordonnées suivies persistent
    await page.locator('#btn-save-whiteboard').click();
    await expect(page.locator('.cv-toast-region')).toContainText('Tableau blanc enregistré');
    await expect(page.locator('html')).not.toHaveAttribute('data-persisting', 'true');

    await page.reload();
    const restoredArrow = page.locator('.lc-wb-el[data-el-type="arrow"]').first();
    await expect(restoredArrow).toHaveAttribute('data-start-bound', String(stickyId));
    await expect(restoredArrow).toHaveAttribute('data-end-bound', String(rectId));
    expect(Number(await restoredArrow.getAttribute('data-w'))).toBe(arrowUpdatedW);

    // Sélectionner la flèche et détacher la poignée de fin vers le vide
    await restoredArrow.focus();
    const endHandle = restoredArrow.locator('[data-wb-arrow-handle="end"]');
    await expect(endHandle).toBeVisible();
    const handleBox = await endHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 300, svgBox.y + 320);
      await page.mouse.up();
    }
    await expect(restoredArrow).not.toHaveAttribute('data-end-bound', String(rectId));
    await expect(restoredArrow).toHaveAttribute('data-start-bound', String(stickyId));

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });

  test('grille d’alignement SVG, bascule d’affichage, magnétisme optionnel et export propre', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-nav-view="whiteboards"]').click();

    await page.getByRole('button', { name: 'Créer un tableau blanc' }).click();
    await page.locator('#whiteboard-dialog-title-input').fill('Grille alignement');
    await page.locator('#dialog-whiteboard button[type="submit"]').click();

    const wbContainer = page.locator('.lc-wb-container');
    const gridLayer = page.locator('.lc-wb-grid-layer');
    const gridBtn = page.locator('[data-wb-action="toggle-grid"]');
    const snapBtn = page.locator('[data-wb-action="toggle-snap"]');

    // Grille visible par défaut, magnétisme désactivé par défaut
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(snapBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(wbContainer).toHaveAttribute('data-wb-grid', 'true');
    await expect(wbContainer).toHaveAttribute('data-wb-snap', 'false');
    await expect(gridLayer).toBeVisible();

    // Masquer puis réafficher la grille
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(gridLayer).toBeHidden();
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(gridLayer).toBeVisible();

    // Activer le magnétisme sur la grille (pas de 20 px)
    await snapBtn.click();
    await expect(snapBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(wbContainer).toHaveAttribute('data-wb-snap', 'true');

    // Dessiner un rectangle avec coordonnées non multiples de 20 -> aligné sur la grille
    await page.locator('[data-wb-tool="rect"]').click();
    const svgBox = await page.locator('.lc-wb-svg').boundingBox();
    expect(svgBox).not.toBeNull();
    if (svgBox) {
      await page.mouse.move(svgBox.x + 33, svgBox.y + 47);
      await page.mouse.down();
      await page.mouse.move(svgBox.x + 172, svgBox.y + 153);
      await page.mouse.up();
    }

    const rect = page.locator('.lc-wb-el[data-el-type="rect"]').first();
    await expect(rect).toBeVisible();
    const rx = Number(await rect.getAttribute('data-x'));
    const ry = Number(await rect.getAttribute('data-y'));
    const rw = Number(await rect.getAttribute('data-w'));
    const rh = Number(await rect.getAttribute('data-h'));
    expect(rx % 20).toBe(0);
    expect(ry % 20).toBe(0);
    expect(rw % 20).toBe(0);
    expect(rh % 20).toBe(0);

    // Déplacement clavier avec magnétisme actif -> avance de 20 px
    await page.locator('[data-wb-tool="select"]').click();
    await rect.focus();
    await rect.press('ArrowRight');
    await rect.press('ArrowDown');
    await expect(rect).toHaveAttribute('data-x', String(rx + 20));
    await expect(rect).toHaveAttribute('data-y', String(ry + 20));

    // L’export SVG autonome ne doit pas inclure la grille d’alignement de travail
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-wb-svg').click();
    const svgDownload = await svgDownloadPromise;
    const svgStream = await svgDownload.createReadStream();
    /** @type {string[]} */
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    }
    const exportedSvg = svgChunks.join('');
    expect(exportedSvg).toContain('<rect');
    expect(exportedSvg).not.toContain('lc-wb-grid-layer');
    expect(exportedSvg).not.toContain('grid-minor');

    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axeResults.violations).toEqual([]);
  });
});
