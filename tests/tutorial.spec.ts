import { expect, test, type Page } from '@playwright/test';

// Plan P4 exit criterion: random scramble → step through every stage → solved, for both tutorials, on the
// laptop and phone projects.

const stage = (page: Page) => page.getByTestId('tutorial-stage');

async function setVeryFast(page: Page) {
  await page.getByRole('button', { name: 'Tutorial options' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tutorial options' });
  await dialog.getByRole('radio', { name: 'Very fast' }).check();
  await dialog.getByRole('button', { name: 'Close' }).click();
}

/** Play each stage's solution until the cube is solved; returns the stages seen, in order. */
async function playToSolved(page: Page): Promise<string[]> {
  const seen: string[] = [];
  const solved = page.getByRole('heading', { name: 'Solved!' });
  const play = page.locator('[data-testid="play-step"]:enabled');
  for (let i = 0; i < 20; i++) {
    await expect(play.or(solved)).toBeVisible({ timeout: 30_000 });
    if (await solved.isVisible()) break;
    const current = (await stage(page).textContent()) ?? '';
    if (seen.at(-1) !== current) seen.push(current);
    await play.click();
    // Playback ends when the button stops offering "Pause".
    await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0, { timeout: 60_000 });
  }
  await expect(solved).toBeVisible();
  return seen;
}

test('CFOP tutorial: random scramble to solved, stage by stage', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('tutorial/cfop');
  await expect(page.getByRole('heading', { name: 'CFOP tutorial' })).toBeVisible();
  await setVeryFast(page);
  await page.getByRole('button', { name: 'Random scramble' }).click();
  await expect(stage(page)).toHaveText('Cross', { timeout: 30_000 });
  await expect(page.getByTestId('step-title')).toHaveText('Solve the white cross');

  // Hint and reveal on the first stage.
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.getByRole('status')).toContainText('Cross pieces');
  await page.getByRole('button', { name: 'Show solution' }).click();
  await expect(page.getByTestId('step-moves').locator('li').first()).toHaveAttribute('aria-current', 'step');

  // Step forward one move, then back.
  await page.getByRole('button', { name: 'Next move' }).click();
  await expect(page.getByTestId('step-moves').locator('li').nth(1)).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(page.getByTestId('step-moves').locator('li').first()).toHaveAttribute('aria-current', 'step');

  const seen = await playToSolved(page);
  expect(seen[0]).toBe('Cross');
  expect(seen).toContain('OLL');
  expect(seen).toContain('PLL');
  expect(seen.filter((s) => s.startsWith('F2L')).length).toBeGreaterThanOrEqual(3);
  await expect(stage(page)).toHaveText('Solved');

  // Full solution panel: one row per step and a total.
  await page.getByText('Full solution').click();
  await expect(page.getByTestId('solution-table').getByRole('rowheader', { name: 'Cross' })).toBeVisible();
  await expect(page.getByTestId('solution-table').getByRole('rowheader', { name: 'Total' })).toBeVisible();

  // Breaking the cross sends the stepper back; undo brings it forward again.
  await page.getByRole('group', { name: 'Move pad' }).getByRole('button', { name: 'D', exact: true }).click();
  await expect(stage(page)).toHaveText('Cross');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(stage(page)).toHaveText('Solved');
});

test('Ortega tutorial: random scramble to solved', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('tutorial/ortega');
  await expect(page.getByRole('heading', { name: 'Ortega tutorial (2x2)' })).toBeVisible();
  await setVeryFast(page);
  await page.getByRole('button', { name: 'Random scramble' }).click();
  await expect(stage(page)).toHaveText('Face', { timeout: 30_000 });
  const seen = await playToSolved(page);
  expect(seen[0]).toBe('Face');
  await expect(stage(page)).toHaveText('Solved');
});

test('typed scrambles are checked move by move', async ({ page }) => {
  await page.goto('tutorial/cfop');
  const input = page.getByRole('textbox', { name: /type the scramble/ });
  await input.fill("R K U2 F'");
  await expect(page.getByText('Not a valid move: K')).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');

  await input.fill("R U R' U' F2");
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(stage(page)).toHaveText('Cross', { timeout: 30_000 });
  await expect(page.getByTestId('tutorial-scramble')).toHaveText("Scramble: R U R' U' F2");
});

test('OLL case popup shows the diagram and alg', async ({ page }) => {
  await page.goto('tutorial/cfop');
  // F2L done, last layer scrambled: an inverse Sune with white on the bottom.
  await page.getByRole('textbox', { name: /type the scramble/ }).fill("z2 R U2 R' U' R U' R'");
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(stage(page)).toHaveText('OLL', { timeout: 30_000 });
  await expect(page.getByTestId('case-name')).toHaveText('Sune');
  await page.getByRole('button', { name: 'Show case' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sune' });
  await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog).toContainText("R U R' U R U2 R'");
});

test('white-or-yellow mode solves the shorter yellow cross', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('tutorial/cfop');
  await page.getByRole('button', { name: 'Tutorial options' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tutorial options' });
  await dialog.getByRole('radio', { name: 'White or yellow' }).check();
  await dialog.getByRole('radio', { name: 'Very fast' }).check();
  await dialog.getByRole('button', { name: 'Close' }).click();

  // The triggers bring the yellow edges back, so the yellow cross is one D turn away; the white one isn't.
  await page.getByRole('textbox', { name: /type the scramble/ }).fill("R U R' F U2 F' L U L' D");
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(stage(page)).toHaveText('Cross', { timeout: 30_000 });
  await expect(page.getByTestId('step-title')).toHaveText('Solve the yellow cross');
  await expect(page.getByText(/Solve the four yellow edges/)).toBeVisible();

  // An easy scramble: F2L may finish the last layer too, so only the end is checked.
  await playToSolved(page);
  await expect(stage(page)).toHaveText('Solved');
});

test('beginner tutorial: random scramble to solved, layer by layer', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('tutorial/beginner');
  await expect(page.getByRole('heading', { name: 'Beginner tutorial' })).toBeVisible();
  await setVeryFast(page);
  await page.getByRole('button', { name: 'Random scramble' }).click();
  await expect(stage(page)).toHaveText('Cross', { timeout: 30_000 });
  await expect(page.getByTestId('step-title')).toHaveText('Solve the white cross');

  const seen = await playToSolved(page);
  expect(seen.slice(0, 3)).toEqual(['Cross', 'First layer', 'Middle layer']);
  expect(seen).toContain('Twist corners');
  await expect(stage(page)).toHaveText('Solved');
  await expect(page.getByRole('link', { name: 'Next: the CFOP tutorial' })).toBeVisible();
});

test('the Learn page sends new cubers to the beginner tutorial', async ({ page }) => {
  await page.goto('learn');
  await page.getByRole('button', { name: 'Skip quiz' }).click();
  await page.getByRole('link', { name: 'beginner tutorial', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Beginner tutorial' })).toBeVisible();
});
