'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Activity, FilePenLine, Paperclip } from 'lucide-react'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarcarAba } from '@/components/navegacao-ativa'
import { useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import { AnexosGerais, AvisosAnexos } from '@/features/anexos/anexos-do-campo'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { enviarParaValidacao } from './actions'
import { CampoTextual } from './campo-textual'
import { aplicarSinal, brutosDeSinais, CamposSinais, errosDeSinais, type BrutosSinais, type CampoSinal } from './campos-sinais'
import { ehRedirecionamento, enviarEvolucao, MENSAGEM_SEM_CONEXAO_ENVIO, mensagemAnexoNaoEnviado } from './envio'
import { rascunhoSimplesVazio, validarParaEnviarSimples, type DadosSimples } from './modelos/simples'
import { RodapeEvolucao, DialogoDescartar } from './rodape-evolucao'
import { tituloEvolucao } from './rotulos'
import { tituloAdendo } from './adendo'
import { OriginalAdendo } from './original-adendo'
import type { EvolucaoTimeline } from './cartao-evolucao'
import { useRascunhoEvolucao } from './use-rascunho-evolucao'

type Props = {
  internacaoId: string
  userId: string
  categoria: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosSimples; textoLivre: string; devolvidaMotivo: string | null; devolvidaPorNome?: string | null } | null
  anexos: AnexoRascunho[]
  /** Evolução original quando o rascunho é um adendo. */
  adendo: EvolucaoTimeline | null
}

/** Formulário das categorias não médicas (enfermagem, fisioterapia, nutrição, psicologia, fonoaudiologia, serviço social). */
export function FormSimples({ internacaoId, userId, categoria, paciente, rascunho, anexos, adendo }: Props) {
  const titulo = adendo ? tituloAdendo(adendo.finalizada_em ?? adendo.criado_em) : tituloEvolucao(categoria)
  const [brutos, setBrutos] = useState<BrutosSinais>(() => brutosDeSinais((rascunho?.dados ?? rascunhoSimplesVazio()).sinais))
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState(false)
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [avisoAnexo, setAvisoAnexo] = useState(false)
  const travaEnvio = useRef(false)

  const {
    dados,
    alterar,
    hidratado,
    fila,
    idRascunho,
    indicador,
    enviando,
    setEnviando,
    salvando,
    erroAcao,
    setErroAcao,
    salvarAgora,
    garantirRascunho,
    descartarRascunho,
  } = useRascunhoEvolucao<DadosSimples>({
    internacaoId,
    userId,
    rascunho,
    dadosVazios: rascunhoSimplesVazio(),
    aoRestaurar: (d) => setBrutos(brutosDeSinais(d.sinais)),
  })

  const anexosEvolucao = useAnexosEvolucao({ iniciais: anexos, garantirRascunho })

  function alterarCampo(campo: 'texto' | 'plano', valor: string) {
    alterar({ ...dados, [campo]: valor })
  }

  function alterarSinal(campo: CampoSinal, texto: string) {
    setBrutos((b) => ({ ...b, [campo]: texto }))
    // Campo inválido não substitui o último valor válido: o erro aparece na própria grade.
    const sinais = aplicarSinal(dados.sinais, campo, texto)
    if (sinais) alterar({ ...dados, sinais })
  }

  /** Envio em andamento ou falho bloqueia o envio: mostra o aviso junto dos anexos. */
  function bloquearPorAnexo() {
    setAvisoAnexo(true)
  }

  function pedirEnvio() {
    const encontrados = [...validarParaEnviarSimples(dados), ...errosDeSinais(brutos)]
    setErros(encontrados)
    setErroAcao(null)
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      bloquearPorAnexo()
      return
    }
    setAvisoAnexo(false)
    if (encontrados.length === 0) setDialogo(true)
  }

  async function confirmarEnvio() {
    // Trava síncrona: dois cliques no mesmo instante não enviam duas vezes.
    if (travaEnvio.current) return
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      setDialogo(false)
      bloquearPorAnexo()
      return
    }
    travaEnvio.current = true
    setEnviando(true)
    setErroAcao(null)
    let navegando = false
    try {
      const resultado = await enviarEvolucao(fila, enviarParaValidacao)
      // Em sucesso o servidor redireciona; aqui só chega o erro de negócio ou de salvamento.
      if (resultado.erro) setErroAcao(resultado.erro)
    } catch (erro) {
      // Redirecionamento = sucesso: mantém a trava até a navegação terminar.
      if (ehRedirecionamento(erro)) {
        navegando = true
        throw erro
      }
      setErroAcao(MENSAGEM_SEM_CONEXAO_ENVIO)
    } finally {
      if (!navegando) {
        travaEnvio.current = false
        setEnviando(false)
        setDialogo(false)
      }
    }
  }

  async function confirmarDescarte() {
    const ok = await descartarRascunho()
    if (!ok) setDescartarAberto(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <MarcarAba status="INTERNADO" />
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/internacoes/${internacaoId}`}
            className="inline-flex min-h-11 w-fit items-center font-semibold text-primary underline-offset-4 hover:underline"
          >
            ← Prontuário
          </Link>
          {idRascunho && (
            <Button
              type="button"
              variant="ghost"
              size="compacto"
              className="font-semibold text-destructive hover:text-destructive"
              disabled={enviando || anexosEvolucao.enviando}
              onClick={() => setDescartarAberto(true)}
            >
              Descartar rascunho
            </Button>
          )}
        </div>
        <p className="min-w-0 break-words text-muted-foreground">
          {paciente.nome} · Leito {paciente.leito}
        </p>
      </header>

      {adendo && <OriginalAdendo original={adendo} />}

      {rascunho?.devolvidaMotivo && (
        <p role="status" className="rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {`Devolvida pelo médico: ${rascunho.devolvidaMotivo}`}
          {rascunho.devolvidaPorNome && (
            <span className="mt-1 block text-sm font-normal">{`Devolvida por ${rascunho.devolvidaPorNome}`}</span>
          )}
        </p>
      )}

      {erros.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          <p>Antes de enviar, corrija:</p>
          <ul className="list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {erroAcao && (
        <p role="alert" className="rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <form onSubmit={(e) => e.preventDefault()} aria-label={titulo} className="flex flex-col">
        <fieldset disabled={!hidratado} className="contents">
          <CartaoSecao
            titulo={titulo}
            icone={FilePenLine}
            subtitulo="O rascunho salva sozinho. Envie para validação quando terminar."
            className="sm:rounded-b-none"
          >
            <div className="flex flex-col gap-4">
              <CampoTextual id="ev-texto" rotulo="Evolução" valor={dados.texto} onChange={(v) => alterarCampo('texto', v)} obrigatorio linhas={6} />

              <div className="grid gap-2">
                <p className="flex items-center gap-1 text-[11px] font-bold tracking-wide text-primary-suave-foreground uppercase">
                  <Activity aria-hidden="true" className="size-3.5" />
                  Sinais vitais
                </p>
                <CamposSinais brutos={brutos} onAlterar={alterarSinal} />
              </div>

              <CampoTextual id="ev-plano" rotulo="Plano" corRotulo="text-conduta" valor={dados.plano} onChange={(v) => alterarCampo('plano', v)} obrigatorio linhas={4} />

              <div className="grid gap-2">
                <p className="flex items-center gap-1 text-[11px] font-bold tracking-wide text-texto-forte uppercase">
                  <Paperclip aria-hidden="true" className="size-3.5" />
                  Anexos
                </p>
                <AvisosAnexos
                  estado={anexosEvolucao}
                  avisoFinalizacao={avisoAnexo && (anexosEvolucao.enviando || anexosEvolucao.temFalha) ? mensagemAnexoNaoEnviado('enviar') : null}
                />
                <AnexosGerais estado={anexosEvolucao} />
              </div>
            </div>
          </CartaoSecao>
        </fieldset>
        <RodapeEvolucao
          indicador={indicador}
          salvar={{ desabilitado: !hidratado || enviando || salvando || anexosEvolucao.enviando, onSalvar: salvarAgora }}
          acaoPrincipal={
            <Button type="button" variant="primaria" size="compacto" disabled={!hidratado || enviando} onClick={pedirEnvio}>
              Enviar para validação
            </Button>
          }
        />
      </form>

      <Dialog open={dialogo} onOpenChange={(aberto) => !aberto && !enviando && setDialogo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar para validação?</DialogTitle>
            <DialogDescription>
              Depois de enviada, a evolução só pode ser alterada se o médico devolver.
              <br />
              {`${anexosEvolucao.anexos.length} anexo(s) será(ão) incluído(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(false)}>
              Voltar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmarEnvio}>
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoDescartar aberto={descartarAberto} enviando={enviando} onAbertoChange={setDescartarAberto} onConfirmar={confirmarDescarte} />
    </div>
  )
}
