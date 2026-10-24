import { expect, test, type Page } from '@playwright/test';

async function openPlay(page: Page) {
  await page.goto('play');
  await expect(page.getByRole('heading', { name: 'Free-play' })).toBeVisible();
  // The engine worker answers once its tables are built.
  await expect(page.getByTestId('stage-status')).toHaveText('Solved!', { timeout: 20_000 });
}

const pad = (page: Page) => page.getByRole('group', { name: 'Move pad' });
const history = (page: Page) => page.getByTestId('history-moves');
const count = (page: Page) => page.getByTestId('move-count');

test('move pad, merged history, undo and redo', async ({ page }) => {
  await openPlay(page);
  await pad(page).getByRole('button', { name: 'R', exact: true }).click();
  await pad(page).getByRole('button', { name: 'R', exact: true }).click();
  await pad(page).getByRole('button', { name: "U'", exact: true }).click();
  await expect(count(page)).toHaveText('3 moves');
  await expect(history(page)).toHaveText("R2 U'");

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(count(page)).toHaveText('2 moves');
  await expect(history(page)).toHaveText('R2');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(history(page)).toHaveText("R2 U'");

  // Keyboard: cstimer layout (I = R) and Ctrl+Z.
  await page.keyboard.press('KeyI');
  await expect(count(page)).toHaveText('4 moves');
  await page.keyboard.press('Control+z');
  await expect(count(page)).toHaveText('3 moves');
  await expect(page.getByTestId('stage-status')).toHaveText('White cross not solved');
});

test('solve next F2L pair with the helper', async ({ page }) => {
  await openPlay(page);
  await pad(page)
    .getByRole('button', { name: /Wide moves/ })
    .click();
  for (const move of ['z2', 'R', 'U', "R'"]) {
    await pad(page).getByRole('button', { name: move, exact: true }).click();
  }
  await expect(page.getByTestId('stage-status')).toHaveText('Cross ✓ · 3/4 F2L pairs');

  await page.getByRole('button', { name: 'Find next F2L pair' }).click();
  await expect(page.getByTestId('helper-info')).toContainText('Next pair');

  await page.getByRole('button', { name: 'Solve next F2L pair' }).click();
  await expect(page.getByTestId('stage-status')).toHaveText(/Solved!|Just a U turn left/, {
    timeout: 20_000,
  });
  // Helper moves are recorded after the user's moves.
  await expect(count(page)).not.toHaveText('4 moves');
});

test('scramble, helper playback can be stopped with Esc', async ({ page }) => {
  await openPlay(page);
  await page.getByRole('button', { name: 'Scramble' }).click();
  await expect(page.getByTestId('stage-status')).toHaveText('White cross not solved', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Solve cross' }).click();
  await expect(page.getByTestId('stage-status')).toContainText('Playing');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('stage-status')).not.toContainText('Playing');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('tapping a sticker turns its face in the chosen direction', async ({ page }) => {
  await openPlay(page);
  const cube = page.locator('twisty-player');
  await page.waitForTimeout(1500); // the 3D renderer loads lazily
  const tap = async () => {
    const box = (await cube.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
  };

  await tap();
  await expect(count(page)).toHaveText('1 move');
  await expect(history(page)).not.toContainText("'"); // clockwise by default (D-068)

  await page.getByRole('button', { name: 'Free-play options' }).click();
  await page.getByRole('radio', { name: 'Anticlockwise' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await tap();
  await expect(count(page)).toHaveText('1 move');
  await expect(history(page)).toContainText("'");
});

test('2x2 mode offers the Ortega helpers', async ({ page }) => {
  await openPlay(page);
  await page.getByRole('group', { name: 'Puzzle' }).getByRole('button', { name: '2x2' }).click();
  await page.getByRole('button', { name: 'Scramble' }).click();
  await expect(page.getByTestId('stage-status')).not.toHaveText('Solved!', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: /Solve (face|OLL|PBL)/ })).toBeVisible();
  // No slice moves on a 2x2.
  await pad(page).getByRole('button', { name: 'Rotations' }).click();
  await expect(pad(page).getByRole('button', { name: 'M', exact: true })).toHaveCount(0);
});

/** Saturated pixels in `after` whose colour differs from `before` (the cube must not change under a highlight). */
async function changedColours(page: Page, before: Buffer, after: Buffer) {
  return page.evaluate(
    async ([a, b]) => {
      const pixels = async (png: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const [A, B] = await Promise.all([pixels(a!), pixels(b!)]);
      let lit = 0;
      let changed = 0;
      for (let i = 0; i < B.length; i += 12) {
        const max = Math.max(B[i]!, B[i + 1]!, B[i + 2]!);
        const min = Math.min(B[i]!, B[i + 1]!, B[i + 2]!);
        if (max < 128 || (max - min) / max < 0.5) continue;
        lit++;
        const diff =
          Math.abs(B[i]! - A[i]!) + Math.abs(B[i + 1]! - A[i + 1]!) + Math.abs(B[i + 2]! - A[i + 2]!);
        if (diff > 60) changed++;
      }
      return { lit, changed };
    },
    [before.toString('base64'), after.toString('base64')],
  );
}

test('find next pair highlights the cube as it is (D-083)', async ({ page }) => {
  test.setTimeout(120_000);
  await openPlay(page);
  await page.getByRole('button', { name: 'Scramble' }).click();
  await expect(page.getByTestId('stage-status')).toHaveText('White cross not solved', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Solve cross' }).click();
  const solvePair = page.getByRole('button', { name: 'Solve next F2L pair' });
  await expect(solvePair).toBeEnabled({ timeout: 30_000 });
  for (let i = 0; i < 2; i++) {
    await solvePair.click();
    await expect(solvePair).toBeEnabled({ timeout: 30_000 });
  }
  await page.waitForTimeout(1000);
  const cube = page.getByRole('img', { name: /cube/ }).first();
  const before = await cube.screenshot();
  await page.getByRole('button', { name: 'Find next F2L pair' }).click();
  await expect(page.getByTestId('helper-info')).toContainText('Next pair');
  await page.waitForTimeout(1500);
  const { lit, changed } = await changedColours(page, before, await cube.screenshot());
  expect(lit).toBeGreaterThan(100);
  expect(changed).toBeLessThanOrEqual(lit * 0.02);
});
