import { supabase, cloudEnabled } from './supabase'

/*
 * One storage API, two backends.
 *  - Cloud: Supabase table `records` (one row per item, payload in `data` jsonb, RLS by user_id).
 *  - Local: localStorage, namespaced per local profile.
 * Collections: medications, doses, doctors, symptoms, appointments, profile.
 */
export const COLLECTIONS = ['medications', 'doses', 'doctors', 'symptoms', 'appointments', 'profile']

const listeners = new Set()
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const emit = (collection) => listeners.forEach((fn) => fn(collection))

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

let currentUserId = null
export function setDbUser(id) { currentUserId = id }

// ---------- local backend ----------
const LKEY = (c) => `mt.data.${currentUserId || 'local'}.${c}`
const lread = (c) => { try { return JSON.parse(localStorage.getItem(LKEY(c)) || '[]') } catch { return [] } }
const lwrite = (c, rows) => localStorage.setItem(LKEY(c), JSON.stringify(rows))

const local = {
  async list(c) { return lread(c) },
  async create(c, item) { const rows = lread(c); rows.push(item); lwrite(c, rows); return item },
  async update(c, id, item) { lwrite(c, lread(c).map((r) => (r.id === id ? item : r))); return item },
  async remove(c, id) { lwrite(c, lread(c).filter((r) => r.id !== id)) },
  async replaceAll(c, rows) { lwrite(c, rows) },
}

// ---------- cloud backend ----------
const fromRow = (r) => ({ ...r.data, id: r.id })
const cloud = {
  async list(c) {
    const { data, error } = await supabase.from('records').select('id,data').eq('collection', c).order('created_at')
    if (error) throw error
    return data.map(fromRow)
  },
  async create(c, item) {
    const { id, ...rest } = item
    const { error } = await supabase.from('records').insert({ id, collection: c, data: rest, user_id: currentUserId })
    if (error) throw error
    return item
  },
  async update(c, id, item) {
    const { id: _, ...rest } = item
    const { error } = await supabase.from('records').update({ data: rest, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
    return item
  },
  async remove(c, id) {
    const { error } = await supabase.from('records').delete().eq('id', id)
    if (error) throw error
  },
  async replaceAll(c, rows) {
    const { error } = await supabase.from('records').delete().eq('collection', c)
    if (error) throw error
    if (rows.length) {
      const payload = rows.map(({ id, ...rest }) => ({ id: id || uid(), collection: c, data: rest, user_id: currentUserId }))
      const { error: e2 } = await supabase.from('records').insert(payload)
      if (e2) throw e2
    }
  },
}

let mode = 'local'
export function setDbMode(m) { mode = m === 'cloud' && cloudEnabled ? 'cloud' : 'local' }
export const dbMode = () => mode
const be = () => (mode === 'cloud' ? cloud : local)

const stamp = (item) => ({ ...item, updated_at: new Date().toISOString() })

export const db = {
  list: (c) => be().list(c),
  async create(c, item) {
    const row = stamp({ created_at: new Date().toISOString(), ...item, id: item.id || uid() })
    await be().create(c, row); emit(c); return row
  },
  async update(c, id, item) { const row = stamp({ ...item, id }); await be().update(c, id, row); emit(c); return row },
  async remove(c, id) { await be().remove(c, id); emit(c) },
  async replaceAll(c, rows) { await be().replaceAll(c, rows); emit(c) },
}

// Profile is a single document kept in the `profile` collection.
export async function getProfile() {
  const rows = await db.list('profile')
  return rows[0] || null
}
export async function saveProfile(patch) {
  const cur = await getProfile()
  if (cur) return db.update('profile', cur.id, { ...cur, ...patch })
  return db.create('profile', patch)
}

// Backup: everything as one JSON document.
export async function exportAll() {
  const out = { app: 'medtracker-pro', version: 1, exported_at: new Date().toISOString(), data: {} }
  for (const c of COLLECTIONS) out.data[c] = await db.list(c)
  return out
}
export async function importAll(json) {
  if (!json || json.app !== 'medtracker-pro' || !json.data) throw new Error('Arquivo de backup inválido')
  for (const c of COLLECTIONS) if (Array.isArray(json.data[c])) await db.replaceAll(c, json.data[c])
}
