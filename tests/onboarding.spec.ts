import { expect, test } from '@playwright/test';

test('first visit: quiz sets a level and preset, then the notation course works', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Get started' })).toBeVisible();
  await page
    .getByRole('region', { name: 'Get started' })
    .getByRole('link', { name: 'Take the quiz' })
    .click();

  await expect(page.getByText('Question 1 of 3')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, with a beginner method' }).click();
  await page.getByRole('button', { name: 'Under 30 seconds' }).click();
  await expect(page.getByRole('heading', { name: 'Pick your animation speed' })).toBeVisible();
  await page.getByRole('slider', { name: 'Animation speed' }).fill('0');
  await page.getByRole('button', { name: 'Finish' }).click();
  // A fast beginner-method solver is capped one level above the method: "Learning CFOP".
  await expect(page.getByTestId('quiz-level')).toHaveText('Learning CFOP');

  await page.getByRole('button', { name: 'Show me the notation course' }).click();
  await page.getByRole('button', { name: "Show R'", exact: true }).click();
  await expect(page.getByTestId('notation-move')).toHaveText('R′');

  // Mini-quiz: "R U" with the move pad.
  await expect(page.getByTestId('quiz-task')).toHaveText('R U');
  const pad = page.getByRole('group', { name: 'Move pad' });
  await pad.getByRole('button', { name: 'R', exact: true }).click();
  await pad.getByRole('button', { name: 'U', exact: true }).click();
  await expect(page.getByText('Correct!')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByTestId('quiz-task')).toHaveText('R′ U2');

  // The preset reached Settings, including the speed picked in the quiz; nothing asks again.
  await page.goto('settings');
  await expect(page.getByText('Learning CFOP')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Animation speed' })).toHaveAttribute(
    'aria-valuetext',
    'Slow',
  );
  await expect(page.getByRole('radio', { name: '2-look (beginner)' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /15-second inspection/ })).toBeChecked();
  await page.goto('./');
  await expect(page.getByRole('region', { name: 'Get started' })).toHaveCount(0);
});

test('the quiz can be skipped', async ({ page }) => {
  await page.goto('learn');
  await page.getByRole('button', { name: 'Skip quiz' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to speedcubing' })).toBeVisible();
  await expect(page.getByText('Not set yet')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notation' })).toBeVisible();
});

test('keyboard map: rebind a key, unbind one, reset', async ({ page }) => {
  await page.goto('settings');
  await page.getByText('Keyboard map').click();
  await page.getByRole('button', { name: "Add a key for x'" }).click();
  await expect(page.getByText('Press a key for x′')).toBeVisible();
  await page.keyboard.press('KeyI');
  await expect(page.getByText('I now does x′ (it did R before).')).toBeVisible();
  await expect(page.getByRole('button', { name: "Remove key I from x'" })).toBeVisible();
  await page.getByRole('button', { name: 'Remove key J from U' }).click();
  await expect(page.getByRole('button', { name: 'Remove key J from U' })).toHaveCount(0);

  // The binding is used by the cube pages.
  await page.goto('play');
  // Key presses are ignored until the 3D cube has loaded.
  await expect(async () => {
    await page.keyboard.press('KeyI');
    await expect(page.getByTestId('history-moves')).toContainText("x'", { timeout: 1000 });
  }).toPass({ timeout: 20_000 });

  await page.goto('settings');
  await page.getByText('Keyboard map').click();
  await page.getByRole('button', { name: 'Reset to default' }).click();
  await expect(page.getByRole('button', { name: 'Remove key I from R' })).toBeVisible();
});

test('JSON backup: export, then import on a fresh device', async ({ page, browser }) => {
  await page.goto('timer');
  await expect(page.getByRole('combobox', { name: 'Session' })).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'Timer options' }).click();
  await page.getByRole('radio', { name: 'Type in times' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
  const entry = page.getByRole('textbox', { name: 'Time' });
  await entry.fill('1234');
  await entry.press('Enter');
  await expect(page.getByTestId('history-time')).toHaveText(['12.34']);

  await page.goto('settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup (JSON)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^cubebuddy-backup-\d{8}\.json$/);
  const path = await download.path();

  const fresh = await browser.newContext({ serviceWorkers: 'block' });
  const other = await fresh.newPage();
  await other.goto('settings');
  await other.locator('input[type=file][accept*=json]').setInputFiles(path);
  await expect(other.getByText(/Imported: \d+ new records/)).toBeVisible();
  await other.goto('timer');
  await expect(other.getByTestId('history-time')).toHaveText(['12.34']);
  await fresh.close();
});

test('account page offers Google and email sign-in, and works without an account', async ({ page }) => {
  await page.goto('account');
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
  const configured = page.getByRole('button', { name: 'Continue with Google' });
  const unconfigured = page.getByText('Accounts aren’t available in this build');
  await expect(configured.or(unconfigured)).toBeVisible({ timeout: 15_000 });
  if (await configured.isVisible()) {
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Export backup (JSON)' })).toBeVisible();
});
