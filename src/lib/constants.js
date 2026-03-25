// ─── Palette utilities ────────────────────────────────────────────────────────
export function hexAlpha (hex, a = 0.12) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Color palettes ───────────────────────────────────────────────────────────
// 4 distinct palettes, zero cross-palette duplicate hex values.
// P0 (Vivid) is the anchor — all derived colors (col types, tab dots, category pills) use it.
export const PALETTES = [
  // P0 – Vivid
  ['#6366f1','#06b6d4','#10b981','#f59e0b','#f43f5e','#a855f7','#fb923c','#84cc16','#ec4899','#14b8a6'],
  // P1 – Cool
  ['#3b82f6','#8b5cf6','#0284c7','#059669','#ca8a04','#ef4444','#f97316','#4338ca','#db2777','#22c55e'],
  // P2 – Warm Earth
  ['#dc2626','#ea580c','#d97706','#65a30d','#0f766e','#0369a1','#7e22ce','#be185d','#15803d','#1d4ed8'],
  // P3 – Soft Pastel
  ['#0ea5e9','#22d3ee','#34d399','#a3e635','#fde047','#fdba74','#f87171','#c084fc','#f0abfc','#67e8f9'],
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
  