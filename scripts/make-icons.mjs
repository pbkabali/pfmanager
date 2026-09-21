#!/usr/bin/env node
/*
 * Regenerate the favicon and the PNG app icons from one piece of artwork.
 *
 *   node scripts/make-icons.mjs
 *
 * The ART below is the single source of truth: a money bag with a dollar
 * sign, money flowing in from the top left and out at the bottom right, on
 * the app's dark ground. The script writes public/favicon.svg from it and
 * rasterises the PNGs with macOS Quick Look (`qlmanage`), which is the one
 * SVG renderer this machine has without adding an image dependency. On
 * another OS, install librsvg and swap the render() call for rsvg-convert.
 *
 * Every PNG is OPAQUE and full-bleed:
 *  - iOS ignores alpha and rounds the corners itself, so the touch icon must
 *    be a plain filled square or the platform paints white behind it.
 *  - Android adaptive icons crop the maskable icon to a circle or squircle,
 *    so its artwork is pulled into the central 80% safe zone.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BOX = 64
const BACKGROUND = '#0b0b0c'

/** Artwork in a 64-unit box, background excluded. */
const ART = `
  <!-- Money in: sweeps down from the top left towards the bag. -->
  <path d="M8 33 C 8 18, 18 11, 27 11" stroke="#22c55e" stroke-width="3.6" fill="none" stroke-linecap="round"/>
  <path d="M22.5 6.5 L 28.5 11 L 22.5 15.5" stroke="#22c55e" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Money out: sweeps up from the bottom right away from the bag. -->
  <path d="M56 33 C 56 48, 46 55, 37 55" stroke="#9598a1" stroke-width="3.6" fill="none" stroke-linecap="round"/>
  <path d="M41.5 50.5 L 35.5 55 L 41.5 59.5" stroke="#9598a1" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Money bag: body, tuft, tie. -->
  <path d="M32 24 C 21 24, 15 33, 15 42 C 15 50, 23 53, 32 53 C 41 53, 49 50, 49 42 C 49 33, 43 24, 32 24 Z" fill="#16a34a"/>
  <path d="M26.5 24 L 37.5 24 L 40 18.5 L 35.5 20 L 32 16 L 28.5 20 L 24 18.5 Z" fill="#16a34a"/>
  <rect x="25.5" y="22.5" width="13" height="3.2" rx="1.6" fill="${BACKGROUND}"/>
  <!-- Dollar sign. -->
  <text x="32" y="46" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="19" fill="${BACKGROUND}">$</text>
`

const OUTPUTS = [
  { file: 'public/icons/apple-touch-icon.png', size: 180, artScale: 1 },
  { file: 'public/icons/icon-192.png', size: 192, artScale: 1 },
  { file: 'public/icons/icon-512.png', size: 512, artScale: 1 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, artScale: 0.8 },
]

/** Quick Look renders small SVGs inconsistently; always draw big, then resample. */
const RENDER_SIZE = 1024

/** The full SVG document, optionally with rounded corners and shrunken art. */
function svg({ width, radius = 0, artScale = 1 }) {
  const half = BOX / 2
  const transform =
    artScale === 1 ? '' : ` transform="translate(${half} ${half}) scale(${artScale}) translate(${-half} ${-half})"`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}" width="${width}" height="${width}">
  <rect width="${BOX}" height="${BOX}" rx="${radius}" fill="${BACKGROUND}"/>
  <g${transform}>${ART}
  </g>
</svg>
`
}

/** Rasterise an SVG string to PNG bytes at `size` px: Quick Look at 1024, sips down. */
function render(svgText, size) {
  const dir = mkdtempSync(join(tmpdir(), 'pfm-icons-'))
  try {
    const src = join(dir, 'icon.svg')
    writeFileSync(src, svgText)
    execFileSync('/usr/bin/qlmanage', ['-t', '-s', String(RENDER_SIZE), '-o', dir, src], { stdio: 'ignore' })
    const big = join(dir, 'icon.svg.png')
    if (size !== RENDER_SIZE) {
      execFileSync('/usr/bin/sips', ['-z', String(size), String(size), big], { stdio: 'ignore' })
    }
    return readFileSync(big)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

writeFileSync('public/favicon.svg', svg({ width: BOX, radius: 12 }))
console.log('wrote public/favicon.svg')

for (const out of OUTPUTS) {
  writeFileSync(out.file, render(svg({ width: RENDER_SIZE, artScale: out.artScale }), out.size))
  console.log(`wrote ${out.file} (${out.size}x${out.size}${out.artScale !== 1 ? ', maskable safe zone' : ''})`)
}
