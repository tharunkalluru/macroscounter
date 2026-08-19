import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = resolve(__dirname, '../public/icons')

// Same mark as icons/icon.svg, but full-bleed (no baked-in rounded-rect
// background) — maskable icons must fill the entire canvas edge-to-edge so
// the OS's own mask shape (circle, squircle, rounded-square, ...) can crop
// it safely; the meaningful content already sits well within the required
// 80% "safe zone" (a 150px-radius circle centered on a 512 canvas).
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0f172a"/>
  <circle cx="256" cy="256" r="150" fill="#16a34a"/>
  <path d="M180 256a76 76 0 0 1 152 0" stroke="#f0fdf4" stroke-width="20" fill="none" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="18" fill="#f0fdf4"/>
</svg>`

const STANDARD_SVG_PATH = resolve(ICONS_DIR, 'icon.svg')

const SPLASH_SCREENS = [
  // A representative set of current device classes (not Apple's full
  // historical matrix) — see SETUP.md for how to extend this.
  { name: 'apple-splash-1170x2532.png', width: 1170, height: 2532 }, // iPhone 13/14/15 (6.1")
  { name: 'apple-splash-1179x2556.png', width: 1179, height: 2556 }, // iPhone 15/16 Pro (6.1")
  { name: 'apple-splash-750x1334.png', width: 750, height: 1334 }, // iPhone SE (4.7")
  { name: 'apple-splash-1536x2048.png', width: 1536, height: 2048 }, // iPad 9.7-10.2"
]

async function main() {
  mkdirSync(ICONS_DIR, { recursive: true })

  await sharp(STANDARD_SVG_PATH).resize(192, 192).png().toFile(resolve(ICONS_DIR, 'icon-192.png'))
  await sharp(STANDARD_SVG_PATH).resize(512, 512).png().toFile(resolve(ICONS_DIR, 'icon-512.png'))
  await sharp(STANDARD_SVG_PATH).resize(180, 180).png().toFile(resolve(ICONS_DIR, 'apple-touch-icon.png'))

  const maskableBuffer = Buffer.from(MASKABLE_SVG)
  await sharp(maskableBuffer).resize(192, 192).png().toFile(resolve(ICONS_DIR, 'icon-maskable-192.png'))
  await sharp(maskableBuffer).resize(512, 512).png().toFile(resolve(ICONS_DIR, 'icon-maskable-512.png'))

  for (const { name, width, height } of SPLASH_SCREENS) {
    // Centered mark on the app's background color, sized to ~40% of the
    // shorter edge — a plain, brand-colored launch screen (no real
    // per-device typography/layout, just enough to avoid a flash of white).
    const markSize = Math.round(Math.min(width, height) * 0.28)
    const mark = await sharp(STANDARD_SVG_PATH).resize(markSize, markSize).png().toBuffer()
    await sharp({
      create: { width, height, channels: 4, background: '#0f172a' },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toFile(resolve(ICONS_DIR, name))
  }

  console.log(`Wrote ${4 + SPLASH_SCREENS.length} icon/splash assets to ${ICONS_DIR}`)
}

main()
