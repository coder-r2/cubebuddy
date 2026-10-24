import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, name: string) => page.getByTestId('case-card').filter({ hasText: name });

test('choose an alternative alg, mark learned, and it persists', async ({ page }) => {
  await page.goto('trainer');
  await page.getByRole('link', { name: /Full PLL/ }).click();
  await expect(page.getByRole('heading', { name: 'Full PLL' })).toBeVisible();

  await page.getByRole('button', { name: 'Open Ua-perm' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ua-perm' });
  await dialog.getByRole('radio', { name: /M2 U M U2 M' U M2/ }).check();
  await dialog.getByRole('group', { name: 'Progress' }).getByRole('button', { name: 'Learned' }).click();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await expect(card(page, 'Ua-perm').getByTestId('case-alg')).toHaveText("M2 U M U2 M' U M2");
  await expect(page.getByText('1 learned · 0 learning · 20 not started')).toBeVisible();
  await page.reload();
  await expect(card(page, 'Ua-perm').getByTestId('case-alg')).toHaveText("M2 U M U2 M' U M2");
  await expect(page.getByText('1 learned · 0 learning · 20 not started')).toBeVisible();
});

test('custom algs are verified before use', async ({ page }) => {
  await page.goto('trainer/oll');
  await page.getByRole('button', { name: 'Open OLL 27 – Sune' }).click();
  const dialog = page.getByRole('dialog', { name: 'OLL 27 – Sune' });
  const input = dialog.getByRole('textbox', { name: 'Custom alg' });
  await input.fill("R U2 R' U' R U' R'");
  await dialog.getByRole('button', { name: 'Check and use' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('This alg doesn’t solve this case.');

  await input.fill("U R U R' U R U2 R'");
  await dialog.getByRole('button', { name: 'Check and use' }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(card(page, 'OLL 27').getByTestId('case-alg')).toHaveText("U R U R' U R U2 R'");
});

test('timed drill: five cases with reveal', async ({ page }) => {
  await page.goto('trainer/pll-2look');
  await page.getByRole('tab', { name: 'Timed drill' }).click();
  const scramble = page.getByTestId('drill-scramble');
  for (let i = 1; i <= 5; i++) {
    await expect(scramble).not.toHaveText(/Generating/, { timeout: 30_000 });
    await page.keyboard.down('Space');
    await page.waitForTimeout(400);
    await page.keyboard.up('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('drill-count')).toHaveText(`${i} solved this session`);
  }
  await expect(page.getByTestId('drill-reveal').getByRole('button', { name: 'Mark learned' })).toBeVisible();
});

test('recognition drill records an answer', async ({ page }) => {
  await page.goto('trainer/oll-2look');
  await page.getByRole('tab', { name: 'Recognition drill' }).click();
  await expect(page.getByTestId('recognition-score')).toHaveText('0 / 0 correct');
  await page
    .getByRole('button', { name: /^(Line|L shape|Dot|Sune|Antisune|H|Pi|Headlights|Chameleon|Bowtie)$/ })
    .first()
    .click();
  await expect(page.getByTestId('recognition-score')).toHaveText(/^[01] \/ 1 correct$/);
  await page.getByRole('button', { name: 'Next' }).click();
});

test('full OLL print sheet fits on A4 and Letter', async ({ page, browserName, isMobile }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'PDF output is a desktop Chromium feature');
  await page.goto('trainer/oll/print');
  await expect(page.getByTestId('print-grid').locator('li')).toHaveCount(57);
  for (const format of ['A4', 'Letter'] as const) {
    const pdf = await page.pdf({ format });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages, `${format} pages`).toBeLessThanOrEqual(3);
  }
});

test('alg player: queued steps, move list and replay', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('trainer/pll');
  await page.getByRole('button', { name: 'Open T-perm' }).click();
  const dialog = page.getByRole('dialog', { name: 'T-perm' });
  const moves = dialog.getByRole('list', { name: 'Moves' }).getByRole('button');
  await expect(moves.first()).toHaveAttribute('aria-current', 'step');
  // Three quick taps all count.
  for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: 'Next move' }).click();
  await expect(moves.nth(3)).toHaveAttribute('aria-current', 'step', { timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Previous move' }).click();
  await expect(moves.nth(2)).toHaveAttribute('aria-current', 'step', { timeout: 10_000 });
  // Tap a move to jump to the cube after it.
  await moves.nth(9).click();
  await expect(moves.nth(10)).toHaveAttribute('aria-current', 'step');
  await moves.last().click();
  await expect(dialog.getByRole('button', { name: 'Replay' })).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Back to the start' }).click();
  await expect(moves.first()).toHaveAttribute('aria-current', 'step', { timeout: 10_000 });
  await dialog.getByRole('button', { name: 'Play' }).click();
  // Software WebGL in CI is slow; the whole alg plays to the end.
  await expect(dialog.getByRole('button', { name: 'Replay' })).toBeVisible({ timeout: 30_000 });
});
