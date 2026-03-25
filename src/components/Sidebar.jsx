import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../store/AppContext'
import s from './Sidebar.module.css'

// ── Shared fixed-position menu shell ─────────────────────────────────────────
// Renders into document.body so sidebar overflow:hidden never clips it.
function FixedMenu ({ pos, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const id = setTimeout(() => {
      const handler = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, 0)
    return () => clearTimeout(id)
  }, [onClose])

  return createPortal(
    <div ref={ref} className={s.fixedMenu} style={{ top: pos.top, left: pos.left }}>
      {children}
    </div>,
    document.body
  )
}

// ── Workspace ⋯ context menu ──────────────────────────────────────────────────
function WsContextMenu ({ pos, ws, onClose, onStartRename }) {
  const { dispatch } = useApp()

  const doDelete = () => {
    onClose()
    if (window.confirm(`Delete workspace "${ws.name}"? Datasets will move to Uncategorized.`))
      dispatch({ type: 'DELETE_WORKSPACE', id: ws.id })
  }

  return (
    <FixedMenu pos={pos} onClose={onClose}>
      <button className={s.menuItem} onClick={() => { onClose(); onStartRename() }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
        </svg>
        Rename
      </button>
      <div className={s.menuDivider} />
      <button className={[s.menuItem, s.menuItemDanger].join(' ')} onClick={doDelete}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 10a1 1 0 001 1h6a1 1 0 001-1l1-10"/>
        </svg>
        Delete workspace
      </button>
    </FixedMenu>
  )
}

// ── Move-to-workspace picker ──────────────────────────────────────────────────
function MovePicker ({ pos, tab, workspaces, onClose }) {
  const { dispatch } = useApp()

  const move = wsId => {
    dispatch({ type: 'SET_TAB_WORKSPACE', tabId: tab.id, workspaceId: wsId })
    onClose()
  }

  return (
    <FixedMenu pos={pos} onClose={onClose}>
      <div className={s.menuHd}>Move to workspace</div>
      {workspaces.map(ws => (
        <button key={ws.id} className={s.menuItem} onClick={() => move(ws.id)}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
          </svg>
          {ws.name}
          {(tab.workspaceId ?? null) === ws.id && (
            <svg className={s.menuCheck} width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 8l4 4 6-6"/>
            </svg>
          )}
        </button>
      ))}
      {(tab.workspaceId ?? null) !== null && (
        <>
          <div className={s.menuDivider} />
          <button className={s.menuItem} onClick={() => move(null)}>Remove from workspace</button>
        </>
      )}
    </FixedMenu>
  )
}

// ── Single dataset row ────────────────────────────────────────────────────────
function DsItem ({ tab, workspaces, showMove }) {
  const { state, dispatch } = useApp()
  const isActive = tab.id === state.activeId
  const isClosed = !tab.open
  const [picker, setPicker] = useState(null)
  const moveRef  = useRef(null)

  const openPicker = e => {
    e.stopPropagation()
    const r = moveRef.current.getBoundingClientRect()
    setPicker({ top: r.bottom + 4, left: Math.max(8, r.right - 164) })
  }

  return (
    <div
      className={[s.item, isActive && s.active, isClosed && s.closed].filter(Boolean).join(' ')}
      onClick={() => dispatch({ type: 'SET_ACTIVE', id: tab.id })}
      title={isClosed ? `Click to reopen ${tab.name}` : tab.name}
    >
      <span className={s.dot} style={{ background: tab.color, opacity: isClosed ? 0.4 : 1 }} />
      <span className={s.name}>{tab.name}</span>
      <span className={s.rowCount}>{tab.rows.length.toLocaleString()}</span>

      {showMove && workspaces.length > 0 && (
        <button ref={moveRef} className={s.moveBtn} onClick={openPicker} title="Move to workspace">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
          </svg>
        </button>
      )}

      {isClosed ? (
        <span className={s.reopenIco} title="Closed — click to reopen">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
          </svg>
        </span>
      ) : (
        <span className={s.rm} onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', id: tab.id }) }} title="Close">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
          </svg>
        </span>
      )}

      {picker && (
        <MovePicker pos={picker} tab={tab} workspaces={workspaces} onClose={() => setPicker(null)} />
      )}
    </div>
  )
}

// ── Workspace section ─────────────────────────────────────────────────────────
function WsSection ({ ws, tabs, workspaces }) {
  const { dispatch } = useApp()
  const [collapsed,  setCollapsed]  = useState(false)
  const [ctxMenu,    setCtxMenu]    = useState(null)
  const [renaming,   setRenaming]   = useState(false)
  const [reName,     setReName]     = useState(ws.name)
  const moreRef   = useRef(null)
  const renameRef = useRef(null)

  // Keep reName in sync if workspace is renamed externally
  useEffect(() => { if (!renaming) setReName(ws.name) }, [ws.name, renaming])

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  const commitRename = () => {
    const n = reName.trim()
    if (n && n !== ws.name) dispatch({ type: 'RENAME_WORKSPACE', id: ws.id, name: n })
    else setReName(ws.name)
    setRenaming(false)
  }

  const openMenu = e => {
    e.stopPropagation()
    const r = moreRef.current.getBoundingClientRect()
    setCtxMenu({ top: r.bottom + 4, left: Math.max(8, r.right - 148) })
  }

  return (
    <div className={s.wsSection}>
      <div className={s.wsHeader} onClick={() => !renaming && setCollapsed(c => !c)}>
        <svg
          className={[s.wsChev, collapsed ? s.wsChevCollapsed : ''].filter(Boolean).join(' ')}
          width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path d="M4 6l4 4 4-4"/>
        </svg>

        {renaming ? (
          <input
            ref={renameRef}
            className={s.wsRenameInput}
            value={reName}
            onChange={e => setReName(e.target.value)}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setReName(ws.name); setRenaming(false) }
            }}
            onBlur={commitRename}
          />
        ) : (
          <span className={s.wsLabel}>{ws.name}</span>
        )}

        {!renaming && (
          <>
            <span className={s.wsCount}>{tabs.length}</span>
            <button ref={moreRef} className={s.wsMore} onClick={openMenu} title="Workspace options">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="13" cy="8" r="1.5"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {!collapsed && tabs.length === 0 && (
        <div className={s.wsEmpty}>No datasets — drag one here</div>
      )}
      {!collapsed && tabs.map(t => (
        <DsItem key={t.id} tab={t} workspaces={workspaces} showMove />
      ))}

      {ctxMenu && (
        <WsContextMenu
          pos={ctxMenu}
          ws={ws}
          onClose={() => setCtxMenu(null)}
          onStartRename={() => setRenaming(true)}
        />
      )}
    </div>
  )
}

// ── New workspace inline input ─────────────────────────────────────────────────
function NewWsRow ({ onDone }) {
  const { dispatch } = useApp()
  const [name, setName] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])

  const commit = () => {
    const n = name.trim()
    if (n) dispatch({ type: 'ADD_WORKSPACE', name: n })
    onDone()
  }

  return (
    <div className={s.newWsRow}>
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx3)', flexShrink: 0 }}>
        <path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z"/>
      </svg>
      <input
        ref={ref}
        className={s.newWsInput}
        value={name}
        placeholder="Workspace name…"
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onDone()
        }}
        onBlur={commit}
      />
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar ({ onUpload }) {
  const { state } = useApp()
  const [q,          setQ]          = useState('')
  const [creatingWs, setCreatingWs] = useState(false)

  const workspaces = state.workspaces || []
  const hasWs      = workspaces.length > 0 || creatingWs

  const filtered = state.tabs.filter(t =>
    t.name.toLowerCase().includes(q.toLowerCase())
  )

  // Tabs belonging to a specific workspace
  const tabsFor  = wsId => filtered.filter(t => (t.workspaceId ?? null) === wsId)
  // Tabs with no valid workspace assignment
  const uncat    = filtered.filter(t => {
    const wid = t.workspaceId ?? null
    return wid === null || !workspaces.find(w => w.id === wid)
  })
  // When searching, hide workspaces that have no matching datasets
  const visibleWs = q ? workspaces.filter(ws => tabsFor(ws.id).length > 0) : workspaces

  return (
    <aside className={s.sidebar}>
      {/* Traffic-light zone */}
      <div className={s.traffic}>
        <div className={s.wordmark}>
          <span className={s.wordmarkMatrix}>Matrix</span>
          <span className={s.proBadge}>PRO</span>
        </div>
      </div>

      {/* Search */}
      {state.tabs.length >= 4 && (
        <div className={s.search}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l3.5 3.5"/>
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search datasets…" />
          {q && (
            <span className={s.clearQ} onClick={() => setQ('')} title="Clear">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
              </svg>
            </span>
          )}
        </div>
      )}

      <div className={s.scroll}>
        {!hasWs ? (
          /* ── Flat mode (no workspaces yet) ── */
          <div className={s.group}>
            <div className={s.groupLabel}>My Datasets</div>
            {state.tabs.length === 0 && (
              <div className={s.emptyState}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={s.emptyIco}>
                  <rect x="3" y="3" width="26" height="26" rx="4"/>
                  <path d="M3 10h26M3 17h26M3 24h26M11 10v19M20 10v19"/>
                </svg>
                <p className={s.emptyText}>No datasets yet</p>
                <p className={s.emptyHint}>Open a CSV or TSV file to get started</p>
              </div>
            )}
            {state.tabs.length > 0 && filtered.length === 0 && q && (
              <div className={s.empty}>No matches for "{q}"</div>
            )}
            {filtered.map(t => (
              <DsItem key={t.id} tab={t} workspaces={workspaces} showMove={false} />
            ))}
          </div>
        ) : (
          /* ── Workspace mode ── */
          <>
            {visibleWs.map(ws => (
              <WsSection key={ws.id} ws={ws} tabs={tabsFor(ws.id)} workspaces={workspaces} />
            ))}

            {/* Uncategorized — only shown when datasets exist without a workspace */}
            {uncat.length > 0 && (
              <div className={s.group}>
                <div className={s.groupLabel}>Uncategorized</div>
                {uncat.map(t => (
                  <DsItem key={t.id} tab={t} workspaces={workspaces} showMove />
                ))}
              </div>
            )}

            {state.tabs.length === 0 && (
              <div className={s.emptyState}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className={s.emptyIco}>
                  <rect x="3" y="3" width="26" height="26" rx="4"/>
                  <path d="M3 10h26M3 17h26M3 24h26M11 10v19M20 10v19"/>
                </svg>
                <p className={s.emptyText}>No datasets yet</p>
                <p className={s.emptyHint}>Open a CSV or TSV file to get started</p>
              </div>
            )}
          </>
        )}

        {/* New workspace */}
        <div className={s.newWsArea}>
          {creatingWs ? (
            <NewWsRow onDone={() => setCreatingWs(false)} />
          ) : (
            <button className={s.newWsBtn} onClick={() => setCreatingWs(true)}>
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 3v10M3 8h10"/>
              </svg>
              New workspace
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={s.footer}>
        <button className={s.openBtn} onClick={onUpload}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 12V5a1 1 0 011-1h3l2-2h5a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
            <path d="M2 7h12"/>
          </svg>
          Open file
          <kbd className={s.kbd}>⌘O</kbd>
        </button>
      </div>
    </aside>
  )
}
