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
  if (browser) return;
  if (launchPromise) {
    await launchPromise;
    return;
  }
  launchPromise = (async () => {
    try {
      const executablePath = getChromiumExecutablePath();
      const launchOptions: Record<string, unknown> = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--single-process',
          '--no-zygote',
          '--disable-features=VizDisplayCompositor',
        ],
      };
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      browser = await chromium.launch(launchOptions);
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