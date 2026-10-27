'use client'

import { useRef, useState } from 'react'
import { Activity, Copy, FilePenLine, FlaskConical, HeartPulse, ScanLine } from 'lucide-react'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import { AnexosDoCampo, AnexosOutros, AvisosAnexos } from '@/features/anexos/anexos-do-campo'
import type { AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { enviarParaValidacao, finalizar } from './actions'
import { CampoTextual } from './campo-textual'
import { aplicarSinal, brutosDeSinais, CamposSinais, errosDeSinais, type BrutosSinais, type CampoSinal } from './campos-sinais'
import { rascunhoMedicaVazio, SUGESTOES_EXAME_FISICO, validarParaFinalizar, type DadosMedica } from './modelos/medica'
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
  /** Chamado depois de descartar o rascunho, para a ficha recomeçar vazia. */
  aoDescartar?: (idRascunho: string) => void
  rascunho: { id: string; dados: DadosMedica; textoLivre: string; devolvidaMotivo: string | null; devolvidaPorNome?: string | null } | null
  anterior: DadosMedica | null
  /** Valores de um rascunho novo (quadro de admissão na primeira evolução); sem isso, rascunho vazio. */
  inicial?: DadosMedica | null
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

export function FormMedica({ internacaoId, userId, perfil, rascunho, anterior, inicial, anexos, adendo, aoDescartar }: Props) {
  const podeFinalizar = perfil === 'medico'
  const titulo = adendo ? tituloAdendo(adendo.finalizada_em ?? adendo.criado_em) : 'Evolução médica'

  const [brutos, setBrutos] = useState<BrutosSinais>(() => brutosDeSinais((rascunho?.dados ?? inicial ?? rascunhoMedicaVazio()).sinais))
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState(false)
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [avisoAnexo, setAvisoAnexo] = useState(false)
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
    dadosVazios: inicial ?? rascunhoMedicaVazio(),
    aoRestaurar: (d) => setBrutos(brutosDeSinais(d.sinais)),
    aoDescartar,
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

  /** Envio em andamento ou falho bloqueia a finalização: mostra o aviso junto dos campos de exame. */
  function bloquearPorAnexo() {
    setAvisoAnexo(true)
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
          <p>{podeFinalizar ? 'Antes de finalizar, corrija:' : 'Antes de enviar, corrija:'}</p>
          <ul className="list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} aria-label={titulo} className="flex flex-col">
        <fieldset disabled={!hidratado} className="contents">
          <CartaoSecao
            titulo={titulo}
            icone={FilePenLine}
            subtitulo="O rascunho salva sozinho. Finalize para liberar a impressão."
            className="sm:rounded-b-none"
            acao={
              <div className="flex flex-wrap items-center justify-end gap-1">
                {idRascunho && (
                  <Button
                type="button"
                variant="ghost"
                size="compacto"
                className="font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                disabled={enviando || anexosEvolucao.enviando}
                onClick={() => setDescartarAberto(true)}
              >
                Descartar rascunho
              </Button>
                )}
              <Button
                type="button"
                variant="contorno-teal"
                size="compacto"
                disabled={!hidratado || !anterior || enviando || salvando}
                title={anterior ? undefined : 'Sem evolução finalizada anterior para copiar.'}
                aria-label="Copiar evolução anterior"
                onClick={copiarAnterior}
              >
                <Copy aria-hidden="true" />
                <span className="hidden sm:inline">Copiar anterior</span>
              </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <CampoTextual id="ev-diagnosticos" rotulo="Diagnósticos" valor={dados.diagnosticos} onChange={(v) => alterarCampo('diagnosticos', v)} linhas={2} />
                <CampoTextual id="ev-comorbidades" rotulo="Comorbidades" valor={dados.comorbidades} onChange={(v) => alterarCampo('comorbidades', v)} linhas={2} />
                <CampoTextual id="ev-muc" rotulo="MUC" valor={dados.muc} onChange={(v) => alterarCampo('muc', v)} linhas={2} placeholder="Ex.: Enalapril 20 mg 12/12 h" />
              </div>

              <CampoTextual id="ev-evolucao" rotulo="Evolução clínica" valor={dados.evolucao_clinica} onChange={(v) => alterarCampo('evolucao_clinica', v)} obrigatorio linhas={5} />

              <AvisosAnexos
                estado={anexosEvolucao}
                avisoFinalizacao={avisoAnexo && (anexosEvolucao.enviando || anexosEvolucao.temFalha) ? mensagemAnexoNaoEnviado(podeFinalizar ? 'finalizar' : 'enviar') : null}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <CampoTextual id="ev-ecg" rotulo="ECG" icone={HeartPulse} corRotulo="text-exame-ecg" valor={dados.ecg} onChange={(v) => alterarCampo('ecg', v)} linhas={2} placeholder="Ex.: ritmo sinusal">
                  <AnexosDoCampo tipo="ECG" estado={anexosEvolucao} />
                </CampoTextual>
                <CampoTextual id="ev-imagem" rotulo="Exames de imagem" icone={ScanLine} corRotulo="text-exame-imagem" valor={dados.exames_imagem} onChange={(v) => alterarCampo('exames_imagem', v)} linhas={2} placeholder="Ex.: Eco FE 52%">
                  <AnexosDoCampo tipo="IMAGEM" estado={anexosEvolucao} />
                </CampoTextual>
                <CampoTextual id="ev-lab" rotulo="Exames laboratoriais" icone={FlaskConical} corRotulo="text-exame-lab" valor={dados.exames_laboratoriais} onChange={(v) => alterarCampo('exames_laboratoriais', v)} linhas={2} placeholder="Ex.: Trop 0,42, Hb 13,1">
                  <AnexosDoCampo tipo="LABORATORIO" estado={anexosEvolucao} />
                </CampoTextual>
              </div>
              <AnexosOutros estado={anexosEvolucao} />

              <div className="grid gap-2">
                <p className="flex items-center gap-1 text-[11px] font-bold tracking-wide text-primary-suave-foreground uppercase">
                  <Activity aria-hidden="true" className="size-3.5" />
                  Sinais vitais
                </p>
                <CamposSinais brutos={brutos} onAlterar={alterarSinal} />
              </div>

              <div className="grid gap-2">
                <p className="text-[11px] font-bold tracking-wide text-texto-forte uppercase">Exame físico</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CAMPOS_EXAME.map((c) => (
                    <CampoTextual key={c.chave} id={`ev-exame-${c.chave}`} rotulo={c.rotulo} valor={dados.exame_fisico[c.chave]} onChange={(v) => alterarExame(c.chave, v)} linhas={2} placeholder={`Ex.: ${SUGESTOES_EXAME_FISICO[c.chave]}`} />
                  ))}
                </div>
              </div>

              <CampoTextual id="ev-conduta" rotulo="Conduta" corRotulo="text-conduta" valor={dados.conduta} onChange={(v) => alterarCampo('conduta', v)} obrigatorio linhas={3} placeholder="Ex.: condutas, prescrições, exames solicitados…" />
            </div>
          </CartaoSecao>
        </fieldset>
        <RodapeEvolucao
          indicador={indicador}
          salvar={{ desabilitado: !hidratado || enviando || salvando || anexosEvolucao.enviando, onSalvar: salvarAgora }}
          acaoPrincipal={
            <Button type="button" variant="primaria" size="lg" className="flex-[1.4] bg-teal-700 hover:bg-teal-800 sm:h-9 sm:flex-none sm:px-3 sm:text-[13px]" disabled={!hidratado || enviando} onClick={pedirConclusao}>
              {podeFinalizar ? 'Finalizar' : 'Enviar para validação'}
            </Button>
          }
        />
      </form>

      {erroAcao && (
        <p role="alert" className="fixed inset-x-3 bottom-24 z-40 rounded-lg border border-destructive-soft-borda bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <Dialog open={dialogo} onOpenChange={(aberto) => !aberto && !enviando && setDialogo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{podeFinalizar ? 'Finalizar evolução?' : 'Enviar para validação?'}</DialogTitle>
            <DialogDescription>
              {podeFinalizar
                ? 'Depois de finalizada, a evolução não pode mais ser alterada. Você poderá reabri-la por 15 minutos, enquanto não for impressa.'
                : 'Depois de enviada, a evolução só pode ser alterada se o médico devolver.'}
              <br />
              {`${anexosEvolucao.anexos.length} anexo(s) será(ão) incluído(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" autoFocus disabled={enviando} onClick={() => setDialogo(false)}>
              {podeFinalizar ? 'Cancelar' : 'Voltar'}
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmarConclusao}>
              {podeFinalizar ? 'Finalizar' : 'Confirmar envio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogoDescartar aberto={descartarAberto} enviando={enviando} onAbertoChange={setDescartarAberto} onConfirmar={confirmarDescarte} />
    </div>
  )
}
