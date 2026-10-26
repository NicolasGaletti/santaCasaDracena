'use client'

import { useEffect, useRef, useState } from 'react'
import { removerAnexo, urlAssinada } from './actions'
import { abrirPdfEmNovaAba } from './abrir-pdf'
import { enviarAnexo, ehFalhaDeRede, mensagemDeEnvio, MENSAGEM_SEM_CONEXAO_ANEXO, type AnexoRascunho } from './enviar-anexo'
import type { TipoAnexo } from './rotulos'

const MENSAGEM_DATA = 'Informe a data do exame.'
const TEMPO_CONFIRMACAO_MS = 4000
const MENSAGEM_REMOCAO = 'Não foi possível remover o anexo. Tente novamente.'
type Metadados = { tipo: TipoAnexo; descricao: string; dataExame: string }
type Envio = Metadados & { chave: string; arquivo: File; estado: 'enviando' | 'erro'; mensagem?: string }

/** Hoje no fuso de São Paulo, como AAAA-MM-DD (en-CA já formata assim). */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function revogarPrevia(url: string | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

/**
 * Estado dos anexos de um rascunho. Vive no formulário (não no bloco) para que um envio em
 * andamento não se perca quando o painel de anexar é fechado.
 */
export function useAnexosEvolucao({
  iniciais,
  garantirRascunho,
}: {
  iniciais: AnexoRascunho[]
  garantirRascunho: () => Promise<string>
}) {
  const [anexos, setAnexos] = useState<AnexoRascunho[]>(iniciais)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [adicionado, setAdicionado] = useState(false)
  const contador = useRef(0)
  const vivo = useRef(true)
  const anexosRef = useRef(anexos)
  const renovadas = useRef(new Set<string>())

  useEffect(() => {
    anexosRef.current = anexos
  }, [anexos])

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
      anexosRef.current.forEach((a) => revogarPrevia(a.previewUrl))
    }
  }, [])

  // "Anexo adicionado." some sozinho; um novo envio também o apaga (ver `enviar`).
  useEffect(() => {
    if (!adicionado) return
    const t = setTimeout(() => setAdicionado(false), TEMPO_CONFIRMACAO_MS)
    return () => clearTimeout(t)
  }, [adicionado])

  const enviando = envios.some((e) => e.estado === 'enviando')
  const temFalha = envios.some((e) => e.estado === 'erro')

  // Sem este aviso, fechar ou recarregar com um upload em voo perde o anexo.
  useEffect(() => {
    if (!enviando) return
    function aoSair(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aoSair)
    return () => window.removeEventListener('beforeunload', aoSair)
  }, [enviando])

  async function executar(chave: string, arquivo: File, meta: Metadados) {
    try {
      const evolucaoId = await garantirRascunho()
      const anexo = await enviarAnexo({ evolucaoId, ...meta, arquivo })
      setEnvios((lista) => lista.filter((e) => e.chave !== chave))
      if (!vivo.current) {
        revogarPrevia(anexo.previewUrl)
        return
      }
      setAnexos((lista) => [...lista, anexo])
      setAdicionado(true)
    } catch (falha) {
      if (!vivo.current) return
      setEnvios((lista) =>
        lista.map((e) => (e.chave === chave ? { ...e, estado: 'erro', mensagem: mensagemDeEnvio(falha) } : e)),
      )
    }
  }

  /** Devolve false quando a validação recusa o envio (nada foi enviado). */
  function enviar(arquivo: File, meta: Metadados): boolean {
    if (!meta.dataExame) {
      setErro(MENSAGEM_DATA)
      return false
    }
    contador.current += 1
    const chave = `envio-${contador.current}`
    setErro(null)
    setAdicionado(false)
    setEnvios((lista) => [...lista, { ...meta, chave, arquivo, estado: 'enviando' }])
    void executar(chave, arquivo, meta)
    return true
  }

  function tentarNovamente(envio: Envio) {
    setEnvios((lista) =>
      lista.map((e) => (e.chave === envio.chave ? { ...e, estado: 'enviando', mensagem: undefined } : e)),
    )
    void executar(envio.chave, envio.arquivo, {
      tipo: envio.tipo,
      descricao: envio.descricao,
      dataExame: envio.dataExame,
    })
  }

  function cancelarEnvio(chave: string) {
    setEnvios((lista) => lista.filter((e) => e.chave !== chave))
  }

  /** Prévia de servidor expirou (5 min): pede URL nova uma vez por anexo. Prévia `blob:` não expira. */
  async function renovarPrevia(anexo: AnexoRascunho) {
    if (!anexo.previewUrl || anexo.previewUrl.startsWith('blob:') || renovadas.current.has(anexo.id)) return
    renovadas.current.add(anexo.id)
    // Prévia (não é visualização): não registra acesso.
    const { url } = await urlAssinada(anexo.id)
    if (!vivo.current || !url) return
    setAnexos((lista) => lista.map((a) => (a.id === anexo.id ? { ...a, previewUrl: url } : a)))
  }

  /** PDF em nova aba com URL assinada gerada na hora (a prévia guardada pode ter expirado). */
  async function abrirPdf(anexo: AnexoRascunho) {
    setErro(null)
    const mensagem = await abrirPdfEmNovaAba(anexo.id)
    if (mensagem) setErro(mensagem)
  }

  /** Apaga o objeto e a linha. Se o objeto não pôde ser apagado, a linha continua na lista. */
  async function remover(anexo: AnexoRascunho): Promise<boolean> {
    setErro(null)
    try {
      const { erro: falha } = await removerAnexo(anexo.id)
      if (falha) {
        setErro(falha)
        return false
      }
    } catch (falha) {
      setErro(ehFalhaDeRede(falha) ? MENSAGEM_SEM_CONEXAO_ANEXO : MENSAGEM_REMOCAO)
      return false
    }
    revogarPrevia(anexo.previewUrl)
    setAnexos((lista) => lista.filter((a) => a.id !== anexo.id))
    return true
  }

  return {
    anexos,
    envios,
    erro,
    /** Um envio acabou de dar certo (some em ~4 s ou no próximo envio). */
    adicionado,
    enviando,
    /** Envio que falhou e não foi refeito nem cancelado: impede a finalização. */
    temFalha,
    enviar,
    renovarPrevia,
    abrirPdf,
    tentarNovamente,
    cancelarEnvio,
    remover,
  }
}

export type EstadoAnexos = ReturnType<typeof useAnexosEvolucao>
