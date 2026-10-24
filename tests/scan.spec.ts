import { expect, test, type Page } from '@playwright/test';
import { applyMoves, solvedFacelets } from '../src/engine/facelets';
import { COLOUR_NAMES } from '../src/engine/colourSets';
import { parseAlg } from '../src/engine/notation';

// Plan P6b: copy a real cube into the tutorial by hand (net editor) or with the camera.

// Chromium's fake camera (a moving test pattern) stands in for a real one.
test.use({
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
});

const stickersOf = (alg: string) => Array.from(applyMoves(solvedFacelets(), parseAlg(alg)));

/** Paint every sticker in order: the editor moves on to the next unset sticker after each colour. */
async function paint(page: Page, colours: number[]) {
  const palette = page.getByRole('group', { name: 'Colours' });
  for (let i = 0; i < 54; i++) {
    if (i % 9 === 4) continue;
    await palette.getByRole('button', { name: new RegExp(`^${COLOUR_NAMES[colours[i]!]} `) }).click();
  }
}

test('enter a cube by hand, fix a mistake, and solve it in the tutorial', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('tutorial/cfop');
  await page.getByRole('button', { name: 'Enter by hand' }).click();
  const dialog = page.getByRole('dialog', { name: 'Copy your cube' });
  await expect(dialog.getByRole('group', { name: 'Cube net' })).toBeVisible();

  // Trying to continue early points at the missing stickers.
  await dialog.getByRole('button', { name: 'Use this cube' }).click();
  await expect(dialog.getByTestId('scan-problem')).toHaveText('48 stickers still need a colour.');

  const colours = stickersOf("R U F' D2 L B'");
  await paint(page, colours);
  await expect(dialog.getByText('This cube is valid.')).toBeVisible();

  // Twist a corner by re-colouring its three stickers: the editor says it can't be solved.
  const set = async (sticker: number, colour: number) => {
    await dialog.locator(`[data-sticker="${sticker}"]`).click();
    await dialog
      .getByRole('group', { name: 'Colours' })
      .getByRole('button', { name: new RegExp(`^${COLOUR_NAMES[colour]} `) })
      .click();
  };
  const [u, r, f] = [colours[8]!, colours[9]!, colours[20]!];
  await set(8, f);
  await set(9, u);
  await set(20, r);
  await expect(dialog.getByTestId('scan-problem')).toContainText('twisted');
  await set(8, u);
  await set(9, r);
  await set(20, f);
  await expect(dialog.getByText('This cube is valid.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Use this cube' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('tutorial-stage')).toHaveText('Cross', { timeout: 30_000 });
  // The tutorial's cube is exactly the one entered.
  const setup = ((await page.getByTestId('tutorial-scramble').textContent()) ?? '').replace('Scramble: ', '');
  expect(stickersOf(setup)).toEqual(colours);
});

test.describe('camera', () => {
  test('scans six faces in order, then opens the editor to check them', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'fake camera is Chromium-only');
    await page.goto('tutorial/cfop');
    await page.getByRole('button', { name: 'Scan with camera' }).click();
    const dialog = page.getByRole('dialog', { name: 'Copy your cube' });
    for (const [colour, words] of [
      ['green', /green facing the camera/],
      ['red', /red faces the camera/],
      ['blue', /blue faces the camera/],
      ['orange', /orange faces the camera/],
      ['white', /white faces it/],
      ['yellow', /yellow faces the camera/],
    ] as const) {
      await expect(dialog.getByTestId('scan-instruction')).toHaveText(words);
      await dialog.getByRole('button', { name: `Capture ${colour} face` }).click();
    }
    await expect(dialog.getByText(/Check the colours against your cube/)).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Cube net' })).toBeVisible();
    // Every colour is used 9 times by the classifier, whatever the camera saw.
    await expect(dialog.getByRole('button', { name: 'white (9 of 9)' })).toBeVisible();
  });
});
