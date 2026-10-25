'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { hojeSP, idade } from '@/lib/datas'
import { admitir, type EstadoAdmissao } from './actions'

const ESTADO_INICIAL: EstadoAdmissao = {}
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

const classeSelect =
  'h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function FormAdmissao({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const [state, formAction, pending] = useActionState(admitir, ESTADO_INICIAL)
  const valores = state.valores ?? {}

  // Data digitada nesta tentativa; após um envio com erro, volta ao valor devolvido pelo servidor.
  const [digitado, setDigitado] = useState<{ base: EstadoAdmissao; valor: string } | null>(null)
  const nascimento = digitado && digitado.base === state ? digitado.valor : (valores.nascimento ?? '')
  const anosNascimento =
    DATA_ISO.test(nascimento) && nascimento <= hojeSP()
      ? idade(nascimento)
      : null

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.erro && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 font-semibold text-destructive-soft-foreground">
          {state.erro}
        </p>
      )}

      <fieldset className="grid gap-4 lg:grid-cols-2">
        <legend className="mb-2 text-lg font-bold">Paciente</legend>
        <div className="grid gap-2 lg:col-span-2">
          <Label htmlFor="nome">
            Nome completo <span aria-hidden="true">*</span>
          </Label>
          <Input id="nome" name="nome" required autoComplete="off" defaultValue={valores.nome} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nascimento">
            Data de nascimento <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="nascimento"
            name="nascimento"
            type="date"
            required
            defaultValue={valores.nascimento}
            onChange={(e) => setDigitado({ base: state, valor: e.target.value })}
            aria-describedby="idade-calculada"
          />
          <p id="idade-calculada" aria-live="polite" className="text-sm text-muted-foreground">
            {anosNascimento === null
              ? 'Idade será calculada pela data.'
              : `Idade: ${anosNascimento} ${anosNascimento === 1 ? 'ano' : 'anos'}`}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="convenio">
            Convênio <span aria-hidden="true">*</span>
          </Label>
          <Input id="convenio" name="convenio" required defaultValue={valores.convenio} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4 lg:grid-cols-2">
        <legend className="mb-2 text-lg font-bold">Internação</legend>
        <div className="grid gap-2">
          <Label htmlFor="equipe">
            Equipe responsável <span aria-hidden="true">*</span>
          </Label>
          <select id="equipe" name="equipe" required className={classeSelect} defaultValue={valores.equipe ?? ''}>
            <option value="" disabled>
              Escolha a equipe
            </option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="leito">
            Leito / ala <span aria-hidden="true">*</span>
          </Label>
          <Input id="leito" name="leito" required defaultValue={valores.leito} />
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-lg font-bold">Quadro inicial</legend>
        <div className="grid gap-2">
          <Label htmlFor="diagnostico">Diagnóstico inicial</Label>
          <Input id="diagnostico" name="diagnostico" defaultValue={valores.diagnostico} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="comorbidades">Comorbidades</Label>
          <Textarea id="comorbidades" name="comorbidades" defaultValue={valores.comorbidades} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="muc">MUC (medicamentos de uso contínuo)</Label>
          <Textarea id="muc" name="muc" defaultValue={valores.muc} />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" size="lg">
          <Link href="/">Cancelar</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          Confirmar admissão
        </Button>
      </div>
    </form>
  )
}
