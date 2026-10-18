import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarDays, Plus, Edit3, Trash2, CalendarPlus, MapPin, CheckCircle2, Circle, X } from 'lucide-react'
import { db } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { download } from '@/lib/reminders'
import { Empty, Field, Modal, PageHeader, Skeleton, VoiceButton } from '@/components/ui'

const EMPTY = { title: '', date_time: '', doctor_id: '', doctor_name: '', location: '', notes: '', questions: [], done: false }

function apptICS(a) {
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const start = new Date(a.date_time)
  const end = new Date(start.getTime() + 60 * 60000)
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedTracker Pro//PT-BR', 'BEGIN:VEVENT',
    `UID:${a.id}@medtracker-pro`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`🩺 ${a.title || 'Consulta'}${a.doctor_name ? ` - ${a.doctor_name}` : ''}`)}`,
    `LOCATION:${esc(a.location)}`,
    `DESCRIPTION:${esc([a.notes, a.questions?.length ? `Perguntas: ${a.questions.join('; ')}` : ''].filter(Boolean).join('\n'))}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Consulta amanhã', 'TRIGGER:-P1D', 'END:VALARM',
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Consulta em 2 horas', 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

function AppointmentForm({ open, onClose, initial }) {
  const { items: doctors } = useCollection('doctors')
  const [form, setForm] = useState(EMPTY)
  const [q, setQ] = useState('')
  useEffect(() => { if (open) { setForm({ ...EMPTY, ...initial }); setQ('') } }, [open, initial])
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const editing = Boolean(initial?.id)

  const save = async () => {
    if (!form.date_time) return toast.error('Escolha data e hora')
    const doc = doctors.find((d) => d.id === form.doctor_id)
    const payload = { ...form, doctor_name: doc?.name || form.doctor_name, location: form.location || doc?.address || '', title: form.title || (doc?.specialty ? `Consulta de ${doc.specialty}` : 'Consulta') }
    try {
      if (editing) await db.update('appointments', initial.id, { ...initial, ...payload })
      else await db.create('appointments', payload)
      toast.success('Consulta salva'); onClose()
    } catch { toast.error('Não foi possível salvar') }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar consulta' : 'Nova consulta'} description="Anote as perguntas para não esquecer nada na hora."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="grid gap-4">
        <Field label="Data e hora"><input type="datetime-local" className="field" value={form.date_time} onChange={(e) => set({ date_time: e.target.value })} autoFocus /></Field>
        <Field label="Médico">
          <select className="field" value={form.doctor_id} onChange={(e) => set({ doctor_id: e.target.value })}>
            <option value="">— sem vínculo —</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ''}</option>)}
          </select>
        </Field>
        <Field label="Título"><input className="field" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Retorno cardiologista, exame de sangue…" /></Field>
        <Field label="Local"><input className="field" value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Endereço ou teleconsulta" /></Field>
        <Field label="Perguntas para o médico">
          <ul className="space-y-1.5 mb-2">
            {form.questions.map((x, i) => (
              <li key={i} className="flex items-center gap-2 text-sm bg-muted rounded-2xl px-3 py-2">
                <span className="flex-1">{x}</span>
                <button type="button" onClick={() => set({ questions: form.questions.filter((_, j) => j !== i) })} aria-label="Remover pergunta"><X className="w-3.5 h-3.5 text-faint" /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posso tomar com café?"
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); set({ questions: [...form.questions, q.trim()] }); setQ('') } }} />
            <button type="button" className="btn-outline" onClick={() => { if (q.trim()) { set({ questions: [...form.questions, q.trim()] }); setQ('') } }}><Plus className="w-4 h-4" /></button>
          </div>
        </Field>
        <Field label="Anotações" aside={<VoiceButton value={form.notes} onChange={(v) => set({ notes: v })} />}>
          <textarea className="field" rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="O que o médico disse, exames pedidos…" />
        </Field>
      </div>
    </Modal>
  )
}

export default function Appointments() {
  const { items, loading } = useCollection('appointments')
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  useEffect(() => { if (params.get('novo')) { setEditing(null); setOpen(true); setParams({}, { replace: true }) } }, [params, setParams])

  const now = new Date()
  const sorted = [...items].sort((a, b) => a.date_time.localeCompare(b.date_time))
  const upcoming = sorted.filter((a) => new Date(a.date_time) >= new Date(now.toDateString()) && !a.done)
  const past = sorted.filter((a) => !upcoming.includes(a)).reverse()

  const Card = (a) => {
    const d = new Date(a.date_time)
    return (
      <article key={a.id} className={`card p-5 flex gap-4 ${a.done ? 'opacity-70' : ''}`}>
        <div className="w-16 shrink-0 text-center rounded-2xl bg-muted py-2">
          <div className="text-[10px] uppercase tracking-widest text-faint">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
          <div className="font-display text-2xl font-semibold text-brand leading-none mt-0.5">{d.getDate()}</div>
          <div className="text-xs text-sub mt-1 tabular-nums">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium">{a.title}</h3>
          <p className="text-xs text-faint mt-0.5">{d.toLocaleDateString('pt-BR', { weekday: 'long' })}{a.doctor_name ? ` · ${a.doctor_name}` : ''}</p>
          {a.location && <p className="text-xs text-sub mt-2 flex gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{a.location}</p>}
          {a.questions?.length > 0 && (
            <ul className="mt-3 text-xs text-sub list-disc pl-4 space-y-0.5">{a.questions.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
          {a.notes && <p className="mt-3 text-xs text-faint border-t border-line pt-3 whitespace-pre-line">{a.notes}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => db.update('appointments', a.id, { ...a, done: !a.done })} className="btn-outline btn-sm">
              {a.done ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Circle className="w-3.5 h-3.5" />}{a.done ? 'Realizada' : 'Marcar realizada'}
            </button>
            {!a.done && <button onClick={() => download('consulta.ics', apptICS(a), 'text/calendar')} className="btn-outline btn-sm"><CalendarPlus className="w-3.5 h-3.5" />Agenda</button>}
            <button onClick={() => { setEditing(a); setOpen(true) }} className="btn-outline btn-sm px-3" aria-label="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={() => window.confirm('Excluir esta consulta?') && db.remove('appointments', a.id)} className="btn-danger btn-sm px-3" aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Agenda" title="Consultas e exames" subtitle="Datas, perguntas para o médico e anotações da consulta."
        actions={<button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary"><Plus className="w-4 h-4" />Nova consulta</button>} />
      {loading ? <Skeleton rows={3} className="h-28" /> : items.length === 0 ? (
        <div className="card p-6"><Empty icon={<CalendarDays className="w-6 h-6" />} title="Nenhuma consulta" text="Agende e receba o alarme um dia antes e duas horas antes." action="Agendar" onAction={() => setOpen(true)} /></div>
      ) : (
        <div className="space-y-8">
          <section><div className="label mb-3">Próximas</div>{upcoming.length ? <div className="grid lg:grid-cols-2 gap-4">{upcoming.map(Card)}</div> : <p className="text-sm text-faint">Nenhuma consulta futura.</p>}</section>
          {past.length > 0 && <section><div className="label mb-3">Histórico</div><div className="grid lg:grid-cols-2 gap-4">{past.map(Card)}</div></section>}
        </div>
      )}
      <AppointmentForm open={open} onClose={() => setOpen(false)} initial={editing} />
    </div>
  )
}
