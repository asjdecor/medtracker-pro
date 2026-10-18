// Dose scheduling: turns medication definitions + dose logs into concrete slots.

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Times for a medication: explicit list, or derived from the interval starting at first_time (default 08:00).
export function medTimes(m) {
  if (m.times?.length) return [...m.times].sort()
  const every = Number(m.frequency_hours) || 0
  if (every <= 0 || every > 24) return []
  const [h0, m0] = (m.first_time || '08:00').split(':').map(Number)
  const out = []
  for (let t = h0 * 60 + m0; t < h0 * 60 + m0 + 24 * 60; t += every * 60) {
    const mm = t % (24 * 60)
    out.push(`${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`)
  }
  return out.sort()
}

const activeOn = (m, day) => {
  if (!m.active) return false
  const d = ymd(day)
  if (m.start_date && d < m.start_date) return false
  if (m.end_date && d > m.end_date) return false
  return true
}

export const slotKey = (medId, day, time) => `${medId}|${day}|${time}`

export function slotsForDay(meds, day, doses = []) {
  const d = ymd(day)
  const byKey = new Map(doses.map((x) => [x.slot, x]))
  const out = []
  for (const m of meds) {
    if (!activeOn(m, day) || m.as_needed) continue
    // Doses scheduled before the medication was registered never existed (unless explicitly logged).
    const since = m.created_at ? new Date(m.created_at) : null
    for (const t of medTimes(m)) {
      const [h, mi] = t.split(':').map(Number)
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi)
      const key = slotKey(m.id, d, t)
      const log = byKey.get(key) || null
      if (since && at < since && !log) continue
      out.push({ key, med: m, time: t, at, log })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

export function nextSlot(meds, doses, now = new Date()) {
  for (let i = 0; i < 2; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const s = slotsForDay(meds, day, doses).find((x) => !x.log && x.at >= now)
    if (s) return s
  }
  return null
}

// Slots that existed for the medication (not before it was registered).
const countable = (s) => !s.med.created_at || s.at >= dayStart(new Date(s.med.created_at))

// Adherence over the last `days` days (only slots already due count).
export function adherence(meds, doses, days = 7, now = new Date()) {
  const series = []
  let due = 0, taken = 0
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const slots = slotsForDay(meds, day, doses).filter((s) => s.at <= now && countable(s))
    const t = slots.filter((s) => s.log?.status === 'taken').length
    due += slots.length; taken += t
    series.push({
      day: ymd(day),
      label: day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      due: slots.length,
      taken: t,
      pct: slots.length ? Math.round((t / slots.length) * 100) : null,
    })
  }
  return { pct: due ? Math.round((taken / due) * 100) : null, due, taken, series }
}

// Consecutive days with every due dose taken. Today counts only once it's complete.
export function streak(meds, doses, now = new Date()) {
  let n = 0
  for (let i = 0; i < 366; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const slots = slotsForDay(meds, day, doses).filter(countable)
    if (!slots.length) { if (i === 0) continue; break }
    if (slots.every((s) => s.log?.status === 'taken')) n++
    else if (i === 0) continue
    else break
  }
  return n
}

// Days of stock left given the daily schedule.
export function stockDays(m) {
  if (m.stock_qty == null || m.stock_qty === '') return null
  const perDay = medTimes(m).length * (Number(m.dose_qty) || 1)
  if (!perDay) return null
  return Math.floor(Number(m.stock_qty) / perDay)
}

export function countdown(target, now) {
  const diff = Math.max(0, target - now)
  const h = Math.floor(diff / 3.6e6), m = Math.floor((diff % 3.6e6) / 6e4), s = Math.floor((diff % 6e4) / 1e3)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
