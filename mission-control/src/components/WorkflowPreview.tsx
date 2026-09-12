import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Incident, PatientGraph, PatientGraphNode } from '../types/automedic'

const NODE_W = 168
const NODE_H = 44
const MIN_ZOOM = 0.35
const MAX_ZOOM = 2.5

type Props = {
  graph: PatientGraph | null | undefined
  incident?: Incident | null
}

type Cam = { scale: number; x: number; y: number }

function roleLabel(role?: string) {
  if (role === 'auth') return 'AUTH'
  if (role === 'map') return 'MAP'
  if (role === 'trigger') return 'IN'
  if (role === 'gate') return 'GATE'
  return null
}

export function WorkflowPreview({ graph, incident }: Props) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState<Cam>({ scale: 1, x: 0, y: 0 })
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
  const [panning, setPanning] = useState(false)

  const layout = useMemo(() => {
    if (!graph?.nodes.length) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of graph.nodes) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x)
      maxY = Math.max(maxY, n.y)
    }
    const pad = 48
    const width = Math.max(maxX - minX + NODE_W + pad * 2, 400)
    const height = Math.max(maxY - minY + NODE_H + pad * 2, 220)
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))

    const project = (n: PatientGraphNode) => ({
      left: n.x - minX + pad,
      top: n.y - minY + pad,
      cx: n.x - minX + pad + NODE_W / 2,
      cy: n.y - minY + pad + NODE_H / 2,
    })

    return { width, height, byId, project, pad }
  }, [graph])

  const highlight = useMemo(() => {
    const set = new Set<string>()
    if (!incident) return set
    const failed =
      incident.failedNode ||
      incident.diagnosis?.failedNodeName ||
      incident.patch?.nodeName ||
      ''
    if (failed) set.add(failed)
    if (incident.diagnosis?.failureType === 'AUTH_EXPIRED') set.add('AutoMedic AUTH Probe')
    if (incident.diagnosis?.failureType === 'FIELD_MAPPING') set.add('Map to CRM Fields')
    return set
  }, [incident])

  const fitToFrame = useCallback(() => {
    const el = frameRef.current
    if (!el || !layout) return
    const { clientWidth: fw, clientHeight: fh } = el
    if (fw < 40 || fh < 40) return
    const margin = 28
    const scale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((fw - margin * 2) / layout.width, (fh - margin * 2) / layout.height))
    )
    const x = (fw - layout.width * scale) / 2
    const y = (fh - layout.height * scale) / 2
    setCam({ scale, x, y })
  }, [layout])

  useEffect(() => {
    fitToFrame()
    const onResize = () => fitToFrame()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fitToFrame, graph?.workflowId, graph?.nodes.length])

  function zoomBy(factor: number, origin?: { x: number; y: number }) {
    setCam((prev) => {
      const el = frameRef.current
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * factor))
      if (!el || !origin) {
        const cx = (el?.clientWidth ?? 0) / 2
        const cy = (el?.clientHeight ?? 0) / 2
        const wx = (cx - prev.x) / prev.scale
        const wy = (cy - prev.y) / prev.scale
        return { scale: nextScale, x: cx - wx * nextScale, y: cy - wy * nextScale }
      }
      const wx = (origin.x - prev.x) / prev.scale
      const wy = (origin.y - prev.y) / prev.scale
      return { scale: nextScale, x: origin.x - wx * nextScale, y: origin.y - wy * nextScale }
    })
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y }
    setPanning(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.px
    const dy = e.clientY - drag.current.py
    setCam((prev) => ({
      scale: prev.scale,
      x: drag.current!.cx + dx,
      y: drag.current!.cy + dy,
    }))
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null
    setPanning(false)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const el = frameRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const origin = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, origin)
  }

  if (!graph || !graph.nodes.length || !layout) {
    return (
      <p className="mt-8 font-mono text-[11px] text-[var(--ink-3)]">
        Patient canvas unavailable — waiting for live workflow snapshot.
      </p>
    )
  }

  const zoomPct = Math.round(cam.scale * 100)

  return (
    <section className="mt-10">
      <div className="overflow-hidden border border-[var(--ink)] shadow-[4px_4px_0_0_color-mix(in_srgb,var(--ink)_18%,transparent)]">
        {/* Frame chrome */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ink)] bg-[var(--ink)] px-3 py-2.5 text-[var(--plate)]">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--plate)_65%,transparent)]">
              Live patient canvas
            </p>
            <h3 className="truncate text-[14px] font-semibold tracking-tight">{graph.workflowName}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ToolbarBtn label="Zoom out" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
              −
            </ToolbarBtn>
            <span className="min-w-[3.25rem] px-1 text-center font-mono text-[11px] tabular-nums text-[color-mix(in_srgb,var(--plate)_80%,transparent)]">
              {zoomPct}%
            </span>
            <ToolbarBtn label="Zoom in" onClick={() => zoomBy(1.2)} title="Zoom in">
              +
            </ToolbarBtn>
            <ToolbarBtn label="Fit" onClick={fitToFrame} title="Fit whole graph in frame">
              Fit
            </ToolbarBtn>
            {graph.openInN8nUrl && (
              <a
                href={graph.openInN8nUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-1 border border-[color-mix(in_srgb,var(--plate)_35%,transparent)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--plate)] hover:bg-[color-mix(in_srgb,var(--plate)_12%,transparent)]"
              >
                n8n
              </a>
            )}
          </div>
        </header>

        <div
          ref={frameRef}
          className={`relative h-[min(420px,52vh)] touch-none select-none overflow-hidden bg-[var(--plate-recess)] ${
            panning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="application"
          aria-label={`Pan and zoom graph of ${graph.workflowName}`}
        >
          {/* subtle grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(to right, var(--rule-soft) 1px, transparent 1px), linear-gradient(to bottom, var(--rule-soft) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              backgroundPosition: `${cam.x}px ${cam.y}px`,
            }}
          />

          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
              width: layout.width,
              height: layout.height,
            }}
          >
            <svg
              width={layout.width}
              height={layout.height}
              className="overflow-visible"
              aria-hidden
            >
              <defs>
                <marker
                  id="patient-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)" />
                </marker>
              </defs>
              {graph.edges.map((e, i) => {
                const a = layout.byId.get(e.from)
                const b = layout.byId.get(e.to)
                if (!a || !b) return null
                const pa = layout.project(a)
                const pb = layout.project(b)
                return (
                  <line
                    key={`${e.from}-${e.to}-${i}`}
                    x1={pa.cx}
                    y1={pa.cy}
                    x2={pb.cx}
                    y2={pb.cy}
                    stroke="var(--ink-3)"
                    strokeWidth={1.75}
                    strokeOpacity={0.55}
                    markerEnd="url(#patient-arrow)"
                  />
                )
              })}
              {graph.nodes.map((n) => {
                const p = layout.project(n)
                const lit = highlight.has(n.name)
                const auth = n.role === 'auth'
                const map = n.role === 'map'
                const trigger = n.role === 'trigger'
                const gate = n.role === 'gate'
                let stroke = 'var(--ink)'
                let fill = 'var(--plate)'
                let badge = 'var(--ink-3)'
                if (auth || lit) {
                  stroke = 'var(--sig-fault)'
                  fill = 'color-mix(in srgb, var(--sig-fault) 14%, var(--plate))'
                  badge = 'var(--sig-fault)'
                } else if (map) {
                  stroke = 'var(--sig-live)'
                  fill = 'color-mix(in srgb, var(--sig-live) 10%, var(--plate))'
                  badge = 'var(--sig-live)'
                } else if (trigger) {
                  stroke = 'var(--sig-ok)'
                  fill = 'color-mix(in srgb, var(--sig-ok) 10%, var(--plate))'
                  badge = 'var(--sig-ok)'
                } else if (gate) {
                  stroke = 'var(--sig-hold)'
                  fill = 'color-mix(in srgb, var(--sig-hold) 10%, var(--plate))'
                  badge = 'var(--sig-hold)'
                }
                const tag = roleLabel(n.role)
                const label =
                  n.name.length > 24 ? `${n.name.slice(0, 22)}…` : n.name
                return (
                  <g key={n.id}>
                    <rect
                      x={p.left}
                      y={p.top}
                      width={NODE_W}
                      height={NODE_H}
                      rx={3}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={auth || lit ? 2.25 : 1.5}
                    />
                    {tag && (
                      <text
                        x={p.left + 8}
                        y={p.top + 14}
                        fill={badge}
                        style={{
                          fontSize: 8,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          letterSpacing: '0.12em',
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </text>
                    )}
                    <text
                      x={p.left + NODE_W / 2}
                      y={p.top + (tag ? 30 : 27)}
                      textAnchor="middle"
                      fill="var(--ink)"
                      style={{
                        fontSize: 11,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
            Drag to pan · scroll to zoom · Fit resets frame
          </p>
        </div>

        <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--rule)] bg-[var(--plate)] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
          <Legend swatch="var(--sig-ok)" label="Trigger" />
          <Legend swatch="var(--sig-live)" label="Map" />
          <Legend swatch="var(--sig-hold)" label="Gate" />
          <Legend swatch="var(--sig-fault)" label="Fault / AUTH" />
          <span className="ml-auto normal-case tracking-normal">
            {graph.nodes.length} nodes · live from n8n
          </span>
        </footer>
      </div>
    </section>
  )
}

function ToolbarBtn({
  children,
  onClick,
  label,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  title: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="min-w-[2rem] border border-[color-mix(in_srgb,var(--plate)_35%,transparent)] px-2.5 py-1.5 font-mono text-[12px] font-semibold leading-none text-[var(--plate)] hover:bg-[color-mix(in_srgb,var(--plate)_12%,transparent)]"
    >
      {children}
    </button>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 border border-[var(--ink)]" style={{ background: swatch }} />
      {label}
    </span>
  )
}
