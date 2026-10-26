'use client'

import { BedDouble, Check, Stethoscope, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { CartaoSecao } from '@/components/layout/cartao-secao'
import { ChipsSelecao } from '@/components/layout/chips-selecao'
import { RodapeAcoes } from '@/components/layout/rodape-acoes'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { hojeSP, idade } from '@/lib/datas'
import { admitir, type EstadoAdmissao } from './actions'
import { CampoConvenio } from './campo-convenio'

const ESTADO_INICIAL: EstadoAdmissao = {}
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

const obrigatorio = (
  <span aria-hidden="true" className="text-destructive">
    *
  </span>
)

type Props = {
  equipes: { id: string; nome: string }[]
  convenios: { id: string; nome: string }[]
}

export function FormAdmissao({ equipes, convenios }: Props) {
  const [state, formAction, pending] = useActionState(admitir, ESTADO_INICIAL)
  const valores = state.valores ?? {}
  const [equipe, setEquipe] = useState(valores.equipe ?? '')

  // Data digitada nesta tentativa; após um envio com erro, volta ao valor devolvido pelo servidor.
  const [digitado, setDigitado] = useState<{ base: EstadoAdmissao; valor: string } | null>(null)
  const nascimento = digitado && digitado.base === state ? digitado.valor : (valores.nascimento ?? '')
  const anosNascimento = DATA_ISO.test(nascimento) && nascimento <= hojeSP() ? idade(nascimento) : null

  return (
    <form action={formAction} className="flex min-w-0 flex-col gap-4">
      {state.erro && state.campo !== 'convenio' && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {state.erro}
        </p>
      )}

      <CartaoSecao titulo="Paciente" icone={UserRound}>
        <div className="grid items-start gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <RotuloCampo htmlFor="nome">Nome completo {obrigatorio}</RotuloCampo>
            <Input id="nome" name="nome" required autoComplete="off" defaultValue={valores.nome} />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <RotuloCampo htmlFor="nascimento" className="mb-0">
                Data de nascimento {obrigatorio}
              </RotuloCampo>
              <span aria-live="polite" className="shrink-0 text-xs font-semibold text-primary-suave-foreground">
                {anosNascimento !== null && (
                  <span data-testid="idade">
                    {anosNascimento} {anosNascimento === 1 ? 'ano' : 'anos'}
                  </span>
                )}
              </span>
            </div>
            <Input
              id="nascimento"
              name="nascimento"
              type="date"
              required
              defaultValue={valores.nascimento}
              onChange={(e) => setDigitado({ base: state, valor: e.target.value })}
            />
          </div>
          <div>
            <RotuloCampo htmlFor="convenio">Convênio {obrigatorio}</RotuloCampo>
            <CampoConvenio
              opcoes={convenios}
              defaultValue={valores.convenio}
              erro={state.campo === 'convenio' ? state.erro : undefined}
            />
          </div>
        </div>
      </CartaoSecao>

      <CartaoSecao titulo="Internação" icone={BedDouble}>
        <div className="grid items-start gap-4">
          <div>
            <span className="mb-1 block text-[11px] font-bold tracking-wide text-texto-forte uppercase">
              Equipe responsável {obrigatorio}
            </span>
            <ChipsSelecao
              nome="equipe"
              rotulo="Equipe responsável"
              opcoes={equipes.map((e) => ({ valor: e.id, rotulo: e.nome }))}
              valor={equipe}
              onChange={setEquipe}
            />
            <input type="hidden" name="equipe" value={equipe} />
          </div>
          <div className="sm:max-w-xs">
            <RotuloCampo htmlFor="leito">Leito / ala {obrigatorio}</RotuloCampo>
            <Input id="leito" name="leito" required defaultValue={valores.leito} />
          </div>
        </div>
      </CartaoSecao>

      <CartaoSecao titulo="Quadro inicial" icone={Stethoscope} subtitulo="Opcional, visível só para a equipe clínica.">
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <div>
            <RotuloCampo htmlFor="diagnostico">Diagnóstico inicial</RotuloCampo>
            <Textarea id="diagnostico" name="diagnostico" rows={2} placeholder="Ex.: IAMSSST" defaultValue={valores.diagnostico} />
          </div>
          <div>
            <RotuloCampo htmlFor="comorbidades">Comorbidades</RotuloCampo>
            <Textarea id="comorbidades" name="comorbidades" rows={2} placeholder="Ex.: HAS, DM2" defaultValue={valores.comorbidades} />
          </div>
          <div>
            <RotuloCampo htmlFor="muc">MUC (medicamentos de uso contínuo)</RotuloCampo>
            <Textarea id="muc" name="muc" rows={2} placeholder="Ex.: Enalapril 20mg 12/12h" defaultValue={valores.muc} />
          </div>
        </div>
      </CartaoSecao>

      <RodapeAcoes info="Campos com * são obrigatórios.">
        <Button asChild variant="outline" size="lg">
          <Link href="/">Cancelar</Link>
        </Button>
        <Button type="submit" variant="primaria" size="lg" disabled={pending} className="sm:min-w-44">
          <Check aria-hidden className="size-4" />
          Confirmar admissão
        </Button>
      </RodapeAcoes>
    </form>
  )
}
