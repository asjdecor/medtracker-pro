import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { db } from '@/lib/db'
import { medTimes } from '@/lib/schedule'
import { useCollection } from '@/lib/hooks'
import { Field, Modal, Toggle, VoiceButton } from './ui'

export const FORMS = ['comprimido', 'cápsula', 'gotas', 'xarope', 'solução', 'injeção', 'pomada/creme', 'inalador', 'adesivo', 'outro']

export const EMPTY_MED = {
  name: '', dosage: '', form: 'comprimido', schedule: 'times', times: ['08:00'], frequency_hours: 8, first_time: '08:00',
  start_date: '', end_date: '', with_food: false, as_needed: false, stock_qty: '', dose_qty: 1, low_stock_days: 7,
  prescribed_by: '', notes: '', active: true,
}

// New medications default to fixed times; saved ones keep the mode they were created with.
const normalize = (m) => {
  const legacy = m.id && !m.schedule ? (m.times?.length ? 'times' : 'interval') : null
  const schedule = m.as_needed ? 'prn' : m.schedule || legacy || EMPTY_MED.schedule
  return { ...EMPTY_MED, ...m, schedule, times: m.times?.length ? m.times : schedule === 'times' ? ['08:00'] : [] }
}

export default function MedicationForm({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(EMPTY_MED)
  const [newTime, setNewTime] = useState('12:00')
  const { items: doctors } = useCollection('doctors')
  const editing = Boolean(initial?.id)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => { if (open) setForm(normalize(initial || {})) }, [open, initial])

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return
    if (form.times.includes(newTime)) return toast.error('Esse horário já está na lista')
    set({ times: [...form.times, newTime].sort() })
  }

  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome do medicamento')
    if (form.schedule === 'times' && !form.times.length) return toast.error('Adicione pelo menos um horário')
    if (form.schedule === 'interval' && !(form.frequency_hours > 0 && form.frequency_hours <= 24)) return toast.error('Intervalo deve ser entre 1 e 24 horas')
    if (form.end_date && form.start_date && form.end_date < form.start_date) return toast.error('A data final é anterior à inicial')
    const payload = {
      ...form,
      name: form.name.trim(),
      as_needed: form.schedule === 'prn',
      times: form.schedule === 'times' ? form.times : [],
      frequency_hours: form.schedule === 'interval' ? Number(form.frequency_hours) : form.schedule === 'times' && form.times.length ? Math.round(24 / form.times.length) : 0,
      stock_qty: form.stock_qty === '' ? '' : Math.max(0, Number(form.stock_qty)),
      dose_qty: Math.max(0.25, Number(form.dose_qty) || 1),
    }
    try {
      const saved = editing ? await db.update('medications', initial.id, { ...initial, ...payload }) : await db.create('medications', payload)
      toast.success(editing ? 'Medicamento atualizado' : 'Medicamento adicionado')
      onSaved?.(saved)
      onClose()
    } catch { toast.error('Não foi possível salvar') }
  }

  const preview = form.schedule === 'interval' ? medTimes({ frequency_hours: form.frequency_hours, first_time: form.first_time }) : []

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? 'Editar medicamento' : 'Novo medicamento'}
      description="Horários, estoque e duração. Você pode pausar sem excluir."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="grid gap-4">
        <Field label="Nome e concentração">
          <input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Losartana 50 mg" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dose por tomada"><input className="field" value={form.dosage} onChange={(e) => set({ dosage: e.target.value })} placeholder="1 comprimido" /></Field>
          <Field label="Forma">
            <select className="field" value={form.form} onChange={(e) => set({ form: e.target.value })}>
              {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>

        <div>
          <span className="label">Como tomar</span>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup">
            {[['times', 'Horários fixos'], ['interval', 'A cada X horas'], ['prn', 'Se necessário']].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.schedule === v} onClick={() => set({ schedule: v })}
                className={`h-10 rounded-full text-xs font-medium border transition-colors ${form.schedule === v ? 'bg-brand text-on-brand border-brand' : 'border-line text-sub hover:bg-muted'}`}>{l}</button>
            ))}
          </div>
        </div>

        {form.schedule === 'times' && (
          <Field label="Horários">
            <div className="flex flex-wrap gap-2">
              {form.times.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-muted text-brand text-sm tabular-nums">
                  {t}
                  <button type="button" onClick={() => set({ times: form.times.filter((x) => x !== t) })} className="p-1 rounded-full hover:bg-line" aria-label={`Remover ${t}`}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input type="time" className="field w-36" value={newTime} onChange={(e) => setNewTime(e.target.value)} aria-label="Novo horário" />
              <button type="button" onClick={addTime} className="btn-outline"><Plus className="w-4 h-4" />Adicionar</button>
            </div>
          </Field>
        )}
        {form.schedule === 'interval' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Intervalo (horas)"><input type="number" min="1" max="24" className="field" value={form.frequency_hours} onChange={(e) => set({ frequency_hours: e.target.value })} /></Field>
            <Field label="Primeira dose"><input type="time" className="field" value={form.first_time} onChange={(e) => set({ first_time: e.target.value })} /></Field>
            {preview.length > 0 && <p className="col-span-2 text-xs text-faint -mt-1">Horários: {preview.join(' · ')}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Início"><input type="date" className="field" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field label="Fim (opcional)" hint="Vazio = uso contínuo"><input type="date" className="field" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} /></Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Estoque" hint="unidades"><input type="number" min="0" className="field" value={form.stock_qty} onChange={(e) => set({ stock_qty: e.target.value })} placeholder="30" /></Field>
          <Field label="Por dose" hint="unidades"><input type="number" min="0.25" step="0.25" className="field" value={form.dose_qty} onChange={(e) => set({ dose_qty: e.target.value })} /></Field>
          <Field label="Avisar com" hint="dias restantes"><input type="number" min="1" className="field" value={form.low_stock_days} onChange={(e) => set({ low_stock_days: e.target.value })} /></Field>
        </div>

        <Field label="Prescrito por">
          <input className="field" list="doctor-names" value={form.prescribed_by} onChange={(e) => set({ prescribed_by: e.target.value })} placeholder="Dr(a). …" />
          <datalist id="doctor-names">{doctors.map((d) => <option key={d.id} value={d.name} />)}</datalist>
        </Field>
        <Field label="Observações" aside={<VoiceButton value={form.notes} onChange={(v) => set({ notes: v })} />}>
          <textarea className="field" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Tomar após o café… (ou toque no microfone)" />
        </Field>
        <Toggle id="with-food" checked={form.with_food} onChange={(v) => set({ with_food: v })} label="Tomar com alimento" description="Mostra o aviso no lembrete" />
        <Toggle id="active" checked={form.active} onChange={(v) => set({ active: v })} label="Em uso" description="Aparece no painel e gera lembretes" />
      </div>
    </Modal>
  )
}
