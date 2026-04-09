import React, { createContext, useContext, useReducer, useCallback } from 'react'
import { makeDS, genHousing, genWorld, genSales, genStocks, uid } from '../lib/data'

// ─── Initial state ────────────────────────────────────────────────────────────
const init = {
  tabs:       [],        // dataset objects
  workspaces: [],        // { id, name }[]
  actionHistory: {},     // { [dsId]: snapshot[] } — unified undo stack, max 50
  redoHistory:   {},     // { [dsId]: snapshot[] } — redo stack, cleared on new action
  activeId:   null,      // active tab id
  view:       'table',   // 'table' | 'graph' | 'sql'
  panelOpen:  false,
  panelTab:   'graph',   // 'filters' | 'stats' | 'graph' | 'saved'
  chartType:      'bar',
  barOrientation: 'vertical',
  palette:    0,
  axisX:      '',
  axisY:      '',
  axisY2:     '',
  axisSz:     '',
  showLabels: false,
  showGrid:   true,
  smoothCurves: true,
  aggFn:      'sum',
  pivotRowFields:   [],
  pivotColField:    '',
  pivotValueFields: [],
  settings: { rowHeight: 32, defaultNumFmt: null, ollamaModel: 'llama3.2:latest', dateFormat: 'medium', csvDelimiter: 'auto' },
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
function reducer (state, action) {
  switch (action.type) {

    case 'ADD_TAB': {
      const ds = { ...action.ds, open: true, workspaceId: action.ds.workspaceId ?? null }
      return {
        ...state,
        tabs:     [...state.tabs, ds],
        activeId: ds.id,
      }
    }

    case 'ADD_WORKSPACE': {
      const ws = { id: uid(), name: action.name.trim() }
      return { ...state, workspaces: [...state.workspaces, ws] }
    }

    case 'RENAME_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map(w =>
          w.id === action.id ? { ...w, name: action.name.trim() } : w
        ),
      }

    case 'DELETE_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.filter(w => w.id !== action.id),
        tabs: state.tabs.map(t =>
          t.workspaceId === action.id ? { ...t, workspaceId: null } : t
        ),
      }

    case 'SET_TAB_WORKSPACE':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.tabId ? { ...t, workspaceId: action.workspaceId } : t
        ),
      }

    case 'CLOSE_TAB': {
      const tabs = state.tabs.map(t => t.id === action.id ? { ...t, open: false } : t)
      const activeId = state.activeId === action.id
        ? (tabs.find(t => t.open && t.id !== action.id)?.id ?? null)
        : state.activeId
      return { ...state, tabs, activeId }
    }

    case 'DELETE_TAB': {
      const tabs = state.tabs.filter(t => t.id !== action.id)
      const activeId = state.activeId === action.id
        ? (tabs.find(t => t.open)?.id ?? null)
        : state.activeId
      return { ...state, tabs, activeId }
    }

    case 'SET_ACTIVE':
      return {
        ...state,
        activeId: action.id,
        view: 'table',
        tabs: state.tabs.map(t => t.id === action.id ? { ...t, open: true } : t),
        pivotRowFields:   [],
        pivotColField:    '',
        pivotValueFields: [],
      }

    case 'UPDATE_DS': {
      // merge partial DS fields
      return {
        ...state,
        tabs: state.tabs.map(t => t.id === action.id ? { ...t, ...action.patch } : t),
      }
    }

    case 'SET_VIEW':
      return { ...state, view: action.view }

    case 'TOGGLE_PANEL':
      return { ...state, panelOpen: !state.panelOpen }

    case 'SET_PANEL_TAB':
      return { ...state, panelTab: action.tab }

    case 'SET_CHART_TYPE':
      return { ...state, chartType: action.ct }

    case 'SET_PALETTE':
      return { ...state, palette: action.idx }

    case 'SET_AXIS':
      return { ...state, [`axis${action.which}`]: action.value }

    case 'SET_TOGGLE':
      return { ...state, [action.key]: action.value }

    case 'SET_AGG':
      return { ...state, aggFn: action.fn }

    case 'SET_PIVOT':
      return { ...state, pivotRowFields: action.rowFields, pivotColField: action.colField, pivotValueFields: action.valueFields }

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'RESTORE_TABS': {
      const openTab = [...action.tabs].reverse().find(t => t.open !== false)
      return {
        ...state,
        tabs:     action.tabs,
        activeId: openTab?.id ?? null,
      }
    }

    case 'RESTORE_WORKSPACES':
      return { ...state, workspaces: action.workspaces }

    // data is a plain object (e.g. { rows } or { cols, pinnedCols, … })
    case 'PUSH_ACTION': {
      const prev   = state.actionHistory[action.dsId] || []
      const capped = prev.length >= 50 ? prev.slice(1) : prev
      return {
        ...state,
        actionHistory: { ...state.actionHistory, [action.dsId]: [...capped, action.data] },
        redoHistory:   { ...state.redoHistory,   [action.dsId]: [] },  // new action clears redo
      }
    }

    case 'UNDO_ACTION': {
      const stack = state.actionHistory[action.dsId] || []
      if (!stack.length) return state
      const tab      = state.tabs.find(t => t.id === action.dsId)
      // capture current state snapshot for redo (same keys as what we're restoring)
      const snap     = stack[stack.length - 1]
      const current  = tab ? Object.fromEntries(Object.keys(snap).map(k => [k, tab[k]])) : {}
      const rStack   = state.redoHistory[action.dsId] || []
      return {
        ...state,
        tabs:          state.tabs.map(t => t.id === action.dsId ? { ...t, ...snap } : t),
        actionHistory: { ...state.actionHistory, [action.dsId]: stack.slice(0, -1) },
        redoHistory:   { ...state.redoHistory,   [action.dsId]: [...rStack, current] },
      }
    }

    case 'REDO_ACTION': {
      const rStack = state.redoHistory[action.dsId] || []
      if (!rStack.length) return state
      const snap    = rStack[rStack.length - 1]
      const tab     = state.tabs.find(t => t.id === action.dsId)
      const current = tab ? Object.fromEntries(Object.keys(snap).map(k => [k, tab[k]])) : {}
      const uStack  = state.actionHistory[action.dsId] || []
      return {
        ...state,
        tabs:          state.tabs.map(t => t.id === action.dsId ? { ...t, ...snap } : t),
        redoHistory:   { ...state.redoHistory,   [action.dsId]: rStack.slice(0, -1) },
        actionHistory: { ...state.actionHistory, [action.dsId]: [...uStack, current] },
      }
    }

    default:
      return state
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
const Ctx = createContext(null)

export function AppProvider ({ children }) {
  const [state, dispatch] = useReducer(reducer, init)

  const getDS = useCallback(
    () => state.tabs.find(t => t.id === state.activeId) || null,
    [state.tabs, state.activeId]
  )

  const addSample = useCallback((key) => {
    const generators = {
      housing: () => makeDS('CA Housing',       genHousing(), state.tabs.length),
      world:   () => makeDS('World Population', genWorld(),   state.tabs.length),
      sales:   () => makeDS("Sales '23",        genSales(),   state.tabs.length),
      stocks:  () => makeDS('Tech Stocks',      genStocks(),  state.tabs.length),
    }
    const ds = generators[key]?.()
    if (ds) dispatch({ type: 'ADD_TAB', ds })
    return ds
  }, [state.tabs.length])

  const addTab = useCallback((ds) => {
    dispatch({ type: 'ADD_TAB', ds })
  }, [])

  const updateDS = useCallback((id, patch) => {
    dispatch({ type: 'UPDATE_DS', id, patch })
  }, [])

  return (
    <Ctx.Provider value={{ state, dispatch, getDS, addSample, addTab, updateDS }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
