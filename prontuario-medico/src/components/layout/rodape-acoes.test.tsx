import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RodapeAcoes } from './rodape-acoes'

describe('RodapeAcoes', () => {
  it('renderiza info e filhos', () => {
    render(
      <RodapeAcoes info="Médico: Ana (CRM 1)">
        <button>Salvar</button>
      </RodapeAcoes>,
    )
    expect(screen.getByText('Médico: Ana (CRM 1)')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeNull()
  })

  it('fixo no celular e estático a partir de sm', () => {
    const { container } = render(<RodapeAcoes>x</RodapeAcoes>)
    const el = container.querySelector('[data-slot="rodape-acoes"]')!
    expect(el.className).toContain('fixed')
    expect(el.className).toContain('sm:static')
  })
})
