import { useCallback, useEffect, useState } from 'react'
import { db, onChange } from './db'

// Live list of a collection; re-fetches whenever any write touches it.
export function useCollection(collection) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try { setItems(await db.list(collection)); setError(null) }
    catch (e) { setError(e) }
    finally { setLoading(false) }
  }, [collection])

  useEffect(() => {
    load()
    return onChange((c) => { if (c === collection) load() })
  }, [collection, load])

  return { items, loading, error, reload: load }
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

// A small per-device preference kept in localStorage.
export function useLocalSetting(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v == null ? initial : JSON.parse(v) } catch { return initial }
  })
  const set = useCallback((v) => {
    setValue(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage unavailable */ }
  }, [key])
  return [value, set]
}
