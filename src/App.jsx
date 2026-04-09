import React, { useState, useCallback, useEffect, useRef, Component } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { ToastProvider, useToast } from './components/Toast'
import Sidebar    from './components/Sidebar'
import Titlebar   from './components/Titlebar'
import Toolbar    from './components/Toolbar'
import DataTable  from './components/DataTable'
import ChartView  from './components/ChartView'
import PivotView      from './components/PivotView'
import DashboardView  from './components/DashboardView'
import { lazy, Suspense } from 'react'
const SqlEditor = lazy(() => import('./components/SqlEditor'))
import Panel      from './components/Panel'
import Welcome    from './components/Welcome'
import Modal      from './components/Modal'
import NewDatasetModal from './components/NewDatasetModal'
import SettingsModal  from './components/SettingsModal'
import s          from './App.module.css'
import { makeDS, isNumericCol, evalFormula, specToFn, uid } from './lib/data'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const isElectron = !!window.MP

class SqlBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError (e) { return { err: e } }
  render () {
    if (this.state.err) return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--tx3)', fontSize: 13, padding: 32 }}>
        <span style={{ fontSize: 22 }}>⚠</span>
        <span>SQL engine failed to load</span>
        <span style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'var(--m)' }}>{this.state.err.message}</span>
        <button onClick={() => this.setState({ err: null })} style={{ marginTop: 8, padding: '5px 14px', background: 'var(--bg4)', border: '1px solid var(--bd2)', borderRadius: 'var(--r)', color: 'var(--tx2)', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      </div>
    )
    return this.props.children
  }
}

// ─── Drop overlay ─────────────────────────────────────────────────────────────
function DropOverlay ({ visible }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(99,102,241,.05)', backdropFilter: 'blur(4px)',
      border: '2px dashed rgba(99,102,241,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 10, pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 48 }}>⬇</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ac2)' }}>Drop to open</div>
      <div style={{ fontSize: 13, color: 'var(--tx2)' }}>CSV or TSV file</div>
    </div>
  )
}

// ─── Inner app (has access to context) ────────────────────────────────────────
function Inner () {
  const { state, dispatch, getDS, addSample, addTab, updateDS } = useApp()
  const toast = useToast()

  const [newModal,      setNewModal]      = useState(false)
  const [saveModal,     setSaveModal]     = useState(false)
  const [renameModal,   setRenameModal]   = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
  const [groupModal,  setGroupModal]  = useState(false)
  const [formulaModal,  setFormulaModal]  = useState(false)
  const [formulaCol,    setFormulaCol]    = useState(null)
  const [formulaName,   setFormulaName]   = useState('')
  const [formulaText,   setFormulaText]   = useState('')
  const [formulaError,  setFormulaError]  = useState('')
  const [saveName,    setSaveName]    = useState('')
  const [renameName,  setRenameName]  = useState('')
  const [groupBy,     setGroupBy]     = useState('')
  const [groupFn,     setGroupFn]     = useState('sum')
  const [graphName,   setGraphName]   = useState('Untitled graph')
  const [joinModal,   setJoinModal]   = useState(false)
  const [joinRightId, setJoinRightId] = useState('')
  const [joinKeyCol,  setJoinKeyCol]  = useState('')
  const [joinType,    setJoinType]    = useState('inner')
  const [dropping,    setDropping]    = useState(false)
  const dropCount    = useRef(0)
  const fileInputRef = useRef(null)
  const didInit      = useRef(false)
  const rowSaveTimer = useRef(null)
  const persistedIds  = useRef(new Set())   // IDs upserted to DB
  const openStates    = useRef(new Map())   // id → last-persisted open state
  const persistedWsIds = useRef(new Set())  // workspace IDs upserted to DB

  const ds = getDS()

  // ── Settings: load from localStorage on mount ──────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mp-settings') || 'null')
      if (saved) dispatch({ type: 'SET_SETTINGS', patch: saved })
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Settings: persist to localStorage on change ────────────────────────────
  useEffect(() => {
    if (!state.settings) return
    localStorage.setItem('mp-settings', JSON.stringify(state.settings))
  }, [state.settings])

  // ── Persistence: restore on mount ──────────────────────────────────────────
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    if (!isElectron) return   // web: no persistence, start with Welcome screen
    ;(async () => {
      try {
        const [saved, savedWs] = await Promise.all([
          window.MP.db.loadDatasets(),
          window.MP.db.loadWorkspaces(),
        ])
        if (!saved.length && !savedWs.length) return  // empty DB → Welcome screen
        saved.forEach(r => {
          persistedIds.current.add(r.id)
          openStates.current.set(r.id, r.open !== false)
        })
        dispatch({
          type: 'RESTORE_TABS',
          tabs: saved.map(r => ({ ...r, filters: {}, filterLabels: {}, savedGraphs: [] })),
        })
        if (savedWs.length) dispatch({ type: 'RESTORE_WORKSPACES', workspaces: savedWs })
      } catch {}  // on error → Welcome screen
    })()
  }, [])

  // ── Persist new tabs to SQLite ───────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return
    state.tabs.forEach(t => {
      if (!persistedIds.current.has(t.id)) {
        persistedIds.current.add(t.id)
        openStates.current.set(t.id, true)
        window.MP.db.upsertDataset({ id: t.id, name: t.name, color: t.color, cols: t.cols, rows: t.rows, workspaceId: t.workspaceId ?? null, pinnedTypes: t.pinnedTypes ?? null, computedCols: t.computedCols ?? null, colFormats: t.colFormats ?? null, numberFormats: t.numberFormats ?? null }).catch(() => {})
      }
    })
  }, [state.tabs])

  // ── Persist workspace assignments when tabs move between workspaces ──────────
  const wsAssignKey = state.tabs.map(t => `${t.id}:${t.workspaceId ?? ''}`).join(',')
  useEffect(() => {
    if (!isElectron) return
    state.tabs.forEach(t => {
      if (persistedIds.current.has(t.id)) {
        window.MP.db.upsertDataset({ id: t.id, name: t.name, color: t.color, cols: t.cols, rows: t.rows, workspaceId: t.workspaceId ?? null, pinnedTypes: t.pinnedTypes ?? null, computedCols: t.computedCols ?? null, colFormats: t.colFormats ?? null, numberFormats: t.numberFormats ?? null }).catch(() => {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsAssignKey])

  // ── Persist workspace create / rename / delete ───────────────────────────────
  useEffect(() => {
    if (!isElectron) return
    const currentIds = new Set(state.workspaces.map(w => w.id))
    // delete workspaces that were removed
    persistedWsIds.current.forEach(id => {
      if (!currentIds.has(id)) {
        window.MP.db.deleteWorkspace(id).catch(() => {})
        persistedWsIds.current.delete(id)
      }
    })
    // upsert new or updated workspaces
    state.workspaces.forEach((ws, i) => {
      persistedWsIds.current.add(ws.id)
      window.MP.db.upsertWorkspace({ id: ws.id, name: ws.name, sort: i }).catch(() => {})
    })
  }, [state.workspaces])

  // ── Debounced row save when cells are edited ────────────────────────────────
  useEffect(() => {
    if (!isElectron || !ds) return
    clearTimeout(rowSaveTimer.current)
    rowSaveTimer.current = setTimeout(() => {
      window.MP.db.upsertDataset({ id: ds.id, name: ds.name, color: ds.color, cols: ds.cols, rows: ds.rows, workspaceId: ds.workspaceId ?? null, pinnedTypes: ds.pinnedTypes ?? null, computedCols: ds.computedCols ?? null, colFormats: ds.colFormats ?? null, numberFormats: ds.numberFormats ?? null }).catch(() => {})
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds?.rows, ds?.pinnedTypes, ds?.computedCols])

  // ── Persist open/close state changes to SQLite ──────────────────────────────
  useEffect(() => {
    if (!isElectron) return
    state.tabs.forEach(t => {
      const openVal = t.open !== false
      if (openStates.current.has(t.id) && openStates.current.get(t.id) !== openVal) {
        openStates.current.set(t.id, openVal)
        window.MP.db.setDatasetOpen({ id: t.id, open: openVal }).catch(() => {})
      }
    })
  }, [state.tabs])

  // ── Set up axes when active dataset or view changes ─────────────────────────
  useEffect(() => {
    if (!ds) return
    const nums = ds.cols.filter(c => isNumericCol(ds, c))
    const cats = ds.cols.filter(c => !nums.includes(c))
    if (!state.axisX || !ds.cols.includes(state.axisX))
      dispatch({ type: 'SET_AXIS', which: 'X', value: cats[0] || ds.cols[0] || '' })
    if (!state.axisY || !ds.cols.includes(state.axisY))
      dispatch({ type: 'SET_AXIS', which: 'Y', value: nums[0] || ds.cols[1] || ds.cols[0] || '' })
  }, [state.activeId])

  // ── Load saved graphs from DB when switching tabs ───────────────────────────
  useEffect(() => {
    if (!ds || !isElectron) return
    ;(async () => {
      try {
        const rows = await window.MP.db.loadGraphs(ds.id)
        const mapped = rows.map(r => ({ id: r.id, title: r.title, ...r.config, at: new Date(r.ts).toLocaleTimeString() }))
        const existing = new Set((ds.savedGraphs || []).map(g => String(g.id)))
        const toAdd = mapped.filter(g => !existing.has(String(g.id)))
        if (toAdd.length) updateDS(ds.id, { savedGraphs: [...(ds.savedGraphs || []), ...toAdd] })
      } catch {}
    })()
  }, [state.activeId])

  // ── Electron menu events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) return
    window.MP.on('menu:open',        () => triggerUpload())
    window.MP.on('menu:exportCSV',   () => doExportCSV())
    window.MP.on('menu:exportPNG',   () => { /* handled via ChartView callback */ })
    window.MP.on('menu:saveGraph',   () => { if (state.view === 'graph') setSaveModal(true) })
    window.MP.on('menu:viewTable',   () => dispatch({ type: 'SET_VIEW', view: 'table' }))
    window.MP.on('menu:viewGraph',   () => dispatch({ type: 'SET_VIEW', view: 'graph' }))
    window.MP.on('menu:togglePanel', () => dispatch({ type: 'TOGGLE_PANEL' }))
  }, [state.view])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape') { setNewModal(false); setSaveModal(false); setRenameModal(false); setGroupModal(false); setSettingsModal(false) }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setSettingsModal(v => !v) }
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); dispatch({ type: 'SET_VIEW', view: 'table' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); dispatch({ type: 'SET_VIEW', view: 'graph' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); dispatch({ type: 'SET_VIEW', view: 'sql' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); dispatch({ type: 'SET_VIEW', view: 'pivot' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); dispatch({ type: 'SET_VIEW', view: 'dashboard' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); dispatch({ type: 'TOGGLE_PANEL' }) }
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && state.view === 'graph') { e.preventDefault(); openSaveModal() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') { e.preventDefault(); doExportCSV() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') { e.preventDefault(); triggerUpload() }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        const openTabs = state.tabs.filter(t => t.open !== false)
        if (openTabs.length < 2) return
        const cur  = openTabs.findIndex(t => t.id === state.activeId)
        const next = e.shiftKey
          ? (cur - 1 + openTabs.length) % openTabs.length
          : (cur + 1) % openTabs.length
        dispatch({ type: 'SET_ACTIVE', id: openTabs[next].id })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.view, state.tabs, state.activeId, ds])

  // ── Paste-to-import ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return
      const text = e.clipboardData?.getData('text')
      if (!text?.trim()) return
      const lines = text.trim().split('\n').filter(l => l.trim())
      if (lines.length < 2) return
      const settingDelim = state.settings?.csvDelimiter
      const delimiter = settingDelim && settingDelim !== 'auto' ? settingDelim : (lines[0].includes('\t') ? '\t' : ',')
      const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, delimiter, dynamicTyping: false })
      if (!res.data.length || !res.meta.fields?.length) return
      e.preventDefault()
      const newDs = makeDS('Pasted data', res.data, state.tabs.length)
      newDs.cols = res.meta.fields.filter(c => c && c.trim())
      addTab(newDs)
      if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, workspaceId: null, pinnedTypes: null, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
      toast(`Pasted ${newDs.rows.length.toLocaleString()} rows · ${newDs.cols.length} columns`, '📋')
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [state.tabs.length, addTab, toast])

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const isFileDrag = e => e.dataTransfer.types.includes('Files')
    const enter = e => { if (!isFileDrag(e)) return; dropCount.current++; setDropping(true) }
    const leave = e => { if (!isFileDrag(e)) return; dropCount.current--; if (dropCount.current <= 0) { dropCount.current = 0; setDropping(false) } }
    const over  = e => { if (isFileDrag(e)) e.preventDefault() }
    const drop  = e => {
      e.preventDefault(); dropCount.current = 0; setDropping(false)
      const f = e.dataTransfer.files[0]; if (!f) return
      const ext = f.name.split('.').pop().toLowerCase()
      const reader = new FileReader()
      if (ext === 'xlsx' || ext === 'xls') {
        reader.onload = ev => parseXlsx(ev.target.result, f.name)
        reader.readAsArrayBuffer(f)
      } else {
        reader.onload = ev => parseAndAdd(ev.target.result, f.name)
        reader.readAsText(f)
      }
    }
    document.addEventListener('dragenter',  enter)
    document.addEventListener('dragleave',  leave)
    document.addEventListener('dragover',   over)
    document.addEventListener('drop',       drop)
    return () => {
      document.removeEventListener('dragenter',  enter)
      document.removeEventListener('dragleave',  leave)
      document.removeEventListener('dragover',   over)
      document.removeEventListener('drop',       drop)
    }
  }, [])

  // ── File parse ──────────────────────────────────────────────────────────────
  const persistDs = useCallback((newDs) => {
    if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, workspaceId: null, pinnedTypes: null, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
  }, [])

  const parseAndAdd = useCallback((text, filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    const settingDelim = state.settings?.csvDelimiter
    const fileDelim = ext === 'tsv' ? '\t' : (settingDelim && settingDelim !== 'auto' ? settingDelim : ',')
    const res = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: fileDelim, dynamicTyping: false })
    if (!res.data.length) { toast('Empty or unreadable file', '⚠'); return }
    const newDs = makeDS(filename.replace(/\.[^.]+$/, ''), res.data, state.tabs.length)
    newDs.cols = (res.meta.fields || []).filter(c => c && c.trim())
    addTab(newDs)
    persistDs(newDs)
    toast(`Loaded ${newDs.rows.length.toLocaleString()} rows · ${newDs.cols.length} columns`, '📂')
  }, [state.tabs.length, addTab, toast, persistDs])

  const parseXlsx = useCallback((buffer, filename, type = 'array') => {
    try {
      const wb   = XLSX.read(buffer, { type })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) { toast('Empty or unreadable spreadsheet', '⚠'); return }
      const newDs = makeDS(filename.replace(/\.[^.]+$/, ''), rows, state.tabs.length)
      newDs.cols = Object.keys(rows[0]).map(String).filter(c => c.trim())
      addTab(newDs)
      persistDs(newDs)
      toast(`Loaded ${newDs.rows.length.toLocaleString()} rows · ${newDs.cols.length} columns`, '📊')
    } catch { toast('Could not parse spreadsheet', '⚠') }
  }, [state.tabs.length, addTab, toast, persistDs])

  const triggerUpload = useCallback(async () => {
    if (isElectron) {
      const r = await window.MP.openFile()
      if (!r) return
      if (r.binary) {
        const buf = Uint8Array.from(atob(r.buffer), c => c.charCodeAt(0)).buffer
        parseXlsx(buf, r.name)
      } else {
        parseAndAdd(r.content, r.name)
      }
    } else {
      fileInputRef.current?.click()
    }
  }, [parseAndAdd, parseXlsx])

  const handleFileInput = useCallback(e => {
    const f = e.target.files[0]; if (!f) return; e.target.value = ''
    const ext = f.name.split('.').pop().toLowerCase()
    const reader = new FileReader()
    if (ext === 'xlsx' || ext === 'xls') {
      reader.onload = ev => parseXlsx(ev.target.result, f.name)
      reader.readAsArrayBuffer(f)
    } else {
      reader.onload = ev => parseAndAdd(ev.target.result, f.name)
      reader.readAsText(f)
    }
  }, [parseAndAdd, parseXlsx])

  // ── Import from URL ──────────────────────────────────────────────────────────
  const [urlModal,   setUrlModal]   = useState(false)
  const [urlInput,   setUrlInput]   = useState('')
  const [urlLoading, setUrlLoading] = useState(false)

  const importFromUrl = useCallback(async () => {
    const url = urlInput.trim()
    if (!url) return
    setUrlLoading(true)
    try {
      let buffer, contentType = '', ok = true
      if (isElectron) {
        const r = await window.MP.fetchUrl(url)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        buffer      = r.buffer  // base64 string
        contentType = r.contentType
      } else {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        contentType = res.headers.get('content-type') || ''
        const ab = await res.arrayBuffer()
        buffer = ab
      }
      const filename = url.split('?')[0].split('/').pop() || 'url-data'
      const ext      = filename.split('.').pop().toLowerCase()
      if (ext === 'xlsx' || ext === 'xls') {
        const type = isElectron ? 'base64' : 'array'
        parseXlsx(buffer, filename, type)
      } else if (ext === 'json' || contentType.includes('json')) {
        const text = isElectron
          ? atob(buffer)
          : new TextDecoder().decode(buffer)
        const json = JSON.parse(text)
        const rows = Array.isArray(json) ? json
          : (json.data ?? json.rows ?? Object.values(json)[0])
        if (!Array.isArray(rows) || !rows.length) throw new Error('No row array found in JSON')
        const newDs = makeDS(filename.replace(/\.[^.]+$/, '') || 'URL data', rows, state.tabs.length)
        newDs.cols = Object.keys(rows[0]).map(String).filter(c => c.trim())
        addTab(newDs); persistDs(newDs)
        toast(`Loaded ${newDs.rows.length.toLocaleString()} rows · ${newDs.cols.length} columns`, '🌐')
      } else {
        const text = isElectron
          ? atob(buffer)
          : new TextDecoder().decode(buffer)
        parseAndAdd(text, filename || 'url-data.csv')
      }
      setUrlModal(false); setUrlInput('')
    } catch (err) {
      toast(`Failed: ${err.message}`, '⚠')
    } finally {
      setUrlLoading(false)
    }
  }, [urlInput, parseAndAdd, parseXlsx, addTab, persistDs, toast, state.tabs.length])

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const doExportCSV = useCallback(async () => {
    if (!ds) return
    const filters = ds.filters || {}
    const rows = Object.values(filters).reduce((acc, fn) => acc.filter(fn), ds.rows)
    const cols = ds.cols.filter(c => !(ds.hiddenCols || []).includes(c))
    const csv = cols.join(',') + '\n' + rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const name = (ds.name || 'export').replace(/\s+/g, '_') + '.csv'
    if (isElectron) {
      const ok = await window.MP.saveCSV({ defaultName: name, content: csv })
      if (ok) toast(`Exported ${rows.length.toLocaleString()} rows`, '⬇')
    } else {
      const a = document.createElement('a'); a.download = name; a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.click()
      toast(`Exported ${rows.length.toLocaleString()} rows`, '⬇')
    }
  }, [ds, toast])

  // ── Export JSON ─────────────────────────────────────────────────────────────
  const doExportJSON = useCallback(async () => {
    if (!ds) return
    const filters = ds.filters || {}
    const allRows = Object.values(filters).reduce((acc, fn) => acc.filter(fn), ds.rows)
    const cols = ds.cols.filter(c => !(ds.hiddenCols || []).includes(c))
    const rows = allRows.map(r => Object.fromEntries(cols.map(c => [c, r[c]])))
    const json = JSON.stringify(rows, null, 2)
    const name = (ds.name || 'export').replace(/\s+/g, '_') + '.json'
    if (isElectron) {
      const ok = await window.MP.saveCSV({ defaultName: name, content: json })
      if (ok) toast(`Exported ${rows.length.toLocaleString()} rows`, '⬇')
    } else {
      const a = document.createElement('a'); a.download = name; a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json); a.click()
      toast(`Exported ${rows.length.toLocaleString()} rows`, '⬇')
    }
  }, [ds, toast])

  // ── Export PNG ──────────────────────────────────────────────────────────────
  const doExportPNG = useCallback(async (dataURL, titleOverride) => {
    const name = (titleOverride || graphName || 'graph').replace(/\s+/g, '_') + '.png'
    if (isElectron) {
      await window.MP.savePNG({ defaultName: name, dataURL })
      toast('PNG exported', '⬇')
    } else {
      const a = document.createElement('a'); a.download = name; a.href = dataURL; a.click()
      toast('PNG exported', '⬇')
    }
  }, [graphName, toast])

  // ── Save graph ──────────────────────────────────────────────────────────────
  const openSaveModal = useCallback(() => {
    setSaveName('')          // always start fresh — no stale text
    setSaveModal(true)
  }, [])

  const confirmSave = useCallback(async () => {
    if (!ds) return
    const title = saveName.trim() || 'Untitled graph'
    const config = { ct: state.chartType, xCol: state.axisX, yCol: state.axisY, y2Col: state.axisY2, pal: state.palette }
    let dbId = null
    if (isElectron) {
      try { dbId = await window.MP.db.saveGraph(ds.id, title, config) } catch {}
    }
    const sg = { id: dbId || Date.now(), title, ...config, at: new Date().toLocaleTimeString() }
    updateDS(ds.id, { savedGraphs: [...(ds.savedGraphs || []), sg] })
    setGraphName(title)
    setSaveModal(false)
    toast(`"${title}" saved`, '✓')
  }, [ds, saveName, state, updateDS, toast])

  // ── Load saved graph ────────────────────────────────────────────────────────
  const loadGraph = useCallback(sg => {
    dispatch({ type: 'SET_CHART_TYPE', ct: sg.ct })
    dispatch({ type: 'SET_PALETTE', idx: sg.pal || 0 })
    dispatch({ type: 'SET_AXIS', which: 'X', value: sg.xCol })
    dispatch({ type: 'SET_AXIS', which: 'Y', value: sg.yCol })
    dispatch({ type: 'SET_AXIS', which: 'Y2', value: sg.y2Col || '' })
    setGraphName(sg.title)
    dispatch({ type: 'SET_VIEW', view: 'graph' })
    toast(`Loaded "${sg.title}"`, '📊')
  }, [dispatch, toast])

  const deleteGraph = useCallback(async id => {
    if (!ds) return
    if (isElectron) { try { await window.MP.db.deleteGraph(id) } catch {} }
    updateDS(ds.id, { savedGraphs: (ds.savedGraphs || []).filter(g => String(g.id) !== String(id)) })
    toast('Graph deleted')
  }, [ds, updateDS, toast])

  // ── Duplicate dataset ───────────────────────────────────────────────────────
  const duplicateDataset = useCallback(() => {
    if (!ds) return
    const newDs = makeDS(`${ds.name} (copy)`, ds.rows, state.tabs.length)
    newDs.cols        = [...ds.cols]
    newDs.rows        = ds.rows.map(r => ({ ...r }))
    newDs.pinnedTypes = ds.pinnedTypes ? { ...ds.pinnedTypes } : null
    newDs.workspaceId = ds.workspaceId ?? null
    addTab(newDs)
    if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, workspaceId: newDs.workspaceId, pinnedTypes: newDs.pinnedTypes ?? null, computedCols: newDs.computedCols ?? null, colFormats: newDs.colFormats ?? null, numberFormats: newDs.numberFormats ?? null }).catch(() => {})
    toast(`Duplicated "${ds.name}"`, '⎘')
  }, [ds, state.tabs.length, addTab, toast])

  // ── Change dataset colour ───────────────────────────────────────────────────
  const changeColor = useCallback((color) => {
    if (!ds) return
    updateDS(ds.id, { color })
    if (isElectron) window.MP.db.upsertDataset({ id: ds.id, name: ds.name, color, cols: ds.cols, rows: ds.rows, workspaceId: ds.workspaceId ?? null, pinnedTypes: ds.pinnedTypes ?? null, computedCols: ds.computedCols ?? null, colFormats: ds.colFormats ?? null, numberFormats: ds.numberFormats ?? null }).catch(() => {})
  }, [ds, updateDS])

  // ── Rename dataset ──────────────────────────────────────────────────────────
  const openRename = useCallback(() => {
    if (!ds) return; setRenameName(ds.name); setRenameModal(true)
  }, [ds])

  const confirmRename = useCallback(() => {
    if (!ds || !renameName.trim()) return
    updateDS(ds.id, { name: renameName.trim() })
    if (isElectron) window.MP.db.upsertDataset({ id: ds.id, name: renameName.trim(), color: ds.color, cols: ds.cols, rows: ds.rows, workspaceId: ds.workspaceId ?? null, pinnedTypes: ds.pinnedTypes ?? null, computedCols: ds.computedCols ?? null, colFormats: ds.colFormats ?? null, numberFormats: ds.numberFormats ?? null }).catch(() => {})
    setRenameModal(false)
    toast(`Renamed to "${renameName.trim()}"`, '✎')
  }, [ds, renameName, updateDS, toast])

  // ── Delete dataset ──────────────────────────────────────────────────────────
  const deleteDataset = useCallback(() => {
    if (!ds || !confirm(`Delete "${ds.name}"? This cannot be undone.`)) return
    if (isElectron) window.MP.db.deleteDataset(ds.id).catch(() => {})
    dispatch({ type: 'DELETE_TAB', id: ds.id })
    toast('Dataset deleted')
  }, [ds, dispatch, toast])

  // ── Group ──────────────────────────────────────────────────────────────────
  const openGroupModal = useCallback(() => {
    if (!ds) return
    const cats = ds.cols.filter(c => !isNumericCol(ds, c))
    if (!cats.length) { toast('No categorical columns to group by', '⚠'); return }
    setGroupBy(cats[0]); setGroupFn('sum'); setGroupModal(true)
  }, [ds, toast])

  const confirmGroup = useCallback(() => {
    if (!ds) return
    const numCols = ds.cols.filter(c => isNumericCol(ds, c))
    const groups  = [...new Set(ds.rows.map(r => r[groupBy]))]
    const newRows = groups.map(g => {
      const gr = ds.rows.filter(r => r[groupBy] === g)
      const obj = { [groupBy]: g, Count: gr.length }
      numCols.slice(0, 6).forEach(nc => {
        const ns = gr.map(r => parseFloat(r[nc]) || 0)
        const agg = {
          sum:   ns.reduce((a, b) => a + b, 0),
          avg:   ns.reduce((a, b) => a + b, 0) / ns.length,
          min:   Math.min(...ns),
          max:   Math.max(...ns),
          count: ns.length,
        }[groupFn]
        obj[`${groupFn}_${nc}`] = +agg.toFixed(2)
      })
      return obj
    })
    const newDs = makeDS(`${ds.name} (by ${groupBy})`, newRows, state.tabs.length)
    addTab(newDs)
    if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
    setGroupModal(false)
    toast(`Grouped by "${groupBy}" — ${groupFn}`, '⬡')
  }, [ds, groupBy, groupFn, state.tabs.length, addTab, toast])

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const addFilter = useCallback((col, filterFn, label, spec = null) => {
    if (!ds) return
    const newFilters = { ...ds.filters, [col]: filterFn }
    const newLabels  = { ...(ds.filterLabels || {}), [col]: label }
    const newSpecs   = { ...(ds.filterSpecs  || {}), [col]: spec }
    updateDS(ds.id, { filters: newFilters, filterLabels: newLabels, filterSpecs: newSpecs })
    toast(`Filter: ${col} ${label}`, '⚡')
  }, [ds, updateDS, toast])

  const removeFilter = useCallback((col) => {
    if (!ds) return
    const { [col]: _,   ...rest  } = ds.filters
    const { [col]: __,  ...rest2 } = ds.filterLabels || {}
    const { [col]: ___, ...rest3 } = ds.filterSpecs  || {}
    updateDS(ds.id, { filters: rest, filterLabels: rest2, filterSpecs: rest3 })
    toast(`Removed filter on "${col}"`)
  }, [ds, updateDS, toast])

  const clearAllFilters = useCallback(() => {
    if (!ds) return
    updateDS(ds.id, { filters: {}, filterLabels: {}, filterSpecs: {} })
    toast('All filters cleared')
  }, [ds, updateDS, toast])

  const saveCurrentFilters = useCallback((name) => {
    if (!ds) return
    const newSet = {
      id:           uid(),
      name,
      specs:        { ...(ds.filterSpecs  || {}) },
      filterLabels: { ...(ds.filterLabels || {}) },
    }
    updateDS(ds.id, { savedFilterSets: [...(ds.savedFilterSets || []), newSet] })
    toast(`Saved filter set "${name}"`, '✓')
  }, [ds, updateDS, toast])

  const loadFilterSet = useCallback((filterSet) => {
    if (!ds) return
    const newFilters = {}
    const newLabels  = {}
    const newSpecs   = {}
    Object.entries(filterSet.specs || {}).forEach(([col, spec]) => {
      if (!spec || !ds.cols.includes(col)) return
      try {
        newFilters[col] = specToFn(col, spec)
        newLabels[col]  = filterSet.filterLabels?.[col] || col
        newSpecs[col]   = spec
      } catch {}
    })
    updateDS(ds.id, { filters: newFilters, filterLabels: newLabels, filterSpecs: newSpecs })
    toast(`Loaded "${filterSet.name}"`, '⚡')
  }, [ds, updateDS, toast])

  const deleteFilterSet = useCallback((id) => {
    if (!ds) return
    updateDS(ds.id, { savedFilterSets: (ds.savedFilterSets || []).filter(s => s.id !== id) })
  }, [ds, updateDS])

  // ── Cross-dataset join ────────────────────────────────────────────────────────
  const openJoinModal = useCallback(() => {
    setJoinRightId(''); setJoinKeyCol(''); setJoinType('inner')
    setJoinModal(true)
  }, [])

  const doJoin = useCallback(() => {
    if (!ds || !joinRightId || !joinKeyCol) return
    const right = state.tabs.find(t => t.id === joinRightId)
    if (!right) return

    // right columns, renaming any that clash with left (except the key)
    const rightOnlyCols = right.cols.filter(c => c !== joinKeyCol)
    const rightColNames = rightOnlyCols.map(c => ds.cols.includes(c) ? `${right.name}.${c}` : c)

    // build right-side index
    const rightIdx = new Map()
    right.rows.forEach(r => {
      const k = String(r[joinKeyCol] ?? '')
      if (!rightIdx.has(k)) rightIdx.set(k, [])
      rightIdx.get(k).push(r)
    })

    let newRows = []

    if (joinType === 'inner' || joinType === 'left') {
      ds.rows.forEach(lRow => {
        const k = String(lRow[joinKeyCol] ?? '')
        const matches = rightIdx.get(k) || []
        if (matches.length) {
          matches.forEach(rRow => {
            const merged = { ...lRow }
            rightOnlyCols.forEach((rc, i) => { merged[rightColNames[i]] = rRow[rc] })
            newRows.push(merged)
          })
        } else if (joinType === 'left') {
          const merged = { ...lRow }
          rightColNames.forEach(rc => { merged[rc] = null })
          newRows.push(merged)
        }
      })
    } else {
      // right join — build left index
      const leftIdx = new Map()
      ds.rows.forEach(r => {
        const k = String(r[joinKeyCol] ?? '')
        if (!leftIdx.has(k)) leftIdx.set(k, [])
        leftIdx.get(k).push(r)
      })
      right.rows.forEach(rRow => {
        const k = String(rRow[joinKeyCol] ?? '')
        const matches = leftIdx.get(k) || []
        if (matches.length) {
          matches.forEach(lRow => {
            const merged = { ...lRow }
            rightOnlyCols.forEach((rc, i) => { merged[rightColNames[i]] = rRow[rc] })
            newRows.push(merged)
          })
        } else {
          const merged = { [joinKeyCol]: rRow[joinKeyCol] }
          ds.cols.filter(c => c !== joinKeyCol).forEach(c => { merged[c] = null })
          rightOnlyCols.forEach((rc, i) => { merged[rightColNames[i]] = rRow[rc] })
          newRows.push(merged)
        }
      })
    }

    const allCols = [...ds.cols, ...rightColNames]
    const name    = `${ds.name} ⋈ ${right.name}`
    const resultDs = makeDS(name, newRows, state.tabs.length)
    resultDs.cols  = allCols
    // fix rows to have all cols
    resultDs.rows  = newRows.map(r => {
      const out = {}
      allCols.forEach(c => { out[c] = c in r ? r[c] : null })
      return out
    })
    addTab(resultDs)
    if (isElectron) window.MP.db.upsertDataset({ id: resultDs.id, name: resultDs.name, color: resultDs.color, cols: resultDs.cols, rows: resultDs.rows, workspaceId: null, pinnedTypes: null, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
    toast(`Joined — ${newRows.length} rows`, '⋈')
    setJoinModal(false)
  }, [ds, state.tabs, joinRightId, joinKeyCol, joinType, addTab, toast])

  // ── Computed columns ─────────────────────────────────────────────────────────
  const openAddComputedCol = useCallback(() => {
    if (!ds) return
    setFormulaCol(null); setFormulaName(''); setFormulaText(''); setFormulaError('')
    setFormulaModal(true)
  }, [ds])

  const openEditComputedCol = useCallback((col) => {
    if (!ds) return
    setFormulaCol(col)
    setFormulaName(col)
    setFormulaText(ds.computedCols?.[col]?.formula || '')
    setFormulaError('')
    setFormulaModal(true)
  }, [ds])

  const confirmFormula = useCallback(() => {
    if (!ds) return
    const n = formulaName.trim()
    const f = formulaText.trim()
    if (!n) { setFormulaError('Column name is required'); return }
    if (!f) { setFormulaError('Formula is required'); return }
    if (!formulaCol && ds.cols.includes(n)) { setFormulaError(`"${n}" already exists`); return }
    if (formulaCol && n !== formulaCol && ds.cols.includes(n)) { setFormulaError(`"${n}" already exists`); return }

    const cc = { ...(ds.computedCols || {}) }
    let newCols      = [...ds.cols]
    let newHidden    = [...(ds.hiddenCols || [])]
    let newColWidths = { ...(ds.colWidths || {}) }

    if (formulaCol) {
      delete cc[formulaCol]
      cc[n] = { formula: f }
      newCols      = newCols.map(c => c === formulaCol ? n : c)
      newHidden    = newHidden.map(c => c === formulaCol ? n : c)
      if (formulaCol in newColWidths) { newColWidths[n] = newColWidths[formulaCol]; delete newColWidths[formulaCol] }
    } else {
      cc[n] = { formula: f }
      newCols = [...newCols, n]
    }

    updateDS(ds.id, { computedCols: cc, cols: newCols, hiddenCols: newHidden, colWidths: newColWidths })
    setFormulaModal(false)
    toast(formulaCol ? `Updated "${n}"` : `Added computed column "${n}"`)
  }, [ds, formulaCol, formulaName, formulaText, updateDS, toast])

  const deleteComputedCol = useCallback(() => {
    if (!ds || !formulaCol) return
    const { [formulaCol]: _, ...cc } = (ds.computedCols || {})
    const newCols      = ds.cols.filter(c => c !== formulaCol)
    const newHidden    = (ds.hiddenCols || []).filter(c => c !== formulaCol)
    const { [formulaCol]: __, ...newColWidths } = (ds.colWidths || {})
    updateDS(ds.id, { computedCols: cc, cols: newCols, hiddenCols: newHidden, colWidths: newColWidths })
    setFormulaModal(false)
    toast(`Deleted "${formulaCol}"`)
  }, [ds, formulaCol, updateDS, toast])

  // ── Open pivot result as a new dataset ──────────────────────────────────────
  const openPivotAsDataset = useCallback((rows) => {
    if (!ds || !rows.length) return
    const name = `${ds.name} (Pivot)`
    const newDs = makeDS(name, rows, state.tabs.length)
    addTab(newDs)
    if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, workspaceId: null, pinnedTypes: null, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
    dispatch({ type: 'SET_VIEW', view: 'table' })
    toast(`Opened as "${name}"`, '✓')
  }, [ds, state.tabs.length, addTab, dispatch, toast])

  // ── Create blank dataset from scratch ───────────────────────────────────────
  // cols is [{ name: string, type: string }]
  const createScratch = useCallback((name, cols) => {
    const newDs = makeDS(name, [], state.tabs.length)
    newDs.cols        = cols.map(c => c.name)
    newDs.rows        = []
    newDs.pinnedTypes = Object.fromEntries(cols.map(c => [c.name, c.type]))
    addTab(newDs)
    if (isElectron) window.MP.db.upsertDataset({ id: newDs.id, name: newDs.name, color: newDs.color, cols: newDs.cols, rows: newDs.rows, workspaceId: null, pinnedTypes: newDs.pinnedTypes ?? null, computedCols: null, colFormats: null, numberFormats: null }).catch(() => {})
    toast(`Created "${name}"`, '✓')
  }, [state.tabs.length, addTab, toast])

  return (
    <div className={s.app}>
      <DropOverlay visible={dropping} />

      <Sidebar onUpload={triggerUpload} />

      <div className={s.main}>
        <Titlebar onNew={() => setNewModal(true)} />

        {ds ? (
          <>
            <Toolbar
              ds={ds}
              onRename={openRename}
              onDelete={deleteDataset}
              onDuplicate={duplicateDataset}
              onColorChange={changeColor}
              onSaveGraph={openSaveModal}
              onExportCSV={doExportCSV}
              onExportJSON={doExportJSON}
              onGroup={openGroupModal}
              onJoin={openJoinModal}
              onClearFilters={clearAllFilters}
              onAddComputedCol={openAddComputedCol}
            />

            <div className={s.content}>
              <div className={s.center}>
                {state.view === 'table'     && <DataTable ds={ds} onAddComputedCol={openAddComputedCol} onEditComputedCol={openEditComputedCol} />}
                {state.view === 'pivot'     && <PivotView ds={ds} onOpenAsDataset={openPivotAsDataset} />}
                {state.view === 'dashboard' && <DashboardView ds={ds} onExportPNG={(dataURL, title) => doExportPNG(dataURL, title)} />}
                {state.view === 'graph' && (
                  <ChartView
                    ds={ds}
                    graphName={graphName}
                    onGraphNameChange={setGraphName}
                    onExportPNG={doExportPNG}
                  />
                )}
                {state.view === 'sql' && (
                  <SqlBoundary>
                    <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 13 }}>Loading SQL engine…</div>}>
                      <SqlEditor />
                    </Suspense>
                  </SqlBoundary>
                )}
              </div>
              {state.view !== 'sql' && state.view !== 'pivot' && state.view !== 'dashboard' && (
                <Panel
                  ds={ds}
                  onFilterAdd={addFilter}
                  onFilterRemove={removeFilter}
                  onFilterClear={clearAllFilters}
                  onSaveFilterSet={saveCurrentFilters}
                  onLoadFilterSet={loadFilterSet}
                  onDeleteFilterSet={deleteFilterSet}
                  onLoadGraph={loadGraph}
                  onDeleteGraph={deleteGraph}
                />
              )}
            </div>
          </>
        ) : (
          <Welcome onSample={addSample} onUpload={triggerUpload} onScratch={() => setNewModal(true)} />
        )}
      </div>

      {/* Hidden file input (web fallback) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* New dataset modal */}
      {newModal && (
        <NewDatasetModal
          onClose={() => setNewModal(false)}
          onSample={key => { addSample(key); setNewModal(false) }}
          onUpload={() => { setNewModal(false); triggerUpload() }}
          onImportUrl={() => { setNewModal(false); setUrlInput(''); setUrlModal(true) }}
          onCreate={(name, cols) => { createScratch(name, cols); setNewModal(false) }}
        />
      )}

      {/* Import from URL modal */}
      {urlModal && (
        <Modal
          title="Import from URL"
          subtitle="Paste a public link to a CSV, TSV, JSON, or XLSX file."
          onClose={() => { setUrlModal(false); setUrlInput('') }}
          onConfirm={importFromUrl}
          confirmLabel={urlLoading ? 'Loading…' : 'Import'}
        >
          <input
            className={s.input}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !urlLoading && importFromUrl()}
            placeholder="https://example.com/data.csv"
            autoFocus
            disabled={urlLoading}
          />
        </Modal>
      )}

      {/* Settings modal */}
      {settingsModal && (
        <SettingsModal onClose={() => setSettingsModal(false)} />
      )}

      {/* Save graph modal */}
      {saveModal && (
        <Modal
          title="Save graph"
          subtitle="Give this graph a name to keep it with your dataset."
          onClose={() => setSaveModal(false)}
          onConfirm={confirmSave}
          confirmLabel="Save graph"
        >
          <input
            className={s.input}
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmSave()}
            placeholder="e.g. Revenue by Region — Q3"
            autoFocus
          />
        </Modal>
      )}

      {/* Rename modal */}
      {renameModal && (
        <Modal
          title="Rename dataset"
          onClose={() => setRenameModal(false)}
          onConfirm={confirmRename}
          confirmLabel="Rename"
        >
          <input
            className={s.input}
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmRename()}
            placeholder="Dataset name"
            autoFocus
          />
        </Modal>
      )}

      {/* Group modal */}
      {groupModal && ds && (
        <Modal
          title="Group dataset"
          subtitle="Aggregate rows by a category. A new dataset tab will be created."
          onClose={() => setGroupModal(false)}
          onConfirm={confirmGroup}
          confirmLabel="Create grouped dataset"
        >
          <label className={s.mLabel}>Group by (category column)</label>
          <select className={s.mSelect} value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            {ds.cols.filter(c => !isNumericCol(ds, c)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className={s.mLabel}>Aggregation function</label>
          <select className={s.mSelect} value={groupFn} onChange={e => setGroupFn(e.target.value)}>
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
            <option value="count">Count only</option>
          </select>
        </Modal>
      )}

      {/* Formula modal — add / edit computed column */}
      {formulaModal && ds && (
        <Modal
          title={formulaCol ? 'Edit computed column' : 'Add computed column'}
          subtitle={!formulaCol ? 'Define a formula using column names as variables.' : undefined}
          onClose={() => setFormulaModal(false)}
          onConfirm={confirmFormula}
          confirmLabel={formulaCol ? 'Save changes' : 'Add column'}
        >
          <label className={s.mLabel}>Column name</label>
          <input
            className={s.input}
            value={formulaName}
            onChange={e => { setFormulaName(e.target.value); setFormulaError('') }}
            placeholder="e.g. Profit Margin"
            autoFocus
          />
          <label className={s.mLabel}>Formula</label>
          <input
            className={s.input}
            value={formulaText}
            onChange={e => { setFormulaText(e.target.value); setFormulaError('') }}
            onKeyDown={e => e.key === 'Enter' && confirmFormula()}
            placeholder="e.g. Revenue - Cost"
            style={{ fontFamily: 'var(--m)' }}
          />
          {/* Column name chips — click to insert safe identifier */}
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {ds.cols.filter(c => !ds.computedCols?.[c]).map(c => {
              const safe = c.replace(/[^a-zA-Z0-9_$]/g, '_')
              return (
                <button
                  key={c}
                  style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg5)', border: '1px solid var(--bd2)', borderRadius: 4, color: 'var(--tx2)', cursor: 'pointer', fontFamily: 'var(--m)' }}
                  onClick={() => setFormulaText(prev => prev ? `${prev} + ${safe}` : safe)}
                  title={safe !== c ? `"${c}" — insert as ${safe}` : 'Insert column name'}
                >{safe}</button>
              )
            })}
          </div>
          {/* Live preview */}
          {formulaText.trim() && ds.rows.length > 0 && (
            <div style={{ marginTop: 8, background: 'var(--bg4)', border: '1px solid var(--bd1)', borderRadius: 6, padding: '7px 10px', fontSize: 11, fontFamily: 'var(--m)', color: 'var(--tx2)' }}>
              <div style={{ color: 'var(--tx3)', marginBottom: 4, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>Preview</div>
              {ds.rows.slice(0, 5).map((row, i) => {
                const val   = evalFormula(formulaText.trim(), row)
                const isErr = val === ''
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, lineHeight: 1.9 }}>
                    <span style={{ color: 'var(--tx3)', minWidth: 36 }}>row {i + 1}</span>
                    <span style={{ color: isErr ? '#f43f5e' : 'var(--tx1)' }}>{isErr ? 'error' : String(val)}</span>
                  </div>
                )
              })}
            </div>
          )}
          {formulaError && (
            <div style={{ marginTop: 8, color: '#f43f5e', fontSize: 11 }}>{formulaError}</div>
          )}
          {formulaCol && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bd1)' }}>
              <button
                onClick={deleteComputedCol}
                style={{ background: 'none', border: '1px solid rgba(244,63,94,.35)', borderRadius: 5, color: '#f43f5e', fontSize: 11, cursor: 'pointer', padding: '5px 10px' }}
              >Delete column</button>
            </div>
          )}
        </Modal>
      )}

      {/* Join datasets modal */}
      {joinModal && ds && (() => {
        const otherDs   = state.tabs.filter(t => t.open && t.id !== ds.id)
        const rightDs   = otherDs.find(t => t.id === joinRightId)
        const sharedCols = rightDs
          ? ds.cols.filter(c => rightDs.cols.includes(c))
          : []
        const JOIN_TYPES = [
          { id: 'inner', label: 'Inner', desc: 'Matching rows only' },
          { id: 'left',  label: 'Left',  desc: 'All left + matching right' },
          { id: 'right', label: 'Right', desc: 'All right + matching left' },
        ]
        return (
          <Modal
            title="Join datasets"
            subtitle="Merge two datasets on a shared key column. Creates a new dataset tab."
            onClose={() => setJoinModal(false)}
            onConfirm={doJoin}
            confirmLabel="Join"
          >
            <label className={s.mLabel}>Right dataset</label>
            <select
              className={s.mSelect}
              value={joinRightId}
              onChange={e => { setJoinRightId(e.target.value); setJoinKeyCol('') }}
            >
              <option value="">Select dataset…</option>
              {otherDs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            {joinRightId && (
              <>
                <label className={s.mLabel}>Key column (shared)</label>
                {sharedCols.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#fda4af', marginBottom: 6 }}>
                    No shared columns between these datasets.
                  </div>
                ) : (
                  <select
                    className={s.mSelect}
                    value={joinKeyCol}
                    onChange={e => setJoinKeyCol(e.target.value)}
                  >
                    <option value="">Select key…</option>
                    {sharedCols.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
              </>
            )}

            <label className={s.mLabel}>Join type</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {JOIN_TYPES.map(jt => (
                <button
                  key={jt.id}
                  onClick={() => setJoinType(jt.id)}
                  style={{
                    flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--f)',
                    background: joinType === jt.id ? 'var(--ac-lo)' : 'var(--bg3)',
                    border: `1px solid ${joinType === jt.id ? 'var(--ac)' : 'var(--bd2)'}`,
                    color: joinType === jt.id ? 'var(--ac2)' : 'var(--tx2)',
                    cursor: 'pointer', textAlign: 'center', lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{jt.label}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.8 }}>{jt.desc}</div>
                </button>
              ))}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}

export default function App () {
  return (
    <AppProvider>
      <ToastProvider>
        <Inner />
      </ToastProvider>
    </AppProvider>
  )
}
