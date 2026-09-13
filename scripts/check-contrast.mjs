/*
 * WCAG contrast audit for the theme tokens, both light and dark.
 *
 * Exists because palette.css is designed to be swapped: a rebrand that only
 * looks right in dark mode, or that passes against the page but fails against
 * the slightly-darker card surface, is easy to ship by eye. Run this after
 * changing any colour.
 *
 *   npm run check:contrast
 *
 * The values below mirror palette.css / theme.css. Keep them in step -- this
 * reads no CSS, deliberately, so it stays dependency-free.
 */

const N = {
  0: '#0b0b0c',
  50: '#17181b',
  100: '#232529',
  200: '#34373d',
  300: '#4b4f57',
  400: '#71757e',
  500: '#9598a1',
  600: '#b8bac1',
  700: '#d4d6da',
  800: '#e7e8ea',
  900: '#f4f4f5',
  1000: '#ffffff',
}

const ACCENT = '#16a34a'
const ACCENT_DEEP = '#15803d'
const DANGER = '#dc2626'
const DANGER_DEEP = '#b91c1c'
const DANGER_LIGHT = '#f87171'

const themes = {
  light: {
    bg: N[1000],
    surface: N[900],
    'surface-raised': N[1000],
    edge: N[600],
    fg: N[0],
    'fg-muted': N[300],
    'fg-subtle': N[400],
    accent: ACCENT,
    'accent-fg': N[0],
    'accent-text': ACCENT_DEEP,
    danger: DANGER,
    'danger-fg': N[1000],
    'danger-text': DANGER_DEEP,
    'positive-text': ACCENT_DEEP,
    'negative-text': DANGER_DEEP,
  },
  dark: {
    bg: N[0],
    surface: N[50],
    'surface-raised': N[100],
    edge: N[200],
    fg: N[900],
    'fg-muted': N[600],
    'fg-subtle': N[400],
    accent: ACCENT,
    'accent-fg': N[0],
    'accent-text': ACCENT,
    danger: DANGER,
    'danger-fg': N[1000],
    'danger-text': DANGER_LIGHT,
    'positive-text': ACCENT,
    'negative-text': DANGER_LIGHT,
  },
}

/*
 * What sits on what. Each pair is [foreground, background, minimum ratio].
 * 4.5 is AA for body text, 3 is AA for large text and UI components.
 * fg-subtle carries only secondary labels that restate nearby content (dates,
 * counts), so it is held to the 3:1 UI threshold rather than body-text AA.
 */
const checks = [
  ['fg', 'bg', 4.5],
  ['fg', 'surface', 4.5],
  ['fg', 'surface-raised', 4.5],
  ['fg-muted', 'bg', 4.5],
  ['fg-muted', 'surface', 4.5],
  ['fg-subtle', 'bg', 3],
  ['fg-subtle', 'surface', 3],
  ['accent-text', 'bg', 4.5],
  ['accent-text', 'surface', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['danger-text', 'bg', 4.5],
  ['danger-text', 'surface', 4.5],
  ['danger-fg', 'danger', 4.5],
  ['positive-text', 'bg', 4.5],
  ['positive-text', 'surface', 4.5],
  ['negative-text', 'bg', 4.5],
  ['negative-text', 'surface', 4.5],
  // Non-text: borders and fills only need 3:1.
  ['edge', 'bg', 1.5],
  ['accent', 'bg', 3],
  ['danger', 'bg', 3],
]

function luminance(hex) {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/.{2}/g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

let failures = 0

for (const [name, tokens] of Object.entries(themes)) {
  console.log(`\n${name.toUpperCase()}`)
  for (const [fg, bg, min] of checks) {
    const r = ratio(tokens[fg], tokens[bg])
    const ok = r >= min
    if (!ok) failures++
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${fg.padEnd(14)} on ${bg.padEnd(15)} ${r.toFixed(2).padStart(6)}  (min ${min})`,
    )
  }
}

console.log()
if (failures) {
  console.error(`${failures} contrast check(s) failed.`)
  process.exit(1)
}
console.log('All contrast checks passed.')
