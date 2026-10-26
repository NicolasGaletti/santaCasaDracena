'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BlocoAnexos, useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { enviarParaValidacao, finalizar } from './actions'
import { CampoTextual } from './campo-textual'
import { aplicarSinal, brutosDeSinais, CamposSinais, errosDeSinais, type BrutosSinais, type CampoSinal } from './campos-sinais'
import { rascunhoMedicaVazio, validarParaFinalizar, type DadosMedica } from './modelos/medica'
import { ehRedirecionamento, enviarEvolucao, MENSAGEM_SEM_CONEXAO_ENVIO, mensagemAnexoNaoEnviado } from './envio'
import { DialogoDescartar, RodapeEvolucao } from './rodape-evolucao'
import { tituloAdendo } from './adendo'
import { OriginalAdendo } from './original-adendo'
import type { EvolucaoTimeline } from './cartao-evolucao'
import { useRascunhoEvolucao } from './use-rascunho-evolucao'

type Props = {
  internacaoId: string
  userId: string
  perfil: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosMedica; textoLivre: string; devolvidaMotivo: string | null } | null
  anterior: DadosMedica | null
  anexos: AnexoRascunho[]
  /** Evolução original quando o rascunho é um adendo. */
  adendo: EvolucaoTimeline | null
}

type CampoTexto =
  | 'diagnosticos'
  | 'comorbidades'
  | 'muc'
  | 'evolucao_clinica'
  | 'ecg'
  | 'exames_imagem'
  | 'exames_laboratoriais'
  | 'conduta'
type CampoExame = keyof DadosMedica['exame_fisico']

const MENSAGEM_SEM_CONEXAO =
  'Sem conexão: a evolução não foi finalizada. Ela continua salva neste aparelho; tente de novo quando a conexão voltar.'

const CAMPOS_EXAME: { chave: CampoExame; rotulo: string }[] = [
  { chave: 'geral', rotulo: 'Geral' },
  { chave: 'ar', rotulo: 'Aparelho respiratório' },
  { chave: 'acv', rotulo: 'Aparelho cardiovascular' },
  { chave: 'abdome', rotulo: 'Abdome' },
  { chave: 'membros', rotulo: 'Membros' },
  { chave: 'neuro', rotulo: 'Neurológico' },
]

export function FormMedica({ internacaoId, userId, perfil, paciente, rascunho, anterior, anexos, adendo }: Props) {
  const podeFinalizar = perfil === 'medico'
  const titulo = adendo ? tituloAdendo(adendo.finalizada_em ?? adendo.criado_em) : 'Evolução médica'

  const [brutos, setBrutos] = useState<BrutosSinais>(() => brutosDeSinais((rascunho?.dados ?? rascunhoMedicaVazio()).sinais))
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState(false)
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [avisoAnexo, setAvisoAnexo] = useState(false)
  const [abertos, setAbertos] = useState<string[]>(['evolucao', 'conduta'])
  const travaConclusao = useRef(false)

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
  } = useRascunhoEvolucao<DadosMedica>({
    internacaoId,
    userId,
    rascunho,
    dadosVazios: rascunhoMedicaVazio(),
    aoRestaurar: (d) => setBrutos(brutosDeSinais(d.sinais)),
  })

  const anexosEvolucao = useAnexosEvolucao({ iniciais: anexos, garantirRascunho })

  function alterarCampo(campo: CampoTexto, valor: string) {
    alterar({ ...dados, [campo]: valor })
  }

  function alterarExame(campo: CampoExame, valor: string) {
    alterar({ ...dados, exame_fisico: { ...dados.exame_fisico, [campo]: valor } })
  }

  function alterarSinal(campo: CampoSinal, texto: string) {
    setBrutos((b) => ({ ...b, [campo]: texto }))
    // Campo inválido não substitui o último valor válido: o erro aparece e bloqueia a finalização.
    const sinais = aplicarSinal(dados.sinais, campo, texto)
    if (sinais) alterar({ ...dados, sinais })
  }

  function copiarAnterior() {
    if (!anterior) return
    // Copia tudo menos sinais vitais: os do dia atual são mantidos.
    alterar({ ...anterior, modelo_versao: 'medica@1', sinais: dados.sinais })
  }

  /** Envio em andamento ou falho bloqueia a finalização: mostra o aviso na seção Exames, aberta. */
  function bloquearPorAnexo() {
    setAvisoAnexo(true)
    setAbertos((lista) => (lista.includes('exames') ? lista : [...lista, 'exames']))
  }

  /** Finalizar (médico) ou enviar para validação (demais perfis): mesma validação, mesma confirmação. */
  function pedirConclusao() {
    const encontrados = [...validarParaFinalizar(dados), ...errosDeSinais(brutos)]
    setErros(encontrados)
    setErroAcao(null)
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      bloquearPorAnexo()
      return
    }
    setAvisoAnexo(false)
    if (encontrados.length === 0) setDialogo(true)
  }

  async function confirmarConclusao() {
    // Trava síncrona: dois cliques no mesmo instante não disparam duas ações.
    if (travaConclusao.current) return
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      setDialogo(false)
      bloquearPorAnexo()
      return
    }
    travaConclusao.current = true
    setEnviando(true)
    setErroAcao(null)
    let navegando = false
    try {
      // Espera o envio em andamento, garante a versão mais nova no servidor e só então age.
      const resultado = await enviarEvolucao(fila, podeFinalizar ? finalizar : enviarParaValidacao)
      // Em sucesso o servidor redireciona; aqui só chega o erro de negócio ou de salvamento.
      if (resultado.erro) setErroAcao(resultado.erro)
    } catch (erro) {
      // Redirecionamento = sucesso: mantém a trava até a navegação terminar.
      if (ehRedirecionamento(erro)) {
        navegando = true
        throw erro
      }
      // Falha de transporte ou do servidor: a evolução continua rascunho e o botão volta a funcionar.
      setErroAcao(podeFinalizar ? MENSAGEM_SEM_CONEXAO : MENSAGEM_SEM_CONEXAO_ENVIO)
    } finally {
      if (!navegando) {
        travaConclusao.current = false
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
        <h1 className="text-2xl font-bold leading-snug">
          {titulo}
        </h1>
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
          <p>{podeFinalizar ? 'Antes de finalizar, corrija:' : 'Antes de enviar, corrija:'}</p>
          <ul className="list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} aria-label={titulo} className="flex flex-col gap-4 pb-28">
        <fieldset disabled={!hidratado} className="contents">
          <Accordion type="multiple" value={abertos} onValueChange={setAbertos} className="rounded-lg border border-border bg-card px-4">
            <AccordionItem value="diagnosticos">
              <AccordionTrigger className="min-h-11 text-base font-bold">Diagnósticos</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-diagnosticos" rotulo="Diagnósticos" valor={dados.diagnosticos} onChange={(v) => alterarCampo('diagnosticos', v)} linhas={2} />
                <CampoTextual id="ev-comorbidades" rotulo="Comorbidades" valor={dados.comorbidades} onChange={(v) => alterarCampo('comorbidades', v)} linhas={2} />
                <CampoTextual id="ev-muc" rotulo="MUC" valor={dados.muc} onChange={(v) => alterarCampo('muc', v)} linhas={2} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="evolucao">
              <AccordionTrigger className="min-h-11 text-base font-bold">Evolução</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-evolucao" rotulo="Evolução clínica" valor={dados.evolucao_clinica} onChange={(v) => alterarCampo('evolucao_clinica', v)} obrigatorio linhas={6} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="exames">
              <AccordionTrigger className="min-h-11 text-base font-bold">{anexosEvolucao.anexos.length > 0 ? `Exames (${anexosEvolucao.anexos.length})` : 'Exames'}</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-ecg" rotulo="ECG" valor={dados.ecg} onChange={(v) => alterarCampo('ecg', v)} linhas={2} />
                <CampoTextual id="ev-imagem" rotulo="Exames de imagem" valor={dados.exames_imagem} onChange={(v) => alterarCampo('exames_imagem', v)} linhas={2} />
                <CampoTextual id="ev-lab" rotulo="Exames laboratoriais" valor={dados.exames_laboratoriais} onChange={(v) => alterarCampo('exames_laboratoriais', v)} linhas={2} />
                <BlocoAnexos
                  estado={anexosEvolucao}
                  avisoFinalizacao={avisoAnexo && (anexosEvolucao.enviando || anexosEvolucao.temFalha) ? mensagemAnexoNaoEnviado(podeFinalizar ? 'finalizar' : 'enviar') : null}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sinais">
              <AccordionTrigger className="min-h-11 text-base font-bold">Sinais vitais</AccordionTrigger>
              <AccordionContent className="pb-4">
                <CamposSinais brutos={brutos} onAlterar={alterarSinal} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="exame-fisico">
              <AccordionTrigger className="min-h-11 text-base font-bold">Exame físico</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                {CAMPOS_EXAME.map((c) => (
                  <CampoTextual key={c.chave} id={`ev-exame-${c.chave}`} rotulo={c.rotulo} valor={dados.exame_fisico[c.chave]} onChange={(v) => alterarExame(c.chave, v)} linhas={2} />
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="conduta">
              <AccordionTrigger className="min-h-11 text-base font-bold">Conduta</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-conduta" rotulo="Conduta" valor={dados.conduta} onChange={(v) => alterarCampo('conduta', v)} obrigatorio linhas={4} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </fieldset>
      </form>

      <RodapeEvolucao
        indicador={indicador}
        salvar={{ desabilitado: !hidratado || enviando || salvando || anexosEvolucao.enviando, onSalvar: salvarAgora }}
        acaoSecundaria={
          <Button
            type="button"
            variant="outline"
            disabled={!hidratado || !anterior || enviando || salvando}
            title={anterior ? undefined : 'Sem evolução finalizada anterior para copiar.'}
            aria-label="Copiar anterior"
            onClick={copiarAnterior}
            className="h-11 px-3 text-sm"
          >
            <Copy aria-hidden="true" className="sm:hidden" />
            <span className="hidden sm:inline">Copiar anterior</span>
          </Button>
        }
        acaoPrincipal={
          <Button type="button" disabled={!hidratado || enviando} onClick={pedirConclusao} className="h-11 px-4">
            {podeFinalizar ? 'Finalizar' : 'Enviar para validação'}
          </Button>
        }
      />

      {erroAcao && (
        <p role="alert" className="fixed inset-x-3 bottom-20 z-30 rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <Dialog open={dialogo} onOpenChange={(aberto) => !aberto && !enviando && setDialogo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{podeFinalizar ? 'Finalizar evolução?' : 'Enviar para validação?'}</DialogTitle>
            <DialogDescription>
              {podeFinalizar
                ? 'Depois de finalizada a evolução não pode ser alterada.'
                : 'Depois de enviada, a evolução só pode ser alterada se o médico devolver.'}
              <br />
              {`${anexosEvolucao.anexos.length} anexo(s) será(ão) incluído(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(false)}>
              Voltar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmarConclusao}>
              {podeFinalizar ? 'Confirmar finalização' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoDescartar aberto={descartarAberto} enviando={enviando} onAbertoChange={setDescartarAberto} onConfirmar={confirmarDescarte} />
    </div>
  )
}
