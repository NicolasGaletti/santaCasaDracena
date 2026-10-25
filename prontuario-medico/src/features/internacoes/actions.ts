'use server'

import { redirect } from 'next/navigation'
import type { EstadoForm } from '@/lib/forms'
import { createClient } from '@/lib/supabase/server'

export type EstadoAdmissao = EstadoForm & { valores?: Record<string, string> }

const CAMPOS_OBRIGATORIOS = ['nome', 'nascimento', 'convenio', 'equipe', 'leito'] as const

export async function admitir(_prev: EstadoAdmissao, form: FormData): Promise<EstadoAdmissao> {
  const campos = [...CAMPOS_OBRIGATORIOS, 'diagnostico', 'comorbidades', 'muc'] as const
  const valores = Object.fromEntries(
    campos.map((c) => [c, String(form.get(c) ?? '')]),
  ) as Record<(typeof campos)[number], string>

  // Mantém o que foi digitado em qualquer erro; o banco é a validação final.
  if (CAMPOS_OBRIGATORIOS.some((c) => !valores[c].trim())) {
    return { erro: 'Preencha os campos obrigatórios.', valores }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admitir_paciente', {
    p_nome: valores.nome,
    p_data_nascimento: valores.nascimento,
    p_convenio: valores.convenio,
    p_equipe_id: valores.equipe,
    p_leito_ala: valores.leito,
    p_diagnostico_inicial: valores.diagnostico,
    p_comorbidades: valores.comorbidades,
    p_muc: valores.muc,
  })

  if (error || !data) {
    // Só mensagens P0001 são pt-BR escritas para o usuário; o resto é erro técnico.
    const erro =
      error?.code === 'P0001' ? error.message : 'Não foi possível concluir a admissão. Tente novamente.'
    return { erro, valores }
  }

  redirect(`/internacoes/${data}`)
}
