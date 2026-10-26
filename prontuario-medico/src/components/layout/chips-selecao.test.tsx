import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ChipsSelecao } from './chips-selecao'

const opcoes = [
  { valor: 'a', rotulo: 'Cardiologia' },
  { valor: 'b', rotulo: 'Clínica' },
  { valor: 'c', rotulo: 'UTI' },
] as const

function Exemplo() {
  const [v, setV] = useState<'a' | 'b' | 'c'>('a')
  return <ChipsSelecao nome="equipe" rotulo="Equipe" opcoes={[...opcoes]} valor={v} onChange={setV} />
}

describe('ChipsSelecao', () => {
  it('expõe radiogroup rotulado e marca a opção ativa', () => {
    render(<Exemplo />)
    expect(screen.getByRole('radiogroup', { name: 'Equipe' })).not.toBeNull()
    expect(screen.getByRole('radio', { name: 'Cardiologia' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Clínica' }).getAttribute('aria-checked')).toBe('false')
  })

  it('seta direita move a seleção', () => {
    render(<Exemplo />)
    screen.getByRole('radio', { name: 'Cardiologia' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Clínica' }).getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Clínica' }))
  })

  it('clique seleciona', () => {
    render(<Exemplo />)
    fireEvent.click(screen.getByRole('radio', { name: 'UTI' }))
    expect(screen.getByRole('radio', { name: 'UTI' }).getAttribute('aria-checked')).toBe('true')
  })
})
