import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Printer, Share2, FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getProfile } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { adherence, medTimes, slotsForDay } from '@/lib/schedule'
import { SEVERITY } from '@/components/ui'

const PERIODS = [[7, '7 dias'], [30, '30 dias'], [90, '90 dias']]

export default function Report() {
  const { user } = useAuth()
  const [days, setDays] = useState(30)
  const [profile, setProfile] = useState(null)
  const meds = useCollection('medications')
  const doses = useCollection('doses')
  const symptoms = useCollection('symptoms')
  const appts = useCollection('appointments')
  useEffect(() => { getProfile().then(setProfile) }, [])

  const since = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days + 1); return d }, [days])
  const stats = useMemo(() => adherence(meds.items, doses.items, days), [meds.items, doses.items, days])
  const perMed = useMemo(() => meds.items.filter((m) => m.active && !m.as_needed).map((m) => {
    let due = 0, taken = 0, skipped = 0
    const now = new Date()
    for (let i = 0; i < days; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      for (const s of slotsForDay([m], day, doses.items)) {
        if (s.at > now || (m.created_at && s.at < new Date(new Date(m.created_at).toDateString()))) continue
        due++
        if (s.log?.status === 'taken') taken++
        else if (s.log?.status === 'skipped') skipped++
      }
    }
    return { m, due, taken, skipped, missed: due - taken - skipped, pct: due ? Math.round((taken / due) * 100) : null }
  }), [meds.items, doses.items, days])
  const prnLogs = doses.items.filter((d) => d.as_needed && new Date(d.at) >= since)
  const sx = symptoms.items.filter((s) => new Date(s.created_at) >= since).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const visits = appts.items.filter((a) => new Date(a.date_time) >= since).sort((a, b) => a.date_time.localeCompare(b.date_time))

  const share = async () => {
    const text = [
      `Relatório MedTracker — ${user?.name} (${days} dias)`,
      `Adesão geral: ${stats.pct ?? '—'}% (${stats.taken}/${stats.due} doses)`,
      '', 'Medicamentos:',
      ...perMed.map(({ m, pct, missed }) => `• ${m.name} ${m.dosage || ''} — ${medTimes(m).join(', ')} — adesão ${pct ?? '—'}%, ${missed} esquecida(s)`),
      sx.length ? '\nSintomas:' : '',
      ...sx.slice(0, 15).map((s) => `• ${new Date(s.created_at).toLocaleDateString('pt-BR')}: ${s.description} (${s.intensity ?? s.severity}/10)`),
    ].filter((l) => l !== '').join('\n')
    try {
      if (navigator.share) await navigator.share({ title: 'Relatório MedTracker', text })
      else { await navigator.clipboard.writeText(text); toast.success('Relatório copiado. Cole no WhatsApp ou e-mail.') }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="fade-up">
      <div className="no-print flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div><span className="label">Para levar à consulta</span><h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand mt-1">Relatório</h1>
          <p className="text-sm text-faint mt-1">Adesão, doses esquecidas e sintomas do período. Imprima ou salve em PDF.</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 p-1 rounded-full bg-surface border border-line">
            {PERIODS.map(([v, l]) => <button key={v} onClick={() => setDays(v)} className={`px-3 h-9 rounded-full text-xs font-medium ${days === v ? 'bg-brand text-on-brand' : 'text-sub hover:bg-muted'}`}>{l}</button>)}
          </div>
          <button onClick={share} className="btn-outline"><Share2 className="w-4 h-4" />Compartilhar</button>
          <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" />Imprimir / PDF</button>
        </div>
      </div>

      <article className="card p-6 sm:p-8 space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <div className="flex items-center gap-2 text-brand"><FileText className="w-5 h-5" /><span className="font-display text-xl font-semibold">Relatório de acompanhamento</span></div>
            <div className="mt-2 text-sm">{user?.name}{profile?.birth_date ? ` · nasc. ${new Date(profile.birth_date + 'T12:00').toLocaleDateString('pt-BR')}` : ''}</div>
            <div className="text-xs text-faint">Período: {since.toLocaleDateString('pt-BR')} a {new Date().toLocaleDateString('pt-BR')}</div>
          </div>
          <div className="text-right">
            <div className="label">Adesão geral</div>
            <div className={`font-display text-4xl font-semibold ${stats.pct == null ? 'text-faint' : stats.pct >= 80 ? 'text-ok' : stats.pct >= 50 ? 'text-accent' : 'text-danger'}`}>{stats.pct ?? '—'}{stats.pct != null && '%'}</div>
            <div className="text-xs text-faint">{stats.taken} de {stats.due} doses</div>
          </div>
        </header>

        {(profile?.allergies || profile?.conditions) && (
          <section className="grid sm:grid-cols-2 gap-4 text-sm">
            {profile.allergies && <div><div className="label !text-danger">Alergias</div><div className="mt-1">{profile.allergies}</div></div>}
            {profile.conditions && <div><div className="label">Condições</div><div className="mt-1">{profile.conditions}</div></div>}
          </section>
        )}

        <section>
          <h2 className="font-display text-lg font-medium text-brand mb-3">Medicamentos em uso</h2>
          {perMed.length === 0 ? <p className="text-sm text-faint">Nenhum medicamento com horário.</p> : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[560px]">
                <thead><tr className="text-left text-faint text-xs uppercase tracking-wider"><th className="p-2 font-medium">Medicamento</th><th className="p-2 font-medium">Horários</th><th className="p-2 font-medium text-right">Tomadas</th><th className="p-2 font-medium text-right">Puladas</th><th className="p-2 font-medium text-right">Esquecidas</th><th className="p-2 font-medium text-right">Adesão</th></tr></thead>
                <tbody>
                  {perMed.map(({ m, taken, skipped, missed, pct }) => (
                    <tr key={m.id} className="border-t border-line">
                      <td className="p-2"><div className="font-medium">{m.name}</div><div className="text-xs text-faint">{[m.dosage, m.prescribed_by].filter(Boolean).join(' · ')}</div></td>
                      <td className="p-2 tabular-nums">{medTimes(m).join(', ')}</td>
                      <td className="p-2 text-right tabular-nums">{taken}</td>
                      <td className="p-2 text-right tabular-nums">{skipped}</td>
                      <td className={`p-2 text-right tabular-nums ${missed ? 'text-danger font-medium' : ''}`}>{missed}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{pct ?? '—'}{pct != null && '%'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {prnLogs.length > 0 && <p className="text-sm mt-3"><span className="text-faint">Uso “se necessário” no período:</span> {Object.entries(prnLogs.reduce((acc, d) => ({ ...acc, [d.med_name]: (acc[d.med_name] || 0) + 1 }), {})).map(([n, c]) => `${n} (${c}x)`).join(', ')}</p>}
        </section>

        <section>
          <h2 className="font-display text-lg font-medium text-brand mb-3">Sintomas registrados ({sx.length})</h2>
          {sx.length === 0 ? <p className="text-sm text-faint">Nenhum sintoma no período.</p> : (
            <ul className="divide-y divide-line">
              {sx.map((s) => (
                <li key={s.id} className="py-2.5 flex gap-3 text-sm">
                  <span className="w-24 shrink-0 text-faint tabular-nums">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                  <span className={`chip h-fit ${SEVERITY[s.severity]?.cls}`}>{s.intensity ?? '—'}/10</span>
                  <span className="flex-1">{s.description}{s.medication_name && <span className="text-faint"> · após {s.medication_name}</span>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {visits.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-medium text-brand mb-3">Consultas</h2>
            <ul className="space-y-2 text-sm">
              {visits.map((a) => <li key={a.id}><span className="text-faint tabular-nums">{new Date(a.date_time).toLocaleDateString('pt-BR')}</span> — {a.title}{a.doctor_name ? ` (${a.doctor_name})` : ''}{a.questions?.length ? <div className="text-xs text-sub ml-4">Perguntas: {a.questions.join('; ')}</div> : null}</li>)}
            </ul>
          </section>
        )}

        <footer className="text-xs text-faint border-t border-line pt-4">Gerado pelo MedTracker Pro em {new Date().toLocaleString('pt-BR')}. Dados informados pelo paciente.</footer>
      </article>
    </div>
  )
}
