import { test, expect } from '@playwright/test';

test('reload and reopen the tournament offline using the cached app shell', async ({ page, context, baseURL }) => {
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await page.goto('./');
  await page.getByRole('button', { name: 'Load sample tournament' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener(
        'controllerchange', () => resolve(), { once: true },
      ));
    }
  });
  expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(baseURL);
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByText('8 teams · 2 courts · 8 / 28 matches recorded', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  // Confirm the stylesheet loaded too, rather than merely unstyled HTML.
  await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(25, 60, 53)');
  const match = page.getByRole('form', { name: 'Court 1 result' });
  await match.getByRole('spinbutton').first().fill('11');
  await match.getByRole('spinbutton').last().fill('6');
  await match.getByRole('button', { name: 'Save result' }).click();
  await expect(match.getByText('Saved: 11 – 6', { exact: true })).toBeVisible();
  await page.close();
  const reopened = await context.newPage();
  const reopenedResponse = await reopened.goto('./');
  expect(reopenedResponse?.fromServiceWorker()).toBe(true);
  await expect(reopened.getByText('8 teams · 2 courts · 9 / 28 matches recorded', { exact: true })).toBeVisible();
});
