import { test, expect } from '@playwright/test';
import { readFile, writeFile, unlink } from 'node:fs/promises';

test('updates activate with open tabs and offer a safe, dismissible offline reload', async ({ page, context }) => {
  const original = await readFile('dist/sw.js', 'utf8');
  const updatePath = 'dist/sw-update-test.js';
  await writeFile(updatePath, original.replace(/const CACHE = PREFIX \+ '[^']+';/, "const CACHE = PREFIX + 'update-test';"));
  try {
    await page.goto('./');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      }
    });
    await expect(page.getByRole('complementary', { name: 'App update' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Load sample tournament' }).click();
    await page.locator('#home-0').fill('17');
    const second = await context.newPage();
    await second.goto('./');
    await second.locator('#home-0').fill('19');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register(new URL('sw-update-test.js', location.href).href, {
        scope: new URL('./', location.href).pathname,
      });
    });
    const prompt = page.getByRole('complementary', { name: 'App update' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Reload', exact: true })).toBeEnabled();
    await expect(page.locator('#home-0')).toHaveValue('17');
    await expect(second.locator('#home-0')).toHaveValue('19');
    const secondPrompt = second.getByRole('complementary', { name: 'App update' });
    await expect(secondPrompt).toBeVisible();
    await secondPrompt.getByRole('button', { name: 'Dismiss update notification' }).click();
    await expect(secondPrompt).toHaveCount(0);
    await expect(second.locator('#home-0')).toHaveValue('19');
    expect(await page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith('courtkit-shell-'))))
      .toEqual([expect.stringMatching(/update-test$/)]);
    await page.getByRole('form', { name: 'Court 1 result' }).getByRole('spinbutton').last().fill('6');
    await page.getByRole('button', { name: 'Save result' }).first().click();
    await expect(prompt).toBeVisible();
    await context.setOffline(true);
    await Promise.all([
      page.waitForEvent('load'),
      prompt.getByRole('button', { name: 'Reload', exact: true }).click(),
    ]);
    await expect(page.getByRole('complementary', { name: 'App update' })).toHaveCount(0);
    await expect(page.getByText('8 teams · 2 courts · 9 / 28 matches recorded', { exact: true })).toBeVisible();
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(25, 60, 53)');
  } finally {
    await unlink(updatePath);
  }
});
