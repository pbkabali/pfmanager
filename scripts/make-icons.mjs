#!/usr/bin/env node
/*
 * Regenerate the PNG app icons from the logo geometry.
 *
 *   node scripts/make-icons.mjs
 *
 * Why this exists: the icons were once rendered by dropping the 64px SVG into
 * the corner of a larger transparent canvas, which iOS shows as a tiny logo on
 * a white tile. This machine has no SVG rasteriser and the project has no
 * image dependency, so the logo -- three rounded bars on a dark square -- is
 * drawn here directly and encoded with Node's built-in zlib.
 *
 * Keep the GEOMETRY below in step with public/favicon.svg; it is the same
 * shapes in the same 64-unit box.
 *
 * Every icon is OPAQUE and full-bleed:
 *  - iOS ignores alpha and rounds the corners itself, so the touch icon must
 *    be a plain filled square or the platform paints white behind it.
 *  - Android adaptive icons crop the maskable icon to a circle or squircle,
 *    so its artwork sits inside the central 80% safe zone.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// ---- geometry: mirrors public/favicon.svg -----------------------------------
const BOX = 64
const BACKGROUND = '#0b0b0c'
const BARS = [
  { x: 12, y: 36, w: 10, h: 16, r: 2, fill: '#4b4f57' },
  { x: 27, y: 26, w: 10, h: 26, r: 2, fill: '#9598a1' },
  { x: 42, y: 12, w: 10, h: 40, r: 2, fill: '#16a34a' },
]

const OUTPUTS = [
  { file: 'public/icons/apple-touch-icon.png', size: 180, artScale: 1 },
  { file: 'public/icons/icon-192.png', size: 192, artScale: 1 },
  { file: 'public/icons/icon-512.png', size: 512, artScale: 1 },
  // Bars shrunk towards the centre so a circular mask cannot clip them.
  { file: 'public/icons/icon-512-maskable.png', size: 512, artScale: 0.72 },
]

/** Samples per axis per pixel; 4x4 gives clean edges at every size here. */
const SUPERSAMPLE = 4

// ---- drawing -------------------------------------------------------------------
function hex(colour) {
  const n = parseInt(colour.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function insideRoundedRect(px, py, { x, y, w, h, r }) {
  if (px < x || px > x + w || py < y || py > y + h) return false
  // Corner test: outside the quarter circle at each corner means outside.
  const cx = px < x + r ? x + r : px > x + w - r ? x + w - r : px
  const cy = py < y + r ? y + r : py > y + h - r ? y + h - r : py
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function render({ size, artScale }) {
  const bg = hex(BACKGROUND)
  const bars = BARS.map((b) => ({ ...b, rgb: hex(b.fill) }))
  const pixels = Buffer.alloc(size * size * 3)
  const step = 1 / SUPERSAMPLE
  const half = BOX / 2

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          // Pixel centre -> logo units, then pull towards the centre for the
          // maskable safe zone.
          let ux = ((px + (sx + 0.5) * step) / size) * BOX
          let uy = ((py + (sy + 0.5) * step) / size) * BOX
          ux = half + (ux - half) / artScale
          uy = half + (uy - half) / artScale
          let rgb = bg
          for (const bar of bars) if (insideRoundedRect(ux, uy, bar)) rgb = bar.rgb
          r += rgb[0]
          g += rgb[1]
          b += rgb[2]
        }
      }
      const n = SUPERSAMPLE * SUPERSAMPLE
      const i = (py * size + px) * 3
      pixels[i] = Math.round(r / n)
      pixels[i + 1] = Math.round(g / n)
      pixels[i + 2] = Math.round(b / n)
    }
  }
  return pixels
}

// ---- PNG encoding ----------------------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour, no alpha -- opaque on purpose
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // One filter byte (0 = none) in front of every scanline.
  const stride = size * 3
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- go -----------------------------------------------------------------------------
for (const out of OUTPUTS) {
  writeFileSync(out.file, encodePng(out.size, render(out)))
  console.log(`wrote ${out.file} (${out.size}x${out.size}${out.artScale !== 1 ? ', maskable safe zone' : ''})`)
}
