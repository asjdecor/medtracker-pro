import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Pill, Plus, Trash2, Edit3, Sparkles, Search, CalendarPlus, PackagePlus, Pause, Play } from 'lucide-react'
import { db } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { medTimes, stockDays } from '@/lib/schedule'
import { buildICS, download } from '@/lib/reminders'
import MedicationForm from '@/components/MedicationForm'
import { Empty, IconTile, Modal, PageHeader, Skeleton, Field } from '@/components/ui'

export default function Medications() {
  const { items, loading } = useCollection('medications')
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('active')
  const [restock, setRestock] = useState(null)
  const [restockQty, setRestockQty] = useState('')

  useEffect(() => {
    if (params.get('novo')) { setEditing(null); setOpen(true); setParams({}, { replace: true }) }
  }, [params, setParams])

  const list = useMemo(() => items
    .filter((m) => filter === 'all' || (filter === 'active' ? m.active : !m.active))
    .filter((m) => !q || `${m.name} ${m.notes} ${m.prescribed_by}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [items, q, filter])

  const remove = async (m) => {
    if (!window.confirm(`Excluir ${m.name}? O histórico de doses é mantido.`)) return
    await db.remove('medications', m.id)
    toast.success('Medicamento removido')
  }
  const toggle = (m) => db.update('medications', m.id, { ...m, active: !m.active }).then(() => toast.success(m.active ? 'Pausado' : 'Retomado'))
  const doRestock = async () => {
    const n = Number(restockQty)
    if (!(n > 0)) return toast.error('Informe a quantidade comprada')
    await db.update('medications', restock.id, { ...restock, stock_qty: (Number(restock.stock_qty) || 0) + n })
    toast.success('Estoque atualizado'); setRestock(null); setRestockQty('')
  }
  const exportCalendar = () => {
    const active = items.filter((m) => m.active && !m.as_needed)
    if (!active.length) return toast.error('Nenhum medicamento com horário para exportar')
    download('medtracker-doses.ics', buildICS(active), 'text/calendar')
    toast.success('Abra o arquivo para adicionar os alarmes à sua agenda')
  }

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Farmácia pessoal" title="Medicamentos" subtitle="Doses, horários, estoque e duração do tratamento."
        actions={<>
          <button onClick={exportCalendar} className="btn-outline" title="Alarmes que tocam mesmo com o app fechado"><CalendarPlus className="w-4 h-4" />Alarmes na agenda</button>
          <Link to="/ia" className="btn-outline"><Sparkles className="w-4 h-4" />Ler receita</Link>
          <button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary"><Plus className="w-4 h-4" />Novo</button>
        </>} />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input className="field pl-11" placeholder="Buscar medicamento…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-surface border border-line self-start">
          {[['active', 'Em uso'], ['paused', 'Pausados'], ['all', 'Todos']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`px-4 h-9 rounded-full text-xs font-medium ${filter === v ? 'bg-brand text-on-brand' : 'text-sub hover:bg-muted'}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"><Skeleton rows={3} className="h-48" /></div> : list.length === 0 ? (
        <div className="card p-6">
          <Empty icon={<Pill className="w-6 h-6" />} title={items.length ? 'Nada encontrado' : 'Nenhum medicamento ainda'}
            text={items.length ? 'Tente outra busca ou filtro.' : 'Adicione manualmente ou fotografe a receita para a IA preencher.'}
            action={items.length ? null : 'Adicionar'} onAction={() => setOpen(true)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => {
            const days = stockDays(m)
            const low = days != null && days <= (Number(m.low_stock_days) || 7)
            const times = medTimes(m)
            return (
              <article key={m.id} className="card p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <IconTile><Pill className="w-4 h-4" /></IconTile>
                  <div className="flex flex-wrap justify-end gap-1">
                    {low && <span className="chip border-danger/30 text-danger bg-danger/10">estoque baixo</span>}
                    <span className={`chip ${m.active ? 'border-ok/30 text-ok bg-ok/10' : 'border-line text-faint'}`}>{m.active ? 'em uso' : 'pausado'}</span>
                  </div>
                </div>
                <h3 className="mt-4 font-display text-lg font-medium">{m.name}</h3>
                <p className="text-xs text-faint mt-1">{[m.dosage, m.form].filter(Boolean).join(' · ') || 'sem dosagem'}</p>
                <dl className="mt-4 space-y-1.5 text-xs flex-1">
                  <div className="flex justify-between gap-3"><dt className="text-faint">Quando</dt><dd className="text-right tabular-nums">{m.as_needed ? 'se necessário' : times.length ? times.join(' · ') : '—'}</dd></div>
                  {m.with_food && <div className="flex justify-between"><dt className="text-faint">Alimento</dt><dd>tomar junto</dd></div>}
                  {(m.start_date || m.end_date) && <div className="flex justify-between"><dt className="text-faint">Período</dt><dd>{m.start_date ? new Date(m.start_date + 'T12:00').toLocaleDateString('pt-BR') : '…'} → {m.end_date ? new Date(m.end_date + 'T12:00').toLocaleDateString('pt-BR') : 'contínuo'}</dd></div>}
                  {m.stock_qty !== '' && m.stock_qty != null && <div className="flex justify-between"><dt className="text-faint">Estoque</dt><dd className={low ? 'text-danger font-medium' : ''}>{m.stock_qty} un.{days != null ? ` · ~${days} dia(s)` : ''}</dd></div>}
                  {m.prescribed_by && <div className="flex justify-between gap-3"><dt className="text-faint">Prescrito por</dt><dd className="truncate">{m.prescribed_by}</dd></div>}
                </dl>
                {m.notes && <p className="mt-3 text-xs text-sub border-t border-line pt-3">{m.notes}</p>}
                <div className="mt-5 flex gap-2">
                  <button onClick={() => { setEditing(m); setOpen(true) }} className="btn-outline btn-sm flex-1"><Edit3 className="w-3.5 h-3.5" />Editar</button>
                  <button onClick={() => { setRestock(m); setRestockQty('') }} className="btn-outline btn-sm px-3" title="Registrar compra" aria-label={`Repor estoque de ${m.name}`}><PackagePlus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggle(m)} className="btn-outline btn-sm px-3" title={m.active ? 'Pausar' : 'Retomar'} aria-label={m.active ? 'Pausar' : 'Retomar'}>{m.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</button>
                  <button onClick={() => remove(m)} className="btn-danger btn-sm px-3" aria-label={`Excluir ${m.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <MedicationForm open={open} onClose={() => setOpen(false)} initial={editing} />

      <Modal open={!!restock} onClose={() => setRestock(null)} title="Repor estoque" description={restock ? `${restock.name} · atual: ${restock.stock_qty || 0} un.` : ''}
        footer={<><button className="btn-ghost" onClick={() => setRestock(null)}>Cancelar</button><button className="btn-primary" onClick={doRestock}>Adicionar</button></>}>
        <Field label="Unidades compradas"><input type="number" min="1" className="field" value={restockQty} onChange={(e) => setRestockQty(e.target.value)} placeholder="30" autoFocus /></Field>
      </Modal>
    </div>
  )
}
