/**
 * Standalone diagnostic script for Playwright Chromium PDF generation.
 * Runs in the same environment as production (Docker container).
 * Tests: browser launch, context creation, page rendering, PDF generation.
 */
import { chromium, type Browser } from 'playwright';

async function main() {
  console.log('=== PDF Diagnostic Script ===');
  console.log('Playwright version:', (await import('playwright/package.json')).version);

  let browser: Browser | null = null;
  let context;
  let page;

  try {
    // 1. Launch Chromium
    console.log('[DIAGNOSTIC] Launching Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });
    console.log(`[DIAGNOSTIC] Browser launched: connected=${browser.isConnected()}`);
    console.log(`[DIAGNOSTIC] Browser PID: N/A`);

    // 2. Create context
    console.log('[DIAGNOSTIC] Creating browser context...');
    context = await browser.newContext();
    console.log('[DIAGNOSTIC] Browser context created successfully');

    // 3. Create page
    console.log('[DIAGNOSTIC] Creating page...');
    page = await context.newPage();
    console.log('[DIAGNOSTIC] Page created successfully');

    // 4. Load a simple HTML page
    console.log('[DIAGNOSTIC] Loading test HTML...');
    await page.goto('data:text/html,<html><body><h1>Test PDF</h1><p>Testing PDF generation</p></body></html>', { waitUntil: 'domcontentloaded' });
    console.log('[DIAGNOSTIC] Page loaded successfully');

    // 5. Generate PDF
    console.log('[DIAGNOSTIC] Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      printBackground: true,
    });

    console.log(`[DIAGNOSTIC] PDF generated: ${pdfBuffer.length} bytes`);
    console.log(`[DIAGNOSTIC] PDF header: ${pdfBuffer.slice(0, 5).toString('ascii')}`);

    if (pdfBuffer.length === 0) {
      throw new Error('PDF buffer is empty');
    }
    if (pdfBuffer.slice(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error(`PDF does not start with %PDF- header`);
    }

    console.log('[DIAGNOSTIC] PDF validation PASSED');

    // 6. Clean up
    await page.close();
    console.log('[DIAGNOSTIC] Page closed');
    await context.close();
    console.log('[DIAGNOSTIC] Context closed');
    await browser.close();
    console.log('[DIAGNOSTIC] Browser closed');
    console.log('[DIAGNOSTIC] ALL TESTS PASSED');
  } catch (err) {
    console.error('[DIAGNOSTIC] ERROR:', err);
    // Cleanup on error
    try { if (page) await page.close().catch(() => {}); } catch {}
    try { if (context) await context.close().catch(() => {}); } catch {}
    try { if (browser) await browser.close().catch(() => {}); } catch {}
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[DIAGNOSTIC] Unhandled error:', err);
  process.exit(1);
});
