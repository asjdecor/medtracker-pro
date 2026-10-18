import { slotsForDay, ymd, medTimes } from './schedule'

// In-app reminders: while the app (or installed PWA) is open, fire a notification when a dose is due.
const SENT_KEY = 'mt.notified'
const readSent = () => { try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]')) } catch { return new Set() } }
const writeSent = (s) => { try { localStorage.setItem(SENT_KEY, JSON.stringify([...s].slice(-300))) } catch { /* ignore */ } }

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export async function notify(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const icon = `${import.meta.env.BASE_URL}icon-192.png`
  const opts = { body, tag, icon, badge: icon, requireInteraction: true }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, opts); return true }
  } catch { /* fall back to a page notification */ }
  new Notification(title, opts)
  return true
}

// Slots that became due in the last `windowMin` minutes and haven't been notified yet.
export function dueSlots(meds, doses, now = new Date(), windowMin = 15) {
  const sent = readSent()
  const slots = slotsForDay(meds, now, doses).filter(
    (s) => !s.log && s.at <= now && now - s.at < windowMin * 60000 && !sent.has(s.key),
  )
  slots.forEach((s) => sent.add(s.key))
  if (slots.length) writeSent(sent)
  return slots
}

// Calendar file: one daily repeating event with an alarm per dose time. Imported into Google Agenda,
// iPhone or Outlook, the reminders ring even with the app closed.
export function buildICS(meds) {
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MedTracker Pro//PT-BR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:MedTracker - Doses']
  for (const m of meds.filter((x) => x.active && !x.as_needed)) {
    const start = (m.start_date || ymd(new Date())).replace(/-/g, '')
    for (const t of medTimes(m)) {
      const until = m.end_date ? `;UNTIL=${m.end_date.replace(/-/g, '')}T235959` : ''
      lines.push(
        'BEGIN:VEVENT',
        `UID:${m.id}-${t.replace(':', '')}@medtracker-pro`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${start}T${t.replace(':', '')}00`,
        'DURATION:PT10M',
        `RRULE:FREQ=DAILY${until}`,
        `SUMMARY:${esc(`💊 ${m.name}${m.dosage ? ` - ${m.dosage}` : ''}`)}`,
        `DESCRIPTION:${esc([m.with_food ? 'Tomar com alimento.' : '', m.notes].filter(Boolean).join(' '))}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`Hora de tomar ${m.name}`)}`, 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function download(filename, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
