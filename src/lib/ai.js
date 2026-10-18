import Anthropic from '@anthropic-ai/sdk'
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema'

/*
 * Clinical AI features, called straight from the browser with the user's own API key.
 * Keys never leave this device except to the provider the user picked.
 */

export const PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — mais preciso' },
      { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — equilibrado' },
      { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — mais rápido e barato' },
    ],
  },
  gemini: {
    label: 'Gemini (Google)',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
}

const SETTINGS_KEY = 'mt.ai'
export function getAISettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { provider: 'claude', model: '', keys: {}, ...s }
  } catch { return { provider: 'claude', model: '', keys: {} } }
}
export function saveAISettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }
export const aiReady = () => { const s = getAISettings(); return Boolean(s.keys?.[s.provider]) }
const modelFor = (s) => s.model && PROVIDERS[s.provider].models.some((m) => m.id === s.model) ? s.model : PROVIDERS[s.provider].models[0].id

export class AIError extends Error {}

const SYSTEM = `Você é um assistente clínico do app MedTracker, falando português do Brasil.
Você ajuda pacientes e cuidadores a organizar a rotina de medicamentos. Você não substitui médico ou farmacêutico.
Seja preciso, claro e cauteloso. Quando algo estiver ilegível ou incerto, diga isso em vez de inventar.
Sinais de alerta (dor no peito, falta de ar, desmaio, reação alérgica grave) → oriente a ligar para o SAMU 192.`

// ---------- files ----------
const toBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result).split(',')[1])
  r.onerror = rej
  r.readAsDataURL(blob)
})

// Downscale large photos so uploads stay fast on mobile data.
async function prepareImage(file, max = 2000) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 3e6) return file
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    return await new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.88))
  } catch { return file }
}

async function fileParts(file) {
  if (!file) return []
  const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')
  const blob = isPdf ? file : await prepareImage(file)
  const mime = isPdf ? 'application/pdf' : (blob.type || 'image/jpeg')
  if (!isPdf && !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
    throw new AIError('Formato não suportado. Envie JPG, PNG, WEBP ou PDF.')
  }
  return [{ kind: isPdf ? 'pdf' : 'image', mime, data: await toBase64(blob) }]
}

// ---------- providers ----------
function claudeClient(key) {
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 2 })
}

const claudeContent = (parts, text) => [
  ...parts.map((p) => p.kind === 'pdf'
    ? { type: 'document', source: { type: 'base64', media_type: p.mime, data: p.data } }
    : { type: 'image', source: { type: 'base64', media_type: p.mime, data: p.data } }),
  { type: 'text', text },
]

function explainClaudeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'Chave da Anthropic inválida. Confira em Perfil → Inteligência artificial.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'Sua chave não tem permissão para este modelo.'
  if (e instanceof Anthropic.RateLimitError) return 'Limite de uso atingido. Aguarde um pouco e tente de novo.'
  if (e instanceof Anthropic.BadRequestError) return `Pedido recusado pela API: ${e.message}`
  if (e instanceof Anthropic.APIConnectionError) return 'Sem conexão com a Anthropic. Verifique a internet.'
  if (e instanceof Anthropic.APIError) return `Erro da Anthropic (${e.status ?? '—'}): ${e.message}`
  return e?.message || 'Falha inesperada na IA'
}

function checkStop(msg) {
  if (msg.stop_reason === 'refusal') {
    throw new AIError('A IA recusou este pedido por política de segurança. Reformule ou consulte um profissional.')
  }
  if (msg.stop_reason === 'max_tokens') throw new AIError('A resposta ficou longa demais. Tente um arquivo menor.')
}

async function claudeJSON(s, { prompt, schema, parts }) {
  const client = claudeClient(s.keys.claude)
  try {
    const msg = await client.beta.messages.parse({
      model: modelFor(s),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaJSONSchemaOutputFormat(schema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: claudeContent(parts, prompt) }],
    })
    checkStop(msg)
    if (!msg.parsed_output) throw new AIError('A IA não devolveu um resultado legível. Tente de novo.')
    return msg.parsed_output
  } catch (e) {
    if (e instanceof AIError) throw e
    throw new AIError(explainClaudeError(e))
  }
}

async function claudeChat(s, history) {
  const client = claudeClient(s.keys.claude)
  try {
    const msg = await client.beta.messages.create({
      model: modelFor(s),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM + '\nResponda de forma curta (até 6 frases), em linguagem simples, sem markdown pesado.',
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    })
    checkStop(msg)
    return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
  } catch (e) {
    if (e instanceof AIError) throw e
    throw new AIError(explainClaudeError(e))
  }
}

async function gemini(s, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelFor(s)}:generateContent`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.keys.gemini },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, ...body }),
    })
  } catch { throw new AIError('Sem conexão com o Google. Verifique a internet.') }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 400 && /API key/i.test(json?.error?.message || '')) throw new AIError('Chave do Gemini inválida. Confira em Perfil → Inteligência artificial.')
    if (res.status === 429) throw new AIError('Limite de uso do Gemini atingido. Aguarde e tente de novo.')
    throw new AIError(`Erro do Gemini (${res.status}): ${json?.error?.message || 'falha'}`)
  }
  const cand = json.candidates?.[0]
  if (!cand || cand.finishReason === 'SAFETY') throw new AIError('O Gemini bloqueou esta resposta por segurança.')
  return (cand.content?.parts || []).map((p) => p.text || '').join('').trim()
}

const geminiParts = (parts, text) => [
  ...parts.map((p) => ({ inline_data: { mime_type: p.mime, data: p.data } })),
  { text },
]

async function geminiJSON(s, { prompt, schema, parts }) {
  const text = await gemini(s, {
    contents: [{ role: 'user', parts: geminiParts(parts, `${prompt}\n\nResponda somente com JSON válido seguindo este JSON Schema:\n${JSON.stringify(schema)}`) }],
    generationConfig: { responseMimeType: 'application/json' },
  })
  try { return JSON.parse(text.replace(/^```(json)?|```$/g, '')) }
  catch { throw new AIError('A IA não devolveu um resultado legível. Tente de novo.') }
}

async function runJSON(task) {
  const s = getAISettings()
  if (!s.keys?.[s.provider]) throw new AIError('Configure sua chave de IA em Perfil → Inteligência artificial.')
  return s.provider === 'gemini' ? geminiJSON(s, task) : claudeJSON(s, task)
}

// ---------- schemas ----------
const str = { type: 'string' }
const strList = { type: 'array', items: str }
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })

const PRESCRIPTION = obj({
  doctor_name: str, doctor_specialty: str, doctor_crm: str, date: str, patient_name: str,
  medications: {
    type: 'array',
    items: obj({
      name: str, dosage: str, form: str,
      frequency_hours: { type: 'integer' },
      times: strList,
      duration_days: { type: 'integer' },
      instructions: str,
      with_food: { type: 'boolean' },
      as_needed: { type: 'boolean' },
    }),
  },
  legibility: { type: 'string', enum: ['boa', 'parcial', 'ruim'] },
  notes: str,
})

const RECORD = obj({
  summary: str, diagnoses: strList, medications: strList, allergies: strList,
  key_findings: strList, recommendations: strList, follow_up: strList,
})

const INTERACTIONS = obj({
  interactions: {
    type: 'array',
    items: obj({
      drugs: strList,
      severity: { type: 'string', enum: ['leve', 'moderada', 'grave'] },
      description: str,
      recommendation: str,
    }),
  },
  general_contraindications: strList,
  food_and_alcohol: strList,
  disclaimer: str,
})

// ---------- public API ----------
export async function analyzePrescription(file) {
  return runJSON({
    schema: PRESCRIPTION,
    parts: await fileParts(file),
    prompt: `Leia esta receita médica e extraia os dados.
- Para cada medicamento: nome comercial ou genérico com concentração (ex.: "Losartana 50 mg"), dosagem por tomada (ex.: "1 comprimido"), forma farmacêutica, intervalo em horas (0 se não houver), horários sugeridos HH:MM coerentes com o intervalo começando 08:00 (lista vazia se "se necessário"), duração em dias (0 se contínuo ou não informado), instruções, se é com alimento, se é "se necessário".
- Campos ausentes ou ilegíveis: string vazia. Não invente nada.
- legibility: avalie a legibilidade geral da receita.`,
  })
}

export async function analyzeRecord(file, extraText = '') {
  return runJSON({
    schema: RECORD,
    parts: await fileParts(file),
    prompt: `Resuma este prontuário/exame para o próprio paciente, em linguagem simples.
Extraia diagnósticos, medicamentos citados, alergias, achados principais, recomendações e próximos passos (follow_up).
Listas vazias quando não houver. ${extraText ? `\nTexto adicional do paciente:\n${extraText}` : ''}`,
  })
}

export async function checkInteractions(names, profile) {
  return runJSON({
    schema: INTERACTIONS,
    parts: [],
    prompt: `Analise interações medicamentosas entre: ${names.join('; ')}.
${profile?.allergies ? `Alergias conhecidas do paciente: ${profile.allergies}.` : ''}
${profile?.conditions ? `Condições do paciente: ${profile.conditions}.` : ''}
Liste apenas interações clinicamente relevantes e conhecidas. Inclua contraindicações gerais, cuidados com alimentos e álcool, e um aviso curto (disclaimer) de que a análise não substitui o farmacêutico/médico.`,
  })
}

export async function chat(history, context) {
  const s = getAISettings()
  if (!s.keys?.[s.provider]) throw new AIError('Configure sua chave de IA em Perfil → Inteligência artificial.')
  const ctx = `Contexto do paciente (use se relevante):
Medicamentos em uso: ${context.meds.length ? context.meds.map((m) => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`).join(', ') : 'nenhum cadastrado'}.
${context.profile?.allergies ? `Alergias: ${context.profile.allergies}.` : ''}${context.profile?.conditions ? ` Condições: ${context.profile.conditions}.` : ''}`
  const msgs = [{ role: 'user', content: ctx }, { role: 'assistant', content: 'Entendido. Como posso ajudar?' }, ...history]
  if (s.provider === 'gemini') {
    return gemini(s, { contents: msgs.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) })
  }
  return claudeChat(s, msgs)
}

// Cheap round-trip used by the "Testar chave" button.
export async function testKey() {
  const s = getAISettings()
  if (s.provider === 'gemini') { await gemini(s, { contents: [{ role: 'user', parts: [{ text: 'Responda apenas: ok' }] }] }); return true }
  await claudeChat(s, [{ role: 'user', content: 'Responda apenas: ok' }])
  return true
}
