import { db } from './db'

const changeStock = async (med, delta) => {
  if (med.stock_qty == null || med.stock_qty === '') return
  const next = Math.max(0, Number(med.stock_qty) + delta)
  await db.update('medications', med.id, { ...med, stock_qty: next })
}

// Log a scheduled slot as taken/skipped; taking a dose consumes stock.
export async function logSlot(slot, status) {
  if (slot.log) await undoSlot(slot)
  await db.create('doses', {
    slot: slot.key, med_id: slot.med.id, med_name: slot.med.name,
    scheduled_for: slot.at.toISOString(), status, at: new Date().toISOString(),
  })
  if (status === 'taken') await changeStock(slot.med, -(Number(slot.med.dose_qty) || 1))
}

export async function undoSlot(slot) {
  if (!slot.log) return
  await db.remove('doses', slot.log.id)
  if (slot.log.status === 'taken') await changeStock(slot.med, Number(slot.med.dose_qty) || 1)
}

// "Se necessário" medications are logged freely.
export async function logAsNeeded(med) {
  const now = new Date()
  await db.create('doses', {
    slot: `${med.id}|prn|${now.toISOString()}`, med_id: med.id, med_name: med.name,
    scheduled_for: now.toISOString(), status: 'taken', at: now.toISOString(), as_needed: true,
  })
  await changeStock(med, -(Number(med.dose_qty) || 1))
}
