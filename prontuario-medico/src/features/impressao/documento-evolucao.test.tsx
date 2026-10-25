// @vitest-environment node
import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { rascunhoMedicaVazio, type DadosMedica } from '@/features/evolucao/modelos/medica'
import {
  DocumentoEvolucao,
  codigoCurto,
  secoesVisiveis,
  sinaisVisiveis,
  type EvolucaoImpressao,
} from './documento-evolucao'

function dadosSemExameFisico(): DadosMedica {
  return {
    ...rascunhoMedicaVazio(),
    exame_fisico: { geral: '', ar: '', acv: '', abdome: '', membros: '', neuro: '' },
  }
}

function impressao(dados: DadosMedica, via = 1): EvolucaoImpressao {
  return {
    evolucao: {
      id: 'd0000000-0000-0000-0000-000000000001',
      categoria: 'medica',
      dados,
      finalizada_em: '2026-10-25T16:05:00.000Z',
      validada_em: '2026-10-25T16:05:00.000Z',
      conteudo_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      snapshot_autor: { nome: 'Dra. Marina Lopes (teste)', conselho: 'CRM', numero: '145892', uf: 'SP' },
      snapshot_validador: { nome: 'Dra. Marina Lopes (teste)', conselho: 'CRM', numero: '145892', uf: 'SP' },
    },
    internacao: {
      leito_ala: 'A-01',
      equipe_nome: 'Cardiologia',
      medico_responsavel_nome: 'Dra. Marina Lopes (teste)',
    },
    paciente: { nome: 'Paciente Teste', data_nascimento: '1970-03-10', convenio: 'SUS' },
    via,
  }
}

describe('secoesVisiveis', () => {
  it('omite seção vazia e mantém a ordem do documento', () => {
    const dados: DadosMedica = {
      ...dadosSemExameFisico(),
      diagnosticos: 'Insuficiência cardíaca',
      conduta: 'Diurético EV',
    }
    expect(secoesVisiveis(dados)).toEqual([
      { titulo: 'Diagnósticos', texto: 'Insuficiência cardíaca' },
      { titulo: 'Conduta', texto: 'Diurético EV' },
    ])
  })

  it('ignora texto só com espaços', () => {
    const dados: DadosMedica = { ...dadosSemExameFisico(), comorbidades: '   ' }
    expect(secoesVisiveis(dados)).toEqual([])
  })

  it('concatena exame físico preenchido com rótulos de sistema', () => {
    const dados: DadosMedica = {
      ...dadosSemExameFisico(),
      exame_fisico: { geral: 'REG', ar: 'MV+ bilateral', acv: '', abdome: '', membros: 'sem edema', neuro: '' },
    }
    expect(secoesVisiveis(dados)).toEqual([
      { titulo: 'Exame físico', texto: 'Geral: REG\nAR: MV+ bilateral\nMembros: sem edema' },
    ])
  })
})

describe('sinaisVisiveis', () => {
  it('mostra só valores preenchidos', () => {
    const dados: DadosMedica = {
      ...dadosSemExameFisico(),
      sinais: { pa: '130/85', fc: 88, fr: null, temp: 36.5, sato2: null, dextro: null, diurese: null },
    }
    expect(sinaisVisiveis(dados)).toEqual([
      { rotulo: 'PA', valor: '130/85 mmHg' },
      { rotulo: 'FC', valor: '88 bpm' },
      { rotulo: 'Temp.', valor: '36,5 °C' },
    ])
  })

  it('devolve lista vazia quando nenhum sinal foi informado', () => {
    expect(sinaisVisiveis(dadosSemExameFisico())).toEqual([])
  })
})

describe('codigoCurto', () => {
  it('usa os 8 primeiros caracteres do uuid em maiúsculas', () => {
    expect(codigoCurto('d0a1b2c3-0000-4000-8000-000000000000')).toBe('D0A1B2C3')
  })
})

describe('DocumentoEvolucao', () => {
  it('gera um PDF não vazio', async () => {
    const dados: DadosMedica = { ...dadosSemExameFisico(), conduta: 'Manter esquema', evolucao_clinica: 'Estável' }
    const buffer = await renderToBuffer(<DocumentoEvolucao evolucoes={[impressao(dados)]} />)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })
})
