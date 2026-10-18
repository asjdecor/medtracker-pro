import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Sparkles, Upload, Camera, FileText, Loader2, ShieldAlert, Plus, UserPlus, RefreshCw, Send, Mic, MicOff,
  Volume2, VolumeX, KeyRound, AlertTriangle, CheckCheck, Eye,
} from 'lucide-react'
import { analyzePrescription, analyzeRecord, checkInteractions, chat, aiReady, getAISettings, PROVIDERS } from '@/lib/ai'
import { db, getProfile } from '@/lib/db'
import { useCollection } from '@/lib/hooks'
import { useDictation, speak, stopSpeaking, ttsSupported } from '@/lib/voice'
import MedicationForm from '@/components/MedicationForm'
import { PageHeader, SEVERITY } from '@/components/ui'

const TABS = [
  ['rx', 'Receita'],
  ['record', 'Exame / prontuário'],
  ['inter', 'Interações'],
  ['chat', 'Assistente'],
]

function Disclaimer() {
  return (
    <p className="flex items-start gap-2 text-xs text-faint mt-4">
      <ShieldAlert className="w-4 h-4 shrink-0 text-accent" />
      A IA pode errar, principalmente com letra difícil. Confira cada item com a receita original e com seu médico ou farmacêutico.
    </p>
  )
}

function UploadZone({ file, onFile, camera }) {
  const input = useRef(null)
  const cam = useRef(null)
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(null); return }
    const u = URL.createObjectURL(file); setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  const pick = (f) => { if (f) { if (f.size > 20e6) return toast.error('Arquivo maior que 20 MB'); onFile(f) } }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
      className={`rounded-3xl border-2 border-dashed p-6 text-center transition-colors ${drag ? 'border-brand bg-muted' : 'border-line bg-bg'}`}
    >
      {preview ? <img src={preview} alt="Pré-visualização" className="mx-auto max-h-56 rounded-2xl object-contain" />
        : file ? <div className="flex flex-col items-center gap-2 text-sub"><FileText className="w-10 h-10 text-brand" /><span className="text-sm">{file.name}</span></div>
          : <div className="flex flex-col items-center gap-2 text-faint"><Upload className="w-8 h-8 text-brand" /><span className="text-sm">Arraste a foto ou PDF aqui</span></div>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {camera && <button type="button" onClick={() => cam.current?.click()} className="btn-primary btn-sm"><Camera className="w-4 h-4" />Tirar foto</button>}
        <button type="button" onClick={() => input.current?.click()} className="btn-outline btn-sm"><Upload className="w-4 h-4" />{file ? 'Trocar arquivo' : 'Escolher arquivo'}</button>
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

function ListBlock({ title, items, tone }) {
  if (!items?.length) return null
  return (
    <div className="mt-5">
      <div className={`label ${tone === 'danger' ? '!text-danger' : ''}`}>{title}</div>
      <ul className="mt-2 space-y-1.5">{items.map((x, i) => <li key={i} className="text-sm flex gap-2"><span className="text-faint">•</span>{x}</li>)}</ul>
    </div>
  )
}

// ---------- Prescription ----------
function PrescriptionPanel() {
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [draft, setDraft] = useState(null)
  const [added, setAdded] = useState(new Set())

  const run = async () => {
    if (!file) return toast.error('Envie a foto ou PDF da receita')
    setBusy(true); setResult(null); setAdded(new Set())
    try { setResult(await analyzePrescription(file)) }
    catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const toMed = (m) => ({
    name: m.name, dosage: m.dosage, form: m.form || 'comprimido', notes: m.instructions,
    with_food: m.with_food, schedule: m.as_needed ? 'prn' : m.times?.length ? 'times' : m.frequency_hours ? 'interval' : 'times',
    times: m.times || [], frequency_hours: m.frequency_hours || 8, first_time: m.times?.[0] || '08:00',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: m.duration_days > 0 ? new Date(Date.now() + (m.duration_days - 1) * 864e5).toISOString().slice(0, 10) : '',
    prescribed_by: result?.doctor_name || '', active: true, dose_qty: 1, stock_qty: '', low_stock_days: 7,
  })

  const addAll = async () => {
    const pending = result.medications.filter((_, i) => !added.has(i))
    for (const m of pending) {
      const med = toMed(m)
      await db.create('medications', { ...med, as_needed: med.schedule === 'prn', times: med.schedule === 'times' ? med.times : [] })
    }
    setAdded(new Set(result.medications.map((_, i) => i)))
    toast.success(`${pending.length} medicamento(s) adicionados. Revise os horários em Medicamentos.`)
  }
  const addDoctor = async () => {
    await db.create('doctors', { name: result.doctor_name, specialty: result.doctor_specialty, crm: result.doctor_crm, phone: '', email: '', address: '', notes: '' })
    toast.success('Médico cadastrado')
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-brand">Fotografe a receita</h2>
        <p className="text-sm text-faint mt-1 mb-5">A IA identifica remédios, doses, horários e duração.</p>
        <UploadZone file={file} onFile={(f) => { setFile(f); setResult(null) }} camera />
        <button onClick={run} disabled={busy || !file} className="btn-primary w-full mt-4">{busy ? <><Loader2 className="w-4 h-4 animate-spin" />Lendo a receita…</> : <><Sparkles className="w-4 h-4" />Analisar receita</>}</button>
        <Disclaimer />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-brand">Resultado</h2>
        {!result ? <p className="text-sm text-faint mt-2">{busy ? 'Analisando… isso leva alguns segundos.' : 'Os medicamentos encontrados aparecem aqui.'}</p> : (
          <div className="mt-4">
            {result.legibility && result.legibility !== 'boa' && (
              <div className="flex gap-2 rounded-2xl bg-warn/10 text-warn text-xs p-3 mb-4"><AlertTriangle className="w-4 h-4 shrink-0" />Legibilidade {result.legibility}. Confira com atenção redobrada.</div>
            )}
            {result.doctor_name && (
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-muted">
                <div className="min-w-0"><div className="label">Médico</div><div className="text-sm font-medium truncate">{result.doctor_name}</div>
                  <div className="text-xs text-faint">{[result.doctor_specialty, result.doctor_crm && `CRM ${result.doctor_crm}`, result.date].filter(Boolean).join(' · ')}</div></div>
                <button onClick={addDoctor} className="btn-outline btn-sm shrink-0"><UserPlus className="w-3.5 h-3.5" />Cadastrar</button>
              </div>
            )}
            {result.medications?.length ? (
              <>
                <ul className="mt-4 space-y-3">
                  {result.medications.map((m, i) => (
                    <li key={i} className="p-4 rounded-2xl border border-line">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">{m.name || 'Medicamento sem nome legível'}</div>
                          <div className="text-xs text-faint mt-0.5">
                            {[m.dosage, m.as_needed ? 'se necessário' : m.frequency_hours ? `a cada ${m.frequency_hours}h` : '', m.times?.length ? m.times.join(' · ') : '', m.duration_days ? `${m.duration_days} dias` : 'uso contínuo'].filter(Boolean).join(' · ')}
                          </div>
                          {m.instructions && <div className="text-xs text-sub mt-1.5">{m.instructions}</div>}
                        </div>
                        {added.has(i) ? <span className="chip border-ok/30 text-ok bg-ok/10 shrink-0">adicionado</span>
                          : <button onClick={() => setDraft({ i, med: toMed(m) })} className="btn-outline btn-sm shrink-0"><Eye className="w-3.5 h-3.5" />Revisar</button>}
                      </div>
                    </li>
                  ))}
                </ul>
                {added.size < result.medications.length && <button onClick={addAll} className="btn-primary w-full mt-4"><CheckCheck className="w-4 h-4" />Adicionar todos</button>}
              </>
            ) : <p className="text-sm text-faint mt-4">Nenhum medicamento identificado. Tente uma foto mais nítida e bem iluminada.</p>}
            {result.notes && <p className="text-xs text-sub mt-4">{result.notes}</p>}
          </div>
        )}
      </section>

      <MedicationForm open={!!draft} onClose={() => setDraft(null)} initial={draft?.med}
        onSaved={() => setAdded((s) => new Set([...s, draft.i]))} />
    </div>
  )
}

// ---------- Record ----------
function RecordPanel() {
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const run = async () => {
    if (!file && !text.trim()) return toast.error('Envie um arquivo ou cole o texto')
    setBusy(true); setResult(null)
    try { setResult(await analyzeRecord(file, text)) }
    catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-brand">Exame, laudo ou prontuário</h2>
        <p className="text-sm text-faint mt-1 mb-5">Receba um resumo em linguagem simples.</p>
        <UploadZone file={file} onFile={(f) => { setFile(f); setResult(null) }} camera />
        <textarea className="field mt-4" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ou cole aqui o texto do laudo…" />
        <button onClick={run} disabled={busy} className="btn-primary w-full mt-4">{busy ? <><Loader2 className="w-4 h-4 animate-spin" />Resumindo…</> : <><Sparkles className="w-4 h-4" />Resumir</>}</button>
        <Disclaimer />
      </section>
      <section className="card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-medium text-brand">Resumo</h2>
          {result?.summary && ttsSupported && <button onClick={() => speak(result.summary)} className="btn-ghost btn-sm"><Volume2 className="w-4 h-4" />Ouvir</button>}
        </div>
        {!result ? <p className="text-sm text-faint mt-2">O resumo aparece aqui.</p> : (
          <div>
            {result.summary && <p className="mt-4 text-sm leading-relaxed">{result.summary}</p>}
            <ListBlock title="Diagnósticos" items={result.diagnoses} />
            <ListBlock title="Medicamentos citados" items={result.medications} />
            <ListBlock title="Alergias" items={result.allergies} tone="danger" />
            <ListBlock title="Achados principais" items={result.key_findings} />
            <ListBlock title="Recomendações" items={result.recommendations} />
            <ListBlock title="Próximos passos" items={result.follow_up} />
          </div>
        )}
      </section>
    </div>
  )
}

// ---------- Interactions ----------
function InteractionsPanel() {
  const { items: meds } = useCollection('medications')
  const [selected, setSelected] = useState(null)
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const active = meds.filter((m) => m.active)
  const chosen = selected ?? active.map((m) => m.id)

  const run = async () => {
    const names = [...meds.filter((m) => chosen.includes(m.id)).map((m) => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`), ...extra.split(',').map((s) => s.trim()).filter(Boolean)]
    if (names.length < 1) return toast.error('Selecione ao menos um medicamento')
    setBusy(true); setResult(null)
    try { setResult(await checkInteractions(names, await getProfile())) }
    catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }
  const toggle = (id) => setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-brand">Checar interações</h2>
        <p className="text-sm text-faint mt-1 mb-5">Usa seus medicamentos, alergias e condições do perfil.</p>
        {active.length === 0 ? <p className="text-sm text-faint">Nenhum medicamento em uso. Digite nomes abaixo.</p> : (
          <div className="flex flex-wrap gap-2">
            {active.map((m) => (
              <button key={m.id} onClick={() => toggle(m.id)} className={`px-3 py-1.5 rounded-full text-sm border ${chosen.includes(m.id) ? 'bg-brand text-on-brand border-brand' : 'border-line text-sub'}`}>{m.name}</button>
            ))}
          </div>
        )}
        <input className="field mt-4" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Outros (separe por vírgula): dipirona, chá de camomila…" />
        <button onClick={run} disabled={busy} className="btn-primary w-full mt-4">{busy ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando…</> : <><ShieldAlert className="w-4 h-4" />Verificar</>}</button>
      </section>
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-medium text-brand">Análise</h2>
        {!result ? <p className="text-sm text-faint mt-2">O resultado aparece aqui.</p> : (
          <div className="mt-4">
            {result.interactions?.length ? (
              <ul className="space-y-3">
                {result.interactions.map((it, i) => (
                  <li key={i} className={`p-4 rounded-2xl border ${it.severity === 'grave' ? 'border-danger/40 bg-danger/5' : 'border-line'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{it.drugs.join(' + ')}</span>
                      <span className={`chip ${SEVERITY[it.severity]?.cls}`}>{it.severity}</span>
                    </div>
                    <p className="text-sm text-sub mt-2">{it.description}</p>
                    {it.recommendation && <p className="text-xs text-faint mt-2">→ {it.recommendation}</p>}
                  </li>
                ))}
              </ul>
            ) : <div className="rounded-2xl bg-ok/10 text-ok text-sm p-4">Nenhuma interação relevante identificada entre os itens.</div>}
            <ListBlock title="Contraindicações gerais" items={result.general_contraindications} />
            <ListBlock title="Alimentos e álcool" items={result.food_and_alcohol} />
            {result.disclaimer && <p className="text-xs text-faint mt-5">⚠︎ {result.disclaimer}</p>}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------- Chat ----------
const SUGGESTIONS = ['Posso tomar meus remédios com café?', 'Esqueci uma dose, o que faço?', 'Quais efeitos colaterais devo observar?', 'Posso beber álcool com meus medicamentos?']

function ChatPanel() {
  const { items: meds } = useCollection('medications')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [voiceOut, setVoiceOut] = useState(false)
  const end = useRef(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages, busy])
  useEffect(() => () => stopSpeaking(), [])

  const ask = async (text) => {
    const t = text.trim()
    if (!t || busy) return
    const history = [...messages, { role: 'user', content: t }]
    setMessages(history); setInput(''); setBusy(true)
    try {
      const reply = await chat(history, { meds: meds.filter((m) => m.active), profile: await getProfile() })
      setMessages([...history, { role: 'assistant', content: reply }])
      if (voiceOut) speak(reply)
    } catch (e) {
      toast.error(e.message)
      setMessages(messages)
      setInput(t)
    } finally { setBusy(false) }
  }
  const { listening, interim, start, stop, supported } = useDictation({ onFinal: (t) => ask(t) })

  return (
    <section className="card p-5 sm:p-6 flex flex-col min-h-[60vh]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium text-brand">Assistente</h2>
          <p className="text-xs text-faint">Conhece seus medicamentos em uso. Fale ou digite.</p>
        </div>
        <div className="flex gap-1">
          {ttsSupported && <button onClick={() => { setVoiceOut(!voiceOut); stopSpeaking() }} className="btn-ghost btn-sm" aria-pressed={voiceOut} title="Ler respostas em voz alta">{voiceOut ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>}
          {messages.length > 0 && <button onClick={() => setMessages([])} className="btn-ghost btn-sm" title="Nova conversa"><RefreshCw className="w-4 h-4" /></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto my-5 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="text-left p-4 rounded-2xl border border-line text-sm text-sub hover:bg-muted">{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-brand text-on-brand rounded-br-lg' : 'bg-muted rounded-bl-lg'}`}>
              {m.content}
              {m.role === 'assistant' && ttsSupported && <button onClick={() => speak(m.content)} className="block mt-2 text-xs text-faint hover:text-brand" aria-label="Ouvir resposta"><Volume2 className="w-3.5 h-3.5 inline" /> ouvir</button>}
            </div>
          </div>
        ))}
        {busy && <div className="flex"><div className="bg-muted rounded-3xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-brand" /></div></div>}
        {listening && <div className="text-sm text-faint italic">{interim || 'Ouvindo…'}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex gap-2">
        {supported && <button type="button" onClick={listening ? stop : start} className={`btn shrink-0 w-11 px-0 ${listening ? 'bg-accent text-white pulse-dot' : 'btn-outline'}`} aria-label={listening ? 'Parar' : 'Falar'}>{listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>}
        <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre seus remédios…" aria-label="Mensagem" />
        <button className="btn-primary shrink-0 w-11 px-0" disabled={busy || !input.trim()} aria-label="Enviar"><Send className="w-4 h-4" /></button>
      </form>
      <p className="text-[11px] text-faint mt-3">Não use para emergências. Em risco de vida, ligue 192.</p>
    </section>
  )
}

export default function AIClinic() {
  const [tab, setTab] = useState('rx')
  const ready = aiReady()
  const s = getAISettings()

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Assistente clínico" title="IA Clínica"
        subtitle="Receitas, exames, interações e dúvidas. Sempre confirme com um profissional."
        actions={ready && <span className="chip border-line text-brand bg-muted !text-xs !normal-case !tracking-normal py-1.5 px-3"><Sparkles className="w-3 h-3" />{PROVIDERS[s.provider].label}</span>} />

      {!ready ? (
        <div className="card p-6 sm:p-8 max-w-2xl">
          <div className="w-12 h-12 rounded-2xl bg-muted text-brand flex items-center justify-center"><KeyRound className="w-6 h-6" /></div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-brand">Ative a IA em 1 minuto</h2>
          <p className="mt-2 text-sm text-sub leading-relaxed">
            Cole uma chave de API do Claude (Anthropic) ou do Gemini (Google). Ela fica guardada só neste aparelho e é enviada
            apenas para o provedor escolhido. O Gemini tem uma cota gratuita para começar.
          </p>
          <Link to="/perfil#ia" className="btn-primary mt-6"><Plus className="w-4 h-4" />Configurar chave</Link>
        </div>
      ) : (
        <>
          <div className="flex gap-1 p-1 mb-6 rounded-full bg-surface border border-line w-fit max-w-full overflow-x-auto" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`px-4 sm:px-5 h-10 rounded-full text-sm font-medium whitespace-nowrap ${tab === id ? 'bg-brand text-on-brand' : 'text-sub hover:bg-muted'}`}>{label}</button>
            ))}
          </div>
          {tab === 'rx' && <PrescriptionPanel />}
          {tab === 'record' && <RecordPanel />}
          {tab === 'inter' && <InteractionsPanel />}
          {tab === 'chat' && <ChatPanel />}
        </>
      )}
    </div>
  )
}
