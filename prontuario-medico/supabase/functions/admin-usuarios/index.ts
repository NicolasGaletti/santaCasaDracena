// Edge Function admin-usuarios (Plano 4, Task 4).
// Convida, reenvia convite, desativa e reativa profissionais.
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são injetadas pelo Supabase.
// O service_role só existe aqui: nunca no Netlify, no navegador ou no repositório.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

type Perfil = 'medico' | 'residente' | 'multiprofissional' | 'academico' | 'recepcao' | 'auditoria' | 'admin'
type Categoria = 'enfermagem' | 'fisioterapia' | 'nutricao' | 'psicologia' | 'fonoaudiologia' | 'servico_social'

// funcao (formato do corpo) -> perfil + categoria (Global Constraints / spec 6.6.1)
const FUNCOES: Record<string, { perfil: Perfil; categoria: Categoria | null; exigeConselho: boolean }> = {
  medico: { perfil: 'medico', categoria: null, exigeConselho: true },
  residente: { perfil: 'residente', categoria: null, exigeConselho: true },
  interno: { perfil: 'academico', categoria: null, exigeConselho: false },
  enfermagem: { perfil: 'multiprofissional', categoria: 'enfermagem', exigeConselho: true },
  fisioterapia: { perfil: 'multiprofissional', categoria: 'fisioterapia', exigeConselho: true },
  nutricao: { perfil: 'multiprofissional', categoria: 'nutricao', exigeConselho: true },
  psicologia: { perfil: 'multiprofissional', categoria: 'psicologia', exigeConselho: true },
  fonoaudiologia: { perfil: 'multiprofissional', categoria: 'fonoaudiologia', exigeConselho: true },
  servico_social: { perfil: 'multiprofissional', categoria: 'servico_social', exigeConselho: true },
  recepcao: { perfil: 'recepcao', categoria: null, exigeConselho: false },
  auditoria: { perfil: 'auditoria', categoria: null, exigeConselho: false },
  admin: { perfil: 'admin', categoria: null, exigeConselho: false },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BAN_PERMANENTE = '876000h' // ~100 anos

class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(req: Request, status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function env(nome: string): string {
  const v = Deno.env.get(nome)
  if (!v) throw new ErroHttp(500, 'Serviço mal configurado.')
  return v
}

function urlConvite(): string {
  return `${env('SITE_URL').replace(/\/+$/, '')}/auth/callback?next=/definir-senha`
}

/** Confere o chamador com o cliente do próprio JWT. Devolve esse cliente e o id do admin. */
async function exigirAdmin(req: Request): Promise<{ doChamador: SupabaseClient; adminId: string }> {
  const autorizacao = req.headers.get('Authorization') ?? ''
  const token = autorizacao.replace(/^Bearer\s+/i, '')
  if (!token) throw new ErroHttp(401, 'Sessão inválida. Entre novamente.')

  const doChamador = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: usuario, error } = await doChamador.auth.getUser(token)
  if (error || !usuario.user) throw new ErroHttp(401, 'Sessão inválida. Entre novamente.')

  const { data: perfil } = await doChamador
    .from('profissionais')
    .select('perfil, ativo')
    .eq('id', usuario.user.id)
    .maybeSingle()
  if (!perfil || perfil.perfil !== 'admin' || !perfil.ativo) {
    throw new ErroHttp(403, 'Acesso restrito a administradores.')
  }

  // TODO(Task 7): exigir aal2 aqui (admin com sessão aal1 -> 403).

  return { doChamador, adminId: usuario.user.id }
}

function servico(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function jaCadastrado(e: { status?: number; code?: string; message?: string }): boolean {
  return e.code === 'email_exists' || e.code === 'user_already_exists' || /already (been )?registered/i.test(e.message ?? '')
}

async function convidar(corpo: Record<string, unknown>, adminId: string) {
  const email = texto(corpo.email).toLowerCase()
  const nome = texto(corpo.nome)
  const funcao = FUNCOES[texto(corpo.funcao)]
  const conselho = texto(corpo.conselho)
  const numero = texto(corpo.numero)
  const uf = texto(corpo.uf).toUpperCase()

  if (!EMAIL.test(email)) throw new ErroHttp(400, 'Informe um e-mail válido.')
  if (!nome) throw new ErroHttp(400, 'Informe o nome do profissional.')
  if (!funcao) throw new ErroHttp(400, 'Selecione a função do profissional.')
  if (funcao.exigeConselho && (!conselho || !numero || !uf)) {
    throw new ErroHttp(400, 'Informe conselho, número e UF do conselho para esta função.')
  }
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw new ErroHttp(400, 'UF do conselho inválida.')

  const admin = servico()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: urlConvite() })
  if (error || !data.user) {
    if (error && jaCadastrado(error)) throw new ErroHttp(409, 'Este e-mail já está cadastrado.')
    throw new ErroHttp(502, 'Não foi possível enviar o convite. Tente novamente.')
  }

  const { error: erroInsert } = await admin.from('profissionais').insert({
    id: data.user.id,
    nome,
    perfil: funcao.perfil,
    categoria: funcao.categoria,
    conselho: conselho || null,
    numero_conselho: numero || null,
    uf_conselho: uf || null,
  })
  if (erroInsert) {
    // sem usuário órfão: desfaz o convite
    await admin.auth.admin.deleteUser(data.user.id)
    throw new ErroHttp(500, 'Não foi possível cadastrar o profissional. Tente novamente.')
  }

  // O trigger de auditoria grava por=null (service_role); registra o admin como autor do convite.
  await admin.from('auditoria').insert({
    tabela: 'convites',
    registro_id: data.user.id,
    operacao: 'INSERT',
    depois: { perfil: funcao.perfil, categoria: funcao.categoria },
    por: adminId,
  })
}

function idDoCorpo(corpo: Record<string, unknown>): string {
  const id = texto(corpo.profissionalId)
  if (!UUID.test(id)) throw new ErroHttp(400, 'Profissional inválido.')
  return id
}

async function reenviar(corpo: Record<string, unknown>) {
  const id = idDoCorpo(corpo)
  const admin = servico()
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user?.email) throw new ErroHttp(404, 'Profissional não encontrado.')
  if (data.user.email_confirmed_at || data.user.last_sign_in_at) {
    throw new ErroHttp(400, 'Este profissional já aceitou o convite.')
  }
  const { error: erroConvite } = await admin.auth.admin.inviteUserByEmail(data.user.email, {
    redirectTo: urlConvite(),
  })
  if (erroConvite) throw new ErroHttp(502, 'Não foi possível reenviar o convite. Tente novamente.')
}

async function definirAtivo(
  corpo: Record<string, unknown>,
  ativo: boolean,
  doChamador: SupabaseClient,
) {
  const id = idDoCorpo(corpo)
  // Com o cliente do chamador: a auditoria registra o admin e as travas do banco valem
  // (não desativar a si mesmo, nem o último admin).
  const { error } = await doChamador.rpc('admin_definir_ativo', { p_id: id, p_ativo: ativo })
  if (error) {
    if (error.code === 'P0001') throw new ErroHttp(400, error.message)
    throw new ErroHttp(500, 'Não foi possível concluir a operação. Tente novamente.')
  }

  // Ban impede novo login e a renovação do token (refresh) do usuário desativado.
  // O supabase-js só expõe auth.admin.signOut(jwt) para o token de quem chama, não por user id;
  // então o access token já emitido vale até expirar, mas o app bloqueia a próxima requisição
  // (exigirProfissional + app.profissional_ativo() leem profissionais.ativo = false).
  const { error: erroBan } = await servico().auth.admin.updateUserById(id, {
    ban_duration: ativo ? 'none' : BAN_PERMANENTE,
  })
  if (erroBan) throw new ErroHttp(502, 'Não foi possível atualizar o acesso do usuário. Tente novamente.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { erro: 'Método não permitido.' })

  try {
    const { doChamador, adminId } = await exigirAdmin(req)

    let corpo: Record<string, unknown>
    try {
      corpo = await req.json()
    } catch {
      throw new ErroHttp(400, 'Requisição inválida.')
    }

    switch (corpo?.acao) {
      case 'convidar':
        await convidar(corpo, adminId)
        break
      case 'reenviar':
        await reenviar(corpo)
        break
      case 'desativar':
        await definirAtivo(corpo, false, doChamador)
        break
      case 'reativar':
        await definirAtivo(corpo, true, doChamador)
        break
      default:
        throw new ErroHttp(400, 'Ação inválida.')
    }
    return json(req, 200, { ok: true })
  } catch (e) {
    if (e instanceof ErroHttp) return json(req, e.status, { erro: e.message })
    console.error(e)
    return json(req, 500, { erro: 'Erro inesperado. Tente novamente.' })
  }
})
