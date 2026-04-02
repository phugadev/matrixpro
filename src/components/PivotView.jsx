import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { parseNumeric, fmtN, makeDS } from '../lib/data'
import s from './PivotView.module.css'

const MAX_COL_VALS = 50
const ROW_COL_W    = 140

const AGG_FNS   = ['sum', 'avg', 'count', 'min', 'max']
const AGG_LABEL = { sum: 'Sum', avg: 'Avg', count: 'Count', min: 'Min', max: 'Max' }

// ─── Aggregation ──────────────────────────────────────────────────────────────
function agg(vals, fn) {
  const nonEmpty = vals.filter(v => v !== '' && v != null)
  if (fn === 'count') return nonEmpty.length
  const nums = nonEmpty.map(v => parseNumeric(v)).filter(n => !isNaN(n))
  if (!nums.length) return ''
  switch (fn) {
    case 'sum': return nums.reduce((a, b) => a + b, 0)
    case 'avg': return nums.reduce((a, b) => a + b, 0) / nums.length
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
    default:    return ''
  }
}

function fmtVal(v) {
  if (v === '' || v == null) return '—'
  if (typeof v === 'number' || !isNaN(parseNumeric(v))) return fmtN(typeof v === 'number' ? v : parseNumeric(v))
  return String(v)
}

// ─── Pivot computation ────────────────────────────────────────────────────────
function computePivot(rows, rowFields, colField, valueFields) {
  // Build column value list for cross-tab
  const colVals = colField
    ? [...new Set(rows.map(r => r[colField]).filter(v => v != null && v !== ''))].map(String).sort().slice(0, MAX_COL_VALS)
    : null

  // Build value column descriptors
  const valCols = []
  for (const vf of valueFields) {
    if (colVals) {
      for (const cv of colVals) {
        valCols.push({ key: `${vf.col}\x01${cv}`, headerLabel: cv, vfCol: vf.col, fn: vf.fn, colVal: cv, vf })
      }
    } else {
      valCols.push({ key: `${vf.col}\x01`, headerLabel: vf.col, vfCol: vf.col, fn: vf.fn, colVal: null, vf })
    }
  }

  // Group source rows by the rowFields combination
  const groups = new Map()
  for (const row of rows) {
    const key = rowFields.map(f => String(row[f] ?? '')).join('\x00')
    if (!groups.has(key)) groups.set(key, { rowVals: rowFields.map(f => row[f] ?? ''), rows: [] })
    groups.get(key).rows.push(row)
  }

  // Compute result rows
  const resultRows = []
  for (const [, g] of groups) {
    const outRow = {}
    rowFields.forEach((f, i) => { outRow[f] = g.rowVals[i] })
    for (const vc of valCols) {
      const subset = vc.colVal != null
        ? g.rows.filter(r => String(r[colField] ?? '') === vc.colVal)
        : g.rows
      outRow[vc.key] = agg(subset.map(r => r[vc.vf.col]), vc.fn)
    }
    resultRows.push(outRow)
  }

  // Grand total row
  const totalRow = {}
  rowFields.forEach((f, i) => { totalRow[f] = i === 0 ? 'Grand Total' : '' })
  for (const vc of valCols) {
    const subset = vc.colVal != null ? rows.filter(r => String(r[colField] ?? '') === vc.colVal) : rows
    totalRow[vc.key] = agg(subset.map(r => r[vc.vf.col]), vc.fn)
  }

  return { resultRows, totalRow, valCols, colVals }
}

// ─── Add field dropdown ───────────────────────────────────────────────────────
function AddDropdown({ cols, onAdd, onClose }) {
  return (
    <div className={s.addDropdown}>
      {cols.length ? cols.map(c => (
        <button key={c} className={s.addDropItem} onClick={() => { onAdd(c); onClose() }}>{c}</button>
      )) : (
        <div className={s.addDropEmpty}>No columns available</div>
      )}
    </div>
  )
}

// ─── Field chip ───────────────────────────────────────────────────────────────
function FieldChip({ label, onRemove, children }) {
  return (
    <div className={s.chip}>
      <span className={s.chipLabel} title={label}>{label}</span>
      {children}
      <button className={s.chipRemove} onClick={onRemove} title="Remove">
        <svg width="7" height="7" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/>
        </svg>
      </button>
    </div>
  )
}

// ─── PivotView ────────────────────────────────────────────────────────────────
export default function PivotView({ ds, onOpenAsDataset }) {
  const { state, dispatch } = useApp()
  const rowFields   = state.pivotRowFields
  const colField    = state.pivotColField
  const valueFields = state.pivotValueFields

  const setRowFields   = useCallback(rf  => dispatch({ type: 'SET_PIVOT', rowFields: rf,     colField,    valueFields }), [dispatch, colField,   valueFields])
  const setColField    = useCallback(cf  => dispatch({ type: 'SET_PIVOT', rowFields,          colField: cf, valueFields }), [dispatch, rowFields,  valueFields])
  const setValueFields = useCallback(vfs => dispatch({ type: 'SET_PIVOT', rowFields,          colField,    valueFields: vfs }), [dispatch, rowFields, colField])

  const [addRowOpen, setAddRowOpen] = useState(false)
  const [addValOpen, setAddValOpen] = useState(false)
  const addRowRef = useRef(null)
  const addValRef = useRef(null)

  useEffect(() => {
    if (!addRowOpen) return
    const h = e => { if (addRowRef.current && !addRowRef.current.contains(e.target)) setAddRowOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [addRowOpen])

  useEffect(() => {
    if (!addValOpen) return
    const h = e => { if (addValRef.current && !addValRef.current.contains(e.target)) setAddValOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [addValOpen])

  const allCols = useMemo(() => ds.cols.filter(c => !ds.computedCols?.[c]), [ds.cols, ds.computedCols])

  const unusedForRow = useMemo(() => allCols.filter(c => !rowFields.includes(c)), [allCols, rowFields])
  const unusedForVal = useMemo(() => allCols.filter(c => !valueFields.find(v => v.col === c)), [allCols, valueFields])

  const pivot = useMemo(() => {
    if (!rowFields.length || !valueFields.length) return null
    return computePivot(ds.rows, rowFields, colField || null, valueFields)
  }, [ds.rows, rowFields, colField, valueFields])

  const addRow    = useCallback(col => setRowFields([...rowFields, col]), [rowFields, setRowFields])
  const removeRow = useCallback(col => setRowFields(rowFields.filter(c => c !== col)), [rowFields, setRowFields])
  const addVal    = useCallback(col => setValueFields([...valueFields, { col, fn: 'sum' }]), [valueFields, setValueFields])
  const removeVal = useCallback(col => setValueFields(valueFields.filter(v => v.col !== col)), [valueFields, setValueFields])
  const changeValFn = useCallback((col, fn) => setValueFields(valueFields.map(v => v.col === col ? { ...v, fn } : v)), [valueFields, setValueFields])

  const handleColFieldChange = useCallback(e => {
    const val = e.target.value
    setColField(val)
    if (val && rowFields.includes(val)) setRowFields(rowFields.filter(c => c !== val))
  }, [setColField, rowFields, setRowFields])

  const handleOpenAsDataset = useCallback(() => {
    if (!pivot || !pivot.resultRows.length) return
    const { resultRows, valCols } = pivot
    const exportColNames = valCols.map(vc =>
      vc.colVal != null ? `${vc.vfCol} [${vc.colVal}]` : `${vc.headerLabel} (${AGG_LABEL[vc.fn].toLowerCase()})`
    )
    const rows = resultRows.map(r => {
      const out = {}
      rowFields.forEach(f => { out[f] = r[f] })
      valCols.forEach((vc, i) => { out[exportColNames[i]] = r[vc.key] })
      return out
    })
    onOpenAsDataset(rows)
  }, [pivot, rowFields, onOpenAsDataset])

  // ── Header rendering ──────────────────────────────────────────────────────
  const renderHeader = () => {
    if (!pivot) return null
    const { valCols, colVals } = pivot

    if (colVals) {
      // Two-row header: top row spans value groups, bottom row shows colVals
      const vfGroups = []
      for (const vc of valCols) {
        const last = vfGroups[vfGroups.length - 1]
        if (last && last.col === vc.vfCol) last.vcs.push(vc)
        else vfGroups.push({ col: vc.vfCol, fn: vc.fn, vcs: [vc] })
      }
      return (
        <thead>
          <tr>
            {rowFields.map((f, i) => (
              <th key={f} rowSpan={2} className={`${s.th} ${s.thRow}`}
                style={{ left: i * ROW_COL_W, minWidth: ROW_COL_W, width: ROW_COL_W }}>{f}</th>
            ))}
            {vfGroups.map(g => (
              <th key={g.col} colSpan={g.vcs.length} className={`${s.th} ${s.thGroup}`}>
                {g.col} <span className={s.fnBadge}>{AGG_LABEL[g.fn]}</span>
              </th>
            ))}
          </tr>
          <tr>
            {valCols.map(vc => (
              <th key={vc.key} className={`${s.th} ${s.thVal}`}>{vc.headerLabel}</th>
            ))}
          </tr>
        </thead>
      )
    }

    return (
      <thead>
        <tr>
          {rowFields.map((f, i) => (
            <th key={f} className={`${s.th} ${s.thRow}`}
              style={{ left: i * ROW_COL_W, minWidth: ROW_COL_W, width: ROW_COL_W }}>{f}</th>
          ))}
          {valCols.map(vc => (
            <th key={vc.key} className={`${s.th} ${s.thVal}`}>
              {vc.headerLabel} <span className={s.fnBadge}>{AGG_LABEL[vc.fn]}</span>
            </th>
          ))}
        </tr>
      </thead>
    )
  }

  // ── Body rendering ────────────────────────────────────────────────────────
  const renderBody = () => {
    if (!pivot) return null
    const { resultRows, totalRow, valCols } = pivot
    return (
      <tbody>
        {resultRows.map((row, ri) => (
          <tr key={ri} className={s.tr}>
            {rowFields.map((f, i) => (
              <td key={f} className={`${s.td} ${s.tdRow}`}
                style={{ left: i * ROW_COL_W, minWidth: ROW_COL_W, width: ROW_COL_W }}>
                {row[f] !== '' && row[f] != null ? String(row[f]) : '—'}
              </td>
            ))}
            {valCols.map(vc => (
              <td key={vc.key} className={`${s.td} ${s.tdVal}`}>{fmtVal(row[vc.key])}</td>
            ))}
          </tr>
        ))}
        <tr className={s.totalRow}>
          {rowFields.map((f, i) => (
            <td key={f} className={`${s.td} ${s.tdRow} ${s.tdTotal}`}
              style={{ left: i * ROW_COL_W, minWidth: ROW_COL_W, width: ROW_COL_W }}>
              {i === 0 ? 'Grand Total' : ''}
            </td>
          ))}
          {valCols.map(vc => (
            <td key={vc.key} className={`${s.td} ${s.tdVal} ${s.tdTotal}`}>{fmtVal(totalRow[vc.key])}</td>
          ))}
        </tr>
      </tbody>
    )
  }

  const canOpen = pivot && pivot.resultRows.length > 0

  return (
    <div className={s.root}>

      {/* ── Config panel ── */}
      <div className={s.config}>

        {/* Row fields */}
        <div className={s.section}>
          <div className={s.sectionHd}>
            <span className={s.sectionLabel}>Rows</span>
            <div ref={addRowRef} style={{ position: 'relative' }}>
              <button className={s.addBtn} onClick={() => setAddRowOpen(v => !v)}
                title="Add row field" disabled={!unusedForRow.length}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M5 1v8M1 5h8"/>
                </svg>
                Add
              </button>
              {addRowOpen && <AddDropdown cols={unusedForRow} onAdd={addRow} onClose={() => setAddRowOpen(false)} />}
            </div>
          </div>
          <div className={s.chipList}>
            {rowFields.map(f => <FieldChip key={f} label={f} onRemove={() => removeRow(f)} />)}
            {!rowFields.length && <div className={s.emptyHint}>At least one row field required</div>}
          </div>
        </div>

        {/* Column field */}
        <div className={s.section}>
          <div className={s.sectionHd}>
            <span className={s.sectionLabel}>Columns</span>
          </div>
          <select className={s.colSelect} value={colField} onChange={handleColFieldChange}>
            <option value="">(none)</option>
            {allCols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {colField && (
            <div className={s.colHint}>
              Cross-tabulates by unique values of <b>{colField}</b>
              {pivot?.colVals && pivot.colVals.length === MAX_COL_VALS && (
                <span className={s.capWarn}> · capped at {MAX_COL_VALS}</span>
              )}
            </div>
          )}
        </div>

        {/* Values */}
        <div className={s.section}>
          <div className={s.sectionHd}>
            <span className={s.sectionLabel}>Values</span>
            <div ref={addValRef} style={{ position: 'relative' }}>
              <button className={s.addBtn} onClick={() => setAddValOpen(v => !v)}
                title="Add value field" disabled={!unusedForVal.length}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                  <path d="M5 1v8M1 5h8"/>
                </svg>
                Add
              </button>
              {addValOpen && <AddDropdown cols={unusedForVal} onAdd={addVal} onClose={() => setAddValOpen(false)} />}
            </div>
          </div>
          <div className={s.chipList}>
            {valueFields.map(vf => (
              <FieldChip key={vf.col} label={vf.col} onRemove={() => removeVal(vf.col)}>
                <select className={s.fnSelect} value={vf.fn} onChange={e => changeValFn(vf.col, e.target.value)} onClick={e => e.stopPropagation()}>
                  {AGG_FNS.map(f => <option key={f} value={f}>{AGG_LABEL[f]}</option>)}
                </select>
              </FieldChip>
            ))}
            {!valueFields.length && <div className={s.emptyHint}>At least one value required</div>}
          </div>
        </div>

        <div className={s.configSpacer} />

        {/* Stats */}
        {pivot && (
          <div className={s.stats}>
            {pivot.resultRows.length.toLocaleString()} groups · {ds.rows.length.toLocaleString()} source rows
          </div>
        )}

        <button className={s.openBtn} disabled={!canOpen} onClick={handleOpenAsDataset}
          title="Materialise pivot result as a new dataset tab">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6z"/><path d="M9 2v4h4"/>
          </svg>
          Open as Dataset
        </button>

      </div>

      {/* ── Grid ── */}
      <div className={s.gridWrap}>
        {!pivot ? (
          <div className={s.emptyState}>
            <svg className={s.emptyIcon} width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
            </svg>
            <div className={s.emptyTitle}>Configure your pivot</div>
            <div className={s.emptySub}>Add row fields and values to get started</div>
          </div>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              {renderHeader()}
              {renderBody()}
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
