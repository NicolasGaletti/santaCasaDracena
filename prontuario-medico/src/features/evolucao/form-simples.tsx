'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BlocoAnexos, useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { CampoTextual } from './campo-textual'
import { aplicarSinal, brutosDeSinais, CamposSinais, type BrutosSinais, type CampoSinal } from './campos-sinais'
import { rascunhoSimplesVazio, type DadosSimples } from './modelos/simples'
import { RodapeEvolucao, DialogoDescartar } from './rodape-evolucao'
import { tituloEvolucao } from './rotulos'
import { useRascunhoEvolucao } from './use-rascunho-evolucao'

type Props = {
  internacaoId: string
  userId: string
  categoria: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosSimples; textoLivre: string } | null
  anexos: AnexoRascunho[]
}

const MENSAGEM_ENVIO_EM_BREVE = 'Envio para validação chega na próxima atualização.'

/** Formulário das categorias não médicas (enfermagem, fisioterapia, nutrição, psicologia, fonoaudiologia, serviço social). */
export function FormSimples({ internacaoId, userId, categoria, paciente, rascunho, anexos }: Props) {
  const titulo = tituloEvolucao(categoria)
  const [brutos, setBrutos] = useState<BrutosSinais>(() => brutosDeSinais((rascunho?.dados ?? rascunhoSimplesVazio()).sinais))
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [abertos, setAbertos] = useState<string[]>(['texto', 'plano'])

  const {
    dados,
    alterar,
    hidratado,
    idRascunho,
    indicador,
    enviando,
    salvando,
    erroAcao,
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

      <p id="aviso-envio" role="status" className="rounded-lg bg-muted p-3 font-semibold text-muted-foreground">
        {MENSAGEM_ENVIO_EM_BREVE}
      </p>

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
              <AccordionTrigger className="min-h-11 text-base font-bold">Anexos</AccordionTrigger>
              <AccordionContent className="pb-4">
                <BlocoAnexos estado={anexosEvolucao} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </fieldset>
      </form>

      <RodapeEvolucao
        indicador={indicador}
        salvar={{ desabilitado: !hidratado || enviando || salvando || anexosEvolucao.enviando, onSalvar: salvarAgora }}
        acaoPrincipal={
          <Button
            type="button"
            disabled
            aria-describedby="aviso-envio"
            title={MENSAGEM_ENVIO_EM_BREVE}
            className="h-11 px-4"
          >
            Enviar para validação
          </Button>
        }
      />

      <DialogoDescartar aberto={descartarAberto} enviando={enviando} onAbertoChange={setDescartarAberto} onConfirmar={confirmarDescarte} />
    </div>
  )
}
