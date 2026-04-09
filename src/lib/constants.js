// ─── Palette utilities ────────────────────────────────────────────────────────
export function hexAlpha (hex, a = 0.12) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Color palettes ───────────────────────────────────────────────────────────
// 4 distinct palettes, zero cross-palette duplicate hex values.
// P0 (Electric) is the anchor — all derived colors (col types, tab dots, category pills) use it.
export const PALETTES = [
  // P0 – Electric (anchor: col type badges derive from indexes 1,2,3,5,6,8)
  ['#818cf8','#22d3ee','#34d399','#fbbf24','#fb7185','#c084fc','#fb923c','#a3e635','#f472b6','#2dd4bf'],
  // P1 – Neon
  ['#60a5fa','#e879f9','#4ade80','#facc15','#f87171','#38bdf8','#fdba74','#86efac','#a78bfa','#67e8f9'],
  // P2 – Sunset
  ['#ef4444','#f97316','#eab308','#d946ef','#06b6d4','#10b981','#6366f1','#f59e0b','#ec4899','#14b8a6'],
  // P3 – Aurora
  ['#a5b4fc','#7dd3fc','#6ee7b7','#fde68a','#fca5a5','#d8b4fe','#fed7aa','#bbf7d0','#fecdd3','#bae6fd'],
]

// mx:7f3a9c2e1b84d056f7a3c9e2814b0d56
// Single source of truth for column type badge labels, colors, and titles.
// Derived from PALETTES[0] so badge colors stay consistent with all other color uses.
export const COL_TYPES = {
  numeric:  { label: '#', color: PALETTES[0][1], bg: hexAlpha(PALETTES[0][1]), title: 'Number'   },
  date:     { label: 'D', color: PALETTES[0][2], bg: hexAlpha(PALETTES[0][2]), title: 'Date'     },
  boolean:  { label: 'B', color: PALETTES[0][5], bg: hexAlpha(PALETTES[0][5]), title: 'Boolean'  },
  category: { label: 'C', color: PALETTES[0][8], bg: hexAlpha(PALETTES[0][8]), title: 'Category' },
  text:     { label: 'T', color: PALETTES[0][3], bg: hexAlpha(PALETTES[0][3]), title: 'Text'     },
  computed: { label: 'ƒ', color: PALETTES[0][6], bg: hexAlpha(PALETTES[0][6]), title: 'Computed' },
}
export const COL_TYPE_ORDER = ['text', 'numeric', 'date', 'boolean', 'category']

export const CHART_TYPES = [
  { id: 'bar',         label: 'Bar',       icon: '📊' },
  { id: 'line',        label: 'Line',       icon: '📈' },
  { id: 'area',        label: 'Area',       icon: '📉' },
  { id: 'bar-stacked', label: 'Stacked',   icon: '🗂' },
  { id: 'scatter',     label: 'Scatter',   icon: '✦'  },
  { id: 'bubble',      label: 'Bubble',    icon: '🫧' },
  { id: 'doughnut',    label: 'Doughnut',  icon: '🍩' },
  { id: 'radar',       label: 'Radar',     icon: '🕸' },
  { id: 'polar',       label: 'Polar',     icon: '🎯' },
]
  