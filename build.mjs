import { copyFile } from 'node:fs/promises'
import { build } from 'esbuild'

/**
 * Bundle the host half into one ESM file. dsh packages stay external because
 * the Host owns their instances.
 *
 * tsc only emits declarations: the runtime modules are combined here, so the
 * package does not ship duplicate copies of src/*.js.
 */
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: false,
  legalComments: 'none',
  external: ['@deepseek-ai/*'],
  banner: {
    js: '// dsh-tag - bundled by esbuild; dsh services stay external.',
  },
})

// The browser half is a hand-written lazy-CJS factory, not TypeScript output.
await copyFile('client/client.js', 'lib/client.js')
