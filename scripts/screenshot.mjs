import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Start `npm exec vite preview` first; optionally pass the Pages preview URL.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(process.argv[2] || 'http://localhost:4173/');
  await page.getByRole('button', { name: 'Load sample tournament' }).click();
  await page.getByRole('heading', { name: 'Round 5 of 14', exact: true }).waitFor();
  await page.getByRole('table').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../docs/screenshot.png', import.meta.url)), fullPage: true });
} finally {
  await browser.close();
}
