/**
 * Reusable Playwright browser manager for payslip PDF generation.
 *
 * Launches Chromium once and reuses the same browser instance across
 * payroll-pdf download requests. Each request gets its own isolated
 * incognito context so employee data never leaks between downloads.
 *
 * Lifecycle:
 *   - Launched lazily on first request.
 *   - Kept warm for subsequent requests (~2-4s per PDF instead of ~15s).
 *   - Closed on server shutdown via dispose().
 */
import { chromium, type Browser } from 'playwright';
let browser: Browser | null = null;
let launchPromise: Promise<void> | null = null;

async function ensureBrowser(): Promise<void> {
  if (browser) return;
  if (launchPromise) {
    await launchPromise;
    return;
  }
  launchPromise = (async () => {
    try {
      browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } finally {
      launchPromise = null;
    }
  })();
  await launchPromise;
}

export async function getPdfBrowser(): Promise<Browser> {
  await ensureBrowser();
  if (!browser) {
    throw new Error('Playwright browser failed to launch');
  }
  return browser;
}

export async function disposePdfBrowser(): Promise<void> {
  if (launchPromise) {
    await launchPromise;
  }
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignore close errors during shutdown
    }
    browser = null;
  }
  launchPromise = null;
}
