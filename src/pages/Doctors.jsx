import { useState } from 'react'
import { toast } from 'sonner'
import { Stethoscope, Plus, Edit3, Trash2, Phone, Mail, MessageCircle, MapPin } from 'lucide-react'
import { db } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { Empty, Field, IconTile, Modal, PageHeader, Skeleton } from '@/components/ui'

const EMPTY = { name: '', specialty: '', crm: '', phone: '', email: '', address: '', notes: '' }
const digits = (s) => String(s || '').replace(/\D/g, '')
const whatsapp = (phone) => { const d = digits(phone); return d ? `https://wa.me/${d.length <= 11 ? `55${d}` : d}` : null }

export function DoctorForm({ open, onClose, initial }) {
  const [form, setForm] = useState(EMPTY)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) { setLastOpen(open); if (open) setForm({ ...EMPTY, ...initial }) }
  const set = (p) => setForm((f) => ({ ...f, ...p }))
  const editing = Boolean(initial?.id)

  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome')
    try {
      if (editing) await db.update('doctors', initial.id, { ...initial, ...form })
      else await db.create('doctors', form)
      toast.success(editing ? 'Médico atualizado' : 'Médico cadastrado'); onClose()
    } catch { toast.error('Não foi possível salvar') }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar médico' : 'Novo médico'}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={save}>Salvar</button></>}>
      <div className="grid gap-4">
        <Field label="Nome"><input className="field" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Dra. Maria Souza" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Especialidade"><input className="field" value={form.specialty} onChange={(e) => set({ specialty: e.target.value })} placeholder="Cardiologia" /></Field>
          <Field label="CRM"><input className="field" value={form.crm} onChange={(e) => set({ crm: e.target.value })} placeholder="12345/SP" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone"><input className="field" type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(11) 99999-0000" /></Field>
          <Field label="E-mail"><input className="field" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        </div>
        <Field label="Endereço do consultório"><input className="field" value={form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="Observações"><textarea className="field" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export default function Doctors() {
  const { items, loading } = useCollection('doctors')
  const { items: meds } = useCollection('medications')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const remove = async (d) => {
    if (!window.confirm(`Excluir ${d.name}?`)) return
    await db.remove('doctors', d.id); toast.success('Removido')
  }

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Sua rede de cuidado" title="Médicos" subtitle="Contatos, especialidades e o que cada um prescreveu."
        actions={<button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary"><Plus className="w-4 h-4" />Novo médico</button>} />
      {loading ? <Skeleton rows={3} className="h-32" /> : items.length === 0 ? (
        <div className="card p-6"><Empty icon={<Stethoscope className="w-6 h-6" />} title="Nenhum médico cadastrado" text="Cadastre para ligar com um toque e vincular receitas e consultas." action="Cadastrar" onAction={() => setOpen(true)} /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((d) => {
            const prescribed = meds.filter((m) => m.prescribed_by && m.prescribed_by.toLowerCase().includes(d.name.toLowerCase().replace(/^dra?\.?\s*/, '')))
            const wa = whatsapp(d.phone)
            return (
              <article key={d.id} className="card p-5 flex flex-col">
                <div className="flex items-start gap-3">
                  <IconTile><Stethoscope className="w-4 h-4" /></IconTile>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-medium truncate">{d.name}</h3>
                    <p className="text-xs text-faint">{[d.specialty, d.crm && `CRM ${d.crm}`].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                </div>
                {d.address && <p className="mt-3 text-xs text-sub flex gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{d.address}</p>}
                {prescribed.length > 0 && <p className="mt-3 text-xs text-sub">Prescreveu: {prescribed.map((m) => m.name).join(', ')}</p>}
                {d.notes && <p className="mt-3 text-xs text-faint border-t border-line pt-3">{d.notes}</p>}
                <div className="mt-auto pt-5 flex flex-wrap gap-2">
                  {d.phone && <a href={`tel:${digits(d.phone)}`} className="btn-outline btn-sm"><Phone className="w-3.5 h-3.5" />Ligar</a>}
                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-outline btn-sm"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</a>}
                  {d.email && <a href={`mailto:${d.email}`} className="btn-outline btn-sm px-3" aria-label="E-mail"><Mail className="w-3.5 h-3.5" /></a>}
                  <button onClick={() => { setEditing(d); setOpen(true) }} className="btn-outline btn-sm px-3" aria-label="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(d)} className="btn-danger btn-sm px-3" aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <DoctorForm open={open} onClose={() => setOpen(false)} initial={editing} />
    </div>
  )
}
