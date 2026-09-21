#!/usr/bin/env node
/*
 * Regenerate the favicon and the PNG app icons from one piece of artwork.
 *
 *   node scripts/make-icons.mjs
 *
 * The ART below is the single source of truth: a money bag with a dollar
 * sign, wrapped by two arcs -- one on the left rising to point right, one
 * on the right falling to point left -- all in the brand green on the dark
 * ground. The script writes public/favicon.svg from it and
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
const GREEN = '#16a34a'
const ART = `
  <!-- Flow around the bag: one arrow on the left arcing up over the bag's
       shoulder to point right, one on the right arcing down to point left.
       Together they wrap the bag; the heads stay horizontal. -->
  <path d="M13 47 A 22 22 0 0 1 27 10.5" stroke="${GREEN}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M22 5.5 L28 10.5 L22 15.5" stroke="${GREEN}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M51 17 A 22 22 0 0 1 37 53.5" stroke="${GREEN}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M42 48.5 L36 53.5 L42 58.5" stroke="${GREEN}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Money bag: body, tuft, tie, dollar sign. Drawn slightly smaller than the
       arcs allow so the arrowheads never touch it. -->
  <g transform="translate(32 36) scale(0.86) translate(-32 -36)">
  <path d="M32 25 C 23 25, 18 32.5, 18 39.5 C 18 46, 24.5 48.5, 32 48.5 C 39.5 48.5, 46 46, 46 39.5 C 46 32.5, 41 25, 32 25 Z" fill="${GREEN}"/>
  <path d="M27.5 25 L 36.5 25 L 38.5 20.5 L 35 21.7 L 32 18.5 L 29 21.7 L 25.5 20.5 Z" fill="${GREEN}"/>
  <rect x="26.7" y="23.8" width="10.6" height="2.6" rx="1.3" fill="${BACKGROUND}"/>
  <text x="32" y="43" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="800" font-size="15.5" fill="${BACKGROUND}">$</text>
  </g>
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
