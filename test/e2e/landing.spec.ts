import { test, expect } from '@playwright/test';

test('landing page loads with logo and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Tubio');
  await expect(page.locator('button:has-text("Configure")')).toBeVisible();
  await expect(page.locator('a:has-text("Install")')).toBeVisible();
});

test('Configure button navigates to stepper', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Configure")');
  await expect(page).toHaveURL(/\/configure/);
});
