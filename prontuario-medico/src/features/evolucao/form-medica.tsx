'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { descartar, finalizar } from './actions'
import {
  armazenamentoIdb,
  criarFilaAutosave,
  resolverRascunho,
  type FilaAutosave,
  type PayloadRascunho,
} from './autosave'
import { modeloMedicaV1, rascunhoMedicaVazio, validarParaFinalizar, type DadosMedica } from './modelos/medica'

type Props = {
  internacaoId: string
  userId: string
  paciente: { nome: string; leito: string }
  rascunho: { id: string; dados: DadosMedica; textoLivre: string; atualizado_em: string } | null
  anterior: DadosMedica | null
}

type Sinal = keyof DadosMedica['sinais']
type CampoTexto = 'diagnosticos' | 'comorbidades' | 'muc' | 'evolucao_clinica' | 'ecg' | 'exames_imagem' | 'exames_laboratoriais' | 'conduta'
type CampoExame = keyof DadosMedica['exame_fisico']

const FUSO_SP = 'America/Sao_Paulo'
const MENSAGEM_SEM_CONEXAO =
  'Sem conexão: a evolução não foi finalizada. Ela continua salva neste aparelho; tente de novo quando a conexão voltar.'

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

/** Campo numérico vazio vira null antes de validar ou salvar. */
function paraNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
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
      <Textarea
        id={id}
        rows={linhas}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24 text-base"
      />
    </div>
  )
}

export function FormMedica({ internacaoId, userId, paciente, rascunho, anterior }: Props) {
  const router = useRouter()
  const chave = `rascunho:${internacaoId}:${userId}`

  const [dados, setDados] = useState<DadosMedica>(() => rascunho?.dados ?? rascunhoMedicaVazio())
  const [brutos, setBrutos] = useState<Record<Sinal, string>>(() => brutosDe(rascunho?.dados ?? rascunhoMedicaVazio()))
  // Uma fila por rascunho. O ouvinte de `online` e o encerramento ficam no efeito abaixo.
  const [fila] = useState<FilaAutosave>(() =>
    criarFilaAutosave({
      salvar: salvarRemoto,
      armazenamento: armazenamentoIdb,
      chave,
      evolucaoId: rascunho?.id,
    }),
  )
  const [erros, setErros] = useState<string[]>([])
  const [dialogo, setDialogo] = useState<null | 'finalizar' | 'descartar'>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  useEffect(() => {
    window.addEventListener('online', fila.aoVoltarConexao)
    return () => {
      window.removeEventListener('online', fila.aoVoltarConexao)
      fila.encerrar()
    }
  }, [fila])

  // Restaura a cópia local se ela for mais nova que o servidor. As props iniciais são fixas
  // para este formulário, por isso só `fila` e `chave` entram nas dependências.
  useEffect(() => {
    let vivo = true
    armazenamentoIdb
      .get(chave)
      .then((local) => {
        const escolhido = resolverRascunho(
          local,
          rascunho
            ? { dados: rascunho.dados, textoLivre: rascunho.textoLivre, atualizado_em: rascunho.atualizado_em }
            : null,
        )
        if (!vivo || escolhido?.origem !== 'local') return
        setDados(escolhido.dados)
        setBrutos(brutosDe(escolhido.dados))
        fila.agendar({ internacaoId, dados: escolhido.dados, textoLivre: escolhido.textoLivre })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentário acima
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
    fila.agendar({ internacaoId, dados: novo, textoLivre: '' })
  }

  function alterarCampo(campo: CampoTexto, valor: string) {
    alterar({ ...dados, [campo]: valor })
  }

  function alterarExame(campo: CampoExame, valor: string) {
    alterar({ ...dados, exame_fisico: { ...dados.exame_fisico, [campo]: valor } })
  }

  function alterarSinal(campo: Sinal, texto: string) {
    setBrutos((b) => ({ ...b, [campo]: texto }))
    const valor = campo === 'pa' ? texto : paraNumero(texto)
    alterar({ ...dados, sinais: { ...dados.sinais, [campo]: valor } as DadosMedica['sinais'] })
  }

  function copiarAnterior() {
    if (!anterior) return
    // Copia tudo menos sinais vitais: os do dia atual são mantidos.
    alterar({ ...anterior, modelo_versao: 'medica@1', sinais: dados.sinais })
  }

  function pedirFinalizacao() {
    const encontrados = [...validarParaFinalizar(dados)]
    if (!modeloMedicaV1.safeParse(dados).success) {
      encontrados.push('Revise os sinais vitais: há valor fora da faixa aceita.')
    }
    setErros(encontrados)
    setErroAcao(null)
    if (encontrados.length === 0) setDialogo('finalizar')
  }

  async function confirmarFinalizacao() {
    setEnviando(true)
    setErroAcao(null)
    try {
      // Envia o que estiver pendente antes de finalizar; sem isso o servidor poderia finalizar uma versão antiga.
      await fila.forcar()
    } catch {
      setEnviando(false)
      setDialogo(null)
      setErroAcao(MENSAGEM_SEM_CONEXAO)
      return
    }
    const evolucaoId = fila.evolucaoId
    if (!evolucaoId) {
      setEnviando(false)
      setDialogo(null)
      setErroAcao('Não foi possível localizar o rascunho. Tente novamente.')
      return
    }
    const resultado = await finalizar(evolucaoId)
    // Em sucesso o servidor redireciona; aqui só chega o erro.
    setEnviando(false)
    setDialogo(null)
    if (resultado?.erro) setErroAcao(resultado.erro)
  }

  async function confirmarDescarte() {
    if (!idRascunho) return
    setEnviando(true)
    setErroAcao(null)
    try {
      await fila.cancelar()
      await descartar(idRascunho)
      router.push(`/internacoes/${internacaoId}`)
      router.refresh()
    } catch {
      setEnviando(false)
      setDialogo(null)
      setErroAcao('Não foi possível descartar o rascunho. Tente novamente.')
    }
  }

  const indicador =
    estado === 'offline'
      ? 'Sem conexão. Suas alterações ficam neste aparelho até a conexão voltar.'
      : estado === 'pendente'
        ? 'Salvando…'
        : ultimoSalvo
          ? `Salvo às ${horaSalvo(ultimoSalvo)}`
          : 'Sem alterações pendentes'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          href={`/internacoes/${internacaoId}`}
          className="inline-flex min-h-11 w-fit items-center font-semibold underline-offset-4 hover:underline"
        >
          ← Voltar ao prontuário
        </Link>
        <h1 className="text-2xl font-bold leading-snug">Evolução médica</h1>
        <p className="text-muted-foreground">
          {paciente.nome} · Leito {paciente.leito}
        </p>
      </header>

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

      <form onSubmit={(e) => e.preventDefault()} aria-label="Evolução médica" className="flex flex-col gap-4">
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
              <CampoTextual
                id="ev-evolucao"
                rotulo="Evolução clínica"
                valor={dados.evolucao_clinica}
                onChange={(v) => alterarCampo('evolucao_clinica', v)}
                obrigatorio
                linhas={6}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="exames">
            <AccordionTrigger className="min-h-11 text-base font-bold">Exames</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4 pb-4">
              <CampoTextual id="ev-ecg" rotulo="ECG" valor={dados.ecg} onChange={(v) => alterarCampo('ecg', v)} linhas={2} />
              <CampoTextual id="ev-imagem" rotulo="Exames de imagem" valor={dados.exames_imagem} onChange={(v) => alterarCampo('exames_imagem', v)} linhas={2} />
              <CampoTextual id="ev-lab" rotulo="Exames laboratoriais" valor={dados.exames_laboratoriais} onChange={(v) => alterarCampo('exames_laboratoriais', v)} linhas={2} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sinais">
            <AccordionTrigger className="min-h-11 text-base font-bold">Sinais vitais</AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {CAMPOS_SINAIS.map((c) => (
                  <div key={c.chave} className="grid gap-2">
                    <Label htmlFor={`ev-sinal-${c.chave}`}>{c.rotulo}</Label>
                    <Input
                      id={`ev-sinal-${c.chave}`}
                      inputMode={c.modo}
                      autoComplete="off"
                      placeholder={c.placeholder}
                      value={brutos[c.chave]}
                      onChange={(e) => alterarSinal(c.chave, e.target.value)}
                      className="h-11 text-base tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="exame-fisico">
            <AccordionTrigger className="min-h-11 text-base font-bold">Exame físico</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4 pb-4">
              {CAMPOS_EXAME.map((c) => (
                <CampoTextual
                  key={c.chave}
                  id={`ev-exame-${c.chave}`}
                  rotulo={c.rotulo}
                  valor={dados.exame_fisico[c.chave]}
                  onChange={(v) => alterarExame(c.chave, v)}
                  linhas={2}
                />
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="conduta">
            <AccordionTrigger className="min-h-11 text-base font-bold">Conduta</AccordionTrigger>
            <AccordionContent className="flex flex-col gap-4 pb-4">
              <CampoTextual
                id="ev-conduta"
                rotulo="Conduta"
                valor={dados.conduta}
                onChange={(v) => alterarCampo('conduta', v)}
                obrigatorio
                linhas={4}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </form>

      <footer className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-border bg-card p-4">
        <p role="status" aria-live="polite" className="text-sm font-semibold text-muted-foreground">
          {indicador}
        </p>
        {erroAcao && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
            {erroAcao}
          </p>
        )}
        {!anterior && (
          <p className="text-sm text-muted-foreground">Sem evolução finalizada anterior para copiar.</p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {idRascunho && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={enviando}
              onClick={() => setDialogo('descartar')}
            >
              Descartar rascunho
            </Button>
          )}
          <Button type="button" variant="outline" size="lg" disabled={!anterior || enviando} onClick={copiarAnterior}>
            Copiar anterior
          </Button>
          <Button type="button" size="lg" disabled={enviando} onClick={pedirFinalizacao}>
            Finalizar
          </Button>
        </div>
      </footer>

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
