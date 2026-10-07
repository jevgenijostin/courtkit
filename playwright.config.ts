import { defineConfig } from '@playwright/test';
const baseURL = `http://127.0.0.1:4173${process.env.GITHUB_PAGES === 'true' ? '/courtkit/' : '/'}`;
export default defineConfig({
  testDir: './e2e',
  use: { baseURL, browserName: 'chromium' },
  webServer: {
    command: 'npm exec vite preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
  },
});
