import { motion } from 'framer-motion'
import type { Patch } from '../types/automedic'

type Props = {
  patch: Patch | null | undefined
  onRollback?: () => void
}

function splitLines(text: string): string[] {
  return text.length === 0 ? [''] : text.split('\n')
}

/** Simple line-level compare — marks lines present in one side but not the other. */
function diffFlags(before: string, after: string): { beforeFlags: boolean[]; afterFlags: boolean[] } {
  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)
  const afterSet = new Set(afterLines)
  const beforeSet = new Set(beforeLines)
  return {
    beforeFlags: beforeLines.map((line) => !afterSet.has(line)),
    afterFlags: afterLines.map((line) => !beforeSet.has(line)),
  }
}

export function PatchDiffPanel({ patch, onRollback }: Props) {
  if (!patch) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Patch diff
        </h2>
        <p className="text-sm text-[var(--muted)]">No patch yet — waiting for gate + apply…</p>
      </section>
    )
  }

  const beforeLines = splitLines(patch.before)
  const afterLines = splitLines(patch.after)
  const { beforeFlags, afterFlags } = diffFlags(patch.before, patch.after)
  const hasVersion =
    patch.workflowVersionBefore != null || patch.workflowVersionAfter != null

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            Patch diff
          </h2>
          <p className="text-sm font-medium text-[var(--text)]">{patch.nodeName}</p>
        </div>
        <button
          type="button"
          onClick={onRollback}
          disabled={!onRollback}
          title={
            onRollback
              ? 'Restore pre-patch snapshot'
              : 'Rollback stub — wire when snapshot restore is ready'
          }
          className="shrink-0 rounded-md border border-[var(--border)] bg-transparent px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-slate-500 hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Rollback
        </button>
      </div>

      {hasVersion && (
        <p className="mb-3 text-xs text-[var(--muted)]">
          Workflow version{' '}
          <span className="font-mono text-[var(--text)]/85">
            {patch.workflowVersionBefore ?? '—'}
          </span>
          <span className="mx-1.5 text-[var(--accent)]">→</span>
          <span className="font-mono text-[var(--text)]/85">
            {patch.workflowVersionAfter ?? '—'}
          </span>
          {patch.replacementCount > 0 && (
            <span className="ml-2 text-[var(--muted)]">
              · {patch.replacementCount} replacement
              {patch.replacementCount === 1 ? '' : 's'}
            </span>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DiffBlock label="Before" lines={beforeLines} flags={beforeFlags} tone="before" />
        <DiffBlock label="After" lines={afterLines} flags={afterFlags} tone="after" />
      </div>
    </motion.section>
  )
}

function DiffBlock({
  label,
  lines,
  flags,
  tone,
}: {
  label: string
  lines: string[]
  flags: boolean[]
  tone: 'before' | 'after'
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--pill)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--text)]/90">
        {lines.map((line, i) => {
          const changed = flags[i]
          const highlight =
            changed && tone === 'before'
              ? 'bg-rose-500/20 text-rose-200'
              : changed && tone === 'after'
                ? 'bg-emerald-500/20 text-emerald-200'
                : ''
          return (
            <div key={`${i}-${line}`} className={`rounded px-1 ${highlight}`}>
              {line || ' '}
            </div>
          )
        })}
      </pre>
    </div>
  )
}
