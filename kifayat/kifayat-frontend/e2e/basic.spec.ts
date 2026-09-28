import { test, expect } from '@playwright/test'

test.describe('Basic E2E Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Kifayat/)
  })

  test('navigation works', async ({ page }) => {
    await page.goto('/')
    
    // Test navigation to products page
    await page.click('text=Products')
    await expect(page).toHaveURL(/\/products/)
  })

  test('search functionality', async ({ page }) => {
    await page.goto('/')
    
    // Click on search
    await page.click('input[placeholder*="Search"]')
    await page.fill('input[placeholder*="Search"]', 'phone')
    
    // Submit search
    await page.press('input[placeholder*="Search"]', 'Enter')
    
    // Verify search results
    await expect(page).toHaveURL(/\/search/)
  })
})