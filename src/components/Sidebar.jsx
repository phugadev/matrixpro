import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import s from './Sidebar.module.css'

export default function Sidebar ({ onUpload }) {
  const { state, dispatch } = useApp()
  const [q, setQ] = useState('')

  const filtered = state.tabs.filter(t =>
    t.name.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <aside className={s.sidebar}>
      {/* Traffic-light zone — exact height of titlebar (38px) */}
      <div className={s.traffic}>
        <div className={s.wordmark}>
          <span className={s.wordmarkMatrix}>Matrix</span>
          <span className={s.proBadge}>PRO</span>
        </div>
      </div>

      {/* Search — only shown when there are enough datasets to warrant it */}
      {state.tabs.length >= 4 && (
        <div className={s.search}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="4.5"/><path d="M11 11l3.5 3.5"/>
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search datasets…"
          />
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

          {filtered.map(t => {
            const isActive = t.id === state.activeId
            const isClosed = !t.open
            return (
              <div
                key={t.id}
                className={[s.item, isActive && s.active, isClosed && s.closed].filter(Boolean).join(' ')}
                onClick={() => dispatch({ type: 'SET_ACTIVE', id: t.id })}
                title={isClosed ? `Click to reopen ${t.name}` : t.name}
              >
                <span className={s.dot} style={{ background: t.color, opacity: isClosed ? 0.4 : 1 }} />
                <span className={s.name}>{t.name}</span>
                <span className={s.rowCount}>{t.rows.length.toLocaleString()}</span>
                {isClosed ? (
                  <span className={s.reopenIco} title="Closed — click to reopen">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/>
                    </svg>
                  </span>
                ) : (
                  <span
                    className={s.rm}
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'CLOSE_TAB', id: t.id }) }}
                    title="Close"
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
                    </svg>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer — always-visible Open file button */}
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
