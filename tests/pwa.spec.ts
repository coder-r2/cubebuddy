import { expect, test } from '@playwright/test';

// The only spec with the service worker enabled (the others block it to stay fast).
test.use({ serviceWorkers: 'allow' });

test('installable manifest, and every page works offline after the first visit', async ({
  page,
  context,
}) => {
  await page.goto('./');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]')?.getAttribute('href');
    return href ? ((await (await fetch(href)).json()) as Record<string, unknown>) : null;
  });
  expect(manifest).toMatchObject({
    name: 'CubeBuddy',
    start_url: '/cubebuddy/',
    scope: '/cubebuddy/',
    display: 'standalone',
  });
  expect((manifest!.icons as { sizes: string; purpose?: string }[]).map((i) => i.purpose ?? i.sizes)).toEqual(
    ['192x192', '512x512', 'maskable'],
  );

  // The app registers its service worker itself; wait until it has precached everything.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.scope.endsWith('/cubebuddy/'))
      throw new Error(`Unexpected scope ${registration.scope}`);
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 20_000 })
    .toBe(true);

  await context.setOffline(true);
  for (const [path, heading] of [
    ['timer', 'Timer'],
    ['trainer/pll', 'Full PLL'],
    ['learn', null],
    ['settings', 'Settings'],
  ] as const) {
    await page.goto(path);
    if (heading)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
  }

  // The 3D cube and the solver engine come from the cache too.
  await page.goto('tutorial/ortega');
  await page.getByRole('button', { name: 'Random scramble' }).click();
  await expect(page.getByTestId('tutorial-stage')).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
});
