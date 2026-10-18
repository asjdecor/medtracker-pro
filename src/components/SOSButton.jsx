import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Siren, HeartPulse, UserRound } from 'lucide-react'
import { getProfile } from '@/lib/db'
import { Modal } from './ui'

const SERVICES = [
  { n: '192', label: 'SAMU', text: 'Emergência médica' },
  { n: '193', label: 'Bombeiros', text: 'Resgate e acidentes' },
  { n: '190', label: 'Polícia', text: 'Segurança' },
  { n: '0800 722 6001', label: 'Disque-Intoxicação (Anvisa)', text: 'Intoxicação por medicamentos' },
]

export default function SOSButton() {
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState([])
  useEffect(() => { if (open) getProfile().then((p) => setContacts(p?.emergency_contacts || [])).catch(() => {}) }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="no-print fixed z-30 right-4 bottom-24 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full bg-danger text-white shadow-lg shadow-danger/30 flex items-center justify-center font-semibold text-sm hover:scale-105 transition-transform"
        aria-label="SOS — emergência"
      >
        SOS
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Emergência" description="Toque para ligar. Em caso de risco de vida, ligue 192 agora.">
        <a href="tel:192" className="flex items-center gap-4 p-4 rounded-2xl bg-danger text-white">
          <Siren className="w-8 h-8 shrink-0" />
          <div><div className="font-display text-2xl font-semibold">Ligar 192</div><div className="text-sm opacity-90">SAMU — atendimento médico de urgência</div></div>
        </a>
        <ul className="mt-3 grid gap-2">
          {SERVICES.slice(1).map((s) => (
            <li key={s.n}>
              <a href={`tel:${s.n.replace(/\s/g, '')}`} className="flex items-center gap-3 p-3 rounded-2xl border border-line hover:bg-muted">
                <Phone className="w-4 h-4 text-danger" />
                <div className="flex-1"><div className="text-sm font-medium">{s.label} · {s.n}</div><div className="text-xs text-faint">{s.text}</div></div>
              </a>
            </li>
          ))}
          {contacts.filter((c) => c.phone).map((c, i) => (
            <li key={i}>
              <a href={`tel:${c.phone}`} className="flex items-center gap-3 p-3 rounded-2xl border border-line hover:bg-muted">
                <UserRound className="w-4 h-4 text-brand" />
                <div className="flex-1"><div className="text-sm font-medium">{c.name || 'Contato'}{c.relation ? ` (${c.relation})` : ''}</div><div className="text-xs text-faint">{c.phone}</div></div>
              </a>
            </li>
          ))}
        </ul>
        <Link to="/emergencia" onClick={() => setOpen(false)} className="btn-outline w-full mt-4"><HeartPulse className="w-4 h-4" /> Mostrar cartão de emergência</Link>
      </Modal>
    </>
  )
}
