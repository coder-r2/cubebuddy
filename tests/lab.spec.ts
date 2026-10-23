import { expect, test } from '@playwright/test';

// P0 spikes (plan.md P0 task 9): cubing.js workers and solvers must work from the production
// build under the /cubebuddy/ base path.
test.describe('lab spikes', () => {
  test.setTimeout(60_000);

  test('random-state scrambles are generated in workers', async ({ page }) => {
    await page.goto('lab');
    const spike = page.locator('[data-spike="scramble-worker"]');
    await expect(spike.locator('[data-status]')).toHaveAttribute('data-status', 'pass', { timeout: 45_000 });
    await expect(page.getByTestId('scramble-333')).toContainText(/[RULDFB]/);
  });

  test('case setup scrambles come from cubing/search and reach the case', async ({ page }) => {
    await page.goto('lab');
    const spike = page.locator('[data-spike="setup-scramble"]');
    await expect(spike.locator('[data-status]')).toHaveAttribute('data-status', 'pass', { timeout: 45_000 });
  });

  test('clicking a sticker reports a move', async ({ page }) => {
    await page.goto('lab');
    const spike = page.locator('[data-spike="move-press"]');
    // twisty-player renders into a closed shadow root, so target the element itself.
    const cube = spike.locator('twisty-player');
    await expect(cube).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500); // let the 3D scene finish loading before clicking
    const box = await cube.boundingBox();
    if (!box) throw new Error('cube has no bounding box');
    // Slightly below the centre lands on the front face in the default camera view.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect(page.getByTestId('move-log')).not.toHaveText('—', { timeout: 10_000 });
  });
});
