import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mic, MicOff, X } from 'lucide-react'
import { useDictation } from '@/lib/voice'

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && <span className="label">{eyebrow}</span>}
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand mt-1">{title}</h1>
        {subtitle && <p className="text-sm text-faint mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className = '', aside }) {
  return (
    <label className={`block ${className}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {aside}
      </span>
      <div className="mt-2">{children}</div>
      {hint && <span className="block mt-1.5 text-xs text-faint">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, description, id }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
      <div>
        <div className="text-sm font-medium text-ink" id={id}>{label}</div>
        {description && <div className="text-xs text-faint">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

export function Modal({ open, onClose, title, description, children, footer, wide = false }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Runs only when opening, so typing never steals focus back to the first field.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector('[autofocus],input,textarea,select')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto bg-surface border border-line rounded-t-3xl sm:rounded-3xl p-6 fade-up`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand">{title}</h2>
            {description && <p className="text-sm text-faint mt-1">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 -m-2 rounded-full text-faint hover:bg-muted" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, text, action, to, onAction }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4 rounded-2xl bg-bg border border-dashed border-line">
      <div className="w-12 h-12 rounded-full bg-surface border border-line flex items-center justify-center text-brand">{icon}</div>
      <h3 className="mt-4 font-display font-medium text-brand">{title}</h3>
      {text && <p className="mt-1 text-sm text-faint max-w-sm">{text}</p>}
      {action && (to
        ? <Link to={to} className="btn-primary btn-sm mt-5">{action}</Link>
        : <button onClick={onAction} className="btn-primary btn-sm mt-5">{action}</button>)}
    </div>
  )
}

export function Skeleton({ rows = 3, className = 'h-14' }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => <li key={i} className={`${className} rounded-2xl bg-muted animate-pulse`} />)}
    </ul>
  )
}

export function IconTile({ children, tone = 'brand', className = 'w-10 h-10' }) {
  const tones = { brand: 'bg-muted text-brand', accent: 'bg-accent/10 text-accent', ok: 'bg-ok/10 text-ok', danger: 'bg-danger/10 text-danger', solid: 'bg-brand text-on-brand' }
  return <div className={`${className} shrink-0 rounded-2xl flex items-center justify-center ${tones[tone]}`}>{children}</div>
}

export const SEVERITY = {
  leve: { label: 'Leve', cls: 'border-ok/30 text-ok bg-ok/10' },
  moderado: { label: 'Moderado', cls: 'border-warn/30 text-warn bg-warn/10' },
  moderada: { label: 'Moderada', cls: 'border-warn/30 text-warn bg-warn/10' },
  grave: { label: 'Grave', cls: 'border-danger/30 text-danger bg-danger/10' },
}

// Mic button that appends dictated text to a field value.
export function VoiceButton({ value, onChange, className = '' }) {
  const { listening, start, stop, supported } = useDictation({
    onFinal: (t) => onChange(value ? `${value.trimEnd()} ${t}` : t),
  })
  if (!supported) return null
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); listening ? stop() : start() }}
      className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors ${listening ? 'bg-accent text-white border-accent pulse-dot' : 'border-line text-brand hover:bg-muted'} ${className}`}
      aria-label={listening ? 'Parar ditado' : 'Ditar por voz'}
      title={listening ? 'Parar ditado' : 'Ditar por voz'}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  )
}

export function Stat({ label, value, hint, icon, tone = 'brand' }) {
  const color = { brand: 'text-brand', accent: 'text-accent', ok: 'text-ok', danger: 'text-danger' }[tone]
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <div className={`mt-4 font-display text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-faint truncate">{hint}</div>}
    </div>
  )
}
