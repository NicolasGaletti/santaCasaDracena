'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Camera, FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { removerAnexo } from './actions'
import { enviarAnexo, ehFalhaDeRede, mensagemDeEnvio, MENSAGEM_SEM_CONEXAO_ANEXO, type AnexoRascunho } from './enviar-anexo'
import { ROTULO_TIPO_ANEXO, TIPOS_ANEXO, type TipoAnexo } from './rotulos'

const ACEITOS = 'image/jpeg,image/png,image/webp,application/pdf'
const MENSAGEM_DATA = 'Informe a data do exame.'
const MENSAGEM_REMOCAO = 'Não foi possível remover o anexo. Tente novamente.'

type Metadados = { tipo: TipoAnexo; descricao: string; dataExame: string }
type Envio = Metadados & { chave: string; arquivo: File; estado: 'enviando' | 'erro'; mensagem?: string }

/** Hoje no fuso de São Paulo, como AAAA-MM-DD (en-CA já formata assim). */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

function revogarPrevia(url: string | undefined) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
}

/**
 * Estado dos anexos de um rascunho. Vive no formulário (não no bloco) para que um envio em
 * andamento não se perca quando a seção Exames é recolhida.
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
  const contador = useRef(0)
  const vivo = useRef(true)
  const anexosRef = useRef(anexos)

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
    } catch (falha) {
      if (!vivo.current) return
      setEnvios((lista) =>
        lista.map((e) => (e.chave === chave ? { ...e, estado: 'erro', mensagem: mensagemDeEnvio(falha) } : e)),
      )
    }
  }

  function enviar(arquivo: File, meta: Metadados) {
    if (!meta.dataExame) {
      setErro(MENSAGEM_DATA)
      return
    }
    contador.current += 1
    const chave = `envio-${contador.current}`
    setErro(null)
    setEnvios((lista) => [...lista, { ...meta, chave, arquivo, estado: 'enviando' }])
    void executar(chave, arquivo, meta)
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
    enviando: envios.some((e) => e.estado === 'enviando'),
    enviar,
    tentarNovamente,
    cancelarEnvio,
    remover,
  }
}

export type EstadoAnexos = ReturnType<typeof useAnexosEvolucao>

const CLASSE_CHIP =
  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function BlocoAnexos({ estado }: { estado: EstadoAnexos }) {
  const [tipo, setTipo] = useState<TipoAnexo>('OUTRO')
  const [descricao, setDescricao] = useState('')
  const [dataExame, setDataExame] = useState(hojeEmSaoPaulo)
  const [aRemover, setARemover] = useState<AnexoRascunho | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    // Limpa o campo para permitir escolher o mesmo arquivo de novo.
    evento.target.value = ''
    if (!arquivo) return
    estado.enviar(arquivo, { tipo, descricao: descricao.trim(), dataExame })
  }

  async function confirmarRemocao() {
    if (!aRemover) return
    setRemovendo(true)
    await estado.remover(aRemover)
    setRemovendo(false)
    setARemover(null)
  }

  return (
    <section className="grid gap-4" aria-label="Anexos de exames">
      <h3 className="text-base font-bold">Anexos</h3>

      <div role="radiogroup" aria-label="Tipo do anexo" className="-mx-4 flex flex-nowrap gap-2 overflow-x-auto px-4 pb-1">
        {TIPOS_ANEXO.map((t) => {
          const marcado = tipo === t
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => setTipo(t)}
              className={`${CLASSE_CHIP} shrink-0 ${marcado ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card'}`}
            >
              {ROTULO_TIPO_ANEXO[t]}
            </button>
          )
        })}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="anexo-descricao">Descrição</Label>
        <Input
          id="anexo-descricao"
          value={descricao}
          maxLength={200}
          placeholder="Ex.: hemograma de admissão"
          onChange={(e) => setDescricao(e.target.value)}
          className="h-11 text-base"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="anexo-data">Data do exame</Label>
        <Input
          id="anexo-data"
          type="date"
          value={dataExame}
          max={hojeEmSaoPaulo()}
          onChange={(e) => setDataExame(e.target.value)}
          className="h-11 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={() => fotoRef.current?.click()}>
          <Camera aria-hidden="true" />
          Tirar foto
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={() => arquivoRef.current?.click()}>
          <Paperclip aria-hidden="true" />
          Escolher arquivo
        </Button>
      </div>
      <input
        ref={fotoRef}
        data-testid="entrada-foto"
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={aoEscolher}
      />
      <input ref={arquivoRef} data-testid="entrada-arquivo" type="file" accept={ACEITOS} hidden onChange={aoEscolher} />

      {estado.erro && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {estado.erro}
        </p>
      )}

      {(estado.envios.length > 0 || estado.anexos.length > 0) && (
        <ul className="grid gap-3">
          {estado.envios.map((e) => (
            <li
              key={e.chave}
              data-testid="anexo-envio"
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div aria-hidden="true" className="size-16 shrink-0 rounded-md bg-muted" />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="font-semibold">{ROTULO_TIPO_ANEXO[e.tipo]}</p>
                {e.estado === 'enviando' ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    Enviando…
                  </p>
                ) : (
                  <p role="alert" className="text-sm font-semibold text-destructive">
                    {e.mensagem}
                  </p>
                )}
              </div>
              {e.estado === 'erro' && (
                <div className="flex shrink-0 flex-col gap-1">
                  <Button type="button" size="sm" className="min-h-11" onClick={() => estado.tentarNovamente(e)}>
                    Tentar novamente
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => estado.cancelarEnvio(e.chave)}>
                    Cancelar envio
                  </Button>
                </div>
              )}
            </li>
          ))}

          {estado.anexos.map((a) => {
            const ehPdf = a.mime === 'application/pdf'
            return (
              <li key={a.id} data-testid="anexo-item" className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                {ehPdf ? (
                  <div
                    data-testid="icone-pdf"
                    className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md bg-muted text-muted-foreground"
                  >
                    <FileText aria-hidden="true" className="size-6" />
                    <span className="text-xs font-semibold">PDF</span>
                  </div>
                ) : a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL de objeto ou assinada: fora do otimizador
                  <img src={a.previewUrl} alt="Foto do anexo" loading="lazy" className="size-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <div aria-hidden="true" className="size-16 shrink-0 rounded-md bg-muted" />
                )}
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="font-semibold">{ROTULO_TIPO_ANEXO[a.tipo]}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatarData(a.dataExame)}
                    {a.descricao ? ` · ${a.descricao}` : ''}
                  </p>
                  {ehPdf && a.previewUrl && (
                    <a
                      href={a.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 w-fit items-center font-semibold underline-offset-4 hover:underline"
                    >
                      Abrir PDF
                    </a>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="-mt-2 min-h-11 shrink-0 px-3 font-semibold text-destructive hover:text-destructive"
                  onClick={() => setARemover(a)}
                >
                  Remover
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={aRemover !== null} onOpenChange={(aberto) => !aberto && !removendo && setARemover(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover anexo?</DialogTitle>
            <DialogDescription>O arquivo será apagado e não poderá ser recuperado.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={removendo} onClick={() => setARemover(null)}>
              Manter anexo
            </Button>
            <Button type="button" variant="destructive" size="lg" disabled={removendo} onClick={confirmarRemocao}>
              Remover anexo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
