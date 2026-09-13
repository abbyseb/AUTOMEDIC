/**
 * Illustrative Future Version ops mockup — not live /state data.
 */
const WINDOW = 'Last 30 days'

const METRICS: { metric: string; value: string; note?: string }[] = [
  { metric: 'Workflows monitored', value: '500' },
  { metric: 'Incidents detected', value: '100' },
  { metric: 'Safe autonomous fixes', value: '63' },
  { metric: 'Escalated to human', value: '37' },
  { metric: 'Incorrect autonomous fixes', value: '0', note: 'target' },
  { metric: 'Manual MTTR (baseline)', value: '35 min' },
  { metric: 'AutoMedic MTTR', value: '45 sec' },
  { metric: 'Engineering hours avoided', value: '36.8 h' },
  { metric: 'Estimated labour avoided', value: '$3,680' },
  { metric: 'AutoMedic compute / API cost', value: '$48' },
  { metric: 'ROI', value: '77×' },
]

export function FutureOpsDashboard() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="border border-[var(--sig-hold)] bg-[color-mix(in_srgb,var(--sig-hold)_14%,var(--plate))] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--sig-hold)]">
          Future version · illustrative mock
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-2)]">
          Not connected to this hackathon demo. Numbers below are a product vision for a fleet
          deployment — the live Mission Control still runs one patient workflow for real.
        </p>
      </div>

      <header className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--ink-3)]">
          AutoMedic · fleet ops
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
          Last 30 days
        </h2>
        <p className="mt-2 text-[14px] text-[var(--ink-3)]">
          Hypothetical fleet of 500 watched workflows. Evidence-gated autonomy + escalate the rest.
        </p>
      </header>

      <div className="mt-8 grid gap-px bg-[var(--rule)] sm:grid-cols-3">
        <Stat label="Autonomous" value="63" sub="safe fixes" tone="ok" />
        <Stat label="Escalated" value="37" sub="human judgment" tone="hold" />
        <Stat label="Incorrect auto-fixes" value="0" sub="target" tone="live" />
      </div>

      <div className="mt-10 overflow-hidden border border-[var(--rule)]">
        <div className="flex items-center justify-between border-b border-[var(--rule)] bg-[var(--plate-recess)] px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            Metric sheet · {WINDOW}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--sig-hold)]">
            Fake data
          </p>
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--rule)]">
              <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-3)]">
                Metric
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-3)]">
                Example
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((row) => (
              <tr key={row.metric} className="border-b border-[var(--rule-soft)] last:border-b-0">
                <td className="px-4 py-3 text-[14px] text-[var(--ink-2)]">
                  {row.metric}
                  {row.note ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                      {row.note}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[14px] font-medium text-[var(--ink)]">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 font-mono text-[11px] leading-relaxed text-[var(--ink-3)]">
        Pitch line: Error Trigger tells you it broke. AutoMedic tells you which field, fixes the
        safe 63%, and escalates the other 37% — with a target of zero incorrect autonomous writes.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'ok' | 'hold' | 'live'
}) {
  const color =
    tone === 'ok' ? 'var(--sig-ok)' : tone === 'hold' ? 'var(--sig-hold)' : 'var(--sig-live)'
  return (
    <div className="bg-[var(--plate)] px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[13px] text-[var(--ink-3)]">{sub}</p>
    </div>
  )
}
