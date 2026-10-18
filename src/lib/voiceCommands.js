import { db, getProfile } from './db'
import { slotsForDay, nextSlot, stockDays } from './schedule'
import { logSlot, logAsNeeded } from './doses'

/*
 * Spoken commands in everyday Portuguese. Each handler returns:
 *   { reply: string to show and speak, navigate?: route, emergency?: true, done?: true }
 * Matching is accent- and case-insensitive and tolerant to small recognition errors
 * ("losartan", "lozartana" → Losartana).
 */

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return d[a.length][b.length]
}

// Find which medication the person mentioned, using the distinctive words of each name.
export function findMed(text, meds) {
  const words = norm(text).split(' ')
  let best = null, bestScore = 0
  for (const m of meds) {
    const keys = norm(m.name).split(' ').filter((w) => w.length >= 4 && !/^\d/.test(w) && !['comprimido', 'capsula', 'gotas'].includes(w))
    for (const k of keys) {
      for (const w of words) {
        if (w.length < 4) continue
        const score = w === k ? 3 : (k.startsWith(w) || w.startsWith(k)) && Math.min(w.length, k.length) >= 5 ? 2 : lev(w, k) <= (k.length >= 7 ? 2 : 1) ? 1 : 0
        if (score > bestScore) { best = m; bestScore = score }
      }
    }
  }
  return best
}

const has = (t, ...patterns) => patterns.some((p) => (p instanceof RegExp ? p.test(t) : t.includes(p)))
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const listPt = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} e ${arr[arr.length - 1]}`)

const ROUTES = [
  [/remedio|medicamento|farmacia/, '/medicamentos', 'Abrindo seus remédios.'],
  [/consulta|agenda|medico marcado/, '/agenda', 'Abrindo suas consultas.'],
  [/sintoma|diario/, '/diario', 'Abrindo o diário de sintomas.'],
  [/medicos?\b|doutor|doutora/, '/medicos', 'Abrindo seus médicos.'],
  [/relatorio/, '/relatorio', 'Abrindo o relatório.'],
  [/cartao|emergencia/, '/emergencia', 'Abrindo o cartão de emergência.'],
  [/perfil|ajuste|configura/, '/perfil', 'Abrindo o perfil.'],
  [/inteligencia|receita|\bia\b/, '/ia', 'Abrindo a inteligência artificial.'],
  [/inicio|hoje|painel|comeco/, '/hoje', 'Voltando para o início.'],
]

export const EXAMPLES = [
  'Tomei a losartana',
  'Qual é o próximo remédio?',
  'Quais remédios eu tomo hoje?',
  'Estou com dor de cabeça',
  'Tomei todos os remédios',
  'Quando é minha consulta?',
]

const HELP = 'Você pode dizer, por exemplo: tomei a losartana. Qual é o próximo remédio? Estou com dor de cabeça. Quando é minha consulta? Ou, em caso de emergência, diga socorro.'

export async function runCommand(raw) {
  const t = norm(raw)
  if (!t) return { reply: 'Não entendi. Pode repetir?' }

  // 1. Emergency first, always.
  if (has(t, 'socorro', 'emergencia', 'samu', 'ambulancia', /\b192\b/, 'passando mal', 'nao consigo respirar', 'dor no peito', 'desmai', 'infarto', 'derrame')) {
    return { reply: 'Se for uma emergência, toque no botão vermelho para ligar para o SAMU, 192.', emergency: true }
  }

  const [meds, doses] = await Promise.all([db.list('medications'), db.list('doses')])
  const active = meds.filter((m) => m.active)
  const now = new Date()

  // 2. Help.
  if (has(t, /^ajuda\b/, 'o que eu posso', 'como funciona', 'o que voce faz')) return { reply: HELP }

  // 2b. Navigation ("abrir remédios", "ir para a agenda") before topic questions that share words.
  if (has(t, /^(abrir|abre|abra|ir para|vai para|va para|mostrar|mostra|ver)\b/)) {
    for (const [re, to, reply] of ROUTES) if (re.test(t)) return { reply, navigate: to }
  }

  // 3. "Tomei todos".
  if (has(t, /tomei (todos|tudo)/, /ja tomei (todos|tudo)/)) {
    const due = slotsForDay(active, now, doses).filter((s) => !s.log && s.at <= new Date(now.getTime() + 60 * 60000))
    if (!due.length) return { reply: 'Não há doses pendentes agora. Muito bem!' }
    for (const s of due) await logSlot(s, 'taken')
    return { reply: `Pronto! Marquei ${due.length === 1 ? 'uma dose' : `${due.length} doses`} como tomadas: ${listPt([...new Set(due.map((s) => s.med.name))])}.`, done: true }
  }

  // 4. "Tomei X" / "já tomei X".
  if (has(t, /\b(tomei|tomou|ja tomei|acabei de tomar|tomamos)\b/)) {
    const med = findMed(t, active)
    if (!med) {
      const names = active.map((m) => m.name)
      return { reply: names.length ? `Qual remédio você tomou? Seus remédios são: ${listPt(names)}.` : 'Você ainda não tem remédios cadastrados.' }
    }
    if (med.as_needed) {
      await logAsNeeded(med)
      return { reply: `Anotei que você tomou ${med.name} agora, às ${hhmm(now)}.`, done: true }
    }
    const pending = slotsForDay([med], now, doses).filter((s) => !s.log)
    if (!pending.length) return { reply: `Todas as doses de ${med.name} de hoje já estão marcadas.` }
    // The dose closest to now is the one the person means.
    const slot = pending.reduce((a, b) => (Math.abs(b.at - now) < Math.abs(a.at - now) ? b : a))
    await logSlot(slot, 'taken')
    const left = stockDays({ ...med, stock_qty: med.stock_qty === '' ? '' : Math.max(0, Number(med.stock_qty) - (Number(med.dose_qty) || 1)) })
    const stockNote = left != null && left <= (Number(med.low_stock_days) || 7) ? ` Atenção: o remédio está acabando, restam cerca de ${left} dias.` : ''
    return { reply: `Pronto! Marquei ${med.name} das ${slot.time} como tomado.${stockNote}`, done: true }
  }

  // 5. Next dose.
  if (has(t, 'proximo remedio', 'proxima dose', 'proximo medicamento', 'que horas eu tomo', 'que horas tomo', 'hora do remedio', 'quando tomo', 'tenho que tomar agora', 'devo tomar agora')) {
    const late = slotsForDay(active, now, doses).filter((s) => !s.log && s.at <= now)
    if (late.length) return { reply: `Você tem ${late.length === 1 ? 'uma dose' : `${late.length} doses`} para tomar agora: ${listPt(late.map((s) => `${s.med.name} das ${s.time}`))}.` }
    const n = nextSlot(active, doses, now)
    if (!n) return { reply: 'Não há nenhuma dose agendada.' }
    const mins = Math.round((n.at - now) / 60000)
    const when = mins < 60 ? `daqui a ${mins} minutos` : n.at.getDate() === now.getDate() ? `às ${n.time}` : `amanhã às ${n.time}`
    return { reply: `O próximo é ${n.med.name}, ${n.med.dosage || 'uma dose'}, ${when}.${n.med.with_food ? ' Tome com alimento.' : ''}` }
  }

  // 6. Today's list.
  if (has(t, 'quais remedios', 'que remedios', 'remedios de hoje', 'remedios hoje', 'lista de remedios', 'o que eu tomo', 'quais medicamentos')) {
    const slots = slotsForDay(active, now, doses)
    if (!slots.length) return { reply: 'Você não tem doses agendadas para hoje.' }
    const pend = slots.filter((s) => !s.log)
    const done = slots.length - pend.length
    return { reply: `Hoje são ${slots.length} doses. ${done ? `Você já tomou ${done}. ` : ''}${pend.length ? `Faltam: ${listPt(pend.map((s) => `${s.med.name} às ${s.time}`))}.` : 'Todas já foram tomadas. Parabéns!'}` }
  }

  // 7. Stock.
  if (has(t, 'estoque', 'acabando', 'quanto tem', 'quantos comprimidos', 'preciso comprar', 'comprar remedio')) {
    const low = active.filter((m) => stockDays(m) != null && stockDays(m) <= (Number(m.low_stock_days) || 7))
    if (!low.length) return { reply: 'Nenhum remédio está acabando. Está tudo em dia.' }
    return { reply: `Precisa comprar: ${listPt(low.map((m) => `${m.name}, que dura mais ${stockDays(m)} dias`))}.` }
  }

  // 8. Appointments.
  if (has(t, 'consulta', 'quando e o medico', 'proximo medico', 'exame marcado')) {
    const appts = (await db.list('appointments')).filter((a) => !a.done && new Date(a.date_time) >= new Date(now.toDateString())).sort((a, b) => a.date_time.localeCompare(b.date_time))
    if (!appts.length) return { reply: 'Você não tem consultas marcadas.' }
    const a = appts[0], d = new Date(a.date_time)
    return { reply: `Sua próxima consulta é ${a.title}${a.doctor_name ? ` com ${a.doctor_name}` : ''}, ${d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}, às ${hhmm(d)}.` }
  }

  // 10. Symptoms: "estou com dor de cabeça", "sinto tontura", "estou enjoado".
  if (has(t, 'estou com', 'to com', 'tou com', 'sinto', 'sentindo', 'senti', /\bdor\b/, 'enjo', 'tontura', 'tonto', 'nausea', 'febre', 'cansad', 'fraqueza', 'coceira', 'vomit', 'diarreia', 'falta de ar', 'mal estar', 'insonia')) {
    const strong = has(t, 'muito forte', 'muita dor', 'insuportavel', 'horrivel', 'demais')
    const mild = has(t, 'pouco', 'leve', 'fraca', 'fraquinha')
    const intensity = strong ? 8 : mild ? 2 : 5
    const med = findMed(t, active)
    await db.create('symptoms', {
      description: raw.trim().replace(/^./, (c) => c.toUpperCase()), intensity, tags: [],
      severity: intensity >= 7 ? 'grave' : intensity >= 4 ? 'moderado' : 'leve',
      medication_id: med?.id || '', medication_name: med?.name || '', source: 'voz',
    })
    const advice = strong ? ' Como é forte, se piorar ou vier com falta de ar, ligue 192.' : ' Se não melhorar, fale com seu médico.'
    return { reply: `Anotei no seu diário: ${raw.trim()}.${advice}`, done: true, emergency: strong && has(t, 'peito', 'respirar', 'falta de ar') }
  }

  // 11. Anything else: ask the AI if configured.
  // Loaded on demand so the AI SDK isn't part of every screen's first load.
  const ai = await import('./ai')
  if (ai.aiReady()) {
    try {
      const reply = await ai.chat([{ role: 'user', content: raw }], { meds: active, profile: await getProfile() })
      return { reply }
    } catch (e) {
      return { reply: e.message || 'Não consegui falar com a inteligência artificial agora.' }
    }
  }
  return { reply: `Não entendi bem. ${HELP}` }
}
