import { expect, test } from '@playwright/test';

test('home page renders with the hero and feature links', async ({ page }) => {
  await page.goto('');
  await expect(page.getByRole('heading', { name: 'Your speedcubing buddy' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Algorithm trainer/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /3D cube/ })).toBeVisible();
});

test('deep links load the right page', async ({ page }) => {
  await page.goto('timer');
  await expect(page.getByRole('heading', { name: 'Timer' })).toBeVisible();
  await page.goto('tutorial/cfop');
  await expect(page.getByRole('heading', { name: 'CFOP tutorial' })).toBeVisible();
});

test('unknown paths show the not-found page', async ({ page }) => {
  await page.goto('definitely/not/a/page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('theme toggle cycles system → light → dark and persists', async ({ page }) => {
  await page.goto('');
  const toggle = page.getByRole('button', { name: /theme/ });
  await toggle.click(); // → light
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click(); // → dark
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('navigation works on the current layout', async ({ page, isMobile }) => {
  await page.goto('');
  if (isMobile) {
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'CFOP tutorial' }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'CFOP tutorial' }).click();
  }
  await expect(page).toHaveURL(/\/cubebuddy\/tutorial\/cfop$/);
  await expect(page.getByRole('heading', { name: 'CFOP tutorial' })).toBeVisible();
});

test('algorithm sources are credited (About & credits)', async ({ page }) => {
  await page.goto('trainer');
  await page.getByRole('link', { name: 'Where the algorithms come from' }).click();
  await expect(page).toHaveURL(/\/cubebuddy\/about#algorithms$/);
  await expect(page.getByRole('heading', { name: 'Where the algorithms come from' })).toBeInViewport();
  await expect(page.getByRole('link', { name: 'J Perm’s algorithm sheets' })).toHaveAttribute(
    'href',
    'https://jperm.net/algs',
  );
  await expect(page.getByRole('link', { name: 'cubing.js' })).toBeVisible();
});
