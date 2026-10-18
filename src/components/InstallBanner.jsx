import { useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'

const DISMISS = 'mt.installDismissed'
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS)) return
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIOS()) setShow(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!show) return null
  const close = () => { localStorage.setItem(DISMISS, '1'); setShow(false) }

  return (
    <div className="no-print fixed z-30 left-4 right-20 bottom-24 lg:left-auto lg:right-28 lg:bottom-8 lg:w-96 card p-4 shadow-lg fade-up">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand text-on-brand flex items-center justify-center shrink-0"><Download className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Instale o MedTracker</div>
          {prompt ? (
            <p className="text-xs text-faint mt-0.5">Abre como aplicativo, funciona offline e avisa as doses.</p>
          ) : (
            <p className="text-xs text-faint mt-0.5">No iPhone: toque em <Share className="inline w-3 h-3" /> Compartilhar → “Adicionar à Tela de Início”.</p>
          )}
          {prompt && (
            <button className="btn-primary btn-sm mt-3" onClick={async () => { prompt.prompt(); await prompt.userChoice; close() }}>Instalar agora</button>
          )}
        </div>
        <button onClick={close} className="p-1 rounded-full text-faint hover:bg-muted" aria-label="Dispensar"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
