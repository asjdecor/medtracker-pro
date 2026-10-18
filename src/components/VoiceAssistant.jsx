import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Mic, Square, X, Volume2, VolumeX, Siren, Loader2, Send, RotateCcw } from 'lucide-react'
import { useDictation, speak, stopSpeaking, ttsSupported } from '@/lib/voice'
import { runCommand, EXAMPLES } from '@/lib/voiceCommands'
import { useLocalSetting } from '@/lib/hooks'

/*
 * Always-visible "Falar" button. One tap → listens → understands → acts → answers out loud.
 * Built for people who find typing hard: huge targets, big text, spoken replies, tap-to-say examples.
 */
export const openVoice = () => window.dispatchEvent(new Event('mt:voice'))

export default function VoiceAssistant() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState(null)
  const [busy, setBusy] = useState(false)
  const [typed, setTyped] = useState('')
  const [talkBack, setTalkBack] = useLocalSetting('mt.voiceReply', true)

  const handle = useCallback(async (text) => {
    setHeard(text); setReply(null); setBusy(true)
    try {
      const r = await runCommand(text)
      setReply(r)
      if (talkBack) speak(r.reply)
      if (r.navigate) { navigate(r.navigate); setTimeout(() => { setOpen(false); toast(r.reply) }, 1200) }
    } catch {
      setReply({ reply: 'Algo deu errado. Tente de novo.' })
    } finally { setBusy(false) }
  }, [navigate, talkBack])

  const { listening, interim, error, start, stop, supported } = useDictation({ onFinal: handle })

  const openAndListen = () => {
    setOpen(true); setHeard(''); setReply(null); setTyped('')
    if (supported) start()
  }
  const close = () => { stop(); stopSpeaking(); setOpen(false) }

  useEffect(() => {
    const onOpen = () => openAndListen()
    window.addEventListener('mt:voice', onOpen)
    return () => window.removeEventListener('mt:voice', onOpen)
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = busy ? 'Entendendo…' : listening ? 'Estou ouvindo. Pode falar.' : reply ? null : error ? error : supported ? 'Toque no microfone e fale.' : null

  return (
    <>
      <button
        onClick={openAndListen}
        className="no-print hidden lg:flex fixed z-30 right-28 bottom-8 h-14 pl-4 pr-6 rounded-full bg-brand text-on-brand shadow-lg shadow-brand/30 items-center gap-2.5 text-base font-semibold hover:bg-brand-strong active:scale-95 transition"
        aria-label="Falar com o app por voz"
      >
        <span className="w-9 h-9 rounded-full bg-on-brand/15 flex items-center justify-center"><Mic className="w-5 h-5" /></span>
        Falar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-bg flex flex-col fade-up" role="dialog" aria-modal="true" aria-label="Assistente de voz"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="font-display text-xl font-semibold text-brand">Fale com o MedTracker</div>
            <div className="flex items-center gap-2">
              {ttsSupported && (
                <button onClick={() => { setTalkBack(!talkBack); stopSpeaking() }} className="btn-outline h-12 px-4" aria-pressed={talkBack}>
                  {talkBack ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  <span className="hidden sm:inline">{talkBack ? 'Resposta falada' : 'Sem som'}</span>
                </button>
              )}
              <button onClick={close} className="btn-outline h-12 w-12 px-0" aria-label="Fechar"><X className="w-6 h-6" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
            <div className="max-w-xl mx-auto flex flex-col items-center text-center">
              {supported ? (
                <button
                  onClick={listening ? stop : start}
                  disabled={busy}
                  className={`relative mt-4 w-40 h-40 sm:w-48 sm:h-48 rounded-full flex items-center justify-center transition-colors ${listening ? 'bg-accent text-white' : 'bg-brand text-on-brand hover:bg-brand-strong'}`}
                  aria-label={listening ? 'Parar de ouvir' : 'Começar a falar'}
                >
                  {listening && <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />}
                  {busy ? <Loader2 className="w-16 h-16 animate-spin" /> : listening ? <Square className="w-14 h-14 relative" fill="currentColor" /> : <Mic className="w-20 h-20" />}
                </button>
              ) : (
                <div className="mt-4 rounded-3xl bg-warn/10 text-warn p-5 text-lg">
                  Este navegador não reconhece voz. Use o Google Chrome, Edge ou Safari, ou escreva abaixo.
                </div>
              )}

              {status && <p className={`mt-6 text-2xl font-medium ${error && !listening ? 'text-danger' : 'text-sub'}`} aria-live="polite">{status}</p>}
              {listening && interim && <p className="mt-3 text-2xl text-faint italic">“{interim}”</p>}

              {heard && !listening && (
                <div className="mt-6 w-full text-left">
                  <div className="label">Você disse</div>
                  <p className="mt-1 text-2xl">“{heard}”</p>
                </div>
              )}

              {reply && (
                <div className={`mt-5 w-full text-left rounded-3xl p-5 ${reply.emergency ? 'bg-danger/10 border border-danger/30' : 'bg-surface border border-line'}`} aria-live="assertive">
                  <p className="text-2xl leading-snug">{reply.reply}</p>
                  {ttsSupported && <button onClick={() => speak(reply.reply)} className="btn-ghost mt-3 h-12 text-base"><Volume2 className="w-5 h-5" />Ouvir de novo</button>}
                </div>
              )}

              {reply?.emergency && (
                <a href="tel:192" className="mt-4 w-full flex items-center justify-center gap-3 h-20 rounded-3xl bg-danger text-white text-2xl font-semibold">
                  <Siren className="w-8 h-8" />Ligar 192 (SAMU)
                </a>
              )}

              {reply && supported && !listening && (
                <button onClick={() => { setReply(null); setHeard(''); start() }} className="btn-primary mt-5 h-16 px-8 text-lg w-full sm:w-auto">
                  <RotateCcw className="w-5 h-5" />Falar de novo
                </button>
              )}

              {!reply && !busy && (
                <div className="mt-8 w-full text-left">
                  <div className="label mb-3">Experimente dizer (ou toque)</div>
                  <div className="grid gap-2">
                    {EXAMPLES.map((ex) => (
                      <button key={ex} onClick={() => { stop(); handle(ex) }} className="text-left px-5 py-4 rounded-2xl border border-line bg-surface text-lg hover:bg-muted">“{ex}”</button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { stop(); handle(typed.trim()); setTyped('') } }} className="mt-8 w-full flex gap-2">
                <input className="field h-14 text-lg" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Ou escreva aqui…" aria-label="Escrever comando" />
                <button className="btn-primary h-14 w-14 px-0 shrink-0" aria-label="Enviar" disabled={!typed.trim() || busy}><Send className="w-5 h-5" /></button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
