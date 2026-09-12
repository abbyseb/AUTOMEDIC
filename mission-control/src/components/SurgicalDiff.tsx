import { useMemo } from 'react'
import type { Patch } from '../types/automedic'

type Props = {
  patch: Patch
}

function highlightLine(line: string, token: string, markClass: string) {
  if (!token || !line.includes(token)) {
    return <>{line}</>
  }
  const parts = line.split(token)
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <mark className={`${markClass} diff-wipe`}>{token}</mark>}
        </span>
      ))}
    </>
  )
}

export function SurgicalDiff({ patch }: Props) {
  const oldTok = patch.oldMapping || ''
  const newTok = patch.newMapping || ''
  const before = patch.before || oldTok || '—'
  const after = patch.after || newTok || '—'

  const provenance = useMemo(() => {
    const bits: string[] = []
    if (patch.nodeName) bits.push(patch.nodeName)
    if (patch.workflowVersionBefore != null && patch.workflowVersionAfter != null) {
      bits.push(`v${patch.workflowVersionBefore} → v${patch.workflowVersionAfter}`)
    }
    if (patch.replacementCount != null) {
      bits.push(`${patch.replacementCount} replacement${patch.replacementCount === 1 ? '' : 's'}`)
    }
    if (patch.snapshotId) bits.push(patch.snapshotId)
    return bits.join(' · ')
  }, [patch])

  return (
    <div className="border border-[var(--rule)] bg-[var(--plate)]">
      <div className="border-b border-[var(--rule)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-3)]">
        Surgical remap
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-[var(--ink-2)]">
        <code>
          <div className="text-[var(--ink-3)]">…</div>
          <div>
            <span className="mr-3 select-none text-[var(--sig-fault)]">−</span>
            {highlightLine(before, oldTok, 'diff-mark-fault')}
          </div>
          <div>
            <span className="mr-3 select-none text-[var(--sig-ok)]">+</span>
            {highlightLine(after, newTok, 'diff-mark')}
          </div>
          <div className="text-[var(--ink-3)]">…</div>
        </code>
      </pre>
      {provenance && (
        <div className="border-t border-[var(--rule)] px-3 py-2 font-mono text-[11px] text-[var(--ink-3)]">
          {provenance}
        </div>
      )}
    </div>
  )
}
