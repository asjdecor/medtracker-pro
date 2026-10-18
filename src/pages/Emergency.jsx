import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Printer, Phone, Edit3, Droplet, AlertTriangle, Pill } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getProfile } from '@/lib/db'
import { useCollection } from '@/lib/hooks'

const age = (iso) => {
  if (!iso) return null
  const b = new Date(iso + 'T12:00'), n = new Date()
  let a = n.getFullYear() - b.getFullYear()
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--
  return a
}

function Row({ label, value, strong }) {
  if (!value) return null
  return <div className="py-3 border-b border-line last:border-0"><div className="label">{label}</div><div className={`mt-1 ${strong ? 'text-xl font-semibold text-danger' : 'text-lg'}`}>{value}</div></div>
}

export default function Emergency() {
  const { user } = useAuth()
  const [p, setP] = useState(null)
  const { items: meds } = useCollection('medications')
  useEffect(() => { getProfile().then((x) => setP(x || {})) }, [])
  const active = meds.filter((m) => m.active)
  if (!p) return null
  const empty = !p.blood_type && !p.allergies && !p.conditions && !(p.emergency_contacts || []).length

  return (
    <div className="fade-up max-w-2xl mx-auto">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <div><span className="label">Mostre a quem for socorrer</span><h1 className="font-display text-3xl font-semibold text-brand mt-1">Cartão de emergência</h1></div>
        <div className="flex gap-2">
          <Link to="/perfil#saude" className="btn-outline"><Edit3 className="w-4 h-4" />Editar</Link>
          <button onClick={() => window.print()} className="btn-primary"><Printer className="w-4 h-4" />Imprimir</button>
        </div>
      </div>

      {empty && <div className="no-print rounded-2xl bg-warn/10 text-warn text-sm p-4 mb-5">Preencha sua ficha de saúde em Perfil para completar o cartão.</div>}

      <article className="card overflow-hidden">
        <div className="bg-danger text-white p-6 flex items-center gap-4">
          <HeartPulse className="w-10 h-10 shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-widest opacity-90">Informações médicas de emergência</div>
            <div className="font-display text-2xl sm:text-3xl font-semibold">{user?.name}</div>
            {age(p.birth_date) != null && <div className="text-sm opacity-90">{age(p.birth_date)} anos · nasc. {new Date(p.birth_date + 'T12:00').toLocaleDateString('pt-BR')}</div>}
          </div>
        </div>
        <div className="p-6">
          {p.blood_type && <div className="flex items-center gap-3 mb-2"><Droplet className="w-6 h-6 text-danger" /><span className="font-display text-4xl font-semibold text-danger">{p.blood_type}</span><span className="text-sm text-faint">tipo sanguíneo</span></div>}
          <Row label="⚠ Alergias" value={p.allergies || 'Nenhuma informada'} strong={!!p.allergies} />
          <Row label="Condições de saúde" value={p.conditions} />
          {active.length > 0 && (
            <div className="py-3 border-b border-line">
              <div className="label flex items-center gap-1.5"><Pill className="w-3.5 h-3.5" />Medicamentos em uso</div>
              <ul className="mt-2 space-y-1">{active.map((m) => <li key={m.id} className="text-base">{m.name}{m.dosage ? ` — ${m.dosage}` : ''}</li>)}</ul>
            </div>
          )}
          <Row label="Peso / altura" value={[p.weight && `${p.weight} kg`, p.height && `${p.height} cm`].filter(Boolean).join(' · ')} />
          <Row label="Cartão SUS" value={p.sus_card} />
          <Row label="Convênio" value={p.insurance} />
          {p.organ_donor && <Row label="Doação de órgãos" value="Sou doador(a)" />}
          {(p.emergency_contacts || []).filter((c) => c.phone).length > 0 && (
            <div className="pt-4">
              <div className="label">Avisar</div>
              <ul className="mt-2 space-y-2">
                {p.emergency_contacts.filter((c) => c.phone).map((c, i) => (
                  <li key={i}><a href={`tel:${c.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-muted"><Phone className="w-4 h-4 text-brand" /><span className="font-medium">{c.name}</span>{c.relation && <span className="text-faint text-sm">({c.relation})</span>}<span className="ml-auto tabular-nums">{c.phone}</span></a></li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex items-start gap-2 text-xs text-faint"><AlertTriangle className="w-4 h-4 shrink-0" />Emergência médica: ligue 192 (SAMU).</div>
        </div>
      </article>
    </div>
  )
}
