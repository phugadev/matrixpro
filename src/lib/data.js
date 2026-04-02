import { PALETTES, hexAlpha } from './constants'

// ─── uid ─────────────────────────────────────────────────────────────────────
export function uid () {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ─── Number formatting ───────────────────────────────────────────────────────
export function fmtN (n) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(0) + 'k'
  return Number.isInteger(n) ? n.toLocaleString() : parseFloat(n).toFixed(2)
}

// Build a { value → { color, bg } } map for a category column.
// Values are sorted alphabetically so the assignment is deterministic regardless of row order.
// Using positional assignment (not hashing) means no two distinct values share a color.
export function buildCatColorMap (uniqueValues) {
  const sorted = [...uniqueValues].sort()
  const map = {}
  sorted.forEach((v, i) => {
    const color = PALETTES[0][i % PALETTES[0].length]
    map[v] = { color, bg: hexAlpha(color, 0.13) }
  })
  return map
}

export function fmtCell (v, colType, catColorMap) {
  if (v === undefined || v === null || v === '') return '—'
  if (colType === 'boolean') {
    const isTrue = /^(true|yes)$/i.test(String(v).trim())
    const color  = isTrue ? PALETTES[0][2] : PALETTES[0][4]  // green : red
    return { type: 'pill', bg: hexAlpha(color, 0.12), color, label: String(v) }
  }
  if (colType === 'category') {
    const entry = catColorMap?.[String(v)]
    const color = entry?.color ?? PALETTES[0][0]
    const bg    = entry?.bg    ?? hexAlpha(PALETTES[0][0], 0.13)
    return { type: 'pill', bg, color, label: String(v) }
  }
  if (colType === 'date') return { type: 'date', label: fmtDate(v) }
  const n = parseNumeric(v)
  if (!isNaN(n) && String(v).trim() !== '') return { type: 'num', label: fmtN(n) }
  return { type: 'text', label: String(v) }
}

// ─── Numeric normalisation (strips $€£¥₹, commas, trailing %) ────────────────
export function parseNumeric (v) {
  const s = String(v).trim().replace(/^[$€£¥₹]/, '').replace(/,/g, '').replace(/%$/, '')
  return Number(s)
}

// ─── Formula evaluation for computed columns ──────────────────────────────────
// Column names are sanitized to valid JS identifiers (spaces → underscores).
// So "Avg income" → "Avg_income" in formulas.
export function evalFormula (formula, row) {
  try {
    const entries  = Object.entries(row)
    const safeKeys = entries.map(([k]) => k.replace(/[^a-zA-Z0-9_$]/g, '_'))
    const vals     = entries.map(([, v]) => {
      if (v === '' || v == null) return ''
      const n = parseNumeric(v)
      return isNaN(n) ? String(v) : n
    })
    const result = new Function(...safeKeys, `"use strict"; return (${formula})`)(...vals)
    if (result == null || (typeof result === 'number' && isNaN(result))) return ''
    return result
  } catch { return '' }
}

// ─── Column type detection ───────────────────────────────────────────────────
export function isNumericCol (ds, col) {
  const sample = ds.rows.slice(0, 20).filter(r => r[col] !== '' && r[col] != null)
  return sample.length > 0 && sample.every(r => !isNaN(parseNumeric(r[col])))
}

const BOOL_VALS = new Set([
  'true','false','yes','no',
  'TRUE','FALSE','YES','NO',
  'True','False','Yes','No',
])
export function isBooleanCol (ds, col) {
  const sample = ds.rows.slice(0, 20).filter(r => r[col] !== '' && r[col] != null)
  return sample.length >= 1 && sample.every(r => BOOL_VALS.has(String(r[col]).trim()))
}

const DATE_RE = [
  /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/,                                                          // 2023-01-15 / ISO datetime
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,                                                              // 2023-01-15 10:30:00 (space separator)
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,                                                                 // 1/15/2023
  /^\d{1,2}-\d{1,2}-\d{4}$/,                                                                     // 01-15-2023
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i,                    // Jan 15, 2023
  /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,                       // 15 Jan 2023
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}$/i,
]

export function isDateCol (ds, col) {
  const sample = ds.rows.slice(0, 20).map(r => r[col]).filter(v => v !== '' && v != null)
  return sample.length >= 2 && sample.every(v => DATE_RE.some(re => re.test(String(v).trim())))
}

// Low-cardinality text → category (auto-pill coloring)
export function isCategoryCol (ds, col) {
  const vals = ds.rows.slice(0, 100).map(r => r[col]).filter(v => v !== '' && v != null)
  if (vals.length < 2) return false
  const unique = new Set(vals)
  return unique.size <= 15 && unique.size / vals.length <= 0.5
}

// 'numeric' | 'date' | 'boolean' | 'category' | 'text'
export function detectColType (ds, col) {
  if (ds.pinnedTypes?.[col]) return ds.pinnedTypes[col]
  if (isDateCol(ds, col))     return 'date'
  if (isBooleanCol(ds, col))  return 'boolean'
  if (isNumericCol(ds, col))  return 'numeric'
  if (isCategoryCol(ds, col)) return 'category'
  return 'text'
}

// Parse a date string safely (avoids UTC midnight timezone shift for plain dates)
export function parseDate (v) {
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00')
  return new Date(s)
}

export function fmtDate (v) {
  const d = parseDate(v)
  if (isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Reconstruct a filter predicate from a serialisable spec ─────────────────
export function specToFn (col, spec) {
  if (!spec) return () => true
  if (spec.type === 'text') {
    const { mode = 'contains', q = '', caseSensitive: cs = false } = spec
    if (mode === 'regex') {
      try { const re = new RegExp(q, cs ? '' : 'i'); return r => re.test(String(r[col] ?? '')) }
      catch { return () => false }
    }
    const needle = cs ? q : q.toLowerCase()
    const xf     = v => cs ? String(v ?? '') : String(v ?? '').toLowerCase()
    if (mode === 'starts') return r => xf(r[col]).startsWith(needle)
    if (mode === 'ends')   return r => xf(r[col]).endsWith(needle)
    return r => xf(r[col]).includes(needle)
  }
  if (spec.type === 'numeric') {
    const loN = spec.lo !== '' && spec.lo != null ? +spec.lo : null
    const hiN = spec.hi !== '' && spec.hi != null ? +spec.hi : null
    return r => { const n = parseNumeric(r[col]); return !isNaN(n) && (loN === null || n >= loN) && (hiN === null || n <= hiN) }
  }
  if (spec.type === 'cat') {
    const sel = new Set(spec.selected || [])
    return r => sel.has(r[col])
  }
  if (spec.type === 'date') {
    const sy = new Set(spec.selYears || [])
    const sm = new Set(spec.selMonths || [])
    const fromD = spec.fromStr ? parseDate(spec.fromStr) : null
    const toD   = spec.toStr   ? parseDate(spec.toStr)   : null
    const hasFrom = fromD && !isNaN(fromD.getTime())
    const hasTo   = toD   && !isNaN(toD.getTime())
    return r => {
      const d = parseDate(r[col])
      if (isNaN(d.getTime())) return false
      if (sy.size > 0 && !sy.has(d.getFullYear())) return false
      if (sm.size > 0 && !sm.has(d.getMonth()))    return false
      if (hasFrom && d < fromD) return false
      if (hasTo   && d > toD)   return false
      return true
    }
  }
  if (spec.type === 'boolean') {
    return r => String(r[col]).trim() === String(spec.sel).trim()
  }
  return () => true
}

// ─── Make dataset object ─────────────────────────────────────────────────────
export function makeDS (name, rows, existingTabCount = 0) {
  const cols = rows.length ? Object.keys(rows[0]) : []
  return {
    id:              uid(),
    name,
    rows,
    cols,
    filters:         {},
    filterLabels:    {},
    filterSpecs:     {},
    savedFilterSets: [],
    savedGraphs:     [],
    color:           PALETTES[0][existingTabCount % PALETTES[0].length],
  }
}

// ─── Sample generators ───────────────────────────────────────────────────────
export function genHousing (n = 600) {
  const prox = ['INLAND', 'NEAR OCEAN', 'ISLAND', '<1H OCEAN', 'NEAR BAY']
  return Array.from({ length: n }, (_, i) => ({
    'Ocean proximity': prox[i % prox.length],
    Longitude:         +(-122 + Math.random() * 5).toFixed(2),
    Latitude:          +(34   + Math.random() * 8).toFixed(2),
    Population:        Math.floor(200  + Math.random() * 2800),
    'Avg income':      Math.floor(28000 + Math.random() * 160000),
    'House value':     Math.floor(80000 + Math.random() * 900000),
    'Housing age':     Math.floor(8    + Math.random() * 50),
    Mortgage:          Math.random() > 0.45 ? 'YES' : 'NO',
  }))
}

export function genWorld (n = 240) {
  const c  = ['Nigeria','China','India','USA','Brazil','Germany','France','UK','Japan','Russia','Mexico','Indonesia','Pakistan','Ethiopia','Egypt','Vietnam','Philippines','Bangladesh','Congo','Tanzania','South Africa','Kenya','Algeria','Ukraine','Argentina','Colombia','Spain','Canada','Australia']
  const co = ['Africa','Asia','Asia','Americas','Americas','Europe','Europe','Europe','Asia','Europe','Americas','Asia','Asia','Africa','Africa','Asia','Asia','Asia','Africa','Africa','Africa','Africa','Africa','Europe','Americas','Americas','Europe','Americas','Oceania']
  return Array.from({ length: n }, (_, i) => ({
    Country:           c[i % c.length],
    Continent:         co[i % co.length],
    Year:              2000 + Math.floor(i / c.length * 3),
    Population:        Math.floor(5e6 + Math.random() * 1.4e9),
    'GDP per capita':  Math.floor(500 + Math.random() * 85000),
    'Life expectancy': +(45 + Math.random() * 42).toFixed(1),
    CO2:               +(0.1 + Math.random() * 18).toFixed(2),
  }))
}

export function genSales (n = 360) {
  const reps     = ['Stark','Banner','Rogers','Parker','Strange','Romanoff','Barton']
  const regions  = ['North','South','East','West']
  const products = ['Alpha','Beta','Gamma','Delta','Epsilon']
  return Array.from({ length: n }, (_, i) => ({
    Month:    (i % 12) + 1,
    Quarter:  `Q${Math.floor((i % 12) / 3) + 1}`,
    Rep:      reps[i % reps.length],
    Region:   regions[i % regions.length],
    Product:  products[i % products.length],
    Units:    Math.floor(10 + Math.random() * 600),
    Revenue:  Math.floor(12000 + Math.random() * 380000),
    Cost:     Math.floor(5000  + Math.random() * 150000),
    Profit:   Math.floor(1000  + Math.random() * 120000),
    Rating:   +(2.5 + Math.random() * 2.5).toFixed(1),
  }))
}

export function genStocks () {
  const tickers = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','NFLX']
  const rows    = []
  tickers.forEach(tk => {
    let p = 100 + Math.random() * 200
    for (let d = 0; d < 50; d++) {
      p *= 1 + (Math.random() - 0.48) * 0.04
      rows.push({
        Ticker:       tk,
        Day:          d + 1,
        Open:         +p.toFixed(2),
        Close:        +(p * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2),
        Volume:       Math.floor(1e6 + Math.random() * 5e7),
        'Mkt Cap $B': +(p * (1e8 + Math.random() * 9e8) / 1e9).toFixed(1),
      })
    }
  })
  return rows
}
