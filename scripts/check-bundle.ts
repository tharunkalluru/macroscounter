import { gzipSync } from 'node:zlib'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = resolve(__dirname, '../dist')
const INDEX_HTML = resolve(DIST_DIR, 'index.html')
const BUDGET_BYTES = 300 * 1024

function gzipSize(filePath: string): number {
  return gzipSync(readFileSync(filePath)).length
}

function main() {
  if (!existsSync(INDEX_HTML)) {
    console.error(`Not found: ${INDEX_HTML} — run "npm run build" first.`)
    process.exit(1)
  }

  const html = readFileSync(INDEX_HTML, 'utf-8')

  // Only assets index.html references directly on load count toward the
  // "initial" bundle — lazy route chunks (WeightPage/ScanPage/etc., pulled in
  // via dynamic import()) are fetched later and don't block first load.
  const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
  const styleHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
  // Phase F.0: Inter (Google Fonts) and Phosphor Icons (unpkg) are loaded
  // from external CDNs, cached offline via the service worker's
  // runtimeCaching rules (see vite.config.ts) rather than bundled locally —
  // this budget only measures this app's own JS/CSS, not third-party assets.
  const assetPaths = [...scriptSrcs, ...styleHrefs].filter((path) => !/^https?:\/\//.test(path))

  if (assetPaths.length === 0) {
    console.error('No <script src> or stylesheet <link> tags found in dist/index.html.')
    process.exit(1)
  }

  let totalGz = 0
  console.log('Initial bundle assets (referenced directly by index.html):')
  for (const assetPath of assetPaths) {
    const filePath = resolve(DIST_DIR, assetPath.replace(/^\//, ''))
    if (!existsSync(filePath)) {
      console.error(`  Referenced asset missing on disk: ${assetPath}`)
      process.exit(1)
    }
    const size = gzipSize(filePath)
    totalGz += size
    console.log(`  ${assetPath}: ${(size / 1024).toFixed(2)} KB gz`)
  }

  console.log(`\nTotal initial JS+CSS: ${(totalGz / 1024).toFixed(2)} KB gz (budget: ${BUDGET_BYTES / 1024} KB gz)`)

  if (totalGz > BUDGET_BYTES) {
    console.error(`\nFAIL: initial bundle exceeds the ${BUDGET_BYTES / 1024} KB gz budget.`)
    process.exit(1)
  }
  console.log('\nPASS: initial bundle is within budget.')
}

main()
