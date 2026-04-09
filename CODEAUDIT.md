# CODEAUDIT.md — Matrix Pro

> **Living document.** Update whenever a significant feature is added or removed.
> Last updated: 2026-04-09 (settings redesign: tab nav, row layout, palette overhaul)

---

## Feature inventory

### Datasets
- [x] Import CSV/TSV — file picker (`⌘O`), drag-drop, paste from clipboard
- [x] Import XLSX/XLS — drag-drop, file picker (`⌘O`); Electron reads binary via IPC; web uses FileReader/ArrayBuffer; SheetJS (`xlsx`) parses first sheet
- [x] Import from URL — modal in NewDatasetModal; supports CSV/TSV/JSON/XLSX; Electron uses `dialog:fetchUrl` IPC (no CORS); web uses `fetch()`
- [x] 4 built-in sample datasets — CA Housing, World Population, Sales '23, Tech Stocks
- [x] Create blank dataset — `NewDatasetModal` (define cols + types upfront)
- [x] Duplicate, rename, delete, close/reopen, change colour
- [x] Export CSV (`⌘E`) / JSON — visible rows/cols only, respects active filters
- [x] Cross-dataset join — inner/left/right → new tab
- [x] Group & aggregate — category grouping → new tab

### App settings (`SettingsModal.jsx`, `⌘,`)
- [x] **Layout** — 500px modal; horizontal tab nav (Appearance / Data / AI); row layout (label-left, control-right) for single controls; full-width sections for pickers
- [x] **Row height** — Compact (24) / Default (32) / Comfortable (40); stored in `state.settings.rowHeight`
- [x] **Chart palette** — 4 palettes shown as 2×2 card grid with name + all 10 dots; Electric / Neon / Sunset / Aurora; same `SET_PALETTE` action
- [x] **Number format** — 7 chip options + Auto; stored in `state.settings.defaultNumFmt`
- [x] **Date format** — stored in `state.settings.dateFormat` (default `medium`); 4 options; wired through `fmtCell` → `fmtDate` in `data.js`
- [x] **CSV delimiter** — stored in `state.settings.csvDelimiter` (default `auto`); wired into paste handler and `parseAndAdd`; TSV always forces Tab
- [x] **Ollama model** — stored in `state.settings.ollamaModel` (default `llama3.2:latest`); Detect fetches `/api/tags`; manual fallback input
- [x] Settings persisted to `localStorage` (`mp-settings`) and restored on mount
- [x] **Palettes overhauled** — Electric / Neon / Sunset / Aurora; all vibrant dark-mode colours; P0 indexes 1,2,3,5,6,8 retain hue roles for `COL_TYPES`

### Workspaces
- [x] Create / rename / delete workspaces; move dataset via hover folder icon
- [x] Collapse/expand sections; datasets fall back to Uncategorized on workspace delete

### Table view (`DataTable.jsx`)
- [x] Virtualised rendering (ROW_H=32, OVERSCAN=20)
- [x] Inline cell editing — double-click; Enter/Tab/Esc; numeric validation + shake
- [x] Keyboard nav — arrow keys, F2/Enter to edit, Delete/Backspace to clear, `⌘↵` new row
- [x] Column reorder (drag header), resize (drag right edge, min 50px), rename (double-click label)
- [x] Freeze/pin columns — sticky on horizontal scroll; visual separator after last pinned
- [x] Multi-sort — `⇅` click; Shift+click to stack; priority badges `↑¹ ↓²`
- [x] Column type override — click type badge (`T/#/D/B/C`) to cycle
- [x] Undo (`⌘Z`) / Redo (`⌘⇧Z`) — 50-step per dataset
- [x] Find (`⌘F`) / Find & Replace (`⌘H`) — match highlighting, Shift+Enter/Enter nav
- [x] Row selection — single/range/toggle/all; bulk duplicate, copy TSV, delete
- [x] Column visibility — Columns menu in toolbar
- [x] Computed/formula columns — `ƒ` badge; `evalFormula` in `data.js`
- [x] **Summary footer row** — sticky `<tfoot>` at bottom of scroll area; toggled via Σ button in footer bar; cycles Sum → Avg → Count (click label); respects active filters + search; numeric cols show value with column number format applied; non-numeric cols show count in Count mode only; pinned cols remain sticky
- [x] **Column context menu** (right-click header):
  - Sort A→Z/Z→A, Rename, Freeze/Unfreeze, Edit formula (computed)
  - **Format** (numeric only): Number format picker (7 options), Color scale toggle, Highlight rule modal (threshold op/val/colour), Clear highlight rule
  - **Clean** (all non-computed): Fill nulls forward, Fill nulls with value (modal)
  - **Clean** (text/category only): Trim whitespace, To UPPERCASE/lowercase/Title Case
  - Hide column, Delete column (undoable via ⌘Z)
- [x] **Number formatting** — per-column via `numberFormats[col]`; `applyNumFmt(n, fmt)` in `data.js`; options: auto/int/fixed1/fixed2/currency/percent/scientific
- [x] **Color-scale heatmap** — stored as `colFormats[col] = [{type:'scale'}]`; `getColRules(ds,col)` coerces old string value for backward compat
- [x] **Threshold highlight rule** — stored as `colFormats[col] = [{type:'threshold', op, val, color}]`; 20% alpha tint on matching cells

### Stats panel (`Panel.jsx`, `⌘\`)
- [x] Numeric/category/date/text filters; saved filter sets; active chips in toolbar
- [x] Stats cards: type, count, **% missing**, **unique count**, completeness bar, 16-bucket histogram
- [x] Numeric stats: min/max/mean/median, **mode**, **IQR outlier count**
- [x] Category stats: top values, **unique count**, **"+N more"** overflow footer

### Graph view (`ChartView.jsx`, ⌘2)
- [x] 9 chart types; dual Y-axis; 4 palettes; grid/smooth/labels toggles; PNG export
- [x] Save/load named graph configs per dataset (`⌘S`)
- [x] AI Insights (`Panel.jsx → AISuggestions`) — local Ollama (model from `state.settings.ollamaModel`); generates 5 presets; clicking a preset applies: chart type, X/Y axes (case-insensitive match + smart fallback to first cat/numeric col), agg func, and clears Y2 + size axis; non-numeric Y col auto-overrides agg to `count`; prompt includes `agg` field (sum/mean/median/min/max/count); graceful error + timeout UI
- [x] `buildChartData` is **exported** — consumed by `ChartCanvas.jsx`

### Dashboard (`DashboardView.jsx`, ⌘5)
- [x] Responsive card grid of all `ds.savedGraphs`
- [x] Each card uses `ChartCanvas` (prop-driven, no AppContext) at height 240
- [x] Hover → PNG export button per card; empty state when no saved graphs

### Pivot Table (`PivotView.jsx`, ⌘4)
- [x] Row/Column/Values axis wells; Sum/Avg/Count/Min/Max per value field
- [x] Grand Total row; two-level header when Column axis active
- [x] Three-state column sort (desc → asc → off)
- [x] **Export CSV** — downloads `{ds.name}-pivot.csv`
- [x] **Open as Dataset** — materialises sorted result as new tab

### SQL Editor (`SqlEditor.jsx`, ⌘3)
- [x] sql.js WebAssembly (lazy-loaded); all open datasets as queryable tables
- [x] Schema sidebar; `⌘↵` to run; Open as dataset

---

## Dataset object — key fields

```js
{
  cols, rows, hiddenCols, pinnedCols, colWidths, pinnedTypes, computedCols,
  sorts, filters, filterSpecs, filterLabels, savedFilterSets,
  savedGraphs,       // [{ id, title, ct, xCol, yCol, y2Col, pal }]
  colFormats,        // { [col]: Array<{type:'scale'}|{type:'threshold',op,val,color}> }
                     //   (legacy: string 'scale' coerced by getColRules)
  numberFormats,     // { [col]: 'int'|'fixed1'|'fixed2'|'currency'|'percent'|'scientific' }
}
// filters (functions) are NEVER persisted — only filterSpecs (plain objects) are
// colFormats + numberFormats stored as col_formats / number_formats TEXT in SQLite
```

---

## Keyboard shortcuts (all taken)

| Shortcut | Action | Handler |
|----------|--------|---------|
| `⌘O` | Open file | App.jsx |
| `⌘E` | Export CSV | App.jsx |
| `⌘S` | Save graph | App.jsx |
| `⌘Z / ⌘⇧Z` | Undo / Redo | App.jsx → `UNDO/REDO_ACTION` |
| `⌘↵` | Add row / Run query | DataTable / SqlEditor |
| `⌘A` | Select all rows | DataTable |
| `⌘F / ⌘H` | Find / Replace | DataTable |
| `⌘\` | Toggle panel | App.jsx |
| `⌘,` | Settings modal | App.jsx |
| `⌘1–5` | Table/Graph/SQL/Pivot/Dashboard | App.jsx |
| `⌃Tab / ⌃⇧Tab` | Next/prev dataset | App.jsx |

**Next available**: `⌘6`, `⌘,` (settings), `⌘R`

---

## Event handler map

### Global
| Event | Location | Notes |
|-------|----------|-------|
| `window keydown` | App.jsx | ⌘1–5, ⌘Z/⇧Z, ⌘F/H/E/S/O/A/↵, ⌘\, ⌃Tab |
| `window keydown` | DataTable.jsx (×2) | Arrow nav, ⌘A/F/H/Z/⇧Z/↵, Escape |
| `window keydown` | Modal.jsx | Escape closes modal |
| `document paste` | App.jsx | Imports clipboard CSV/TSV |
| `document dragenter/leave/dragover/drop` | App.jsx | File drop import; drop guard: `files.length > 0` — **must stay** |
| `document mousemove/mouseup` | DataTable.jsx | Column resize |
| `document mousemove/mouseup` | ChartView.jsx | Panel resize |
| `document mousedown` | Toolbar.jsx (×4) | Closes ColMenu, ExportMenu, DsMenu, ColorPicker |
| `document mousedown` | Sidebar.jsx | Closes workspace context menu |
| `document mousedown` | Panel.jsx | Closes saved-filter dropdown |
| `document mousedown` | PivotView.jsx (×2) | Closes AddRow/AddVal dropdowns |
| `document mousedown` | DataTable.jsx | Closes `colCtxMenu` (guard: `[data-colctx]`) |

### Inline (DataTable header)
| Event | Element | Action |
|-------|---------|--------|
| `onContextMenu` | `<th>` | Opens `colCtxMenu` at cursor position |
| `onDragStart/End/Over/Drop` | `<th>` | Column reorder |
| `onMouseDown` | `.resizeHandle` | Column resize |
| `onDoubleClick` | label span | Inline rename |
| `onClick` | type badge | Cycle column type |
| `onClick` | sort `⇅` | Sort / multi-sort |
| `onDoubleClick` | `<td>` | Open cell editor |

### z-index layers
```
1–4    Sticky table columns + headers
50     Pivot AddDropdown popovers
100    Toolbar dropdowns (ColMenu, ExportMenu, DsMenu, ColorPicker, Sidebar menus)
200    Column context menu (colCtxMenu — position: fixed)
300    Modal overlay (threshold rule modal, other modals)
```
