import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Activity, FileText } from 'lucide-react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { AbasColoridas, AbaPainel } from './abas-coloridas'

const abas = [
  { valor: 'evolucoes', rotulo: 'Evoluções', icone: FileText, cor: 'teal' as const },
  { valor: 'ecg', rotulo: 'ECG', icone: Activity, cor: 'rose' as const },
]

function Exemplo() {
  const [v, setV] = useState('evolucoes')
  return (
    <AbasColoridas abas={abas} valor={v} onValorChange={setV}>
      <AbaPainel valor="evolucoes">painel evoluções</AbaPainel>
      <AbaPainel valor="ecg">painel ecg</AbaPainel>
    </AbasColoridas>
  )
}

describe('AbasColoridas', () => {
  it('mostra só o painel ativo', () => {
    render(<Exemplo />)
    expect(screen.getByText('painel evoluções')).not.toBeNull()
    expect(screen.queryByText('painel ecg')).toBeNull()
  })

  it('troca ao clicar', () => {
    render(<Exemplo />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'ECG' }), { button: 0 })
    expect(screen.getByText('painel ecg')).not.toBeNull()
  })

  it('troca com teclado', async () => {
    render(<Exemplo />)
    screen.getByRole('tab', { name: 'Evoluções' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'ECG' }).getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByText('painel ecg')).not.toBeNull()
  })
})
