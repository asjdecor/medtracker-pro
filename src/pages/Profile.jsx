import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import {
  KeyRound, Bell, Palette, Database, Download, Upload, Trash2, Plus, X, Loader2, CheckCircle2, ExternalLink, Cloud, HardDrive, UserRound, Type,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getProfile, saveProfile, exportAll, importAll, db, COLLECTIONS } from '@/lib/db'
import { getAISettings, saveAISettings, testKey, PROVIDERS } from '@/lib/ai'
import { notificationsSupported, requestPermission, notify, buildICS, download } from '@/lib/reminders'
import { useTheme } from '@/components/Shell'
import { useLocalSetting } from '@/lib/hooks'
import { Field, PageHeader, Toggle } from '@/components/ui'

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const EMPTY = { birth_date: '', blood_type: '', weight: '', height: '', allergies: '', conditions: '', sus_card: '', insurance: '', organ_donor: false, emergency_contacts: [] }

function Section({ id, icon: Icon, title, description, children }) {
  return (
    <section id={id} className="card p-5 sm:p-6 scroll-mt-24">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-muted text-brand flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
        <div><h2 className="font-display text-xl font-medium text-brand">{title}</h2>{description && <p className="text-xs text-faint mt-0.5">{description}</p>}</div>
      </div>
      {children}
    </section>
  )
}

function HealthSection() {
  const [p, setP] = useState(null)
  useEffect(() => { getProfile().then((x) => setP({ ...EMPTY, ...x })) }, [])
  if (!p) return null
  const set = (patch) => setP((cur) => ({ ...cur, ...patch }))
  const save = async () => { await saveProfile(p); toast.success('Ficha de saúde salva') }
  const contacts = p.emergency_contacts || []
  const setContact = (i, patch) => set({ emergency_contacts: contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  return (
    <Section id="saude" icon={UserRound} title="Ficha de saúde" description="Usada no cartão de emergência, nas interações e no relatório.">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Data de nascimento"><input type="date" className="field" value={p.birth_date} onChange={(e) => set({ birth_date: e.target.value })} /></Field>
        <Field label="Tipo sanguíneo"><select className="field" value={p.blood_type} onChange={(e) => set({ blood_type: e.target.value })}>{BLOOD.map((b) => <option key={b} value={b}>{b || '—'}</option>)}</select></Field>
        <Field label="Peso (kg)"><input type="number" className="field" value={p.weight} onChange={(e) => set({ weight: e.target.value })} /></Field>
        <Field label="Altura (cm)"><input type="number" className="field" value={p.height} onChange={(e) => set({ height: e.target.value })} /></Field>
        <Field label="Alergias" className="sm:col-span-2"><input className="field" value={p.allergies} onChange={(e) => set({ allergies: e.target.value })} placeholder="Dipirona, penicilina, frutos do mar…" /></Field>
        <Field label="Condições de saúde" className="sm:col-span-2"><input className="field" value={p.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Hipertensão, diabetes tipo 2…" /></Field>
        <Field label="Cartão SUS"><input className="field" value={p.sus_card} onChange={(e) => set({ sus_card: e.target.value })} /></Field>
        <Field label="Convênio"><input className="field" value={p.insurance} onChange={(e) => set({ insurance: e.target.value })} placeholder="Plano e número da carteirinha" /></Field>
      </div>
      <div className="mt-4"><Toggle id="donor" checked={p.organ_donor} onChange={(v) => set({ organ_donor: v })} label="Doador de órgãos" /></div>
      <div className="mt-5">
        <div className="label mb-2">Contatos de emergência</div>
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1.2fr_0.8fr_1fr_auto] gap-2">
              <input className="field" placeholder="Nome" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} aria-label="Nome do contato" />
              <input className="field hidden sm:block" placeholder="Parentesco" value={c.relation} onChange={(e) => setContact(i, { relation: e.target.value })} aria-label="Parentesco" />
              <input className="field" type="tel" placeholder="Telefone" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} aria-label="Telefone" />
              <button onClick={() => set({ emergency_contacts: contacts.filter((_, j) => j !== i) })} className="btn-ghost w-11 px-0" aria-label="Remover contato"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={() => set({ emergency_contacts: [...contacts, { name: '', relation: '', phone: '' }] })} className="btn-outline btn-sm mt-2"><Plus className="w-3.5 h-3.5" />Adicionar contato</button>
      </div>
      <button onClick={save} className="btn-primary mt-6">Salvar ficha</button>
    </Section>
  )
}

function AISection() {
  const [s, setS] = useState(getAISettings)
  const [testing, setTesting] = useState(false)
  const update = (patch) => { const next = { ...s, ...patch }; setS(next); saveAISettings(next) }
  const prov = PROVIDERS[s.provider]
  const model = prov.models.some((m) => m.id === s.model) ? s.model : prov.models[0].id

  const test = async () => {
    setTesting(true)
    try { await testKey(); toast.success('Chave funcionando!') }
    catch (e) { toast.error(e.message) }
    finally { setTesting(false) }
  }

  return (
    <Section id="ia" icon={KeyRound} title="Inteligência artificial" description="A chave fica só neste aparelho (não é sincronizada) e vai direto para o provedor escolhido.">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Provedor">
          <select className="field" value={s.provider} onChange={(e) => update({ provider: e.target.value, model: '' })}>
            {Object.entries(PROVIDERS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Modelo">
          <select className="field" value={model} onChange={(e) => update({ model: e.target.value })}>
            {prov.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Field label={`Chave de API — ${prov.label}`} className="sm:col-span-2"
          hint={<a href={prov.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline">Criar uma chave <ExternalLink className="w-3 h-3" /></a>}>
          <input className="field font-mono" type="password" autoComplete="off" spellCheck={false} value={s.keys?.[s.provider] || ''}
            onChange={(e) => update({ keys: { ...s.keys, [s.provider]: e.target.value.trim() } })} placeholder={s.provider === 'claude' ? 'sk-ant-…' : 'AIza…'} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={test} disabled={testing || !s.keys?.[s.provider]} className="btn-primary">{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Testar chave</button>
        {s.keys?.[s.provider] && <button onClick={() => update({ keys: { ...s.keys, [s.provider]: '' } })} className="btn-danger">Apagar chave</button>}
      </div>
      <p className="text-xs text-faint mt-4">O uso é cobrado pelo provedor na sua conta. Em computadores compartilhados, apague a chave ao terminar.</p>
    </Section>
  )
}

function NotifySection({ meds }) {
  const [perm, setPerm] = useState(notificationsSupported() ? Notification.permission : 'unsupported')
  const ask = async () => setPerm(await requestPermission())
  return (
    <Section id="lembretes" icon={Bell} title="Lembretes" description="Duas formas de ser avisado na hora da dose.">
      <div className="space-y-4">
        <div className="rounded-2xl border border-line p-4">
          <div className="text-sm font-medium">1. Notificações do app</div>
          <p className="text-xs text-faint mt-1">Tocam enquanto o MedTracker estiver aberto ou instalado e ativo em segundo plano.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {perm === 'granted' ? <span className="chip border-ok/30 text-ok bg-ok/10">ativadas</span>
              : perm === 'unsupported' ? <span className="text-xs text-faint">Este navegador não suporta notificações.</span>
                : <button onClick={ask} className="btn-primary btn-sm">Ativar notificações</button>}
            {perm === 'granted' && <button onClick={() => notify('Teste do MedTracker', 'As notificações estão funcionando.', 'test')} className="btn-outline btn-sm">Enviar teste</button>}
            {perm === 'denied' && <span className="text-xs text-danger">Bloqueadas. Libere nas configurações do navegador.</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-line p-4">
          <div className="text-sm font-medium">2. Alarmes na agenda do celular (recomendado)</div>
          <p className="text-xs text-faint mt-1">Baixe o arquivo e abra no celular: Google Agenda, iPhone ou Outlook criam um alarme diário para cada horário. Funciona com o app fechado. Baixe de novo quando mudar os horários.</p>
          <button onClick={() => download('medtracker-doses.ics', buildICS(meds), 'text/calendar')} className="btn-outline btn-sm mt-3"><Download className="w-3.5 h-3.5" />Baixar alarmes (.ics)</button>
        </div>
      </div>
    </Section>
  )
}

function AppearanceSection() {
  const { dark, toggle } = useTheme()
  const [scale, setScale] = useLocalSetting('mt.fontScaleOpt', '100%')
  useEffect(() => {
    document.documentElement.style.fontSize = scale
    try { localStorage.setItem('mt.fontScale', scale) } catch { /* ignore */ }
  }, [scale])
  return (
    <Section id="aparencia" icon={Palette} title="Aparência e acessibilidade">
      <Toggle id="dark" checked={dark} onChange={toggle} label="Tema escuro" description="Mais confortável à noite" />
      <div className="mt-4">
        <span className="label flex items-center gap-1.5"><Type className="w-3.5 h-3.5" />Tamanho do texto</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[['100%', 'Normal'], ['112.5%', 'Grande'], ['125%', 'Muito grande']].map(([v, l]) => (
            <button key={v} onClick={() => setScale(v)} className={`h-10 rounded-full border text-sm ${scale === v ? 'bg-brand text-on-brand border-brand' : 'border-line text-sub hover:bg-muted'}`}>{l}</button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function DataSection() {
  const { user, cloudEnabled } = useAuth()
  const file = useRef(null)
  const localKeys = COLLECTIONS.filter((c) => { try { return JSON.parse(localStorage.getItem(`mt.data.local.${c}`) || '[]').length } catch { return false } })

  const backup = async () => {
    const data = await exportAll()
    download(`medtracker-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json')
    toast.success('Backup baixado')
  }
  const restore = async (f) => {
    if (!f) return
    if (!window.confirm('Restaurar substitui os dados atuais pelos do arquivo. Continuar?')) return
    try { await importAll(JSON.parse(await f.text())); toast.success('Dados restaurados') }
    catch (e) { toast.error(e.message || 'Arquivo inválido') }
  }
  const migrateLocal = async () => {
    if (!window.confirm('Copiar para sua conta os dados salvos neste aparelho sem conta? Os itens serão adicionados aos que já existem.')) return
    // Keep the original ids so dose logs still point at their medications; rows already copied are skipped.
    let n = 0, skipped = 0
    const hasProfile = Boolean(await getProfile())
    for (const c of localKeys.filter((k) => !(k === 'profile' && hasProfile))) {
      const rows = JSON.parse(localStorage.getItem(`mt.data.local.${c}`) || '[]')
      for (const r of rows) {
        try { await db.create(c, r); n++ } catch { skipped++ }
      }
    }
    toast.success(`${n} itens copiados para a nuvem${skipped ? ` (${skipped} já existiam)` : ''}`)
  }
  const wipe = async () => {
    if (window.prompt('Isso apaga TODOS os seus dados. Digite APAGAR para confirmar.') !== 'APAGAR') return
    for (const c of COLLECTIONS) await db.replaceAll(c, [])
    toast.success('Dados apagados')
  }

  return (
    <Section id="dados" icon={Database} title="Seus dados"
      description={user?.mode === 'cloud' ? `Sincronizados na conta ${user.email}.` : 'Guardados apenas neste navegador. Faça backup com frequência.'}>
      <div className="flex items-center gap-2 text-sm mb-5">
        {user?.mode === 'cloud' ? <><Cloud className="w-4 h-4 text-ok" />Modo nuvem (Supabase)</> : <><HardDrive className="w-4 h-4 text-brand" />Modo local</>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={backup} className="btn-outline"><Download className="w-4 h-4" />Baixar backup</button>
        <button onClick={() => file.current?.click()} className="btn-outline"><Upload className="w-4 h-4" />Restaurar backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} />
        {user?.mode === 'cloud' && localKeys.length > 0 && <button onClick={migrateLocal} className="btn-primary"><Cloud className="w-4 h-4" />Enviar dados deste aparelho para a conta</button>}
        <button onClick={wipe} className="btn-danger"><Trash2 className="w-4 h-4" />Apagar tudo</button>
      </div>
      {user?.mode === 'local' && cloudEnabled && <p className="text-xs text-faint mt-4">Quer acessar de outro aparelho? Saia e entre com uma conta. Depois use “Enviar dados deste aparelho para a conta”.</p>}
    </Section>
  )
}

export default function Profile() {
  const { user, updateLocalName } = useAuth()
  const { hash } = useLocation()
  const [meds, setMeds] = useState([])
  useEffect(() => { db.list('medications').then(setMeds) }, [])
  useEffect(() => {
    // HashRouter: "#/perfil#ia" → scroll to the section.
    const anchor = window.location.hash.split('#')[2]
    if (anchor) setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [hash])

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Sua conta" title="Perfil e ajustes" subtitle={user?.mode === 'cloud' ? user.email : 'Uso sem conta, neste aparelho'} />
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          {user?.mode === 'local' && (
            <section className="card p-5 sm:p-6">
              <Field label="Seu nome"><input className="field" defaultValue={user.name} onBlur={(e) => e.target.value.trim() && updateLocalName(e.target.value.trim())} /></Field>
            </section>
          )}
          <HealthSection />
          <AppearanceSection />
        </div>
        <div className="space-y-5">
          <AISection />
          <NotifySection meds={meds} />
          <DataSection />
        </div>
      </div>
    </div>
  )
}
