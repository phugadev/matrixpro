# CLAUDE.md — Matrix Pro

> **Two-file context system** (reusable pattern for any project):
> - `CLAUDE.md` (this file) — *behavioral contract*: how to work here, patterns to follow, rules that don't change often.
> - `CODEAUDIT.md` — *knowledge snapshot*: what already exists, where it lives, what to avoid breaking. Update it when you add a significant feature.
> When implementing features, follow the workflow in .claude/skills/feature/SKILL.md.
> Keep CLAUDE.md stable. Grow CODEAUDIT.md as the project grows.

---

## Project overview

**Matrix Pro** — Electron desktop app for no-code data exploration.
Stack: `Vite + React 18 + Electron 29 + sql.js (WebAssembly SQLite)`.
CSS: CSS Modules with a dark theme. No Tailwind, no styled-components.
Charts: Chart.js 4. CSV: PapaParse. No Redux — single `useReducer` in AppContext.

Build: `npm run dev` (Vite + Electron) · `npm run build:mac/win/linux`
**Always run `npm run build` after changes and confirm `✓ built` before finishing.**

---

## Before implementing anything

1. **Grep for existing implementations first.** Before building feature X, run:
   ```
   Grep "X" across src/ — check components, Toolbar, AppContext actions, README
   ```
   Formula columns, pivot table, and many features are already built. Check CODEAUDIT.md feature inventory.

2. **Check keyboard shortcuts.** ⌘1–4, ⌘Z/⇧Z, ⌘F/H/E/S/O/A/↵, ⌘\, ⌃Tab are all taken. See CODEAUDIT.md.

3. **Check event handlers before adding UI interactions.** Three `window keydown` listeners exist (App, DataTable ×2). Document-level `mousedown`, `mousemove`, `mouseup`, `paste`, `dragenter/leave/over/drop` are all active. New drag/hover/keyboard handlers must not collide. See CODEAUDIT.md event map.

---

## File map

| File | Key locations |
|------|---------------|
| `src/App.jsx` (~1000 ln) | Keyboard shortcuts ~217 · Dataset CRUD ~404 · Computed col callbacks ~623 · `openPivotAsDataset` ~682 · Formula modal ~838 · View render ~732 |
| `src/store/AppContext.jsx` | `init` state ~5 · All action `case` blocks ~34–182 |
| `src/components/DataTable.jsx` (~1250 ln) | `colSnap` + column ops ~196 · Resize ~367 · Col reorder ~421 · Freeze ~451 · Cell editing state ~482 · `addRow` ~504 · Keydown handlers ~654, ~718 |
| `src/components/Toolbar.jsx` | View switcher ~301 · ColMenu `onAddComputedCol` ~380 · Filter toggle ~385 |
| `src/components/Panel.jsx` (~1100 ln) | Filter UI · Stats cards · AI Insights · Saved graphs |
| `src/components/ChartView.jsx` | 9 chart types, PNG export, panel resize |
| `src/components/SqlEditor.jsx` | Lazy-loaded. sql.js in-browser SQL, schema sidebar |
| `src/components/PivotView.jsx` | `computePivot` ~34 · `handleSort` ~176 · Config panel ~248 |
| `src/components/Sidebar.jsx` | Dataset tabs, workspace sections, context menus |
| `src/lib/data.js` | `makeDS` ~182 · `evalFormula` ~57 · `detectColType` ~112 · `fmtCell` ~29 · `specToFn` ~135 |
| `src/lib/constants.js` | `PALETTES`, `COL_TYPES` (badge labels + colours), `COL_TYPE_ORDER` |
| `electron/main.cjs` | SQLite schema + IPC handlers (`upsertDataset`, `loadDatasets`, etc.) |
| `electron/preload.cjs` | `window.MP` bridge: `db.*`, `openFile`, `saveFile`, `on` |

---

## Core patterns

### Dataset state mutation
Every change to a dataset follows this exact pattern:

```javascript
// 1. Push snapshot for undo (only if the change should be undoable)
dispatch({ type: 'PUSH_ACTION', dsId: ds.id, data: { cols: ds.cols } }) // only the keys you're changing

// 2. Update in-memory state
dispatch({ type: 'UPDATE_DS', id: ds.id, patch: { cols: newCols } })

// 3. Persist to SQLite (Electron only)
if (isElectron) window.MP.db.upsertDataset({
  id: ds.id, name: ds.name, color: ds.color,
  cols: ds.cols, rows: ds.rows,
  workspaceId: ds.workspaceId ?? null,
  pinnedTypes: ds.pinnedTypes ?? null,
  computedCols: ds.computedCols ?? null,
}).catch(() => {})
```

`filters` (predicate functions) are **never** persisted — only `filterSpecs` (plain objects) are.

### Adding a new view

Follow this exact sequence (pivot table is the reference implementation):

1. **`AppContext.jsx`** — add any new state keys to `init`; add action type to reducer; reset state in `SET_ACTIVE` if it should clear on dataset switch.
2. **`Toolbar.jsx`** — add button to the `viewSw` group; add `const isNewView = state.view === 'newview'`; hide irrelevant toolbar sections (`!isNewView && ...`).
3. **`App.jsx`** — add `⌘N` to the `keydown` handler; add `import NewView`; add `{state.view === 'newview' && <NewView ds={ds} />}` in the content area; exclude Panel if needed (`state.view !== 'newview'`).
4. **Component** — receives `ds` as prop; reads/writes context via `useApp()`; has its own CSS module.

### Adding a new modal

```javascript
// App.jsx — state
const [myModal, setMyModal] = useState(false)

// App.jsx — render
{myModal && <Modal title="..." onClose={() => setMyModal(false)} onConfirm={handleConfirm}>
  ...
</Modal>}
```

Modal closes on Escape automatically (handled inside `Modal.jsx`).

### Column operations pattern (DataTable.jsx)

All column ops: snapshot → calculate new state → dispatch UPDATE_DS. Example:

```javascript
const colSnap = () => ({ cols: ds.cols, rows: ds.rows, pinnedTypes: ds.pinnedTypes, colWidths: ds.colWidths })
dispatch({ type: 'PUSH_ACTION', dsId: ds.id, data: colSnap() })
dispatch({ type: 'UPDATE_DS', id: ds.id, patch: { cols: newCols, ... } })
```

---

## Dataset object shape

```javascript
{
  id: string,                    // uid() — never changes
  name: string,
  color: string,                 // hex, always from PALETTES[0]
  cols: string[],                // ordered column names
  rows: object[],                // [{ [colName]: value, ... }]
  open: boolean,                 // false = hidden in sidebar, still in state
  workspaceId: string | null,

  // Column metadata
  pinnedTypes:  { [col]: 'text'|'numeric'|'date'|'boolean'|'category' } | null,
  computedCols: { [col]: { formula: string } } | null,
  hiddenCols:   string[],
  pinnedCols:   number,          // # of leftmost visible cols to freeze
  colWidths:    { [col]: number },
  colFormats:   { [col]: 'scale' },  // 'scale' = colour-scale heatmap

  // Sort & filter (filters not persisted — functions)
  sorts:           { col: string, dir: 1|-1 }[],
  filters:         { [col]: Function },      // NOT in SQLite
  filterSpecs:     { [col]: object },        // serialisable, IS in SQLite
  filterLabels:    { [col]: string },
  savedFilterSets: { name: string, specs: object }[],

  // Charts
  savedGraphs: { id, title, config: { ct, xCol, yCol, y2Col, pal } }[],
}
```

---

## UI conventions

- **CSS variables** — `--bg1`–`--bg6` (backgrounds), `--tx1`/`2`/`3` (text light→dim), `--ac`/`--ac2` (indigo), `--bd1`–`--bd3` (borders). Never hardcode colours.
- **Column type colours** — always from `COL_TYPES` in `constants.js`. Don't duplicate.
- **Animations** — use existing keyframes from `global.css`: `fadeUp`, `scaleIn`, `slideUp`, `popIn` (in Toolbar.module.css).
- **Dropdown close pattern** — `document.addEventListener('mousedown', h)` in a `useEffect` with the open-state as dependency, cleaning up on unmount.
- **Monospace font** — `font-family: var(--m)` for numbers, code, formulas.
- **`isElectron`** — `const isElectron = !!window.MP` (top of App.jsx). Gate all `window.MP.*` calls behind this.

---

## After any UI change

Before calling a task done, scan for:
- **Hover conflicts** — does the new hover state collide with an existing one on the same element?
- **Drag conflicts** — does a new `draggable`/`onDragStart` interfere with the global `drop` handler (file import) or column reorder? The global drop handler checks `e.dataTransfer.files.length > 0` — preserve that guard.
- **Keyboard conflicts** — do any new `keydown` handlers shadow existing global shortcuts?
- **z-index** — sticky table columns use z-index 1–4. Dropdowns use 50–200. Modals use 300.
