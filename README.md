# Matrix Pro

No-code data exploration and visualisation. Built with **Vite + React + Electron + sql.js**.

Vibe coding with Claude Code.

![MatrixPro Screenshot](screenshot.png)

---

## Quick start

```bash
npm install
npm run dev
```

> `npm run dev` starts Vite on port 5173 and launches Electron pointing at it.
> No native compilation required — sql.js is pure WebAssembly.

---

## Build for distribution

```bash
npm run build:mac     # → release/Matrix Pro-2.0.0.dmg  (arm64 + x64)
npm run build:win     # → release/Matrix Pro Setup 2.0.0.exe
npm run build:linux   # → release/Matrix Pro-2.0.0.AppImage
```

---

## Features

### Datasets
- Import `.csv` / `.tsv` via drag & drop, **⌘O**, or paste from clipboard (Excel, Sheets, etc.)
- 4 built-in sample datasets (CA Housing, World Population, Sales '23, Tech Stocks)
- **Create blank datasets** — define column names + types via **+** button
- 5 column types: **Text · Number · Date · Boolean · Category** — auto-detected, overridable
- Duplicate, rename, delete, close/reopen via the **⋯** toolbar menu
- **Change dataset colour** — click the colour dot in the toolbar
- **Cross-dataset joins** — inner / left / right on a shared key column → new tab
- **Export CSV** (**⌘E**) or JSON — visible rows/cols only, respects active filters
- All data persisted to SQLite; restored on next launch

### Workspaces
- Organise datasets into named groups; collapse/expand sections
- **⋯** menu on each workspace: rename or delete (datasets fall back to Uncategorized)
- Move any dataset to a workspace via the hover folder icon

### Table view (⌘1)
- Virtualised rendering — handles large datasets without slowdown
- **Inline cell editing** — double-click; Tab/Enter to move; ⌘↵ to add a row
- **Keyboard navigation** — arrow keys, Enter/F2 to edit, Delete/Backspace to clear
- **Column operations** — drag to reorder, drag right edge to resize, double-click label to rename
- **Multi-sort** — click ⇅; Shift+click to stack sort keys with priority indicators (↑¹ ↓²)
- **Row selection** — click index (single), Shift+click (range), ⌘+click (toggle), ⌘A (all)
- **Bulk actions** — duplicate, copy as TSV, or delete selected rows
- **Undo / Redo** (**⌘Z / ⌘⇧Z**) — 50-step history per dataset
- **Find** (**⌘F**) and **Find & Replace** (**⌘H**) with match highlighting and full undo
- **Column context menu** (right-click any header):
  - Sort A→Z / Z→A, Rename, Freeze/Unfreeze
  - **Format** (numeric cols): Number format (Auto/Integer/1dp/2dp/Currency/Percent/Scientific), Color scale heatmap, Highlight rule (threshold with colour picker)
  - Hide column, Delete column (undoable)
- Category columns auto-assign distinct colour pills; boolean columns render green/red pills

### Filters & Stats (⌘\\)
- **Filters** — Numeric range, Category checkboxes, Date (year/month + range), Text/Regex (Contains / Starts with / Ends with / Regex + case-sensitive)
- **Saved filter sets** — save, reload, or delete named filter combinations
- Active filter chips in the toolbar for quick removal
- **Stats panel** — per-column cards with type, count, % missing, unique count, completeness bar, 16-bucket histogram; numeric columns show mode and IQR outlier count; category columns show top values + overflow count

### Graph view (⌘2)
- 9 chart types: Bar (horiz/vert), Line, Area, Stacked, Scatter, Bubble, Doughnut, Radar, Polar
- Dual Y-axis: categorical Y2 → grouped bars; numeric Y2 → line overlay on second axis
- 4 colour palettes, grid/smooth/labels toggles, PNG export
- **Save named graph configurations** (**⌘S**) per dataset

### Dashboard (⌘5)
- Displays all saved graphs for the active dataset in a responsive card grid
- Each card renders a live `ChartCanvas` at 240px height with hover PNG export
- Empty state prompts to save graphs from Graph view

### Pivot Table (⌘4)
- Assign columns to **Rows**, **Columns**, and **Values** wells via **+ Add**
- Values support Sum / Avg / Count / Min / Max — switchable per field
- Grand Total row always visible; two-level header when Column axis is active
- **Export CSV** — downloads pivot result directly
- **Open as Dataset** — materialises the pivot as a new tab

### SQL Editor (⌘3)
- Full in-browser SQL via sql.js (WebAssembly); every open dataset auto-loaded as a table
- Cross-dataset JOINs; schema sidebar; `⌘↵` to run; **Open as dataset**

### AI Insights
- Connects to a locally-running Ollama instance to generate chart suggestions (fully optional)

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘O | Open dataset file |
| Paste | Import clipboard CSV/TSV as new dataset |
| ⌃Tab / ⌃⇧Tab | Next / previous open dataset |
| ⌘1 – ⌘5 | Table / Graph / SQL / Pivot / Dashboard |
| ⌘\\ | Toggle filter panel |
| ⌘F / ⌘H | Find / Find & Replace |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘↵ | Add row (table) · Run query (SQL) |
| ⌘A | Select all visible rows |
| ⌘S | Save current graph |
| ⌘E | Export CSV |
| Esc | Close modal / cancel edit / clear selection |

---

## Ollama AI Insights

```bash
brew install ollama          # or https://ollama.com
ollama pull llama3.2
# Ollama auto-starts on localhost:11434
```

Click **Generate** in the Graph → AI Insights panel.

---

## Data persistence

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/matrix-pro/matrix-pro.db` |
| Windows | `%APPDATA%\matrix-pro\matrix-pro.db` |
| Linux | `~/.config/matrix-pro/matrix-pro.db` |

Stores datasets, saved graphs, column formats, number formats, and workspace assignments. Fully restored on next launch.
