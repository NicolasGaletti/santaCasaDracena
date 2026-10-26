'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { GaleriaExames } from '@/features/anexos/galeria-exames'
import { CartaoEvolucao } from '@/features/evolucao/cartao-evolucao'
import { ehRedirecionamento } from '@/features/evolucao/envio'
import { OriginalAdendo } from '@/features/evolucao/original-adendo'
import { devolver, validar } from './actions'
import type { RevisaoValidacao } from './consultas'

const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente.'
const MOTIVO_MAXIMO = 500

type Dialogo = 'validar' | 'devolver' | null

/** Leitura completa de uma evolução aguardando validação, com validar e devolver. Não edita o texto. */
export function RevisaoEvolucao({ revisao }: { revisao: RevisaoValidacao }) {
  const router = useRouter()
  const id = revisao.evolucao.id
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | null>(null)
  // Trava síncrona: dois cliques no mesmo instante não disparam duas ações.
  const travaRef = useRef(false)

  async function executar(acao: () => Promise<{ erro?: string }>) {
    if (travaRef.current) return
    travaRef.current = true
    setEnviando(true)
    setErroAcao(null)
    let navegando = false
    try {
      const resultado = await acao()
      if (resultado.erro) {
        setErroAcao(resultado.erro)
        return
      }
      // Sucesso: a evolução saiu da lista do médico, então volta para ela.
      navegando = true
      router.replace('/validacao')
    } catch (erro) {
      if (ehRedirecionamento(erro)) throw erro
      setErroAcao(MENSAGEM_GENERICA)
    } finally {
      if (!navegando) {
        travaRef.current = false
        setEnviando(false)
      }
    }
  }

  function confirmarDevolucao() {
    const texto = motivo.trim()
    if (!texto) {
      setErroMotivo('Informe o motivo da devolução.')
      return
    }
    setErroMotivo(null)
    void executar(() => devolver(id, texto))
  }

  const contadorId = `contador-motivo-${id}`
  const erroMotivoId = `erro-motivo-${id}`

  return (
    <div className="flex flex-col gap-4">
      {revisao.original && <OriginalAdendo original={revisao.original} />}
      <CartaoEvolucao evolucao={revisao.evolucao} ocultarAutor />

      <p className="px-1 text-[13px] font-semibold text-muted-foreground">
        {`Registrado por ${revisao.evolucao.autor_nome ?? 'autor não identificado'} – ${revisao.autorIdentificacao || 'Perfil não identificado'}`}
      </p>

      {revisao.anexos.length > 0 && (
        <section aria-labelledby={`titulo-anexos-${id}`} className="flex flex-col gap-3">
          <h2 id={`titulo-anexos-${id}`} className="font-heading text-base font-bold text-primary-suave-foreground">
            Exames anexados
          </h2>
          <GaleriaExames anexos={revisao.anexos} />
        </section>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto"
          disabled={enviando}
          onClick={() => setDialogo('devolver')}
        >
          Devolver
        </Button>
        <Button
          type="button"
          size="lg"
          className="w-full bg-primary text-primary-foreground hover:bg-primary-hover sm:w-auto"
          disabled={enviando}
          onClick={() => setDialogo('validar')}
        >
          Validar
        </Button>
      </div>

      <Dialog open={dialogo === 'validar'} onOpenChange={(aberto) => !enviando && setDialogo(aberto ? 'validar' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validar evolução?</DialogTitle>
            <DialogDescription>Ao validar, a evolução é finalizada e não pode mais ser alterada.</DialogDescription>
          </DialogHeader>
          {erroAcao && (
            <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
              {erroAcao}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={() => void executar(() => validar(id))}>
              Confirmar validação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === 'devolver'} onOpenChange={(aberto) => !enviando && setDialogo(aberto ? 'devolver' : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver evolução?</DialogTitle>
            <DialogDescription>
              A evolução volta a rascunho para o autor corrigir. O motivo aparece para ele.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor={`motivo-${id}`} className="text-[11px] font-bold tracking-wide text-texto-forte uppercase">
              Motivo da devolução
            </label>
            <Textarea
              id={`motivo-${id}`}
              value={motivo}
              maxLength={MOTIVO_MAXIMO}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={erroMotivo ? true : undefined}
              aria-describedby={`${contadorId}${erroMotivo ? ` ${erroMotivoId}` : ''}`}
              className="min-h-28"
            />
            <div className="flex items-start justify-between gap-2 text-xs">
              {erroMotivo ? (
                <p role="alert" id={erroMotivoId} className="font-semibold text-destructive">
                  {erroMotivo}
                </p>
              ) : (
                <span />
              )}
              <p id={contadorId} className="shrink-0 tabular-nums text-muted-foreground">
                {`${motivo.length}/${MOTIVO_MAXIMO}`}
              </p>
            </div>
          </div>
          {erroAcao && (
            <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
              {erroAcao}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={enviando} onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button type="button" size="lg" disabled={enviando} onClick={confirmarDevolucao}>
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
