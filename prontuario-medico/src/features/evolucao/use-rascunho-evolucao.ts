'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { ErroAnexo, MENSAGEM_SEM_CONEXAO_ANEXO } from '@/features/anexos/enviar-anexo'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { registrarFila } from '@/features/sessao/limpeza'
import { descartar } from './actions'
import {
  armazenamentoIdb,
  criarFilaAutosave,
  resolverRascunho,
  type FilaAutosave,
  type PayloadRascunho,
} from './autosave'

const FUSO_SP = 'America/Sao_Paulo'
const MENSAGEM_SALVAR_SEM_CONEXAO = 'Sem conexão: o rascunho continua salvo neste aparelho.'

/** Sem assinatura: o valor muda só com a hidratação (servidor: false; cliente hidratado: true). */
const assinaVazio = () => () => {}

async function salvarRemoto<D>(p: PayloadRascunho<D>): Promise<{ id: string; atualizado_em: string }> {
  const { data, error } = await createBrowserSupabase().rpc('salvar_rascunho', {
    p_internacao_id: p.internacaoId,
    p_dados: p.dados as unknown as Json,
    p_texto_livre: p.textoLivre,
  })
  if (error) throw error
  const linha = data?.[0]
  if (!linha) throw new Error('salvar_rascunho não retornou o rascunho')
  return { id: linha.id, atualizado_em: linha.atualizado_em }
}

function horaSalvo(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_SP })
}

type Opcoes<D> = {
  internacaoId: string
  userId: string
  rascunho: { id: string; dados: D; textoLivre: string } | null
  /** Dados iniciais quando não há rascunho no servidor. */
  dadosVazios: D
  /** Chamado quando a cópia local vence o servidor, para o formulário sincronizar seus campos. */
  aoRestaurar?: (dados: D) => void
}

/**
 * Estado de um rascunho de evolução: autosave em IndexedDB + servidor, hidratação, salvar agora,
 * garantia de rascunho para anexos e descarte. Não conhece o modelo: quem usa decide os campos.
 */
export function useRascunhoEvolucao<D>({ internacaoId, userId, rascunho, dadosVazios, aoRestaurar }: Opcoes<D>) {
  const router = useRouter()
  const chave = `rascunho:${internacaoId}:${userId}`

  const [dados, setDados] = useState<D>(rascunho?.dados ?? dadosVazios)
  // Texto livre carregado do servidor é preservado; o formulário não o edita.
  const [textoLivre] = useState(rascunho?.textoLivre ?? '')
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  // Uma fila por rascunho. Até hidratar, o HTML do servidor fica bloqueado: digitação antes do React não chegaria ao estado.
  const hidratado = useSyncExternalStore(assinaVazio, () => true, () => false)

  const [fila] = useState<FilaAutosave<D>>(() =>
    criarFilaAutosave<D>({
      salvar: salvarRemoto,
      armazenamento: armazenamentoIdb<D>(),
      chave,
      evolucaoId: rascunho?.id,
    }),
  )

  useEffect(() => {
    window.addEventListener('online', fila.aoVoltarConexao)
    const desregistrar = registrarFila(fila)
    return () => {
      desregistrar()
      window.removeEventListener('online', fila.aoVoltarConexao)
      fila.encerrar()
    }
  }, [fila])

  // Restaura a cópia local (IndexedDB) só se o formulário ainda não foi editado: nunca sobrescreve digitação.
  useEffect(() => {
    let vivo = true
    armazenamentoIdb<D>()
      .get(chave)
      .then((local) => {
        const escolhido = resolverRascunho<D>(local, rascunho ? { dados: rascunho.dados, textoLivre: rascunho.textoLivre } : null)
        if (!vivo || escolhido?.origem !== 'local' || !fila.pristina) return
        setDados(escolhido.dados)
        aoRestaurar?.(escolhido.dados)
        fila.agendar({ internacaoId, dados: escolhido.dados, textoLivre: escolhido.textoLivre })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as props iniciais são fixas para este formulário (key={id} na página)
  }, [fila, chave])

  const assinar = useCallback((cb: () => void) => fila.assinar(cb), [fila])
  const estado = useSyncExternalStore(
    assinar,
    () => fila.estado,
    () => 'salvo',
  )
  const ultimoSalvo = fila.ultimoSalvoEm

  const alterar = useCallback(
    (novo: D) => {
      setDados(novo)
      fila.agendar({ internacaoId, dados: novo, textoLivre })
    },
    [fila, internacaoId, textoLivre],
  )

  /** Envio imediato do rascunho (sem esperar o autosave). Falha não deixa o botão travado. */
  async function salvarAgora() {
    if (fila.estado === 'salvo') {
      toast.info('Nada a salvar — já está tudo salvo.')
      return
    }
    setSalvando(true)
    try {
      await fila.forcar()
      toast.success('Rascunho salvo.')
    } catch {
      toast.error(fila.estado === 'erro' ? (fila.mensagemErro ?? MENSAGEM_SALVAR_SEM_CONEXAO) : MENSAGEM_SALVAR_SEM_CONEXAO)
    } finally {
      setSalvando(false)
    }
  }

  /** Anexo precisa do rascunho no servidor: salva agora se ainda não existe. */
  async function garantirRascunho(): Promise<string> {
    if (fila.evolucaoId) return fila.evolucaoId
    alterar(dados)
    try {
      await fila.forcar()
    } catch {
      throw new ErroAnexo(fila.estado === 'erro' ? (fila.mensagemErro ?? MENSAGEM_SEM_CONEXAO_ANEXO) : MENSAGEM_SEM_CONEXAO_ANEXO)
    }
    if (!fila.evolucaoId) throw new ErroAnexo(MENSAGEM_SEM_CONEXAO_ANEXO)
    return fila.evolucaoId
  }

  /** Retorna false se o descarte falhou (a mensagem já está em `erroAcao`). Em sucesso, navega ao prontuário. */
  async function descartarRascunho(): Promise<boolean> {
    const idRascunho = fila.evolucaoId
    if (!idRascunho) return false
    setEnviando(true)
    setErroAcao(null)
    await fila.cancelar().catch(() => {})
    try {
      await descartar(idRascunho)
    } catch {
      // Descarte falhou: a cópia local fica e a fila volta a enviar.
      fila.reabrir()
      setEnviando(false)
      setErroAcao('Não foi possível descartar o rascunho. Tente novamente.')
      return false
    }
    await fila.apagarCopiaLocal().catch(() => {})
    router.push(`/internacoes/${internacaoId}`)
    router.refresh()
    return true
  }

  const indicador = !hidratado
    ? 'Carregando…'
    : estado === 'erro'
      ? (fila.mensagemErro ?? 'Não foi possível salvar.')
      : estado === 'offline'
        ? 'Sem conexão'
        : estado === 'pendente'
          ? 'Salvando…'
          : ultimoSalvo
            ? `Salvo às ${horaSalvo(ultimoSalvo)}`
            : 'Sem alterações'

  return {
    dados,
    alterar,
    hidratado,
    fila,
    idRascunho: fila.evolucaoId,
    indicador,
    enviando,
    setEnviando,
    salvando,
    erroAcao,
    setErroAcao,
    salvarAgora,
    garantirRascunho,
    descartarRascunho,
  }
}
