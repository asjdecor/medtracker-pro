import { useState } from 'react'
import { toast } from 'sonner'
import { Bell, ShieldCheck, Sparkles, Mail, HardDrive, Cloud, CalendarCheck, Loader2, PackageCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/Shell'
import { VoiceButton } from '@/components/ui'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

const FEATURES = [
  { icon: Sparkles, label: 'IA de receitas', text: 'Foto da receita vira lista de remédios' },
  { icon: Bell, label: 'Lembretes', text: 'Notificações e alarmes na agenda' },
  { icon: CalendarCheck, label: 'Adesão', text: 'Marque doses e acompanhe sua sequência' },
  { icon: PackageCheck, label: 'Estoque', text: 'Aviso antes do remédio acabar' },
]

export default function Login() {
  const { cloudEnabled, signInWithEmail, signInWithGoogle, startLocal } = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const sendLink = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Digite um e-mail válido')
    setBusy(true)
    try { await signInWithEmail(email); setSent(true) }
    catch (err) { toast.error(err.message || 'Não foi possível enviar o link') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] min-h-screen">
        <div className="relative flex flex-col justify-between gap-10 p-6 sm:p-12 lg:p-16 grain">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="font-display text-xl font-semibold text-brand">MedTracker <span className="text-accent">Pro</span></div>
          </div>

          <div className="max-w-xl">
            <span className="label">Gestão inteligente de medicamentos</span>
            <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold text-brand leading-[1.05]">
              Cuidar da sua saúde, <br /><span className="text-accent">com precisão clínica.</span>
            </h1>
            <p className="mt-5 text-sub text-lg leading-relaxed">
              Doses do dia, estoque, consultas, sintomas e uma IA que lê receitas. Gratuito, instalável e em português.
            </p>

            <div className="mt-8 card p-5 sm:p-6 space-y-4">
              {cloudEnabled && (
                <>
                  <div className="flex items-center gap-2 text-sm font-medium"><Cloud className="w-4 h-4 text-brand" /> Entrar com conta (sincroniza entre aparelhos)</div>
                  <button onClick={() => signInWithGoogle().catch((e) => toast.error(e.message))} className="btn-outline w-full">
                    <GoogleIcon /> Continuar com Google
                  </button>
                  {sent ? (
                    <div className="rounded-2xl bg-ok/10 text-ok text-sm p-4">Enviamos um link para <b>{email}</b>. Abra o e-mail neste aparelho para entrar.</div>
                  ) : (
                    <form onSubmit={sendLink} className="flex flex-col sm:flex-row gap-2">
                      <input className="field" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
                      <button className="btn-primary shrink-0" disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Receber link</button>
                    </form>
                  )}
                  <div className="flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
                </>
              )}
              <div className="flex items-center gap-2 text-sm font-medium"><HardDrive className="w-4 h-4 text-brand" /> Usar sem conta, só neste aparelho</div>
              <form onSubmit={(e) => { e.preventDefault(); startLocal(name) }} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input className="field pr-28" placeholder="Como podemos te chamar?" value={name} onChange={(e) => setName(e.target.value)} aria-label="Seu nome" />
                  <VoiceButton value="" onChange={(v) => setName(v.replace(/^(meu nome (e|é)|me chamo|eu sou|sou o|sou a)\s+/i, ''))} className="absolute right-1 top-1" />
                </div>
                <button className={cloudEnabled ? 'btn-outline shrink-0' : 'btn-primary shrink-0'}>Começar</button>
              </form>
              <p className="flex items-start gap-2 text-xs text-faint">
                <ShieldCheck className="w-4 h-4 text-ok shrink-0" />
                {cloudEnabled ? 'Com conta, cada pessoa só enxerga os próprios dados. Sem conta, nada sai do seu aparelho.' : 'Seus dados ficam guardados apenas neste aparelho. Faça backup em Perfil.'}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FEATURES.map(({ icon: Icon, label, text }) => (
                <div key={label} className="card p-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-brand"><Icon className="w-4 h-4" /></div>
                  <div className="mt-3 font-display font-medium text-sm text-brand">{label}</div>
                  <div className="mt-1 text-xs text-faint leading-relaxed">{text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-faint">© {new Date().getFullYear()} MedTracker Pro · Não substitui orientação médica.</div>
        </div>

        <div className="hidden lg:block relative overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80"
            alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1A4331]/70 via-[#1A4331]/10 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 bg-surface/95 backdrop-blur-md rounded-3xl p-6 border border-line">
            <span className="label">Feito para quem cuida</span>
            <p className="mt-3 leading-relaxed">
              Marque cada dose com um toque, saiba quando o remédio vai acabar e leve um relatório pronto para a próxima consulta.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
