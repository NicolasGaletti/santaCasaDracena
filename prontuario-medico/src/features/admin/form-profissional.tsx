'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RotuloCampo } from '@/components/layout/rotulo-campo'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FUNCOES, funcaoPorValor } from './funcoes'

export type ValoresProfissional = {
  nome: string
  email: string
  funcao: string
  conselho: string
  numero: string
  uf: string
  equipeIds: string[]
}

type Props = {
  modo: 'convidar' | 'editar'
  equipes: { id: string; nome: string }[]
  inicial: ValoresProfissional
  /** Admin não troca a própria função (o banco também recusa). */
  funcaoTravada?: boolean
  enviando: boolean
  erro: string | null
  rotuloEnvio: string
  onEnviar: (v: ValoresProfissional) => void
  onCancelar: () => void
}

/** Formulário compartilhado por "Convidar profissional" e "Editar". */
export function FormProfissional({
  modo,
  equipes,
  inicial,
  funcaoTravada,
  enviando,
  erro,
  rotuloEnvio,
  onEnviar,
  onCancelar,
}: Props) {
  const [v, setV] = useState(inicial)
  const funcao = funcaoPorValor(v.funcao)
  const temConselho = Boolean(funcao?.conselho)

  function mudarFuncao(valor: string) {
    const anterior = funcaoPorValor(v.funcao)?.conselho ?? ''
    const sugerido = funcaoPorValor(valor)?.conselho ?? ''
    // Só troca o conselho se o campo estiver vazio ou ainda for a sugestão da função anterior.
    const conselho = v.conselho === '' || v.conselho === anterior ? sugerido : v.conselho
    setV({ ...v, funcao: valor, conselho })
  }

  function alternarEquipe(id: string, marcada: boolean) {
    setV({ ...v, equipeIds: marcada ? [...v.equipeIds, id] : v.equipeIds.filter((e) => e !== id) })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar(v)
      }}
    >
      <div>
        <RotuloCampo htmlFor="prof-nome">Nome</RotuloCampo>
        <Input id="prof-nome" value={v.nome} maxLength={200} onChange={(e) => setV({ ...v, nome: e.target.value })} required />
      </div>

      {modo === 'convidar' && (
        <div>
          <RotuloCampo htmlFor="prof-email">E-mail</RotuloCampo>
          <Input
            id="prof-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            required
          />
        </div>
      )}

      <div>
        <RotuloCampo htmlFor="prof-funcao">Função</RotuloCampo>
        <Select value={v.funcao} onValueChange={mudarFuncao} disabled={funcaoTravada}>
          <SelectTrigger id="prof-funcao" className="w-full">
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent position="popper">
            {FUNCOES.map((f) => (
              <SelectItem key={f.valor} value={f.valor} className="min-h-11">
                {f.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {funcaoTravada && <p className="text-xs text-muted-foreground">Você não pode alterar a sua própria função.</p>}
      </div>

      {temConselho && (
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <div>
            <RotuloCampo htmlFor="prof-conselho">Conselho</RotuloCampo>
            <Input id="prof-conselho" value={v.conselho} maxLength={20} onChange={(e) => setV({ ...v, conselho: e.target.value })} />
          </div>
          <div>
            <RotuloCampo htmlFor="prof-uf">UF</RotuloCampo>
            <Input
              id="prof-uf"
              value={v.uf}
              maxLength={2}
              autoCapitalize="characters"
              onChange={(e) => setV({ ...v, uf: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="col-span-2">
            <RotuloCampo htmlFor="prof-numero">Número</RotuloCampo>
            <Input id="prof-numero" value={v.numero} maxLength={20} inputMode="numeric" onChange={(e) => setV({ ...v, numero: e.target.value })} />
          </div>
        </div>
      )}

      {equipes.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[11px] font-bold tracking-wide text-texto-forte uppercase">Equipes</legend>
          <div className="flex flex-col gap-2">
            {equipes.map((eq) => (
              <label
                key={eq.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-suave has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
              >
                <input
                  type="checkbox"
                  checked={v.equipeIds.includes(eq.id)}
                  onChange={(e) => alternarEquipe(eq.id, e.target.checked)}
                  className="size-5 accent-primary"
                />
                {eq.nome}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {erro && (
        <p role="alert" className="rounded-lg bg-destructive-soft p-3 text-sm font-semibold text-destructive-soft-foreground">
          {erro}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primaria" size="lg" disabled={enviando}>
          {enviando ? 'Enviando…' : rotuloEnvio}
        </Button>
      </div>
    </form>
  )
}
