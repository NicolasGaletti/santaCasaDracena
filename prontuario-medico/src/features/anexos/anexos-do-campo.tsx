'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Camera, Check, FileText, Paperclip, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChipsSelecao } from '@/components/layout/chips-selecao'
import { cn } from 'cn'
import { hojeEmSaoPaulo, type EstadoAnexos } from './anexos-evolucao'
import type { AnexoRascunho } from './enviar-anexo'
import {
  formatarDataAnexo,
  ROTULO_TIPO_ANEXO,
  TIPOS_ANEXO_OFERECIDOS,
  type TipoAnexo,
  type TipoAnexoOferecido,
} from './rotulos'

const ACEITOS = 'image/jpeg,image/png,image/webp,application/pdf'
const MENSAGEM_DATA = 'Informe a data do exame.'

/** Cores por tipo (tokens do tema); OUTRO é neutro. */
const COR_TIPO: Record<TipoAnexo, string> = {
  ECG: 'border-exame-ecg/30 bg-exame-ecg/5',
  IMAGEM: 'border-exame-imagem/30 bg-exame-imagem/5',
  LABORATORIO: 'border-exame-lab/30 bg-exame-lab/5',
  OUTRO: 'border-border bg-card',
}

type EnvioEmCurso = EstadoAnexos['envios'][number]

/** Painel de anexar: tipo fixo (vem do campo) ou, sem `tipo`, escolha entre ECG / Imagem / Laboratório. */
function DialogoAnexar({
  aberto,
  onAbertoChange,
  tipo,
  estado,
}: {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  tipo?: TipoAnexoOferecido
  estado: EstadoAnexos
}) {
  const [escolhido, setEscolhido] = useState<TipoAnexoOferecido>(TIPOS_ANEXO_OFERECIDOS[0])
  const [descricao, setDescricao] = useState('')
  const [dataExame, setDataExame] = useState(hojeEmSaoPaulo)
  const [erro, setErro] = useState<string | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const tipoFinal = tipo ?? escolhido

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    // Limpa o campo para permitir escolher o mesmo arquivo de novo.
    evento.target.value = ''
    if (!arquivo) return
    if (!dataExame) {
      setErro(MENSAGEM_DATA)
      return
    }
    if (!estado.enviar(arquivo, { tipo: tipoFinal, descricao: descricao.trim(), dataExame })) return
    // O envio em voo guarda os próprios metadados: o painel já volta ao padrão para o próximo anexo.
    setEscolhido(TIPOS_ANEXO_OFERECIDOS[0])
    setDescricao('')
    setDataExame(hojeEmSaoPaulo())
    setErro(null)
    onAbertoChange(false)
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(a) => {
        if (!a) setErro(null)
        onAbertoChange(a)
      }}
    >
      <DialogContent className="top-auto bottom-0 max-h-[90dvh] max-w-full translate-y-0 gap-5 overflow-y-auto rounded-b-none p-5 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {tipo ? `Anexar ${ROTULO_TIPO_ANEXO[tipo]}` : 'Anexar exame'}
          </DialogTitle>
          <DialogDescription>
            {tipo ? 'Preencha e tire a foto ou escolha o arquivo.' : 'Escolha o tipo e preencha; depois tire a foto ou escolha o arquivo.'}
          </DialogDescription>
        </DialogHeader>

        {!tipo && (
          <ChipsSelecao
            nome="tipo-anexo"
            rotulo="Tipo do anexo"
            opcoes={TIPOS_ANEXO_OFERECIDOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ANEXO[t] }))}
            valor={escolhido}
            onChange={setEscolhido}
          />
        )}

        <div className="grid gap-2">
          <Label htmlFor="anexo-descricao">Descrição</Label>
          <Input
            id="anexo-descricao"
            value={descricao}
            maxLength={200}
            placeholder="Ex.: hemograma de admissão"
            onChange={(e) => setDescricao(e.target.value)}
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
        {erro && (
          <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
            {erro}
          </p>
        )}

        <input ref={fotoRef} data-testid="entrada-foto" type="file" accept="image/*" capture="environment" hidden onChange={aoEscolher} />
        <input ref={arquivoRef} data-testid="entrada-arquivo" type="file" accept={ACEITOS} hidden onChange={aoEscolher} />
      </DialogContent>
    </Dialog>
  )
}

function ItemEnvio({ envio, estado }: { envio: EnvioEmCurso; estado: EstadoAnexos }) {
  return (
    <li data-testid="anexo-envio" className="flex items-center gap-3 rounded-lg border border-border bg-card p-2">
      <div aria-hidden="true" className="size-11 shrink-0 rounded-md bg-muted" />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-[13px] font-semibold">{ROTULO_TIPO_ANEXO[envio.tipo]}</p>
        {envio.estado === 'enviando' ? (
          <p role="status" className="text-[13px] text-muted-foreground">
            Enviando…
          </p>
        ) : (
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {envio.mensagem}
          </p>
        )}
      </div>
      {envio.estado === 'erro' && (
        <div className="flex shrink-0 flex-col gap-1">
          <Button type="button" size="compacto" onClick={() => estado.tentarNovamente(envio)}>
            Tentar novamente
          </Button>
          <Button type="button" variant="ghost" size="compacto" onClick={() => estado.cancelarEnvio(envio.chave)}>
            Cancelar envio
          </Button>
        </div>
      )}
    </li>
  )
}

function ItemAnexo({ anexo, estado, onRemover }: { anexo: AnexoRascunho; estado: EstadoAnexos; onRemover: () => void }) {
  const ehPdf = anexo.mime === 'application/pdf'
  return (
    <li data-testid="anexo-item" className={cn('flex items-center gap-3 rounded-lg border p-2', COR_TIPO[anexo.tipo])}>
      {ehPdf ? (
        <div
          data-testid="icone-pdf"
          className="flex size-11 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-muted-foreground"
        >
          <FileText aria-hidden="true" className="size-5" />
          <span className="text-[10px] leading-none font-semibold">PDF</span>
        </div>
      ) : anexo.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL de objeto ou assinada: fora do otimizador
        <img
          src={anexo.previewUrl}
          alt="Foto do anexo"
          loading="lazy"
          onError={() => void estado.renovarPrevia(anexo)}
          className="size-11 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div aria-hidden="true" className="size-11 shrink-0 rounded-md bg-muted" />
      )}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="text-[13px] font-semibold">
          {ROTULO_TIPO_ANEXO[anexo.tipo]} <span className="font-normal text-muted-foreground">{formatarDataAnexo(anexo.dataExame)}</span>
        </p>
        {anexo.descricao && <p className="line-clamp-2 text-[13px] wrap-break-word text-muted-foreground">{anexo.descricao}</p>}
        {ehPdf && anexo.previewUrl && (
          <a
            href={anexo.previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(evento) => {
              evento.preventDefault()
              void estado.abrirPdf(anexo)
            }}
            className="inline-flex min-h-11 w-fit items-center text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Abrir PDF
          </a>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="compacto"
        className="shrink-0 font-semibold text-destructive hover:text-destructive"
        onClick={onRemover}
      >
        Remover
      </Button>
    </li>
  )
}

/** Lista de envios em curso e de anexos, com a confirmação de remoção. */
function ListaAnexos({ estado, anexos, envios }: { estado: EstadoAnexos; anexos: AnexoRascunho[]; envios: EnvioEmCurso[] }) {
  const [aRemover, setARemover] = useState<AnexoRascunho | null>(null)
  const [removendo, setRemovendo] = useState(false)

  async function confirmarRemocao() {
    if (!aRemover) return
    setRemovendo(true)
    await estado.remover(aRemover)
    setRemovendo(false)
    setARemover(null)
  }

  return (
    <>
      {(envios.length > 0 || anexos.length > 0) && (
        <ul className="grid gap-2">
          {envios.map((e) => (
            <ItemEnvio key={e.chave} envio={e} estado={estado} />
          ))}
          {anexos.map((a) => (
            <ItemAnexo key={a.id} anexo={a} estado={estado} onRemover={() => setARemover(a)} />
          ))}
        </ul>
      )}

      <Dialog open={aRemover !== null} onOpenChange={(a) => !a && !removendo && setARemover(null)}>
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
    </>
  )
}

function Confirmacao() {
  return (
    <p className="flex items-center gap-2 rounded-lg bg-accent p-2 text-[13px] font-semibold text-accent-foreground">
      <Check aria-hidden="true" className="size-4 shrink-0" />
      Anexo adicionado.
    </p>
  )
}

/** Anexos de um campo de exame (ECG, Imagem ou Laboratório): lista sob o campo e botão "Anexar". */
export function AnexosDoCampo({ tipo, estado }: { tipo: TipoAnexoOferecido; estado: EstadoAnexos }) {
  const [aberto, setAberto] = useState(false)
  const anexos = estado.anexos.filter((a) => a.tipo === tipo)
  const envios = estado.envios.filter((e) => e.tipo === tipo)
  const rotulo = ROTULO_TIPO_ANEXO[tipo]

  return (
    <div data-testid={`anexos-${tipo}`} className="grid gap-2">
      <ListaAnexos estado={estado} anexos={anexos} envios={envios} />
      {/* Avisa só no campo do último anexo adicionado. */}
      <div role="status" className="empty:hidden">
        {estado.adicionado && estado.anexos.at(-1)?.tipo === tipo && <Confirmacao />}
      </div>
      {anexos.length === 0 && envios.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum anexo.</p>}
      <Button
        type="button"
        variant="contorno-teal"
        size="compacto"
        className="w-fit"
        aria-label={`Anexar ${rotulo}`}
        onClick={() => setAberto(true)}
      >
        <Plus aria-hidden="true" />
        Anexar
      </Button>
      <DialogoAnexar aberto={aberto} onAbertoChange={setAberto} tipo={tipo} estado={estado} />
    </div>
  )
}

/** Ficha simples: um único "Anexar" com escolha entre ECG, Imagem e Laboratório. */
export function AnexosGerais({ estado }: { estado: EstadoAnexos }) {
  const [aberto, setAberto] = useState(false)
  const legados = estado.anexos.filter((a) => a.tipo === 'OUTRO')
  const novos = estado.anexos.filter((a) => a.tipo !== 'OUTRO')

  return (
    <div data-testid="anexos-GERAIS" className="grid gap-2">
      <ListaAnexos estado={estado} anexos={[...novos, ...legados]} envios={estado.envios} />
      <div role="status" className="empty:hidden">
        {estado.adicionado && <Confirmacao />}
      </div>
      {estado.anexos.length === 0 && estado.envios.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum anexo.</p>}
      <Button type="button" variant="contorno-teal" size="compacto" className="w-fit" onClick={() => setAberto(true)}>
        <Plus aria-hidden="true" />
        Anexar
      </Button>
      <DialogoAnexar aberto={aberto} onAbertoChange={setAberto} estado={estado} />
    </div>
  )
}

/** Anexos antigos do tipo OUTRO: só Abrir/Remover, abaixo dos campos. Some quando não há nenhum. */
export function AnexosOutros({ estado }: { estado: EstadoAnexos }) {
  const antigos = estado.anexos.filter((a) => a.tipo === 'OUTRO')
  if (antigos.length === 0) return null
  return (
    <div data-testid="anexos-OUTRO" className="grid gap-2">
      <p className="text-[11px] font-bold tracking-wide text-texto-forte uppercase">Outros anexos</p>
      <ListaAnexos estado={estado} anexos={antigos} envios={[]} />
    </div>
  )
}

/** Avisos gerais dos anexos: bloqueio de finalização e erros de remoção ou de abertura de PDF. */
export function AvisosAnexos({ estado, avisoFinalizacao = null }: { estado: EstadoAnexos; avisoFinalizacao?: string | null }) {
  return (
    <>
      {avisoFinalizacao && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {avisoFinalizacao}
        </p>
      )}
      {estado.erro && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {estado.erro}
        </p>
      )}
    </>
  )
}
