// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { PDFParse } from 'pdf-parse'
import { describe, expect, it } from 'vitest'
import { rascunhoMedicaVazio, type DadosMedica } from '@/features/evolucao/modelos/medica'
import {
  DocumentoEvolucao,
  codigoCurto,
  legendaAnexo,
  secoesVisiveis,
  sinaisVisiveis,
  type AnexoImpressao,
  type EvolucaoImpressao,
} from './documento-evolucao'

const FOTO = readFileSync(path.join(process.cwd(), 'e2e/fixtures/exame.jpg'))

function dadosSemExameFisico(): DadosMedica {
  return {
    ...rascunhoMedicaVazio(),
    exame_fisico: { geral: '', ar: '', acv: '', abdome: '', membros: '', neuro: '' },
  }
}

function impressao(dados: DadosMedica, via = 1, anexos: AnexoImpressao[] = []): EvolucaoImpressao {
  return {
    evolucao: {
      id: 'd0000000-0000-0000-0000-000000000001',
      categoria: 'medica',
      dados,
      finalizada_em: '2026-10-25T16:05:00.000Z',
      validada_em: '2026-10-25T16:05:00.000Z',
      conteudo_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      hash_versao: 2,
      snapshot_autor: { nome: 'Dra. Marina Lopes (teste)', conselho: 'CRM', numero: '145892', uf: 'SP' },
      snapshot_validador: { nome: 'Dra. Marina Lopes (teste)', conselho: 'CRM', numero: '145892', uf: 'SP' },
    },
    internacao: {
      leito_ala: 'A-01',
      equipe_nome: 'Cardiologia',
    },
    paciente: { nome: 'Paciente Teste', data_nascimento: '1970-03-10', convenio: 'SUS' },
    via,
    anexos,
  }
}

const anexoPdf: AnexoImpressao = {
  id: 'a0000000-0000-0000-0000-000000000001',
  tipo: 'LABORATORIO',
  descricao: 'Hemograma completo',
  dataExame: '2026-10-24',
  mime: 'application/pdf',
  imagem: null,
}

const anexoFoto: AnexoImpressao = {
  id: 'a0000000-0000-0000-0000-000000000002',
  tipo: 'OUTRO',
  descricao: 'Foto do exame',
  dataExame: '2026-10-24',
  mime: 'image/jpeg',
  imagem: { data: new Uint8Array(FOTO), formato: 'jpg' },
}

async function textoDoPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer })
  const resultado = await parser.getText()
  await parser.destroy()
  return resultado.text
}

describe('secoesVisiveis', () => {
  it('imprime observações (texto livre) quando preenchido, por último', () => {
    const dados: DadosMedica = { ...dadosSemExameFisico(), conduta: 'Diurético EV' }
    expect(secoesVisiveis(dados, 'Paciente pediu alta')).toEqual([
      { titulo: 'Conduta', texto: 'Diurético EV' },
      { titulo: 'Observações', texto: 'Paciente pediu alta' },
    ])
  })

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

describe('legendaAnexo', () => {
  it('monta tipo, data de dd/mm/aaaa e descrição', () => {
    expect(legendaAnexo(anexoPdf)).toBe('Laboratório · 24/10/2026 · Hemograma completo')
  })

  it('omite a descrição quando vazia', () => {
    expect(legendaAnexo({ ...anexoPdf, descricao: '' })).toBe('Laboratório · 24/10/2026')
  })
})

describe('DocumentoEvolucao', () => {
  it('gera um PDF não vazio', async () => {
    const dados: DadosMedica = { ...dadosSemExameFisico(), conduta: 'Manter esquema', evolucao_clinica: 'Estável' }
    const buffer = await renderToBuffer(<DocumentoEvolucao evolucoes={[impressao(dados)]} />)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
  })

  it('seção Anexos omitida sem anexos', async () => {
    const buffer = await renderToBuffer(<DocumentoEvolucao evolucoes={[impressao(dadosSemExameFisico())]} />)
    expect(await textoDoPdf(buffer)).not.toContain('Anexos')
  })

  it('lista anexos com rótulo do tipo', async () => {
    const buffer = await renderToBuffer(
      <DocumentoEvolucao evolucoes={[impressao(dadosSemExameFisico(), 1, [anexoPdf, anexoFoto])]} />,
    )
    const texto = await textoDoPdf(buffer)
    expect(texto).toContain('Anexos')
    expect(texto).toContain('Laboratório')
    expect(texto).toContain('Hemograma completo')
    expect(texto).toContain('PDF')
    expect(texto).toContain('Imagem')
  })

  it('sem incluirImagens não ganha página extra para a imagem', async () => {
    const buffer = await renderToBuffer(
      <DocumentoEvolucao evolucoes={[impressao(dadosSemExameFisico(), 1, [anexoFoto])]} />,
    )
    expect(await textoDoPdf(buffer)).toContain('Página 1 de 1')
  })

  it('com incluirImagens cada imagem ganha página própria com legenda e rodapé', async () => {
    const buffer = await renderToBuffer(
      <DocumentoEvolucao evolucoes={[impressao(dadosSemExameFisico(), 1, [anexoPdf, anexoFoto])]} incluirImagens />,
    )
    const texto = await textoDoPdf(buffer)
    expect(texto).toContain('Outro · 24/10/2026 · Foto do exame')
    expect(texto).toContain('Evolução D0000000')
    expect(texto).toContain('Página 2 de 2')
  })

  it('rodapé traz a versão do hash', async () => {
    const buffer = await renderToBuffer(<DocumentoEvolucao evolucoes={[impressao(dadosSemExameFisico())]} />)
    expect(await textoDoPdf(buffer)).toContain('Hash v2 a1b2c3d4e5f6')
  })
})
