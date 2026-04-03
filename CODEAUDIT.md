# CODEAUDIT.md — Matrix Pro

> **Living document.** Update this file whenever a significant feature is added or removed.
> Purpose: give Claude (or any AI assistant) a complete picture of what already exists so it doesn't re-implement, break, or duplicate anything.
>
> Last updated: 2026-04-03

---

## Feature inventory

Check this list **before** suggesting a new feature. If it's here, it's built.

### Datasets
- [x] Import CSV/TSV — file picker (`⌘O`), drag-drop onto app, paste from clipboard
- [x] 4 built-in sample datasets — CA Housing, World Population, Sales '23, Tech Stocks
- [x] Create blank dataset — `+` button → `NewDatasetModal` (define cols + types upfront)
- [x] Duplicate dataset — `⋯` menu → creates full copy as new tab
- [x] Rename dataset — `⋯` menu → modal
- [x] Delete dataset — `⋯` menu → removes from state + SQLite
- [x] Close/reopen dataset — hides in sidebar, state retained, `SET_ACTIVE` reopens
- [x] Change dataset colour — click colour dot → 10-swatch picker from PALETTES[0]
- [x] Export CSV (`⌘E`) — visible rows/cols only, respects active filters
- [x] Export JSON — same visibility rules
- [x] Cross-dataset join — Join button → modal → inner/left/right → new tab
- [x] Group & aggregate — Group button → modal → category grouping → new tab

### Workspaces
- [x] Create workspace — `+ New workspace` in sidebar footer
- [x] Rename workspace — inline `⋯` menu
- [x] Delete workspace — datasets fall back to Uncategorized
- [x] Move dataset to workspace — hover folder icon on dataset row
- [x] Collapse/expand workspace sections

### Table view (`DataTable.jsx`)
- [x] Virtualised rendering — only visible rows in DOM (ROW_H=32, OVERSCAN=20)
- [x] Inline cell editing — double-click; Enter/Tab/Esc navigation; numeric validation with shake
- [x] Keyboard navigation — arrow keys to move focus; F2/Enter to edit; Delete/Backspace to clear; `⌘↵` new row
- [x] Column reordering — drag header left/right; order persists
- [x] Column resizing — drag right edge of header; min 50px
- [x] Freeze/pin columns — pin icon in header; frozen cols stay fixed on horizontal scroll
- [x] Multi-sort — `⇅` click; Shift+click for additional sort keys; priority badges `↑¹ ↓²`
- [x] Column rename — double-click header label; inline input; all metadata updated
- [x] Column type override — click type badge (`T/#/D/B/C`) to cycle through types
- [x] Undo (`⌘Z`) / Redo (`⌘⇧Z`) — 50-step per dataset, covers cell edits + column ops
- [x] Conditional formatting — gradient icon on numeric headers; low→transparent, high→indigo scale
- [x] Find (`⌘F`) — highlight matches amber; Shift+Enter/Enter to navigate
- [x] Find & Replace (`⌘H`) — Replace current or Replace All; full undo support
- [x] Row selection — click index (single), Shift+click (range), `⌘+click` (toggle), `⌘A` (all visible)
- [x] Bulk actions — duplicate, copy as TSV, delete selected rows
- [x] Column visibility — Columns menu in toolbar; search by name; "Show all" button
- [x] Add row — `⌘↵` or footer button; appends empty row
- [x] Delete row — hover × on row number
- [x] Computed/formula columns — `ƒ` badge; formula engine in `data.js:evalFormula`; modal with live preview + column chips

### Filters & Stats (`Panel.jsx`, `⌘\`)
- [x] Numeric range filters — min/max sliders
- [x] Category checkbox filters
- [x] Date filters — year/month multi-select + date range
- [x] Text/Regex filters — Contains / Starts with / Ends with / Regex; case-sensitive toggle
- [x] Saved filter sets — save/reload/delete named filter combinations
- [x] Active filter chips in toolbar — one-click removal
- [x] Stats panel — per-column cards: type, count, completeness bar, 16-bucket histogram

### Graph view (`ChartView.jsx`)
- [x] 9 chart types: Bar, Line, Area, Stacked, Scatter, Bubble, Doughnut, Radar, Polar
- [x] Bar orientation — vertical / horizontal
- [x] Dual Y-axis — categorical Y2 (grouped bars) or numeric Y2 (line overlay)
- [x] 4 colour palettes, grid toggle, smooth curves toggle, labels toggle
- [x] Export chart as PNG
- [x] Save/load named graph configurations per dataset (`⌘S`)
- [x] AI Insights — connects to local Ollama instance; graceful fallback

### Pivot Table (`PivotView.jsx`, `⌘4`)
- [x] Row fields — click `+Add` to assign grouping columns (multi-field)
- [x] Column field — optional cross-tabulation; capped at 50 unique values
- [x] Values — multiple value fields; Sum/Avg/Count/Min/Max per field
- [x] Count uses `COUNT(*)` semantics — counts all rows in group
- [x] Column totals — Total column per value field when cross-tab is active
- [x] Grand Total row — always visible
- [x] Sortable columns — click any header; ↑/↓ indicators; resets on config change
- [x] Two-level header when column axis active — group row + colVal row
- [x] Open as Dataset — materialises sorted result as new tab

### SQL Editor (`SqlEditor.jsx`, `⌘3`)
- [x] Full sql.js WebAssembly SQL (lazy loaded)
- [x] Every open dataset auto-loaded as queryable table
- [x] Cross-dataset JOINs
- [x] Schema sidebar — collapsible tables, column type badges, click-to-insert
- [x] `⌘↵` to run; Tab to indent; shows row count + execution time
- [x] Open as dataset — query result → new tab

---

## Keyboard shortcuts (all taken)

| Shortcut | Action | Handler location |
|----------|--------|-----------------|
| `⌘O` | Open file | App.jsx (Electron menu + keydown) |
| `⌘E` | Export CSV | App.jsx keydown |
| `⌘S` | Save graph | App.jsx keydown (graph view only) |
| `⌘Z` | Undo | App.jsx keydown → `UNDO_ACTION` |
| `⌘⇧Z` | Redo | App.jsx keydown → `REDO_ACTION` |
| `⌘↵` | Add row / Run query | DataTable keydown / SqlEditor |
| `⌘A` | Select all visible rows | DataTable keydown |
| `⌘F` | Find in table | DataTable keydown |
| `⌘H` | Find & Replace | DataTable keydown |
| `⌘\` | Toggle filters panel | App.jsx keydown |
| `⌘1` | Table view | App.jsx keydown |
| `⌘2` | Graph view | App.jsx keydown |
| `⌘3` | SQL view | App.jsx keydown |
| `⌘4` | Pivot view | App.jsx keydown |
| `⌃Tab` | Next dataset | App.jsx keydown |
| `⌃⇧Tab` | Previous dataset | App.jsx keydown |
| `Escape` | Close modal / cancel | App.jsx + Modal.jsx + DataTable |

**Next available**: `⌘5`, `⌘6`, `⌘,` (settings), `⌘R` (refresh/reload)

---

## AppContext action types

```
// Tab lifecycle
ADD_TAB          { ds }
CLOSE_TAB        { id }           — marks open: false, stays in state
DELETE_TAB       { id }           — removes entirely
SET_ACTIVE       { id }           — opens tab, resets view to 'table', resets pivot config

// Dataset mutation
UPDATE_DS        { id, patch }    — shallow merge into matching tab
PUSH_ACTION      { dsId, data }   — push snapshot for undo (clears redo stack)
UNDO_ACTION      { dsId }
REDO_ACTION      { dsId }

// View & UI
SET_VIEW         { view }         — 'table'|'graph'|'sql'|'pivot'
TOGGLE_PANEL                      — toggles right-side panel
SET_PANEL_TAB    { tab }          — 'filters'|'stats'|'graph'|'saved'

// Chart config (global, not per-dataset)
SET_CHART_TYPE   { ct }
SET_PALETTE      { idx }
SET_AXIS         { which, value } — which: 'X'|'Y'|'Y2'|'Sz'
SET_TOGGLE       { key, value }   — showLabels, showGrid, smoothCurves, barOrientation
SET_AGG          { fn }

// Pivot config (global, resets on SET_ACTIVE)
SET_PIVOT        { rowFields, colField, valueFields }

// Workspaces
ADD_WORKSPACE    { name }
RENAME_WORKSPACE { id, name }
DELETE_WORKSPACE { id }           — datasets fall back to workspaceId: null
SET_TAB_WORKSPACE { tabId, workspaceId }

// Restore from SQLite on init
RESTORE_TABS        { tabs }
RESTORE_WORKSPACES  { workspaces }
```

---

## Event handler map

Critical for avoiding interaction conflicts. Scan this before adding any new drag, hover, keyboard, or mouse handler.

### Global (window / document)
| Event | Location | What it does |
|-------|----------|--------------|
| `window keydown` | App.jsx | ⌘1-4, ⌘Z/⇧Z, ⌘F/H/E/S/O/A/↵, ⌘\, ⌃Tab |
| `window keydown` | DataTable.jsx (×2) | Arrow nav + Esc for cell editing; ⌘A, ⌘F, ⌘H, ⌘Z/⇧Z, ⌘↵ for table ops |
| `window keydown` | Modal.jsx | Escape closes any open modal |
| `window keydown` | NewDatasetModal.jsx | Escape closes |
| `document paste` | App.jsx | Imports clipboard CSV/TSV as new dataset |
| `document dragenter/leave` | App.jsx | Shows/hides DropOverlay |
| `document dragover` | App.jsx | Prevents default (enables drop) |
| `document drop` | App.jsx | Imports dropped file **only if** `e.dataTransfer.files.length > 0` — this guard must stay |
| `document mousemove/mouseup` | DataTable.jsx | Column resize drag |
| `document mousemove/mouseup` | ChartView.jsx | Panel resize drag |
| `document mousedown` | Toolbar.jsx (×4) | Closes ColMenu, ExportMenu, DsMenu, ColorPicker on outside click |
| `document mousedown` | Sidebar.jsx | Closes workspace context menu |
| `document mousedown` | Panel.jsx | Closes saved-filter-set dropdown |
| `document mousedown` | PivotView.jsx (×2) | Closes AddRow / AddVal dropdowns |

### Inline element handlers (DataTable)
| Event | Element | What it does |
|-------|---------|--------------|
| `onDragStart/End` | `<th>` | Column reorder — sets `dragCol` state |
| `onDragOver/Drop` | `<th>` | Column reorder drop target |
| `onMouseDown` | Resize handle `.resizeHandle` | Starts column resize |
| `onDoubleClick` | `<th>` label span | Opens column rename input |
| `onClick` | Type badge | Cycles column type (or opens formula edit for computed cols) |
| `onClick` | Sort `⇅` button | Single-sort; Shift+click for multi-sort |
| `onClick` | Pin icon | Toggle freeze column |
| `onClick` | Scale icon | Toggle colour-scale formatting |
| `onClick` | Row index `<td>` | Row selection (+ Shift/⌘ modifiers) |
| `onMouseEnter` | Row index `<td>` | Shows delete `×` button |
| `onDoubleClick` | Data `<td>` | Opens cell editor |

### z-index layers
```
1–2   Sticky table columns (tdRow, thRow)
3     Sticky header row-field cells (thRow in PivotView two-level header)
4     Sticky data table headers (thRow in DataTable)
10    Toolbar (position: relative, z-index implicit)
50    Pivot AddDropdown popovers
100   Toolbar dropdowns (ColMenu, ExportMenu, DsMenu, ColorPicker, Sidebar menus)
200   ColorPicker popover
300   Modal overlay
```

