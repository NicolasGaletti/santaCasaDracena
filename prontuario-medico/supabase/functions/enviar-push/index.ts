// Edge Function enviar-push (Plano 4, Task 7b).
// Chamada por um Database Webhook (INSERT em public.notificacoes) com o header x-webhook-secret.
// Envia Web Push (VAPID) só para validacao_pendente e evolucao_devolvida, respeitando preferências.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas pelo Supabase; o service_role só existe aqui.
// O texto do push vem de notificacoes.texto: sem nome de paciente nem conteúdo clínico.
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const TIPOS_PUSH = new Set(['validacao_pendente', 'evolucao_devolvida'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
}

// Comparação em tempo constante: compara os SHA-256 dos dois valores byte a byte.
async function igualConstante(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ])
  const va = new Uint8Array(ha)
  const vb = new Uint8Array(hb)
  let dif = 0
  for (let i = 0; i < va.length; i++) dif |= va[i] ^ vb[i]
  return dif === 0
}

type Registro = {
  destinatario_id?: unknown
  tipo?: unknown
  internacao_id?: unknown
  evolucao_id?: unknown
  texto?: unknown
}

function urlDe(tipo: string, internacaoId: string | null): string {
  if (!internacaoId) return '/'
  // devolvida abre o rascunho para ajuste; pendente abre a internação (timeline com a evolução)
  return tipo === 'evolucao_devolvida' ? `/internacoes/${internacaoId}/evolucao` : `/internacoes/${internacaoId}`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { erro: 'Método não permitido.' })

  const segredo = Deno.env.get('PUSH_WEBHOOK_SECRET')
  const recebido = req.headers.get('x-webhook-secret')
  if (!segredo || !recebido || !(await igualConstante(recebido, segredo))) {
    return json(401, { erro: 'Não autorizado.' })
  }

  let corpo: { type?: unknown; table?: unknown; record?: Registro }
  try {
    corpo = await req.json()
  } catch {
    return json(400, { erro: 'Corpo inválido.' })
  }
  if (corpo.type !== 'INSERT' || corpo.table !== 'notificacoes' || !corpo.record) {
    return json(400, { erro: 'Evento inválido.' })
  }

  const r = corpo.record
  const tipo = typeof r.tipo === 'string' ? r.tipo : ''
  if (!TIPOS_PUSH.has(tipo)) return json(200, { enviados: 0, ignorado: 'tipo' })
  if (typeof r.destinatario_id !== 'string' || !UUID.test(r.destinatario_id) || typeof r.texto !== 'string') {
    return json(400, { erro: 'Registro inválido.' })
  }
  const internacaoId = typeof r.internacao_id === 'string' && UUID.test(r.internacao_id) ? r.internacao_id : null

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // destinatário desativado não recebe push
  const { data: prof, error: errProf } = await admin
    .from('profissionais')
    .select('ativo')
    .eq('id', r.destinatario_id)
    .maybeSingle()
  if (errProf) return json(500, { erro: 'Falha ao ler profissional.' })
  if (prof?.ativo === false) return json(200, { enviados: 0, ignorado: 'inativo' })

  // preferências: sem linha = tudo ligado
  const { data: pref, error: errPref } = await admin
    .from('preferencias_notificacao')
    .select('push_validacao, push_devolvida')
    .eq('profissional_id', r.destinatario_id)
    .maybeSingle()
  if (errPref) return json(500, { erro: 'Falha ao ler preferências.' })
  const permitido = tipo === 'validacao_pendente' ? (pref?.push_validacao ?? true) : (pref?.push_devolvida ?? true)
  if (!permitido) return json(200, { enviados: 0, ignorado: 'preferencia' })

  const { data: assinaturas, error: errAss } = await admin
    .from('push_assinaturas')
    .select('id, endpoint, p256dh, auth')
    .eq('profissional_id', r.destinatario_id)
  if (errAss) return json(500, { erro: 'Falha ao ler assinaturas.' })
  // só endpoints https (defesa em profundidade contra SSRF; o banco já recusa os demais)
  const validas = (assinaturas ?? []).filter((a) => {
    if (a.endpoint.startsWith('https://')) return true
    console.error('enviar-push: endpoint não-https ignorado', a.id)
    return false
  })
  if (validas.length === 0) return json(200, { enviados: 0 })

  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const assunto = Deno.env.get('VAPID_SUBJECT')
  if (!pub || !priv || !assunto) return json(500, { erro: 'VAPID não configurado.' })
  webpush.setVapidDetails(assunto, pub, priv)

  const payload = JSON.stringify({ title: 'Prontuário Santa Casa', body: r.texto, url: urlDe(tipo, internacaoId) })

  let enviados = 0
  let removidas = 0
  await Promise.all(
    validas.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
        })
        enviados++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_assinaturas').delete().eq('id', a.id)
          removidas++
        } else {
          console.error('enviar-push: falha ao enviar', status ?? 'sem status', (e as Error).message)
        }
      }
    }),
  )

  return json(200, { enviados, removidas })
})
