import { execSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** The commit being built: GitHub Actions says so; locally, ask git; otherwise 'dev'. */
function buildSha(): string {
  const ci = process.env.GITHUB_SHA;
  if (ci) return ci.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // The build stamp shown in the pause menu (src/core/build.ts).
  define: {
    __DW_BUILD__: JSON.stringify({ sha: buildSha(), time: new Date().toISOString() }),
  },
  // Relative base so the build works under a subpath (GitHub Pages) with no config change.
  base: './',
  // Uncompressed development rider GLBs are ordinary Vite assets (including test fixtures).
  assetsInclude: ['**/*.glb'],
  // Per-checkout cache so several worktrees can share one node_modules.
  cacheDir: '.vite',
  server: {
    // Worktrees share one node_modules through a symlink; let the dev server read through it.
    fs: { allow: ['.', realpathSync('node_modules')] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      input: { game: 'index.html', editor: 'editor.html', editorPlaytest: 'editor-playtest.html' },
      output: {
        // three.js in its own chunk: it changes far less often than the game, so returning
        // players keep it cached across releases.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Mesh and course suites build whole islands; on a busy machine the 5 s default is too tight.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
