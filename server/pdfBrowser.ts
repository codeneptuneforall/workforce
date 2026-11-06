/**
 * Reusable Playwright browser manager for payslip PDF generation.
 *
 * Launches Chromium once and reuses the same browser instance across
 * payroll-pdf download requests. Each request gets its own isolated
 * incognito context for isolation.
 *
 * Lifecycle:
 *   - Launched lazily on first request.
 *   - Kept warm for subsequent requests (~2-4s per PDF).
 *   - Auto-restarted if the browser crashes or disconnects.
 *   - Closed on server shutdown via dispose().
 */
import { chromium, type Browser } from 'playwright';
import { config } from './config';

let browser: Browser | null = null;
let launchPromise: Promise<void> | null = null;

/**
 * Resolve the Chromium executable path. In production, the Playwright
 * Chromium binary is installed at a known location under node_modules.
 * Allow overriding via CHROMIUM_EXECUTABLE_PATH for hosting platforms
 * that install Chromium elsewhere (e.g. system chromium package).
 */
function getChromiumExecutablePath(): string | undefined {
  return process.env.CHROMIUM_EXECUTABLE_PATH;
}

async function ensureBrowser(): Promise<void> {
  if (browser) {
    // Verify the browser is still alive before reusing it.
    try {
      await browser.version();
      return;
    } catch {
      // Browser is dead, close and recreate.
      try { await browser.close(); } catch {}
      browser = null;
    }
  }
  if (launchPromise) {
    await launchPromise;
    return;
  }
  launchPromise = (async () => {
    try {
      const executablePath = getChromiumExecutablePath();
      const launchOptions: Record<string, unknown> = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-features=VizDisplayCompositor',
        ],
      };
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      browser = await chromium.launch(launchOptions);

      // Listen for unexpected browser crashes.
      browser.on('disconnected', () => {
        console.log('[pdfBrowser] Chromium browser disconnected');
        browser = null;
      });

      console.log('[pdfBrowser] Chromium launched successfully');
    } catch (err) {
      console.error('[pdfBrowser] Failed to launch Chromium:', err);
      throw err;
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

/**
 * Create a new browser context with automatic recovery.
 * If the browser has crashed, createContext will throw. We catch that,
 * invalidate the browser, launch a fresh one, and retry once.
 */
export async function createBrowserContext(): Promise<import('playwright').BrowserContext> {
  try {
    const browser = await getPdfBrowser();
    return await browser.newContext();
  } catch (err) {
    // Browser may have died between getPdfBrowser() and newContext().
    // Invalidate and retry once.
    console.error('[pdfBrowser] newContext failed, invalidating browser:', err);
    try { await browser?.close(); } catch {}
    browser = null;
    await ensureBrowser();
    const browser2 = await getPdfBrowser();
    return await browser2.newContext();
  }
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
