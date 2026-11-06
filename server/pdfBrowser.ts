/**
 * Playwright browser lifecycle for payslip PDF generation.
 *
 * Strategy:
 *   1. Keep one warm Chromium for the common case (~2s per PDF).
 *   2. If that browser is dead or fails at any point, discard it and render
 *      that request with a dedicated Chromium that is closed afterwards.
 *      A dead shared browser can therefore never poison later requests.
 *   3. Serialise renders (default 1 at a time, PDF_MAX_CONCURRENCY to override)
 *      so a small Render instance does not run out of memory and get its
 *      Chromium process killed while rendering.
 *
 * Lifecycle: launched lazily on first request, closed on server shutdown.
 */
import { chromium, type Browser, type BrowserContext } from 'playwright';

/**
 * Flags for a headless server container. The first four are required to run
 * Chromium as root without shared memory in Docker; the rest cut background
 * work so the render stays small and deterministic.
 */
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-sync',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check'
];

export interface PdfBrowserOptions {
  executablePath?: string;
}

function launchOptions() {
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  return {
    headless: true,
    timeout: 30_000,
    args: LAUNCH_ARGS,
    ...(executablePath ? { executablePath } : {})
  };
}

let sharedBrowser: Browser | null = null;
let sharedLaunch: Promise<Browser> | null = null;

/** Number of PDF renders allowed to run at once. */
function maxConcurrency(): number {
  const configured = Number(process.env.PDF_MAX_CONCURRENCY);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 1;
}

let activeRenders = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(task: () => Promise<T>): Promise<T> {
  while (activeRenders >= maxConcurrency()) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeRenders++;
  try {
    return await task();
  } finally {
    activeRenders--;
    const next = waiting.shift();
    if (next) next();
  }
}

/** True when the error means the browser/connection died, not a page problem. */
export function isBrowserGone(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Target page, context or browser has been closed|browser has been closed|Target closed|Browser closed|Connection closed|Protocol error|browser has crashed|Page crashed/i.test(
    message
  );
}

function attachDisconnectLog(browser: Browser, label: string): void {
  // Instance-scoped: never clear a newer browser that has replaced this one.
  browser.on('disconnected', () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
      sharedLaunch = null;
    }
    console.warn(`[pdfBrowser] ${label} Chromium disconnected`);
  });
}

async function getSharedBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) {
    return sharedBrowser;
  }
  if (sharedBrowser) {
    // Present but no longer connected: drop it before relaunching.
    const dead = sharedBrowser;
    sharedBrowser = null;
    sharedLaunch = null;
    await dead.close().catch(() => {});
  }
  if (!sharedLaunch) {
    sharedLaunch = chromium
      .launch(launchOptions())
      .then((browser) => {
        sharedBrowser = browser;
        attachDisconnectLog(browser, 'shared');
        console.log('[pdfBrowser] Chromium launched');
        return browser;
      })
      .catch((error) => {
        sharedLaunch = null;
        sharedBrowser = null;
        console.error('[pdfBrowser] Chromium launch failed:', error instanceof Error ? error.message : error);
        throw error;
      });
  }
  return sharedLaunch;
}

async function discardSharedBrowser(): Promise<void> {
  const dead = sharedBrowser;
  sharedBrowser = null;
  sharedLaunch = null;
  if (dead) {
    await dead.close().catch(() => {});
  }
}

/**
 * Run `task` against an isolated browser context.
 *
 * The warm browser is tried first. If it is gone (or dies while the task runs),
 * the task is retried once in a dedicated browser that is closed afterwards.
 * The context is always closed, and a failed task still releases its slot.
 */
export async function withPdfBrowser<T>(task: (context: BrowserContext) => Promise<T>): Promise<T> {
  return withRenderSlot(async () => {
    try {
      const browser = await getSharedBrowser();
      const context = await browser.newContext();
      try {
        return await task(context);
      } finally {
        await context.close().catch(() => {});
      }
    } catch (error) {
      if (!isBrowserGone(error)) throw error;
      console.warn('[pdfBrowser] warm browser failed, retrying with a dedicated browser');
      await discardSharedBrowser();
    }

    // Fallback: a fresh, short-lived Chromium for this request only.
    const browser = await chromium.launch(launchOptions());
    attachDisconnectLog(browser, 'dedicated');
    try {
      const context = await browser.newContext();
      try {
        return await task(context);
      } finally {
        await context.close().catch(() => {});
      }
    } finally {
      await browser.close().catch(() => {});
    }
  });
}

/** Close the warm browser on server shutdown. */
export async function disposePdfBrowser(): Promise<void> {
  try {
    if (sharedLaunch) await sharedLaunch.catch(() => undefined);
  } finally {
    const browser = sharedBrowser;
    sharedBrowser = null;
    sharedLaunch = null;
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}
