import React, { useCallback } from 'react'
import ChartCanvas from './ChartCanvas'
import s from './DashboardView.module.css'

export default function DashboardView ({ ds, onExportPNG }) {
  const graphs = ds.savedGraphs || []

  const handleExport = useCallback((sg, dataURL) => {
    if (onExportPNG) onExportPNG(dataURL, sg.title)
  }, [onExportPNG])

  if (!graphs.length) {
    return (
      <div className={s.empty}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
        <div className={s.emptyTitle}>No saved graphs yet</div>
        <div className={s.emptySub}>Save graphs from the Graph view (⌘2) to populate the dashboard</div>
      </div>
    )
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <span className={s.headerTitle}>{ds.name}</span>
        <span className={s.headerCount}>{graphs.length} saved graph{graphs.length !== 1 ? 's' : ''}</span>
      </div>
      <div className={s.grid}>
        {graphs.map(sg => (
          <div key={sg.id} className={s.card}>
            <div className={s.cardHd}>
              <span className={s.cardTitle}>{sg.title}</span>
              <span className={s.cardMeta}>{sg.ct} · {sg.xCol} → {sg.yCol}</span>
            </div>
            <ChartCanvas
              ds={ds}
              config={{ ct: sg.ct, xCol: sg.xCol, yCol: sg.yCol, y2Col: sg.y2Col, pal: sg.pal }}
              height={240}
              onExportPNG={dataURL => handleExport(sg, dataURL)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
