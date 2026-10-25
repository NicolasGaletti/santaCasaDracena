'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MarcarAba } from '@/components/navegacao-ativa'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { BlocoAnexos, useAnexosEvolucao } from '@/features/anexos/anexos-evolucao'
import { ErroAnexo, MENSAGEM_SEM_CONEXAO_ANEXO, type AnexoRascunho } from '@/features/anexos/enviar-anexo'
import { descartar, finalizar } from './actions'
import { armazenamentoIdb, criarFilaAutosave, resolverRascunho, type FilaAutosave, type PayloadRascunho } from './autosave'
import { modeloMedicaV1, rascunhoMedicaVazio, validarParaFinalizar, type DadosMedica } from './modelos/medica'

type Props = {
  internacaoId: string
  userId: string
  perfil: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosMedica; textoLivre: string } | null
  anterior: DadosMedica | null
  anexos: AnexoRascunho[]
}

type Sinal = keyof DadosMedica['sinais']
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

const FUSO_SP = 'America/Sao_Paulo'
const MENSAGEM_SEM_CONEXAO =
  'Sem conexão: a evolução não foi finalizada. Ela continua salva neste aparelho; tente de novo quando a conexão voltar.'

const MENSAGEM_SALVAR_SEM_CONEXAO = 'Sem conexão: o rascunho continua salvo neste aparelho.'

/** Sem assinatura: o valor muda só com a hidratação (servidor: false; cliente hidratado: true). */
const assinaVazio = () => () => {}

const MENSAGEM_RESIDENTE = 'Rascunho salvo. O envio para validação do médico chega em breve.'

/** Redirecionamento do Next chega como erro com digest `NEXT_REDIRECT`: não é falha, não se trata. */
function ehRedirecionamento(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && String((erro as { digest?: unknown }).digest ?? '').startsWith('NEXT_REDIRECT')
}

const CAMPOS_SINAIS: { chave: Sinal; rotulo: string; placeholder: string; modo: 'text' | 'decimal' }[] = [
  { chave: 'pa', rotulo: 'PA (mmHg)', placeholder: '120/80', modo: 'text' },
  { chave: 'fc', rotulo: 'FC (bpm)', placeholder: '80', modo: 'decimal' },
  { chave: 'fr', rotulo: 'FR (irpm)', placeholder: '16', modo: 'decimal' },
  { chave: 'temp', rotulo: 'Temperatura (°C)', placeholder: '36,5', modo: 'decimal' },
  { chave: 'sato2', rotulo: 'SatO2 (%)', placeholder: '98', modo: 'decimal' },
  { chave: 'dextro', rotulo: 'Dextro (mg/dL)', placeholder: '100', modo: 'decimal' },
  { chave: 'diurese', rotulo: 'Diurese (mL/24 h)', placeholder: '1500', modo: 'decimal' },
]

const CAMPOS_EXAME: { chave: CampoExame; rotulo: string }[] = [
  { chave: 'geral', rotulo: 'Geral' },
  { chave: 'ar', rotulo: 'Aparelho respiratório' },
  { chave: 'acv', rotulo: 'Aparelho cardiovascular' },
  { chave: 'abdome', rotulo: 'Abdome' },
  { chave: 'membros', rotulo: 'Membros' },
  { chave: 'neuro', rotulo: 'Neurológico' },
]

function brutosDe(d: DadosMedica): Record<Sinal, string> {
  const texto = (n: number | null) => (n === null ? '' : String(n))
  return {
    pa: d.sinais.pa,
    fc: texto(d.sinais.fc),
    fr: texto(d.sinais.fr),
    temp: texto(d.sinais.temp),
    sato2: texto(d.sinais.sato2),
    dextro: texto(d.sinais.dextro),
    diurese: texto(d.sinais.diurese),
  }
}

/** Texto do campo numérico: vazio é "sem valor" (null); algo que não é número é inválido. */
function lerNumero(texto: string): { ok: true; valor: number | null } | { ok: false } {
  const t = texto.trim().replace(',', '.')
  if (t === '') return { ok: true, valor: null }
  const n = Number(t)
  return Number.isFinite(n) ? { ok: true, valor: n } : { ok: false }
}

/** Mensagem de erro do sinal, ou null. A faixa vem do próprio schema do modelo. */
function erroSinal(chave: Sinal, texto: string): string | null {
  const t = texto.trim()
  if (t === '') return null
  if (chave === 'pa') return /^\d{2,3}\/\d{2,3}$/.test(t) ? null : 'Use o formato 120/80.'
  const lido = lerNumero(t)
  if (!lido.ok) return 'Digite um número.'
  return modeloMedicaV1.shape.sinais.shape[chave].safeParse(lido.valor).success
    ? null
    : 'Valor fora da faixa aceita.'
}

async function salvarRemoto(p: PayloadRascunho): Promise<{ id: string; atualizado_em: string }> {
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

function CampoTextual({
  id,
  rotulo,
  valor,
  onChange,
  obrigatorio = false,
  linhas = 3,
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  obrigatorio?: boolean
  linhas?: number
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </Label>
      <Textarea id={id} rows={linhas} value={valor} onChange={(e) => onChange(e.target.value)} className="min-h-24 text-base" />
    </div>
  )
}

export function FormMedica({ internacaoId, userId, perfil, paciente, rascunho, anterior, anexos }: Props) {
  const podeFinalizar = perfil !== 'residente'
  const router = useRouter()
  const chave = `rascunho:${internacaoId}:${userId}`
  const dadosInicial = rascunho?.dados ?? rascunhoMedicaVazio()

  const [dados, setDados] = useState<DadosMedica>(dadosInicial)
  const [brutos, setBrutos] = useState<Record<Sinal, string>>(() => brutosDe(dadosInicial))
  // Texto livre carregado do servidor é preservado; o formulário não o edita.
  const [textoLivre] = useState(rascunho?.textoLivre ?? '')
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState<null | 'finalizar' | 'descartar'>(null)
  const [enviando, setEnviando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const travaFinalizacao = useRef(false)

  // Uma fila por rascunho. O ouvinte de `online` e o encerramento ficam no efeito abaixo.
  // Até hidratar, o HTML do servidor fica bloqueado: digitação antes do React não chegaria ao estado.
  const hidratado = useSyncExternalStore(assinaVazio, () => true, () => false)

  const [fila] = useState<FilaAutosave>(() =>
    criarFilaAutosave({
      salvar: salvarRemoto,
      armazenamento: armazenamentoIdb,
      chave,
      evolucaoId: rascunho?.id,
    }),
  )

  useEffect(() => {
    window.addEventListener('online', fila.aoVoltarConexao)
    return () => {
      window.removeEventListener('online', fila.aoVoltarConexao)
      fila.encerrar()
    }
  }, [fila])

  // Restaura a cópia local (IndexedDB) só se o formulário ainda não foi editado: nunca sobrescreve digitação.
  useEffect(() => {
    let vivo = true
    armazenamentoIdb
      .get(chave)
      .then((local) => {
        const escolhido = resolverRascunho(local, rascunho ? { dados: rascunho.dados, textoLivre: rascunho.textoLivre } : null)
        if (!vivo || escolhido?.origem !== 'local' || !fila.pristina) return
        setDados(escolhido.dados)
        setBrutos(brutosDe(escolhido.dados))
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
  const idRascunho = fila.evolucaoId

  function alterar(novo: DadosMedica) {
    setDados(novo)
    fila.agendar({ internacaoId, dados: novo, textoLivre })
  }

  function alterarCampo(campo: CampoTexto, valor: string) {
    alterar({ ...dados, [campo]: valor })
  }

  function alterarExame(campo: CampoExame, valor: string) {
    alterar({ ...dados, exame_fisico: { ...dados.exame_fisico, [campo]: valor } })
  }

  function alterarSinal(campo: Sinal, texto: string) {
    setBrutos((b) => ({ ...b, [campo]: texto }))
    // Campo inválido não substitui o último valor válido: o erro aparece e bloqueia a finalização.
    if (erroSinal(campo, texto) !== null) return
    const lido = lerNumero(texto)
    const valor = campo === 'pa' ? texto.trim() : lido.ok ? lido.valor : null
    alterar({ ...dados, sinais: { ...dados.sinais, [campo]: valor } as DadosMedica['sinais'] })
  }

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

  const anexosEvolucao = useAnexosEvolucao({ iniciais: anexos, garantirRascunho })

  function copiarAnterior() {
    if (!anterior) return
    // Copia tudo menos sinais vitais: os do dia atual são mantidos.
    alterar({ ...anterior, modelo_versao: 'medica@1', sinais: dados.sinais })
  }

  const errosSinais = CAMPOS_SINAIS.flatMap((c) => {
    const e = erroSinal(c.chave, brutos[c.chave])
    return e ? [`${c.rotulo}: ${e}`] : []
  })

  function pedirFinalizacao() {
    const encontrados = [...validarParaFinalizar(dados), ...errosSinais]
    setErros(encontrados)
    setErroAcao(null)
    if (encontrados.length === 0) setDialogo('finalizar')
  }

  async function confirmarFinalizacao() {
    // Trava síncrona: dois cliques no mesmo instante não disparam duas finalizações.
    if (travaFinalizacao.current) return
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
    if (!idRascunho) return
    setEnviando(true)
    setErroAcao(null)
    await fila.cancelar().catch(() => {})
    try {
      await descartar(idRascunho)
    } catch {
      // Descarte falhou: a cópia local fica e a fila volta a enviar.
      fila.reabrir()
      setEnviando(false)
      setDialogo(null)
      setErroAcao('Não foi possível descartar o rascunho. Tente novamente.')
      return
    }
    await fila.apagarCopiaLocal().catch(() => {})
    router.push(`/internacoes/${internacaoId}`)
    router.refresh()
  }

  const indicador =
    !hidratado
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
              onClick={() => setDialogo('descartar')}
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
        <Accordion type="multiple" defaultValue={['evolucao', 'conduta']} className="rounded-lg border border-border bg-card px-4">
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
              <BlocoAnexos estado={anexosEvolucao} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sinais">
            <AccordionTrigger className="min-h-11 text-base font-bold">Sinais vitais</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {CAMPOS_SINAIS.map((c) => {
                  const erro = erroSinal(c.chave, brutos[c.chave])
                  return (
                    <div key={c.chave} className="grid content-start gap-2">
                      <Label htmlFor={`ev-sinal-${c.chave}`}>{c.rotulo}</Label>
                      <Input
                        id={`ev-sinal-${c.chave}`}
                        inputMode={c.modo}
                        autoComplete="off"
                        placeholder={c.placeholder}
                        value={brutos[c.chave]}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={erro ? `erro-sinal-${c.chave}` : undefined}
                        onChange={(e) => alterarSinal(c.chave, e.target.value)}
                        className="h-11 text-base tabular-nums"
                      />
                      {erro && (
                        <p id={`erro-sinal-${c.chave}`} className="text-sm font-semibold text-destructive">
                          {erro}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
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

      <footer className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-border bg-card px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:left-auto lg:mx-auto lg:max-w-6xl">
        <p role="status" aria-live="polite" className="min-w-0 shrink text-xs font-semibold text-muted-foreground">
          {indicador}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
          <Button type="button" variant="secondary" disabled={!hidratado || enviando || salvando || anexosEvolucao.enviando} onClick={salvarAgora} className="h-11 px-3 text-sm">
            Salvar
          </Button>
          {podeFinalizar && (
            <Button type="button" disabled={!hidratado || enviando || anexosEvolucao.enviando} onClick={pedirFinalizacao} className="h-11 px-4">
              Finalizar
            </Button>
          )}
        </div>
      </footer>

      {erroAcao && (
        <p role="alert" className="fixed inset-x-3 bottom-20 z-30 rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erroAcao}
        </p>
      )}

      <Dialog open={dialogo !== null} onOpenChange={(aberto) => !aberto && !enviando && setDialogo(null)}>
        <DialogContent>
          {dialogo === 'finalizar' ? (
            <>
              <DialogHeader>
                <DialogTitle>Finalizar evolução?</DialogTitle>
                <DialogDescription>Depois de finalizada a evolução não pode ser alterada.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
                  Voltar
                </Button>
                <Button type="button" size="lg" disabled={enviando} onClick={confirmarFinalizacao}>
                  Confirmar finalização
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Descartar rascunho?</DialogTitle>
                <DialogDescription>O rascunho será apagado e não poderá ser recuperado.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
                  Manter rascunho
                </Button>
                <Button type="button" variant="destructive" size="lg" disabled={enviando} onClick={confirmarDescarte}>
                  Descartar rascunho
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
