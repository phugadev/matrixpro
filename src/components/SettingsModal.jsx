import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { PALETTES } from '../lib/constants'
import s from './SettingsModal.module.css'

const NUM_FMTS = [
  { key: null,         label: 'Auto',       example: '1.5k'   },
  { key: 'int',        label: 'Integer',    example: '1,234'  },
  { key: 'fixed1',     label: '1 decimal',  example: '1,234.5' },
  { key: 'fixed2',     label: '2 decimals', example: '1,234.56' },
  { key: 'currency',   label: 'Currency',   example: '$1,234' },
  { key: 'percent',    label: 'Percent',    example: '42.3%'  },
  { key: 'scientific', label: 'Scientific', example: '1.23e+2' },
]

const ROW_HEIGHTS = [
  { value: 24, label: 'Compact'     },
  { value: 32, label: 'Default'     },
  { value: 40, label: 'Comfortable' },
]

const DATE_FMTS = [
  { key: 'medium', label: 'Jan 5, 2026' },
  { key: 'iso',    label: 'YYYY-MM-DD'  },
  { key: 'eu',     label: 'DD/MM/YYYY'  },
  { key: 'us',     label: 'MM/DD/YYYY'  },
]

const DELIMITERS = [
  { key: 'auto', label: 'Auto'      },
  { key: ',',    label: 'Comma'     },
  { key: ';',    label: 'Semicolon' },
  { key: '\t',   label: 'Tab'       },
]

const PAL_NAMES = ['Electric', 'Neon', 'Sunset', 'Aurora']

const TABS = ['Appearance', 'Data', 'AI']

export default function SettingsModal ({ onClose }) {
  const { state, dispatch } = useApp()
  const settings = state.settings || {}
  const [tab, setTab]                   = useState('Appearance')
  const [availableModels, setAvailable] = useState([])
  const [modelStatus, setModelStatus]   = useState('idle')
  const [customModel, setCustomModel]   = useState('')

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const set = patch => dispatch({ type: 'SET_SETTINGS', patch })

  const detectModels = useCallback(async () => {
    setModelStatus('loading')
    try {
      const res = await fetch('http://localhost:11434/api/tags')
      if (!res.ok) throw new Error()
      const { models } = await res.json()
      setAvailable((models || []).map(m => m.name))
      setModelStatus('ok')
    } catch {
      setAvailable([])
      setModelStatus('error')
    }
  }, [])

  return (
    <div className={s.overlay} onMouseDown={onClose}>
      <div className={s.modal} onMouseDown={e => e.stopPropagation()}>

        {/* Header */}
        <div className={s.hd}>
          <div className={s.title}>Settings</div>
          <button className={s.closeBtn} onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
            </svg>
          </button>
        </div>

        {/* Tab nav */}
        <div className={s.nav}>
          {TABS.map(t => (
            <button
              key={t}
              className={[s.navTab, tab === t ? s.navTabOn : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className={s.body}>

          {/* ── Appearance ── */}
          {tab === 'Appearance' && <>

            <div className={s.row}>
              <div className={s.rowMeta}>
                <div className={s.rowLabel}>Row height</div>
              </div>
              <div className={s.segmented}>
                {ROW_HEIGHTS.map(({ value, label }) => (
                  <button
                    key={value}
                    className={[s.seg, settings.rowHeight === value ? s.segOn : ''].filter(Boolean).join(' ')}
                    onClick={() => set({ rowHeight: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <hr className={s.divider} />

            <div className={s.section}>
              <div className={s.sectionLabel}>Chart palette</div>
              <div className={s.palGrid}>
                {PALETTES.map((pal, idx) => (
                  <button
                    key={idx}
                    className={[s.palCard, state.palette === idx ? s.palCardOn : ''].filter(Boolean).join(' ')}
                    onClick={() => dispatch({ type: 'SET_PALETTE', idx })}
                  >
                    <div className={s.palName}>{PAL_NAMES[idx]}</div>
                    <div className={s.palDots}>
                      {pal.map(c => <span key={c} className={s.palDot} style={{ background: c }} />)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </>}

          {/* ── Data ── */}
          {tab === 'Data' && <>

            <div className={s.section}>
              <div className={s.sectionLabel}>Number format</div>
              <div className={s.fmtGrid}>
                {NUM_FMTS.map(f => (
                  <button
                    key={String(f.key)}
                    className={[s.fmtChip, settings.defaultNumFmt === f.key ? s.fmtChipOn : ''].filter(Boolean).join(' ')}
                    onClick={() => set({ defaultNumFmt: f.key })}
                  >
                    <span className={s.fmtLabel}>{f.label}</span>
                    <span className={s.fmtEx}>{f.example}</span>
                  </button>
                ))}
              </div>
            </div>

            <hr className={s.divider} />

            <div className={s.row}>
              <div className={s.rowMeta}>
                <div className={s.rowLabel}>Date format</div>
              </div>
              <div className={s.segmented}>
                {DATE_FMTS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={[s.seg, settings.dateFormat === key ? s.segOn : ''].filter(Boolean).join(' ')}
                    onClick={() => set({ dateFormat: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <hr className={s.divider} />

            <div className={s.row}>
              <div className={s.rowMeta}>
                <div className={s.rowLabel}>CSV delimiter</div>
              </div>
              <div className={s.segmented}>
                {DELIMITERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={[s.seg, settings.csvDelimiter === key ? s.segOn : ''].filter(Boolean).join(' ')}
                    onClick={() => set({ csvDelimiter: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

          </>}

          {/* ── AI ── */}
          {tab === 'AI' && <>

            <div className={s.row}>
              <div className={s.rowMeta}>
                <div className={s.rowLabel}>Ollama model</div>
                <div className={s.rowDesc}>Active: {settings.ollamaModel || 'llama3.2:latest'}</div>
              </div>
              <button className={s.detectBtn} onClick={detectModels} disabled={modelStatus === 'loading'}>
                {modelStatus === 'loading' ? 'Detecting…' : 'Detect'}
              </button>
            </div>

            {modelStatus === 'error' && (
              <div className={s.ollamaHint}>Ollama not running. Enter a model name manually:</div>
            )}

            {availableModels.length > 0 && (
              <div className={s.modelList}>
                {availableModels.map(m => (
                  <button
                    key={m}
                    className={[s.modelChip, settings.ollamaModel === m ? s.modelChipOn : ''].filter(Boolean).join(' ')}
                    onClick={() => set({ ollamaModel: m })}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}

            {(modelStatus === 'error' || modelStatus === 'ok') && (
              <div className={s.ollamaManual}>
                <input
                  className={s.modelInput}
                  placeholder="e.g. mistral, gemma3, phi4"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customModel.trim()) {
                      set({ ollamaModel: customModel.trim() })
                      setCustomModel('')
                    }
                  }}
                />
                <button
                  className={s.detectBtn}
                  disabled={!customModel.trim()}
                  onClick={() => { set({ ollamaModel: customModel.trim() }); setCustomModel('') }}
                >
                  Set
                </button>
              </div>
            )}

          </>}

        </div>
      </div>
    </div>
  )
}
