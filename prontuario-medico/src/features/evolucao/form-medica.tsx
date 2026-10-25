'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarcarAba } from '@/components/navegacao-ativa'
import { BlocoAnexos, MENSAGEM_ANEXO_NAO_ENVIADO, useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { finalizar } from './actions'
import { CampoTextual } from './campo-textual'
import { aplicarSinal, brutosDeSinais, CamposSinais, errosDeSinais, type BrutosSinais, type CampoSinal } from './campos-sinais'
import { rascunhoMedicaVazio, validarParaFinalizar, type DadosMedica } from './modelos/medica'
import { DialogoDescartar, RodapeEvolucao } from './rodape-evolucao'
import { useRascunhoEvolucao } from './use-rascunho-evolucao'

type Props = {
  internacaoId: string
  userId: string
  perfil: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosMedica; textoLivre: string } | null
  anterior: DadosMedica | null
  anexos: AnexoRascunho[]
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

const MENSAGEM_RESIDENTE = 'Rascunho salvo. O envio para validação do médico chega em breve.'

/** Redirecionamento do Next chega como erro com digest `NEXT_REDIRECT`: não é falha, não se trata. */
function ehRedirecionamento(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && String((erro as { digest?: unknown }).digest ?? '').startsWith('NEXT_REDIRECT')
}

const CAMPOS_EXAME: { chave: CampoExame; rotulo: string }[] = [
  { chave: 'geral', rotulo: 'Geral' },
  { chave: 'ar', rotulo: 'Aparelho respiratório' },
  { chave: 'acv', rotulo: 'Aparelho cardiovascular' },
  { chave: 'abdome', rotulo: 'Abdome' },
  { chave: 'membros', rotulo: 'Membros' },
  { chave: 'neuro', rotulo: 'Neurológico' },
]

export function FormMedica({ internacaoId, userId, perfil, paciente, rascunho, anterior, anexos }: Props) {
  const podeFinalizar = perfil === 'medico'

  const [brutos, setBrutos] = useState<BrutosSinais>(() => brutosDeSinais((rascunho?.dados ?? rascunhoMedicaVazio()).sinais))
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState<null | 'finalizar'>(null)
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [avisoAnexo, setAvisoAnexo] = useState(false)
  const [abertos, setAbertos] = useState<string[]>(['evolucao', 'conduta'])
  const travaFinalizacao = useRef(false)

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

  function pedirFinalizacao() {
    const encontrados = [...validarParaFinalizar(dados), ...errosDeSinais(brutos)]
    setErros(encontrados)
    setErroAcao(null)
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      bloquearPorAnexo()
      return
    }
    setAvisoAnexo(false)
    if (encontrados.length === 0) setDialogo('finalizar')
  }

  async function confirmarFinalizacao() {
    // Trava síncrona: dois cliques no mesmo instante não disparam duas finalizações.
    if (travaFinalizacao.current) return
    if (anexosEvolucao.enviando || anexosEvolucao.temFalha) {
      setDialogo(null)
      bloquearPorAnexo()
      return
    }
    travaFinalizacao.current = true
    setEnviando(true)
    setErroAcao(null)
    try {
      // Espera o envio em andamento e garante que a versão mais nova foi salva antes de finalizar.
      await fila.forcar()
    } catch {
      travaFinalizacao.current = false
      setEnviando(false)
      setDialogo(null)
      // Erro de regra do servidor (P0001) tem mensagem própria; o resto é conexão.
      setErroAcao(fila.estado === 'erro' ? (fila.mensagemErro ?? MENSAGEM_SEM_CONEXAO) : MENSAGEM_SEM_CONEXAO)
      return
    }
    const evolucaoId = fila.evolucaoId
    if (!evolucaoId) {
      travaFinalizacao.current = false
      setEnviando(false)
      setDialogo(null)
      setErroAcao('Não foi possível localizar o rascunho. Tente novamente.')
      return
    }
    let navegando = false
    try {
      const resultado = await finalizar(evolucaoId)
      // Em sucesso o servidor redireciona; aqui só chega o erro de negócio.
      if (resultado?.erro) setErroAcao(resultado.erro)
    } catch (erro) {
      // Redirecionamento = sucesso: mantém a trava até a navegação terminar.
      if (ehRedirecionamento(erro)) {
        navegando = true
        throw erro
      }
      // Falha de transporte ou do servidor: a evolução continua rascunho e o botão volta a funcionar.
      setErroAcao(MENSAGEM_SEM_CONEXAO)
    } finally {
      if (!navegando) {
        travaFinalizacao.current = false
        setEnviando(false)
        setDialogo(null)
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
        <h1 className="text-2xl font-bold leading-snug">Evolução médica</h1>
        <p className="text-muted-foreground">
          {paciente.nome} · Leito {paciente.leito}
        </p>
      </header>

      {!podeFinalizar && (
        <p role="status" className="rounded-lg bg-muted p-3 font-semibold text-muted-foreground">
          {MENSAGEM_RESIDENTE}
        </p>
      )}

      {erros.length > 0 && (
        <div role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          <p>Antes de finalizar, corrija:</p>
          <ul className="list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} aria-label="Evolução médica" className="flex flex-col gap-4 pb-28">
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
              <AccordionTrigger className="min-h-11 text-base font-bold">Exames</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-4 pb-4">
                <CampoTextual id="ev-ecg" rotulo="ECG" valor={dados.ecg} onChange={(v) => alterarCampo('ecg', v)} linhas={2} />
                <CampoTextual id="ev-imagem" rotulo="Exames de imagem" valor={dados.exames_imagem} onChange={(v) => alterarCampo('exames_imagem', v)} linhas={2} />
                <CampoTextual id="ev-lab" rotulo="Exames laboratoriais" valor={dados.exames_laboratoriais} onChange={(v) => alterarCampo('exames_laboratoriais', v)} linhas={2} />
                <BlocoAnexos
                  estado={anexosEvolucao}
                  avisoFinalizacao={avisoAnexo && (anexosEvolucao.enviando || anexosEvolucao.temFalha) ? MENSAGEM_ANEXO_NAO_ENVIADO : null}
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
          podeFinalizar && (
            <Button type="button" disabled={!hidratado || enviando} onClick={pedirFinalizacao} className="h-11 px-4">
              Finalizar
            </Button>
          )
        }
      />

      {erroAcao && (
        <p role="alert" className="fixed inset-x-3 bottom-20 z-30 rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(aberto) => !aberto && !enviando && setDialogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar evolução?</DialogTitle>
            <DialogDescription>
              Depois de finalizada a evolução não pode ser alterada.
              <br />
              {`${anexosEvolucao.anexos.length} anexo(s) será(ão) incluído(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
              Voltar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmarFinalizacao}>
              Confirmar finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoDescartar aberto={descartarAberto} enviando={enviando} onAbertoChange={setDescartarAberto} onConfirmar={confirmarDescarte} />
    </div>
  )
}
