# Matrix Pro

**Local-first data exploration and visualisation — no cloud, no accounts, no limits.**

Drop in a CSV/TSV file, or paste straight from your clipboard. Matrix Pro loads it into a local SQLite database, auto-detects column types, and gives you a full suite of tools to explore, filter, query, and visualise your data — all on your machine.

Built with **Vite + React + Electron + sql.js**.

![MatrixPro Screenshot](screenshot.png)

---

## Why Matrix Pro

Most data tools either require an internet connection, charge a subscription, or demand you hand over your data to a third party. Matrix Pro runs entirely offline. Your data stays on your machine, stored in a local SQLite database and restored automatically every time you launch.

It started as a personal tool for making sense of bad spending habits. It grew into something more.

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
- Import **CSV / TSV** via drag & drop, **⌘O**, or paste from clipboard (Excel, Sheets, etc.)
- Import **Excel (.xlsx / .xls)** via drag & drop or **⌘O** — first sheet loaded automatically
- Import **from URL** — paste a public link to a CSV, TSV, JSON, or XLSX file
- 4 built-in sample datasets to get started immediately (CA Housing, World Population, Sales '23, Tech Stocks)
- **Create blank datasets** — define column names and types from scratch
- 5 column types: **Text · Number · Date · Boolean · Category** — auto-detected, always overridable
- Duplicate, rename, delete, close/reopen datasets via the **⋯** toolbar menu
- **Cross-dataset joins** — inner / left / right on a shared key column → new tab
- **Export CSV** (**⌘E**) or JSON — visible rows/columns only, respects active filters
- All data persisted to SQLite and restored on next launch

### Table view (⌘1)
- Virtualised rendering — handles large datasets without slowdown
- **Inline cell editing** — double-click any cell; Tab/Enter to navigate; ⌘↵ to add a row
- **Keyboard navigation** — arrow keys, Enter/F2 to edit, Delete/Backspace to clear
- **Column operations** — drag to reorder, drag edge to resize, double-click label to rename
- **Multi-sort** — click ⇅; Shift+click to stack sort keys with priority indicators (↑¹ ↓²)
- **Row selection** — single, range, toggle, or select all; bulk duplicate, copy as TSV, or delete
- **Undo / Redo** (**⌘Z / ⌘⇧Z**) — 50-step history per dataset
- **Find** (**⌘F**) and **Find & Replace** (**⌘H**) with match highlighting
- **Column context menu** (right-click any header):
  - Sort, rename, freeze/unfreeze
  - **Format** (numeric): number format, colour scale heatmap, highlight rules with threshold + colour picker
  - **Clean**: fill nulls, trim whitespace, change case (UPPER / lower / Title)
  - Hide or delete column (undoable)
- **Summary footer** — toggle with Σ; cycles Sum / Avg / Count; respects active filters

### Filters & Stats (⌘\\)
- Numeric range, category checkboxes, date range, text/regex filters
- **Saved filter sets** — save, reload, or delete named filter combinations
- Active filter chips in the toolbar for quick removal
- **Stats panel** — per-column cards: type, count, % missing, unique count, 16-bucket histogram, IQR outlier count, top values

### Graph view (⌘2)
- 9 chart types: Bar (horizontal/vertical), Line, Area, Stacked, Scatter, Bubble, Doughnut, Radar, Polar
- Dual Y-axis support — grouped bars or line overlay on second axis
- 4 colour palettes, grid/smooth/labels toggles, PNG export
- **Save named graph configurations** (**⌘S**) per dataset

### Dashboard (⌘5)
- All saved graphs for the active dataset in a responsive card grid
- Live chart rendering with hover PNG export per card

### Pivot Table (⌘4)
- Assign columns to **Rows**, **Columns**, and **Values** wells
- Aggregations: Sum / Avg / Count / Min / Max — switchable per field
- Grand Total row always visible
- **Export CSV** or **Open as Dataset** — materialise the pivot as a new tab

### SQL Editor (⌘3)
- Full in-browser SQL via sql.js (WebAssembly)
- Every open dataset is automatically available as a queryable table
- Cross-dataset JOINs, schema sidebar, **⌘↵** to run, open results as a new dataset

### Workspaces
- Organise datasets into named groups — collapse, expand, rename, delete
- Move any dataset to a workspace via the hover folder icon

### Settings (⌘,)
- Row height: Compact / Default / Comfortable
- Default number format applied across all numeric columns
- Chart colour palette — persists across sessions

### AI Insights *(optional)*
- Connects to a locally-running [Ollama](https://ollama.com) instance
- Generates chart suggestions from your data — fully offline, fully optional

```bash
brew install ollama
ollama pull llama3.2
# Ollama auto-starts on localhost:11434
```

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘O | Open dataset file |
| Paste | Import clipboard CSV/TSV as new dataset |
| ⌃Tab / ⌃⇧Tab | Next / previous dataset |
| ⌘1 – ⌘5 | Table / Graph / SQL / Pivot / Dashboard |
| ⌘\\ | Toggle filter panel |
| ⌘F / ⌘H | Find / Find & Replace |
| ⌘Z / ⌘⇧Z | Undo / Redo |
| ⌘↵ | Add row (table) · Run query (SQL) |
| ⌘A | Select all visible rows |
| ⌘S | Save current graph |
| ⌘E | Export CSV |
| ⌘, | Open settings |
| Esc | Close modal / cancel edit / clear selection |

---

## Data persistence

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/matrix-pro/matrix-pro.db` |
| Windows | `%APPDATA%\matrix-pro\matrix-pro.db` |
| Linux | `~/.config/matrix-pro/matrix-pro.db` |

Datasets, saved graphs, column formats, number formats, and workspace assignments are all stored locally and restored automatically on next launch.