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
  if (nome.length > 200) throw new ErroHttp(400, 'Nome muito longo (máximo 200 caracteres).')
  if (conselho.length > 20) throw new ErroHttp(400, 'Conselho muito longo (máximo 20 caracteres).')
  if (numero.length > 20) throw new ErroHttp(400, 'Número do conselho muito longo (máximo 20 caracteres).')
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
    await desfazerConvite(admin, data.user.id, false)
    throw new ErroHttp(500, 'Não foi possível cadastrar o profissional. Tente novamente.')
  }

  // O trigger de auditoria grava por=null (service_role); registra o admin como autor do convite.
  const { error: erroAuditoria } = await admin.from('auditoria').insert({
    tabela: 'convites',
    registro_id: data.user.id,
    operacao: 'INSERT',
    depois: { perfil: funcao.perfil, categoria: funcao.categoria },
    por: adminId,
  })
  if (erroAuditoria) {
    // convite sem rastro de auditoria não vale: desfaz tudo
    await desfazerConvite(admin, data.user.id, true)
    throw new ErroHttp(500, 'Não foi possível concluir o convite. Tente novamente.')
  }
}

/** Remove o que o convite criou (sem usuário órfão). Falhas de limpeza são logadas. */
async function desfazerConvite(admin: SupabaseClient, id: string, removerProfissional: boolean) {
  if (removerProfissional) {
    const { error } = await admin.from('profissionais').delete().eq('id', id)
    if (error) console.error('Falha ao remover profissional do convite desfeito', id, error)
  }
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) console.error('Falha ao remover usuário órfão do convite desfeito', id, error)
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
  const { data: prof } = await admin.from('profissionais').select('ativo').eq('id', id).maybeSingle()
  if (prof && !prof.ativo) {
    throw new ErroHttp(400, 'Profissional desativado. Reative antes de reenviar o convite.')
  }
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
  const admin = servico()

  // Reativar: tira o ban antes, para uma falha nunca deixar ativo=true com usuário banido.
  if (ativo) await banir(admin, id, false)

  // Com o cliente do chamador: a auditoria registra o admin e as travas do banco valem
  // (não desativar a si mesmo, nem o último admin).
  const { error } = await doChamador.rpc('admin_definir_ativo', { p_id: id, p_ativo: ativo })
  if (error) {
    if (error.code === 'P0001') throw new ErroHttp(400, error.message)
    throw new ErroHttp(500, 'Não foi possível concluir a operação. Tente novamente.')
  }

  if (!ativo) {
    // ativo=false -> ban (sem login nem refresh) -> revoga sessões e refresh tokens.
    // O supabase-js só expõe auth.admin.signOut(jwt), então a revogação por user id é uma RPC
    // exclusiva do service_role.
    await banir(admin, id, true)
    const { error: erroSessoes } = await admin.rpc('admin_revogar_sessoes', { p_id: id })
    if (erroSessoes) throw new ErroHttp(502, 'Não foi possível revogar as sessões do usuário. Tente novamente.')
  }
}

async function banir(admin: SupabaseClient, id: string, banir: boolean) {
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: banir ? BAN_PERMANENTE : 'none',
  })
  if (error) throw new ErroHttp(502, 'Não foi possível atualizar o acesso do usuário. Tente novamente.')
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
