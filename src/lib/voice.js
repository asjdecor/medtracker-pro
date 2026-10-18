import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API: dictation (pt-BR) and text-to-speech. Both degrade silently where unsupported.
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const speechSupported = Boolean(Recognition)
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const ERRORS = {
  'not-allowed': 'O microfone está bloqueado. Toque no cadeado ao lado do endereço do site e permita o microfone.',
  'service-not-allowed': 'O microfone está bloqueado. Permita o microfone nas configurações do navegador.',
  'audio-capture': 'Não encontrei um microfone neste aparelho.',
  network: 'O reconhecimento de voz precisa de internet. Verifique a conexão.',
  'no-speech': 'Não ouvi nada. Toque no microfone e fale de novo.',
}

export function useDictation({ onFinal } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  useEffect(() => () => recRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!Recognition) return false
    stopSpeaking()
    recRef.current?.abort()
    const rec = new Recognition()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let fin = '', tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) fin += r[0].transcript
        else tmp += r[0].transcript
      }
      setInterim(tmp)
      if (fin) finalRef.current?.(fin.trim())
    }
    rec.onend = () => { setListening(false); setInterim('') }
    rec.onerror = (e) => {
      setListening(false); setInterim('')
      if (e.error !== 'aborted') setError(ERRORS[e.error] || 'Não consegui ouvir. Tente de novo.')
    }
    recRef.current = rec
    setError(null)
    try { rec.start() } catch { return false }
    setListening(true)
    return true
  }, [])

  const stop = useCallback(() => recRef.current?.stop(), [])
  return { listening, interim, error, start, stop, supported: speechSupported }
}

// Slightly slower than default: easier to follow for older listeners.
export function speak(text, { onEnd, rate = 0.95 } = {}) {
  if (!ttsSupported || !text) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = rate
  const pt = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'))
  if (pt) u.voice = pt
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd }
  window.speechSynthesis.speak(u)
}
export const stopSpeaking = () => ttsSupported && window.speechSynthesis.cancel()
