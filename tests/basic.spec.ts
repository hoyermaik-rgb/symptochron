import { test, expect } from '@playwright/test';

test('has title and welcome screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SymptoChron/i);
});
