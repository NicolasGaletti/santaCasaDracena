'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { abrirPdfEmNovaAba } from './abrir-pdf'
import { urlAssinada } from './actions'
import type { AnexoGaleria } from './consultas'
import { formatarDataAnexo, ROTULO_TIPO_ANEXO, TIPOS_ANEXO, type TipoAnexo } from './rotulos'

type Filtro = 'todos' | TipoAnexo

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  ...TIPOS_ANEXO.map((t) => ({ valor: t, rotulo: ROTULO_TIPO_ANEXO[t] })),
]

/**
 * Miniatura de uma foto. A URL assinada só é pedida quando a miniatura entra na tela (ou logo, se
 * IntersectionObserver não existir). Se a imagem falhar (URL expirada), pede uma nova URL uma vez.
 */
function MiniaturaFoto({
  anexo,
  rotulo,
  data,
  onAmpliar,
}: {
  anexo: AnexoGaleria
  rotulo: string
  data: string
  onAmpliar: (anexo: AnexoGaleria) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const vivo = useRef(true)
  const renovou = useRef(false)
  const [url, setUrl] = useState<string>()
  const [falhou, setFalhou] = useState(false)

  const pedirUrl = useCallback(async () => {
    const resposta = await urlAssinada(anexo.id)
    if (!vivo.current) return
    if (resposta.url) setUrl(resposta.url)
    else setFalhou(true)
  }, [anexo.id])

  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  useEffect(() => {
    if (url) return
    const elemento = ref.current
    if (!elemento || typeof IntersectionObserver === 'undefined') {
      void pedirUrl()
      return
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((e) => e.isIntersecting)) return
        observador.disconnect()
        void pedirUrl()
      },
      { rootMargin: '200px' },
    )
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [url, pedirUrl])

  function aoFalharImagem() {
    if (renovou.current) {
      setFalhou(true)
      return
    }
    renovou.current = true
    void pedirUrl()
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Ampliar anexo: ${rotulo}, ${data}`}
      onClick={() => onAmpliar(anexo)}
      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {url && !falhou ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage: fora do otimizador
        <img
          src={url}
          alt={`Foto do anexo: ${rotulo}, ${data}`}
          loading="lazy"
          onError={aoFalharImagem}
          className="size-full object-cover"
        />
      ) : (
        <span className="px-2 text-center text-xs font-semibold text-muted-foreground">
          {falhou ? 'Prévia indisponível' : 'Carregando…'}
        </span>
      )}
    </button>
  )
}

export function GaleriaExames({ anexos }: { anexos: AnexoGaleria[] }) {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [erro, setErro] = useState<string | null>(null)
  const [visualizando, setVisualizando] = useState<AnexoGaleria | null>(null)
  const [urlVisualizacao, setUrlVisualizacao] = useState<string>()
  const [falhaVisualizacao, setFalhaVisualizacao] = useState(false)
  const visualizandoRef = useRef<AnexoGaleria | null>(null)

  const visiveis = filtro === 'todos' ? anexos : anexos.filter((a) => a.tipo === filtro)

  // Voltar do navegador fecha o visualizador em vez de sair da página.
  useEffect(() => {
    const aoVoltar = () => {
      visualizandoRef.current = null
      setVisualizando(null)
    }
    window.addEventListener('popstate', aoVoltar)
    return () => {
      window.removeEventListener('popstate', aoVoltar)
      // Se a galeria sair da tela com o visualizador aberto, desfaz a entrada extra do histórico.
      if (visualizandoRef.current && history.state?.visualizadorAnexo) history.back()
    }
  }, [])

  async function ampliar(anexo: AnexoGaleria) {
    visualizandoRef.current = anexo
    history.pushState({ ...history.state, visualizadorAnexo: true }, '')
    setVisualizando(anexo)
    setUrlVisualizacao(undefined)
    setFalhaVisualizacao(false)
    const resposta = await urlAssinada(anexo.id)
    if (visualizandoRef.current?.id !== anexo.id) return
    if (resposta.url) setUrlVisualizacao(resposta.url)
    else setFalhaVisualizacao(true)
  }

  function fecharVisualizador() {
    const estavaAberto = visualizandoRef.current !== null
    visualizandoRef.current = null
    setVisualizando(null)
    if (estavaAberto && history.state?.visualizadorAnexo) history.back()
  }

  async function abrirPdf(anexo: AnexoGaleria) {
    setErro(null)
    const mensagem = await abrirPdfEmNovaAba(anexo.id)
    if (mensagem) setErro(mensagem)
  }

  const rotuloDe = (a: AnexoGaleria) => ROTULO_TIPO_ANEXO[a.tipo]

  return (
    <section className="grid gap-4" aria-label="Galeria de exames">
      {anexos.length > 0 && (
        <div
          role="group"
          aria-label="Filtrar exames por tipo"
          className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {FILTROS.map((f) => {
            const ativo = f.valor === filtro
            return (
              <Button
                key={f.valor}
                type="button"
                size="lg"
                variant={ativo ? 'default' : 'outline'}
                aria-pressed={ativo}
                onClick={() => setFiltro(f.valor)}
                className="min-h-11 shrink-0 snap-start whitespace-nowrap"
              >
                {f.rotulo}
              </Button>
            )
          })}
        </div>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}

      {anexos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
          Nenhum exame anexado em evoluções finalizadas.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
          Nenhum exame deste tipo.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visiveis.map((anexo) => {
            const data = formatarDataAnexo(anexo.dataExame)
            const rotulo = rotuloDe(anexo)
            const ehPdf = anexo.mime === 'application/pdf'
            return (
              <li key={anexo.id} data-testid="galeria-item" className="grid min-w-0 gap-2">
                {ehPdf ? (
                  <button
                    type="button"
                    aria-label={`Abrir PDF: ${rotulo}, ${data}`}
                    onClick={() => void abrirPdf(anexo)}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <FileText aria-hidden="true" className="size-8" />
                    <span className="text-xs font-semibold">PDF</span>
                  </button>
                ) : (
                  <MiniaturaFoto anexo={anexo} rotulo={rotulo} data={data} onAmpliar={ampliar} />
                )}
                <div className="grid min-w-0 gap-0.5">
                  <p className="truncate font-semibold">{rotulo}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {data}
                    {anexo.descricao ? ` · ${anexo.descricao}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={visualizando !== null}
        onOpenChange={(aberto) => {
          if (!aberto) fecharVisualizador()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none bg-black p-0 text-white ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">
            {visualizando ? `Exame: ${rotuloDe(visualizando)}, ${formatarDataAnexo(visualizando.dataExame)}` : 'Exame'}
          </DialogTitle>
          <DialogDescription className="sr-only">Visualização em tela cheia</DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label="Fechar visualização"
              className="absolute top-3 right-3 z-10 text-white hover:bg-white/10 hover:text-white"
            >
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
          <div className="flex h-full items-center justify-center p-4">
            {urlVisualizacao && visualizando ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage: fora do otimizador
              <img
                src={urlVisualizacao}
                alt={`Foto do anexo: ${rotuloDe(visualizando)}, ${formatarDataAnexo(visualizando.dataExame)}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="text-center font-semibold">
                {falhaVisualizacao ? 'Não foi possível abrir a imagem. Tente novamente.' : 'Carregando…'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
