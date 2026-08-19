import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// The dev plan's component tree lives under src/app (there's no separate
// src/components dir in this project) -- scanning src/app/**/*.tsx covers
// every page + component, matching the ux-polish-spec's intent even though
// the literal path it names doesn't exist in this codebase's structure.
const SCAN_DIR = resolve(__dirname, '../src/app')
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      files.push(...walk(full))
    } else if (extname(full) === '.tsx' && !full.endsWith('.test.tsx')) {
      files.push(full)
    }
  }
  return files
}

function main() {
  const files = walk(SCAN_DIR)
  const violations: { file: string; line: number; match: string }[] = []

  for (const file of files) {
    const lines = readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      const matches = line.match(HEX_PATTERN)
      if (matches) {
        for (const match of matches) {
          violations.push({ file: file.replace(resolve(__dirname, '..') + '/', ''), line: i + 1, match })
        }
      }
    })
  }

  if (violations.length > 0) {
    console.error(`FAIL: found ${violations.length} raw hex color(s) in src/app/**/*.tsx:\n`)
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.match}`)
    }
    console.error(
      '\nUse a Tailwind token class (see tailwind.config.ts / src/theme/tokens.ts) instead of a raw ' +
        'hex literal. If the value is needed as a JS value (SVG/Recharts stroke, etc.), import it ' +
        'from src/theme/tokens.ts rather than hardcoding it.'
    )
    process.exit(1)
  }

  console.log(`PASS: no raw hex colors found in ${files.length} files under src/app/**.`)
}

main()
