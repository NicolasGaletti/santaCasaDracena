'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BlocoAnexos, useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
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
  rascunho: { id: string; dados: DadosSimples; textoLivre: string; devolvidaMotivo: string | null } | null
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
  const [abertos, setAbertos] = useState<string[]>(['texto', 'plano'])
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

  /** Envio em andamento ou falho bloqueia o envio: mostra o aviso na seção Anexos, aberta. */
  function bloquearPorAnexo() {
    setAvisoAnexo(true)
    setAbertos((lista) => (lista.includes('anexos') ? lista : [...lista, 'anexos']))
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
            className="inline-flex min-h-11 w-fit items-center font-semibold underline-offset-4 hover:underline"
          >
            ← Prontuário
          </Link>
          {idRascunho && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 px-3 font-semibold text-destructive hover:text-destructive"
              disabled={enviando || anexosEvolucao.enviando}
              onClick={() => setDescartarAberto(true)}
            >
              Descartar rascunho
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold leading-snug">{titulo}</h1>
        <p className="text-muted-foreground">
          {paciente.nome} · Leito {paciente.leito}
        </p>
      </header>

      {adendo && <OriginalAdendo original={adendo} />}

      {rascunho?.devolvidaMotivo && (
        <p role="status" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {`Devolvida pelo médico: ${rascunho.devolvidaMotivo}`}
        </p>
      )}

      {erros.length > 0 && (
        <div role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          <p>Antes de enviar, corrija:</p>
          <ul className="list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {erroAcao && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <form onSubmit={(e) => e.preventDefault()} aria-label={titulo} className="flex flex-col gap-4 pb-28">
        <fieldset disabled={!hidratado} className="contents">
          <Accordion type="multiple" value={abertos} onValueChange={setAbertos} className="rounded-lg border border-border bg-card px-4">
            <AccordionItem value="texto">
              <AccordionTrigger className="min-h-11 text-base font-bold">Evolução</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-texto" rotulo="Evolução" valor={dados.texto} onChange={(v) => alterarCampo('texto', v)} obrigatorio linhas={6} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sinais">
              <AccordionTrigger className="min-h-11 text-base font-bold">Sinais vitais</AccordionTrigger>
              <AccordionContent className="pb-4">
                <CamposSinais brutos={brutos} onAlterar={alterarSinal} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="plano">
              <AccordionTrigger className="min-h-11 text-base font-bold">Plano</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-plano" rotulo="Plano" valor={dados.plano} onChange={(v) => alterarCampo('plano', v)} obrigatorio linhas={4} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="anexos">
              <AccordionTrigger className="min-h-11 text-base font-bold">{anexosEvolucao.anexos.length > 0 ? `Anexos (${anexosEvolucao.anexos.length})` : 'Anexos'}</AccordionTrigger>
              <AccordionContent className="pb-4">
                <BlocoAnexos
                  estado={anexosEvolucao}
                  avisoFinalizacao={avisoAnexo && (anexosEvolucao.enviando || anexosEvolucao.temFalha) ? mensagemAnexoNaoEnviado('enviar') : null}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </fieldset>
      </form>

      <RodapeEvolucao
        indicador={indicador}
        salvar={{ desabilitado: !hidratado || enviando || salvando || anexosEvolucao.enviando, onSalvar: salvarAgora }}
        acaoPrincipal={
          <Button type="button" disabled={!hidratado || enviando} onClick={pedirEnvio} className="h-11 px-4">
            Enviar para validação
          </Button>
        }
      />

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
