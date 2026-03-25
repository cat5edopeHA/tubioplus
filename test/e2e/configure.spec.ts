import { test, expect } from '@playwright/test';

test('stepper wizard navigates through all steps', async ({ page }) => {
  await page.goto('/configure');

  // Step 1: Auth — skip
  await expect(page.locator('text=Authentication')).toBeVisible();
  await page.click('button:has-text("Skip")');

  // Step 2: Quality
  await expect(page.locator('text=Quality')).toBeVisible();
  await page.click('button:has-text("1080p")');
  await page.click('button:has-text("Next")');

  // Step 3: Features
  await expect(page.locator('text=Features')).toBeVisible();
  await page.click('button:has-text("Next")');

  // Step 4: Install
  await expect(page.locator('text=Install')).toBeVisible();
});

test('back navigation preserves state', async ({ page }) => {
  await page.goto('/configure');
  await page.click('button:has-text("Skip")');
  await page.click('button:has-text("720p")');
  await page.click('button:has-text("Next")');
  await page.click('button:has-text("Back")');
  // 720p should still be selected
  const btn720 = page.locator('button:has-text("720p")');
  await expect(btn720).toHaveAttribute('aria-pressed', 'true');
});

test('responsive: stepper works on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/configure');
  await expect(page.locator('text=Authentication')).toBeVisible();
});
