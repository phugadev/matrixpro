# CONTEXT_FRAMEWORK.md — How to build AI context docs for any project

Two files give an AI assistant everything it needs without burning tokens on codebase exploration:

| File | Purpose | Stability | Who maintains |
|------|---------|-----------|---------------|
| `CLAUDE.md` | Behavioral contract — architecture, patterns, conventions | Stable (weeks) | You, once |
| `CODEAUDIT.md` | Knowledge snapshot — what's built, what's wired | Living (update each feature) |You, per feature |

Keep both under **300 lines total**. Longer = slower session start + higher chance Claude reads the wrong sections and hallucinates.

---

## Step 1 — CODEAUDIT.md (what's already built)

This file prevents Claude from re-implementing features or breaking existing wiring.

### Sections to write

**Feature inventory** — one line per feature with a checkbox.
Format: `- [x] Feature name — brief description of scope`
Example: `- [x] Multi-sort — Shift+click adds sort keys; priority badges ↑¹ ↓²`

> **Terminal commands to populate this section:**
> ```bash
> # List all components to jog your memory
> ls src/components/
>
> # Find keyboard shortcuts registered in App.jsx
> grep -n "key ==\|keydown\|⌘\|Cmd" src/App.jsx | head -40
>
> # Find dispatch calls to enumerate action types in use
> grep -n "dispatch({" src/**/*.jsx | grep "type:" | sort -u
> ```

**Keyboard shortcuts table** — list every shortcut + handler location.
Critical: prevents Claude from assigning `⌘S` to a new feature when it's already Save Graph.

> ```bash
> grep -n "⌘\|Ctrl\|Meta\|keydown" src/App.jsx | grep -v "//"
> ```

**AppContext action types** — paste the full list of `case` labels and their payload shapes.

> ```bash
> grep -n "case '" src/store/AppContext.jsx
> # Then read those lines in context to document the payload
> ```

**Event handler map** — list every `window`/`document` listener and what it does.
This is the most valuable section for preventing interaction conflicts (drag, keyboard, paste, drop).

> ```bash
> grep -n "addEventListener\|window\.\|document\." src/**/*.jsx
> grep -n "onDrag\|onMouse\|onClick\|onKeyDown" src/components/DataTable.jsx | head -30
> ```

---

## Step 2 — CLAUDE.md (how to work in this project)

This file prevents Claude from violating architectural patterns or making changes in the wrong place.

### Sections to write

**Project overview** — 3–5 sentences: stack, renderer, state management, persistence.
Write this yourself; no terminal command needed. Be specific about what's *not* here (e.g. "no Redux, no React Router, no backend API").

**Pre-implementation checklist** — a bullet list Claude must check before writing any code.
Template:
```
- [ ] Is the feature already in CODEAUDIT.md?
- [ ] Does a keyboard shortcut already use this key? (check CODEAUDIT shortcuts table)
- [ ] Will this add a window/document event listener? (check event handler map)
- [ ] Does this touch AppContext? Document the new action type.
- [ ] Does this mutate dataset rows? Use UPDATE_DS + db.upsertDataset()
```

**File map with line anchors** — table of key files + the line numbers for important functions.
Line anchors eliminate the need to grep for function locations in future sessions.

> ```bash
> # Find approximate line numbers for key functions
> grep -n "^function \|^const \|^export " src/App.jsx | head -40
> grep -n "case '" src/store/AppContext.jsx
> grep -n "^function \|^const " src/components/DataTable.jsx | head -30
>
> # Find where each view component is rendered
> grep -n "state.view ===" src/App.jsx
> ```

Template table row:
```
| src/App.jsx (~N ln) | Shortcuts ~L · Feature CRUD ~L · View render ~L |
```

**Core mutation pattern** — show the exact boilerplate for the most common operation (e.g. modifying a dataset). Copy the pattern from an existing feature so Claude reuses it exactly rather than inventing a variant.

> ```bash
> # Find an example of dataset mutation + persistence
> grep -n "UPDATE_DS\|upsertDataset\|PUSH_ACTION" src/App.jsx | head -10
> ```

**Adding a new view** — if your app has a tab/view switcher, write the 4-step template once:
1. Create `NewView.jsx` + `NewView.module.css`
2. Add action type to AppContext
3. Add keyboard shortcut to App.jsx
4. Add toolbar button to Toolbar.jsx
5. Add `{state.view === 'new' && <NewView />}` to render area

**Dataset / domain object shape** — paste the actual object shape with field names and types. Claude can't infer this reliably without reading every component.

> ```bash
> grep -n "cols\|data\|color\|pinnedTypes\|computedCols" src/store/AppContext.jsx | head -20
> # Or find where makeDS / createDataset is defined
> grep -rn "makeDS\|createDataset\|function.*ds" src/ | head -10
> ```

**UI conventions** — short list of rules that would otherwise get violated:
- Component file size limit (e.g. "split at 400 lines")
- CSS Modules only (no inline styles beyond `left:` positioning)
- Dark theme variable names (e.g. `--bg1`/`--bg2`, `--tx1`/`--tx2`, `--bd1`/`--bd2`, `--ac`, `--r`, `--ease`)
- z-index layers (critical for avoiding stacking bugs)
- Animation token (e.g. `animation: popIn .1s ease` for all popovers)

**After-UI-change checklist** — actions Claude must take after any visible change:
```
- [ ] Update CODEAUDIT.md feature inventory
- [ ] Update keyboard shortcuts table if a new shortcut was added
- [ ] Update event handler map if a new window/document listener was added
- [ ] Update CLAUDE.md file map line anchors if a major function moved
- [ ] Update README.md feature list + shortcuts table
```

---

## What NOT to put in these files

| Content | Why to omit | Where it lives instead |
|---------|-------------|----------------------|
| Full SQL DDL / schema | Derivable from `electron/main.cjs` | Source file |
| Full column type detection table | Derivable from `data.js` | Source file |
| Known bugs / gaps | Changes too fast, causes confusion | GitHub Issues |
| Code snippets > 10 lines | Bloats context; Claude reads source | Source file |
| Git history / who changed what | `git log` is authoritative | `git log` |
| Architecture diagrams | Not machine-readable efficiently | Separate doc if needed |

---

## Maintenance rules

1. **Update CODEAUDIT.md immediately after shipping a feature** — add the checkbox line while the feature is fresh. Don't batch.
2. **Update line anchors in CLAUDE.md when a file grows significantly** — run `grep -n "function_name" file.jsx` to get the new line.
3. **Never let either file exceed 200 lines** — if it's growing, the section is too detailed. Move detail to source comments.
4. **Review both files at the start of a new major feature** — ask Claude: "Read CLAUDE.md and CODEAUDIT.md. Confirm you understand what's already built and what patterns to follow. Then we'll start."

---

## Minimal working template (copy-paste to bootstrap)

### CLAUDE.md skeleton
```markdown
# CLAUDE.md — [Project Name]
> Behavioral contract. Read before writing any code. Update file map line anchors after big refactors.

## Stack
[1 sentence: framework, renderer, state, persistence]
[1 sentence: what's NOT here — no Redux, no backend, etc.]

## Pre-implementation checklist
- [ ] Feature already in CODEAUDIT.md?
- [ ] Keyboard shortcut conflict?
- [ ] New window/document event listener? (update event handler map)
- [ ] New AppContext action? (document it)
- [ ] Dataset mutation? Use [pattern name] pattern

## File map
| File | Key locations |
|------|--------------|
| [main file] | [function ~line · function ~line] |
| [state file] | [init ~line · action cases ~line] |
| [component] | [key hook ~line · key handler ~line] |

## Mutation pattern
[Paste the 3–5 line boilerplate for the most common operation]

## Dataset shape
\`\`\`js
{ id, name, color, cols: [], data: [], open, workspaceId, pinnedTypes: {}, computedCols: {} }
\`\`\`

## UI conventions
- [CSS approach]
- [Key CSS variables]
- [z-index layers: short list]

## After any UI change
- [ ] CODEAUDIT.md updated
- [ ] README.md updated
```

### CODEAUDIT.md skeleton
```markdown
# CODEAUDIT.md — [Project Name]
> Living document. Update after every feature. Last updated: YYYY-MM-DD

## Feature inventory
### [Domain 1]
- [x] Feature — description
- [x] Feature — description

### [Domain 2]
- [x] Feature — description

## Keyboard shortcuts
| Shortcut | Action | Handler |
|----------|--------|---------|
| ⌘X | ... | File.jsx |

## AppContext actions
\`\`\`
ACTION_TYPE  { payload shape }  — what it does
\`\`\`

## Event handler map
### Global
| Event | Location | What it does |
|-------|----------|-------------|
| window keydown | App.jsx | ... |
```
