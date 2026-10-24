import { expect, test, type Page } from '@playwright/test';

async function openTimer(page: Page) {
  await page.goto('timer');
  await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
  // Sessions load from IndexedDB; the timer ignores input until then.
  await expect(page.getByRole('combobox', { name: 'Session' })).toHaveValue(/.+/);
}

async function switchToTyping(page: Page) {
  await page.getByRole('button', { name: 'Timer options' }).click();
  await page.getByRole('radio', { name: 'Type in times' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
}

async function typeSolve(page: Page, time: string) {
  const input = page.getByRole('textbox', { name: 'Time' });
  await input.fill(time);
  await input.press('Enter');
}

const historyTimes = (page: Page) => page.getByTestId('history-time');

test('keyboard solve: hold space, release, press to stop', async ({ page }) => {
  await openTimer(page);
  await expect(page.getByTestId('scramble')).not.toHaveText('Generating…', { timeout: 20_000 });
  const scramble = await page.getByTestId('scramble').textContent();

  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  const overlay = page.getByTestId('timer-overlay');
  await expect(overlay.getByRole('timer')).toHaveAttribute('data-phase', 'ready');
  // The overlay must cover the whole screen (including the phone bottom bar).
  expect((await overlay.boundingBox())?.height).toBe(page.viewportSize()?.height);
  await page.keyboard.up('Space');
  await expect(overlay.getByRole('timer')).toHaveAttribute('data-phase', 'running');
  await page.waitForTimeout(300);
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');

  await expect(overlay).toBeHidden();
  await expect(historyTimes(page)).toHaveCount(1);
  await expect(page.getByTestId('solve-count')).toHaveText('1/1 solves');
  // The solve keeps its scramble and a new one is shown.
  await historyTimes(page).first().click();
  await expect(page.getByRole('dialog')).toContainText(scramble!);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('scramble')).not.toHaveText(scramble!);
});

test('releasing space too early does not start the timer', async ({ page }) => {
  await openTimer(page);
  await page.keyboard.down('Space');
  await page.waitForTimeout(50);
  await page.keyboard.up('Space');
  await expect(page.getByTestId('timer-overlay')).toBeHidden();
  await expect(page.getByTestId('timer-area').getByRole('timer')).toHaveAttribute('data-phase', 'idle');
});

test('inspection starts on a tap and Esc cancels it', async ({ page }) => {
  await openTimer(page);
  await page.getByRole('button', { name: 'Timer options' }).click();
  await page.getByRole('checkbox', { name: /15-second inspection/ }).check();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.keyboard.press('Space');
  const overlay = page.getByTestId('timer-overlay');
  await expect(overlay).toContainText('Inspection');
  await expect(overlay.getByRole('timer')).toHaveText(/^1[45]$/);
  await page.keyboard.press('Escape');
  await expect(overlay).toBeHidden();
  await expect(page.getByText('No solves in this session yet.')).toBeVisible();
});

test('typed solve, penalty edit and persistence', async ({ page }) => {
  await openTimer(page);
  await switchToTyping(page);
  await typeSolve(page, '1234');
  await expect(historyTimes(page)).toHaveText(['12.34']);

  await page
    .getByRole('group', { name: 'Penalty for the last solve' })
    .getByRole('button', { name: '+2' })
    .click();
  await expect(historyTimes(page)).toHaveText(['14.34+']);

  await historyTimes(page).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'DNF' }).click();
  await expect(dialog.getByTestId('solve-detail-time')).toHaveText('DNF');
  await dialog.getByRole('textbox', { name: 'Comment' }).fill('dropped the cube');
  await dialog.getByRole('button', { name: 'Close' }).click();

  await typeSolve(page, '1:02.5');
  await expect(historyTimes(page)).toHaveText(['1:02.50', 'DNF*']);

  await page.reload();
  await expect(historyTimes(page)).toHaveText(['1:02.50', 'DNF*']);
});

test('rejects an unreadable typed time', async ({ page }) => {
  await openTimer(page);
  await switchToTyping(page);
  await typeSolve(page, 'abc');
  await expect(page.getByText('Couldn’t read that time.')).toBeVisible();
  await expect(historyTimes(page)).toHaveCount(0);
});

test('sessions keep their own solves', async ({ page }) => {
  await openTimer(page);
  await switchToTyping(page);
  await typeSolve(page, '1500');
  await expect(historyTimes(page)).toHaveCount(1);

  await page.getByRole('button', { name: 'New session' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Ortega practice');
  await page.getByRole('radio', { name: '2x2' }).check();
  await page.getByRole('button', { name: 'Create session' }).click();

  const picker = page.getByRole('combobox', { name: 'Session' });
  await expect(picker.locator('option:checked')).toHaveText('Ortega practice (2x2)');
  await expect(page.getByText('No solves in this session yet.')).toBeVisible();

  await picker.selectOption({ label: '3x3 (3x3)' });
  await expect(historyTimes(page)).toHaveText(['15.00']);
});

test('touch: hold, release to start, tap anywhere to stop', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch flow runs on the phone project');
  await openTimer(page);
  const box = (await page.getByTestId('timer-area').boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd', at = point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [at] });

  await touch('touchStart');
  await page.waitForTimeout(400);
  await touch('touchEnd');
  await expect(page.getByTestId('timer-overlay').getByRole('timer')).toHaveAttribute('data-phase', 'running');
  await page.waitForTimeout(200);
  // Stop with a tap on the header logo's spot: once the overlay closes, that tap must not click the logo.
  await touch('touchStart', { x: 20, y: 40 });
  await touch('touchEnd');
  await expect(historyTimes(page)).toHaveCount(1);
  await expect(page).toHaveURL(/\/timer$/);
});
