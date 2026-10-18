import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Trash2, Plus } from 'lucide-react'
import { db } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { ymd } from '@/lib/schedule'
import { Empty, Field, PageHeader, SEVERITY, Skeleton, VoiceButton } from '@/components/ui'

const LEVELS = ['leve', 'moderado', 'grave']
const QUICK = ['Dor de cabeça', 'Náusea', 'Tontura', 'Cansaço', 'Insônia', 'Dor no estômago', 'Falta de ar', 'Coceira']
const EMPTY = { description: '', severity: 'leve', intensity: 3, medication_id: '', tags: [] }

export default function Symptoms() {
  const { items, loading } = useCollection('symptoms')
  const { items: meds } = useCollection('medications')
  const [form, setForm] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const set = (p) => setForm((f) => ({ ...f, ...p }))

  const save = async () => {
    if (!form.description.trim() && !form.tags.length) return toast.error('Descreva o que está sentindo')
    const med = meds.find((m) => m.id === form.medication_id)
    await db.create('symptoms', {
      ...form,
      description: form.description.trim() || form.tags.join(', '),
      intensity: Number(form.intensity),
      severity: form.intensity >= 7 ? 'grave' : form.intensity >= 4 ? 'moderado' : 'leve',
      medication_name: med?.name || '',
    })
    toast.success('Registro salvo')
    if (Number(form.intensity) >= 8) toast.warning('Sintoma intenso. Se piorar ou houver falta de ar, ligue 192.', { duration: 10000 })
    setForm(EMPTY)
  }

  const sorted = useMemo(() => [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)), [items])
  const shown = sorted.filter((s) => filter === 'all' || s.severity === filter)

  // Highest intensity per day over the last 30 days.
  const chart = useMemo(() => {
    const byDay = new Map()
    for (const s of items) {
      const d = s.created_at.slice(0, 10)
      byDay.set(d, Math.max(byDay.get(d) ?? 0, Number(s.intensity) || ({ leve: 2, moderado: 5, grave: 8 }[s.severity] ?? 0)))
    }
    const out = []
    for (let i = 29; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i)
      const k = ymd(day)
      out.push({ label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), v: byDay.get(k) ?? null })
    }
    return out
  }, [items])
  const hasChart = chart.some((c) => c.v != null)

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Diário clínico" title="Sintomas" subtitle="Registre como se sente. O padrão aparece no gráfico e no relatório para o médico." />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5">
        <section className="card p-5 sm:p-6 h-fit">
          <h2 className="font-display text-xl font-medium text-brand mb-4">Novo registro</h2>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((t) => {
                const on = form.tags.includes(t)
                return <button key={t} type="button" onClick={() => set({ tags: on ? form.tags.filter((x) => x !== t) : [...form.tags, t] })}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${on ? 'bg-brand text-on-brand border-brand' : 'border-line text-sub hover:bg-muted'}`}>{t}</button>
              })}
            </div>
            <Field label="Descrição" aside={<VoiceButton value={form.description} onChange={(v) => set({ description: v })} />}>
              <textarea className="field" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex.: dor de cabeça uma hora depois do remédio da manhã" />
            </Field>
            <Field label={`Intensidade: ${form.intensity}/10`}>
              <input type="range" min="0" max="10" value={form.intensity} onChange={(e) => set({ intensity: Number(e.target.value) })} className="w-full accent-[rgb(var(--brand))]" aria-label="Intensidade" />
              <div className="flex justify-between text-[10px] text-faint uppercase tracking-widest"><span>leve</span><span>moderado</span><span>grave</span></div>
            </Field>
            <Field label="Medicamento relacionado">
              <select className="field" value={form.medication_id} onChange={(e) => set({ medication_id: e.target.value })}>
                <option value="">Nenhum</option>
                {meds.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <button onClick={save} className="btn-primary"><Plus className="w-4 h-4" />Registrar</button>
          </div>
        </section>

        <div className="space-y-5 min-w-0">
          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-xl font-medium text-brand">Últimos 30 dias</h2>
            <p className="text-xs text-faint mt-0.5 mb-4">Maior intensidade registrada por dia</p>
            {hasChart ? (
              <div className="h-44 -ml-4" role="img" aria-label="Gráfico de intensidade dos sintomas nos últimos 30 dias">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={6} tick={{ fill: 'rgb(var(--faint))', fontSize: 11 }} />
                    <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} width={28} tick={{ fill: 'rgb(var(--faint))', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12 }} formatter={(v) => [`${v}/10`, 'Intensidade']} />
                    <Line type="monotone" dataKey="v" stroke="rgb(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: 'rgb(var(--accent))' }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-faint">O gráfico aparece depois do primeiro registro.</p>}
          </section>

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-display text-xl font-medium text-brand">Histórico</h2>
              <div className="flex gap-1">
                {['all', ...LEVELS].map((v) => (
                  <button key={v} onClick={() => setFilter(v)} className={`px-3 h-8 rounded-full text-xs ${filter === v ? 'bg-brand text-on-brand' : 'text-sub hover:bg-muted'}`}>{v === 'all' ? 'Todos' : SEVERITY[v].label}</button>
                ))}
              </div>
            </div>
            {loading ? <Skeleton rows={3} /> : shown.length === 0 ? (
              <Empty icon={<Activity className="w-6 h-6" />} title="Sem registros" />
            ) : (
              <ul className="space-y-3">
                {shown.map((s) => (
                  <li key={s.id} className="p-4 rounded-2xl border border-line">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`chip ${SEVERITY[s.severity]?.cls}`}>{SEVERITY[s.severity]?.label}</span>
                        {s.intensity != null && <span className="text-xs text-faint tabular-nums">{s.intensity}/10</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-faint">{new Date(s.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <button onClick={() => window.confirm('Excluir este registro?') && db.remove('symptoms', s.id)} className="p-1.5 rounded-full text-faint hover:text-danger hover:bg-muted" aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm">{s.description}</p>
                    {s.medication_name && <p className="mt-1 text-xs text-faint">Relacionado a: {s.medication_name}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
