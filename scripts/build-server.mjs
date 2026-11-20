/**
 * Bundles the API server (server/ + shared/) into dist/server/index.js so production
 * runs plain `node` instead of compiling TypeScript at runtime with tsx.
 *
 * - tsconfig `paths` (@shared/*, @server/*) are resolved by esbuild at build time.
 * - npm packages stay external and are loaded from node_modules at runtime.
 * - esbuild is installed as a dependency of tsx.
 */
import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info'
});
