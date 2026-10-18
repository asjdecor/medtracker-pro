import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Pill, Bell, Flame, PackageX, Check, SkipForward, Undo2, Clock, ArrowUpRight, Sparkles,
  CalendarDays, Activity, AlertTriangle, Plus,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCollection, useNow } from '@/lib/hooks'
import { slotsForDay, nextSlot, adherence, streak, stockDays, countdown } from '@/lib/schedule'
import { logSlot, undoSlot, logAsNeeded } from '@/lib/doses'
import { Empty, IconTile, Skeleton, Stat, SEVERITY } from '@/components/ui'

function greeting(d) {
  const h = d.getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

function SectionHeader({ title, subtitle, to, cta }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="font-display text-xl font-medium text-brand">{title}</h2>
        {subtitle && <p className="text-xs text-faint mt-0.5">{subtitle}</p>}
      </div>
      {to && <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-strong shrink-0">{cta} <ArrowUpRight className="w-3.5 h-3.5" /></Link>}
    </div>
  )
}

export default function Today() {
  const { user } = useAuth()
  const now = useNow(1000)
  const meds = useCollection('medications')
  const doses = useCollection('doses')
  const appts = useCollection('appointments')
  const symptoms = useCollection('symptoms')
  const loading = meds.loading || doses.loading

  // Recompute heavy stats once a minute, not every second.
  const minute = Math.floor(now.getTime() / 60000)
  const today = useMemo(() => slotsForDay(meds.items, new Date(), doses.items), [meds.items, doses.items, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => adherence(meds.items, doses.items, 7), [meds.items, doses.items, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const seq = useMemo(() => streak(meds.items, doses.items), [meds.items, doses.items])
  const next = useMemo(() => nextSlot(meds.items, doses.items, new Date()), [meds.items, doses.items, minute]) // eslint-disable-line react-hooks/exhaustive-deps
  const lowStock = meds.items.filter((m) => m.active && stockDays(m) != null && stockDays(m) <= (Number(m.low_stock_days) || 7))
  const prn = meds.items.filter((m) => m.active && m.as_needed)
  const upcoming = appts.items.filter((a) => new Date(a.date_time) >= new Date(now.toDateString())).sort((a, b) => a.date_time.localeCompare(b.date_time)).slice(0, 3)
  const recentSymptoms = [...symptoms.items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)

  const done = today.filter((s) => s.log?.status === 'taken').length
  const act = async (slot, status) => {
    try {
      await logSlot(slot, status)
      toast.success(status === 'taken' ? `${slot.med.name} marcado como tomado` : `${slot.med.name} pulado`)
    } catch { toast.error('Não foi possível registrar') }
  }

  const dateFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(now)

  return (
    <div className="fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <span className="label">{greeting(now)}, {user?.name?.split(' ')[0]}</span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand mt-1 first-letter:uppercase">{dateFmt}</h1>
          <p className="text-faint text-sm mt-1">
            {today.length ? `${done} de ${today.length} doses tomadas hoje.` : 'Sua rotina de medicamentos aparece aqui.'}
          </p>
        </div>
        <div className="card px-5 py-3 flex items-center gap-3 self-start sm:self-auto">
          <Clock className="w-4 h-4 text-brand" />
          <div className="font-display text-2xl tabular-nums font-semibold text-brand">{now.toLocaleTimeString('pt-BR', { hour12: false })}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <Stat label="Próxima dose" tone="accent" icon={<Bell className="w-4 h-4" />}
          value={next ? <span className="flex items-center gap-2"><span className="pulse-dot inline-block w-2 h-2 rounded-full bg-accent" />{countdown(next.at, now)}</span> : '—'}
          hint={next ? `${next.med.name} · ${next.time}` : 'nenhuma agendada'} />
        <Stat label="Adesão 7 dias" icon={<Check className="w-4 h-4" />} tone={stats.pct == null ? 'brand' : stats.pct >= 80 ? 'ok' : stats.pct >= 50 ? 'accent' : 'danger'}
          value={stats.pct == null ? '—' : `${stats.pct}%`} hint={`${stats.taken} de ${stats.due} doses`} />
        <Stat label="Sequência" icon={<Flame className="w-4 h-4" />} value={seq} hint={seq === 1 ? 'dia completo' : 'dias completos'} />
        <Stat label="Estoque baixo" icon={<PackageX className="w-4 h-4" />} tone={lowStock.length ? 'danger' : 'brand'}
          value={loading ? '—' : lowStock.length} hint={lowStock.length ? lowStock.map((m) => m.name).join(', ') : 'tudo em dia'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <section className="lg:col-span-2 card p-5 sm:p-6">
          <SectionHeader title="Doses de hoje" subtitle="Toque para registrar cada dose" to="/medicamentos" cta="Gerenciar" />
          {loading ? <Skeleton rows={4} /> : today.length === 0 && prn.length === 0 ? (
            <Empty icon={<Pill className="w-6 h-6" />} title="Nenhum medicamento agendado" text="Cadastre um remédio ou envie a foto da receita para a IA preencher." action="Adicionar medicamento" to="/medicamentos?novo=1" />
          ) : (
            <ol className="relative">
              {today.map((s) => {
                const late = !s.log && s.at < now && now - s.at > 30 * 60000
                const status = s.log?.status
                return (
                  <li key={s.key} className="flex items-center gap-3 sm:gap-4 py-3 border-b border-line last:border-0">
                    <div className={`w-14 text-center font-display tabular-nums font-semibold ${status === 'taken' ? 'text-ok' : late ? 'text-danger' : 'text-brand'}`}>{s.time}</div>
                    <IconTile tone={status === 'taken' ? 'ok' : late ? 'danger' : 'brand'}>{status === 'taken' ? <Check className="w-4 h-4" /> : <Pill className="w-4 h-4" />}</IconTile>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${status ? 'text-faint' : ''} ${status === 'skipped' ? 'line-through' : ''}`}>{s.med.name}</div>
                      <div className="text-xs text-faint truncate">
                        {s.med.dosage || 'dose'}{s.med.with_food ? ' · com alimento' : ''}
                        {status === 'taken' && ` · tomado às ${new Date(s.log.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        {status === 'skipped' && ' · pulado'}
                        {late && ' · atrasado'}
                      </div>
                    </div>
                    {status ? (
                      <button onClick={() => undoSlot(s).catch(() => toast.error('Falha ao desfazer'))} className="btn-ghost btn-sm" aria-label={`Desfazer ${s.med.name}`}><Undo2 className="w-4 h-4" /><span className="hidden sm:inline">Desfazer</span></button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button onClick={() => act(s, 'skipped')} className="btn-ghost btn-sm px-3" aria-label={`Pular ${s.med.name}`} title="Pular"><SkipForward className="w-4 h-4" /></button>
                        <button onClick={() => act(s, 'taken')} className="btn-primary btn-sm" aria-label={`Tomei ${s.med.name}`}><Check className="w-4 h-4" />Tomei</button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
          {prn.length > 0 && (
            <div className="mt-5 pt-5 border-t border-line">
              <div className="label mb-3">Se necessário</div>
              <div className="flex flex-wrap gap-2">
                {prn.map((m) => (
                  <button key={m.id} onClick={() => logAsNeeded(m).then(() => toast.success(`${m.name} registrado`))} className="btn-outline btn-sm"><Plus className="w-3.5 h-3.5" />{m.name}</button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <SectionHeader title="Adesão" subtitle="Doses tomadas nos últimos 7 dias" to="/relatorio" cta="Relatório" />
          {stats.due === 0 ? (
            <p className="text-sm text-faint">O gráfico aparece depois das primeiras doses registradas.</p>
          ) : (
            <div className="h-48 -ml-2" role="img" aria-label={`Adesão de ${stats.pct}% nos últimos 7 dias`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'rgb(var(--faint))', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip cursor={{ fill: 'rgb(var(--muted))' }} contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12 }}
                    formatter={(v, _n, p) => [v == null ? 'sem doses' : `${v}% (${p.payload.taken}/${p.payload.due})`, 'Adesão']} />
                  <Bar dataKey="pct" fill="rgb(var(--brand))" radius={[6, 6, 2, 2]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="mt-5 space-y-2">
              {lowStock.map((m) => (
                <div key={m.id} className="flex items-start gap-2 rounded-2xl bg-danger/10 text-danger p-3 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span><b>{m.name}</b>: {stockDays(m) === 0 ? 'acabou' : `restam ~${stockDays(m)} dia(s)`}. Hora de comprar.</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <section className="card p-5 sm:p-6">
          <SectionHeader title="Próximas consultas" to="/agenda" cta="Agenda" />
          {upcoming.length === 0 ? (
            <Empty icon={<CalendarDays className="w-6 h-6" />} title="Nada agendado" action="Agendar consulta" to="/agenda?novo=1" />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="p-4 rounded-2xl border border-line">
                  <div className="text-sm font-medium">{a.title || 'Consulta'}</div>
                  <div className="text-xs text-faint mt-0.5">{new Date(a.date_time).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{a.doctor_name ? ` · ${a.doctor_name}` : ''}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <SectionHeader title="Diário" subtitle="Últimos sintomas" to="/diario" cta="Ver todos" />
          {recentSymptoms.length === 0 ? (
            <Empty icon={<Activity className="w-6 h-6" />} title="Sem registros" text="Anotar como você se sente ajuda o médico a ver padrões." action="Registrar" to="/diario" />
          ) : (
            <ul className="space-y-3">
              {recentSymptoms.map((s) => (
                <li key={s.id} className="p-4 rounded-2xl border border-line">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`chip ${SEVERITY[s.severity]?.cls}`}>{SEVERITY[s.severity]?.label || s.severity}</span>
                    <span className="text-xs text-faint">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="mt-2 text-sm line-clamp-2">{s.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link to="/ia" className="card card-hover p-6 relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-muted" />
          <div className="relative">
            <IconTile tone="solid"><Sparkles className="w-5 h-5" /></IconTile>
            <div className="mt-6 label">IA Clínica</div>
            <h3 className="mt-2 font-display text-2xl font-semibold text-brand">Fotografe a receita</h3>
            <p className="mt-3 text-sm text-sub">A IA lê os remédios, monta os horários e cadastra tudo para você. Também resume exames e checa interações.</p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand group-hover:gap-3 transition-all">Abrir IA <ArrowUpRight className="w-4 h-4" /></div>
          </div>
        </Link>
      </div>
    </div>
  )
}
