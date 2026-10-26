import { renderToBuffer } from '@react-pdf/renderer'
import type { NextRequest } from 'next/server'
import { DocumentoAlta, type FolhaAlta, type Pessoa } from '@/features/impressao/documento-alta'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PERFIS_NAO_CLINICOS = ['recepcao', 'admin']
const NAO_ENCONTRADA = 'Folha de alta não encontrada.'
const FALHA = 'Não foi possível gerar o PDF.'

const cabecalhos = (extra: Record<string, string> = {}) => ({ 'Cache-Control': 'no-store', ...extra })
const erro = (status: number, mensagem: string) => Response.json({ erro: mensagem }, { status, headers: cabecalhos() })

/** Folha de alta (sem via, sem registro de impressão): mesmas checagens do PDF de evolução. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return erro(400, 'Identificador de internação inválido.')

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub
  if (!userId) return erro(401, 'Não autenticado.')

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('id, perfil, ativo')
    .eq('id', userId)
    .maybeSingle()
  if (!profissional?.ativo) return erro(401, 'Não autenticado.')
  if (PERFIS_NAO_CLINICOS.includes(profissional.perfil)) return erro(403, 'Acesso restrito a profissionais clínicos.')

  const [{ data: linha, error: erroLinha }, { data: bruta, error: erroBruta }] = await Promise.all([
    supabase
      .from('vw_internacoes_lista')
      .select('internacao_id, nome, data_nascimento, convenio, leito_ala, equipe_id, equipe_nome, status, admitido_em, alta_em, tipo_alta')
      .eq('internacao_id', id)
      .maybeSingle(),
    supabase.from('internacoes').select('motivo_alta, alta_por').eq('id', id).maybeSingle(),
  ])
  if (erroLinha || erroBruta) return erro(500, FALHA)
  if (
    !linha || !bruta || linha.status !== 'ALTA' || !linha.alta_em || !linha.tipo_alta ||
    !linha.nome || !bruta.motivo_alta
  ) {
    return erro(404, NAO_ENCONTRADA)
  }

  const { data: membros, error: erroMembros } = await supabase
    .from('membros_equipe')
    .select('profissional_id')
    .eq('equipe_id', linha.equipe_id)
  if (erroMembros) return erro(500, FALHA)
  const idsPessoas = [...new Set([...(membros ?? []).map((m) => m.profissional_id), ...(bruta.alta_por ? [bruta.alta_por] : [])])]
  const { data: pessoas, error: erroPessoas } = idsPessoas.length
    ? await supabase
        .from('vw_profissionais_publico')
        .select('id, nome, conselho, numero_conselho, uf_conselho')
        .in('id', idsPessoas)
    : { data: [], error: null }
  if (erroPessoas) return erro(500, FALHA)
  const pessoaPorId = new Map(
    (pessoas ?? []).map((p): [string | null, Pessoa] => [
      p.id,
      { nome: p.nome ?? '', conselho: p.conselho, numero: p.numero_conselho, uf: p.uf_conselho },
    ]),
  )
  const medico = bruta.alta_por ? (pessoaPorId.get(bruta.alta_por) ?? null) : null

  const folha: FolhaAlta = {
    internacaoId: id,
    paciente: { nome: linha.nome, data_nascimento: linha.data_nascimento ?? '', convenio: linha.convenio ?? '' },
    leito_ala: linha.leito_ala ?? '',
    equipe_nome: linha.equipe_nome ?? '',
    admitido_em: linha.admitido_em ?? linha.alta_em,
    alta_em: linha.alta_em,
    tipo_alta: linha.tipo_alta,
    resumo: bruta.motivo_alta,
    equipe: (membros ?? [])
      .map((m) => pessoaPorId.get(m.profissional_id))
      .filter((p): p is Pessoa => Boolean(p?.nome))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    medico: medico?.nome ? medico : null,
  }

  const pdf = await renderToBuffer(DocumentoAlta({ folha }))
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: cabecalhos({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="folha-alta-${id.slice(0, 8)}.pdf"`,
    }),
  })
}
