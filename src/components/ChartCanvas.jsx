import React, { useEffect, useRef, useCallback } from 'react'
import { Chart, registerables } from 'chart.js'
import { PALETTES } from '../lib/constants'
import { isNumericCol, parseNumeric, fmtN } from '../lib/data'
import { buildChartData } from './ChartView'
import s from './ChartCanvas.module.css'

Chart.register(...registerables)

// Standalone chart renderer — all config comes from props, no AppContext reads.
// Used by DashboardView; ChartView keeps using state directly.
export default function ChartCanvas ({ ds, config, height = 260, onExportPNG }) {
  const { ct, xCol, yCol, y2Col, pal: palIdx = 0 } = config || {}
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)
  const pal       = PALETTES[palIdx] || PALETTES[0]

  const exportPNG = useCallback(() => {
    if (!canvasRef.current || !onExportPNG) return
    onExportPNG(canvasRef.current.toDataURL('image/png'))
  }, [onExportPNG])

  useEffect(() => {
    if (!canvasRef.current || !xCol || !yCol) return

    const data = buildChartData({
      ds, xCol, yCol, y2Col: y2Col || null, szCol: null,
      ct, pal, filters: ds.filters,
      aggFn: 'sum', smoothCurves: false,
    })
    if (!data) return

    const isStacked   = ct === 'bar-stacked'
    const isArea      = ct === 'area'
    const isBarType   = ct === 'bar' || isStacked
    const isRadial    = ct === 'doughnut' || ct === 'polar'
    const isRadar     = ct === 'radar'
    const hasY2       = !!y2Col
    const y2IsNumeric = hasY2 && isNumericCol(ds, y2Col)
    const gridC       = 'rgba(255,255,255,.04)'
    const tickC       = '#4a4a5c'
    const legendC     = '#9090a8'
    const axisLblC    = '#6b6b80'

    const cjsType =
      isBarType           ? 'bar'       :
      ct === 'scatter'    ? 'scatter'   :
      ct === 'bubble'     ? 'bubble'    :
      ct === 'doughnut'   ? 'doughnut'  :
      ct === 'radar'      ? 'radar'     :
      ct === 'polar'      ? 'polarArea' : 'line'

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: cjsType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 180 },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: legendC,
              font: { family: "'Inter',system-ui,sans-serif", size: 10 },
              boxWidth: 8, padding: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,15,20,.96)',
            borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
            titleColor: '#eeeef2', bodyColor: '#9090a8',
            titleFont: { family: "'Inter',sans-serif", size: 11, weight: '600' },
            bodyFont:  { family: "'JetBrains Mono',monospace", size: 10 },
            padding: { top: 8, bottom: 8, left: 12, right: 12 },
            cornerRadius: 8,
            callbacks: {
              label (ctx) {
                const raw = ctx.raw
                const v = typeof raw === 'object' ? raw.y ?? raw.r : raw
                const formatted = (typeof v === 'number' && !isNaN(v)) ? fmtN(v) : v
                return ` ${ctx.dataset.label}: ${formatted}`
              },
            },
          },
        },
        scales: isRadial ? {} : isRadar ? {
          r: {
            ticks: { color: tickC, backdropColor: 'transparent', font: { family: "'JetBrains Mono'", size: 9 } },
            grid: { color: gridC },
            pointLabels: { color: '#86869a', font: { size: 10 } },
          },
        } : {
          x: {
            stacked: isStacked,
            ticks: { color: tickC, maxTicksLimit: 10, font: { family: "'JetBrains Mono'", size: 9 } },
            grid:  { color: gridC },
            title: { display: !!xCol, text: xCol, color: axisLblC, font: { family: "'Inter',sans-serif", size: 10, weight: '500' }, padding: { top: 4 } },
          },
          y: {
            stacked: isStacked,
            ticks: { color: tickC, font: { family: "'JetBrains Mono'", size: 9 } },
            grid:  { color: gridC },
            min: isArea ? 0 : undefined,
            title: { display: !!yCol, text: yCol, color: axisLblC, font: { family: "'Inter',sans-serif", size: 10, weight: '500' }, padding: { bottom: 4 } },
          },
          ...(y2IsNumeric ? {
            y2: {
              position: 'right',
              display: true,
              beginAtZero: isArea,
              ticks: { color: pal[1], font: { family: "'JetBrains Mono'", size: 9 } },
              grid: { display: false },
            },
          } : {}),
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ds.rows, ds.filters, ct, xCol, yCol, y2Col, palIdx])

  if (!xCol || !yCol) {
    return (
      <div className={s.empty} style={{ height }}>
        <span>No axes configured</span>
      </div>
    )
  }

  return (
    <div className={s.wrap} style={{ height }}>
      <canvas ref={canvasRef} />
      {onExportPNG && (
        <button className={s.exportBtn} onClick={exportPNG} title="Export as PNG">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12l4 2 4-2M8 14V5"/><path d="M5 8l3 3 3-3"/>
          </svg>
        </button>
      )}
    </div>
  )
}
