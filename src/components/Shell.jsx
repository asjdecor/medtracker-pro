import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Pill, LayoutDashboard, Sparkles, CalendarDays, Activity, Stethoscope, FileText, UserCircle2,
  LogOut, Menu, X, HeartPulse, Cloud, HardDrive, Moon, Sun,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useCollection, useLocalSetting } from '@/lib/hooks'
import { dueSlots, notify } from '@/lib/reminders'
import SOSButton from './SOSButton'
import InstallBanner from './InstallBanner'

export const NAV = [
  { to: '/hoje', label: 'Hoje', icon: LayoutDashboard },
  { to: '/medicamentos', label: 'Medicamentos', short: 'Remédios', icon: Pill },
  { to: '/ia', label: 'IA Clínica', short: 'IA', icon: Sparkles },
  { to: '/agenda', label: 'Consultas', short: 'Agenda', icon: CalendarDays },
  { to: '/diario', label: 'Diário de sintomas', short: 'Diário', icon: Activity },
  { to: '/medicos', label: 'Médicos', icon: Stethoscope },
  { to: '/relatorio', label: 'Relatório', icon: FileText },
  { to: '/emergencia', label: 'Cartão de emergência', icon: HeartPulse },
  { to: '/perfil', label: 'Perfil e ajustes', icon: UserCircle2 },
]
const BOTTOM = NAV.slice(0, 4)

function Avatar({ user, className = 'w-10 h-10' }) {
  return user?.picture
    ? <img src={user.picture} alt="" className={`${className} rounded-full object-cover border border-line`} referrerPolicy="no-referrer" />
    : <div className={`${className} rounded-full bg-muted text-brand flex items-center justify-center font-display font-semibold`}>{(user?.name || '?').slice(0, 1).toUpperCase()}</div>
}

export function Logo({ small }) {
  return (
    <div className={`${small ? 'w-8 h-8 rounded-xl' : 'w-10 h-10 rounded-2xl'} shrink-0 bg-brand flex items-center justify-center`}>
      <Pill className={small ? 'w-4 h-4 text-on-brand' : 'w-5 h-5 text-on-brand'} strokeWidth={2} />
    </div>
  )
}

export function useTheme() {
  const [theme, setTheme] = useLocalSetting('mt.theme', null)
  const dark = theme ? theme === 'dark' : document.documentElement.classList.contains('dark')
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  return { dark, toggle: () => setTheme(dark ? 'light' : 'dark') }
}

// Fires a notification + toast when a dose becomes due while the app is open.
function ReminderEngine() {
  const { items: meds } = useCollection('medications')
  const { items: doses } = useCollection('doses')
  useEffect(() => {
    const tick = () => {
      for (const s of dueSlots(meds, doses)) {
        const body = `${s.med.dosage || 'Dose'} · ${s.time}${s.med.with_food ? ' · com alimento' : ''}`
        notify(`Hora de tomar ${s.med.name}`, body, s.key)
        toast(`💊 Hora de tomar ${s.med.name}`, { description: body, duration: 15000 })
      }
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [meds, doses])
  return null
}

export default function Shell({ children }) {
  const { user, signOut } = useAuth()
  const { dark, toggle } = useTheme()
  const location = useLocation()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [location.pathname])
  const current = NAV.find((l) => location.pathname.startsWith(l.to))

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'bg-brand text-on-brand' : 'text-sub hover:bg-muted hover:text-brand'}`

  const ModeBadge = () => (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-faint">
      {user?.mode === 'cloud' ? <><Cloud className="w-3 h-3" /> Sincronizado</> : <><HardDrive className="w-3 h-3" /> Neste aparelho</>}
    </span>
  )

  return (
    <div className="min-h-screen bg-bg flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn-primary">Pular para o conteúdo</a>
      <ReminderEngine />

      <aside className="no-print hidden lg:flex w-64 shrink-0 flex-col bg-surface border-r border-line sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3">
          <Logo />
          <div>
            <div className="font-display text-lg font-semibold text-brand leading-tight">MedTracker</div>
            <div className="text-[10px] uppercase tracking-widest text-faint">Pro · gestão clínica</div>
          </div>
        </div>
        <nav className="px-3 flex-1 space-y-1 overflow-y-auto" aria-label="Principal">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={linkCls}><Icon className="w-4 h-4" />{label}</NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-line space-y-3">
          <button onClick={toggle} className="btn-ghost btn-sm w-full justify-start">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {dark ? 'Tema claro' : 'Tema escuro'}
          </button>
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <ModeBadge />
            </div>
            <button onClick={signOut} className="p-2 rounded-full text-faint hover:bg-muted hover:text-accent" title="Sair" aria-label="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print lg:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-line px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Logo small />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-faint leading-none">MedTracker</div>
              <div className="font-display font-medium text-brand text-sm truncate">{current?.label || 'MedTracker'}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="p-2 rounded-full text-faint hover:bg-muted" aria-label="Alternar tema">
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NavLink to="/perfil" aria-label="Perfil"><Avatar user={user} className="w-9 h-9" /></NavLink>
          </div>
        </header>

        <main id="main" className="print-area flex-1 p-4 sm:p-6 lg:p-10 max-w-[1400px] w-full mx-auto pb-32 lg:pb-12">
          {children}
        </main>

        <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Navegação inferior">
          <ul className="grid grid-cols-5 h-16">
            {BOTTOM.map(({ to, label, short, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => `h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive ? 'text-brand' : 'text-faint'}`}>
                  {({ isActive }) => (<>
                    <span className={`w-11 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-muted' : ''}`}><Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.4 : 2} /></span>
                    {short || label}
                  </>)}
                </NavLink>
              </li>
            ))}
            <li>
              <button onClick={() => setMore(true)} className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-faint" aria-label="Mais opções">
                <span className="w-11 h-8 rounded-full flex items-center justify-center"><Menu className="w-[18px] h-[18px]" /></span>
                Mais
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {more && (
        <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Mais opções">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMore(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-surface rounded-t-3xl p-5 fade-up" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3"><Avatar user={user} /><div><div className="text-sm font-medium">{user?.name}</div><ModeBadge /></div></div>
              <button onClick={() => setMore(false)} className="p-2 rounded-full hover:bg-muted" aria-label="Fechar"><X className="w-5 h-5" /></button>
            </div>
            <nav className="grid grid-cols-1 gap-1">
              {NAV.slice(4).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className={linkCls}><Icon className="w-4 h-4" />{label}</NavLink>
              ))}
              <button onClick={signOut} className="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium text-accent hover:bg-muted"><LogOut className="w-4 h-4" />Sair</button>
            </nav>
          </div>
        </div>
      )}

      <InstallBanner />
      <SOSButton />
    </div>
  )
}
