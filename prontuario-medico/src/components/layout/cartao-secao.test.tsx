import { render, screen } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { BarraAcoes, PilulaStatus } from './barra-acoes'
import { CartaoSecao } from './cartao-secao'
import { RotuloCampo } from './rotulo-campo'

describe('CartaoSecao', () => {
  it('renderiza título, subtítulo, ação, filhos e rodapé', () => {
    render(
      <CartaoSecao titulo="Paciente" icone={FileText} subtitulo="Dados" acao={<button>Copiar</button>} rodape="fim">
        conteúdo
      </CartaoSecao>,
    )
    expect(screen.getByRole('heading', { name: 'Paciente' })).not.toBeNull()
    expect(screen.getByText('Dados')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Copiar' })).not.toBeNull()
    expect(screen.getByText('conteúdo')).not.toBeNull()
    expect(screen.getByText('fim')).not.toBeNull()
  })
})

describe('BarraAcoes / PilulaStatus', () => {
  it('mostra status e filhos', () => {
    render(
      <BarraAcoes status={<PilulaStatus tipo="rascunho">Rascunho</PilulaStatus>}>
        <button>Imprimir</button>
      </BarraAcoes>,
    )
    expect(screen.getByText('Rascunho')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Imprimir' })).not.toBeNull()
  })
})

describe('RotuloCampo', () => {
  it('associa o rótulo ao campo', () => {
    render(
      <>
        <RotuloCampo htmlFor="x">Diagnóstico</RotuloCampo>
        <input id="x" />
      </>,
    )
    expect(screen.getByLabelText('Diagnóstico')).not.toBeNull()
  })
})
