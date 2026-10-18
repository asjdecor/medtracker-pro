import { useCallback, useEffect, useRef, useState } from 'react'

// Web Speech API: dictation (pt-BR) and text-to-speech. Both degrade silently where unsupported.
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const speechSupported = Boolean(Recognition)
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function useDictation({ onFinal } = {}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef(null)
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  useEffect(() => () => recRef.current?.abort(), [])

  const start = useCallback(() => {
    if (!Recognition) return false
    const rec = new Recognition()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
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
    rec.onerror = () => { setListening(false); setInterim('') }
    recRef.current = rec
    rec.start()
    setListening(true)
    return true
  }, [])

  const stop = useCallback(() => recRef.current?.stop(), [])
  return { listening, interim, start, stop, supported: speechSupported }
}

export function speak(text) {
  if (!ttsSupported || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'pt-BR'
  u.rate = 1
  const pt = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pt'))
  if (pt) u.voice = pt
  window.speechSynthesis.speak(u)
}
export const stopSpeaking = () => ttsSupported && window.speechSynthesis.cancel()
