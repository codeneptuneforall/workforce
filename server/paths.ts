import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repository root (the folder holding package.json).
 *
 * Resolved by walking up from this file rather than with a fixed `../..`, so it is the
 * same whether the server runs from source (`server/*.ts` via tsx) or from the bundle
 * (`dist/server/index.js`), where every module shares one file location.
 */
function findProjectRoot(start: string): string {
  let current = start;
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

export const projectRoot = findProjectRoot(path.dirname(fileURLToPath(import.meta.url)));
