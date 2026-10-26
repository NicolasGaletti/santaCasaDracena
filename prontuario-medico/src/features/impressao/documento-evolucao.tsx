import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatarDataAnexo, ROTULO_TIPO_ANEXO, type TipoAnexo } from '@/features/anexos/rotulos'
import type { DadosMedica } from '@/features/evolucao/modelos/medica'
import type { DadosSimples } from '@/features/evolucao/modelos/simples'
import { ROTULO_CATEGORIA } from '@/features/evolucao/rotulos'
import { formatarData, idade } from '@/lib/datas'

const FUSO_SP = 'America/Sao_Paulo'

// Palavras inteiras nunca são quebradas com hífen: documento legal, leitura exata.
Font.registerHyphenationCallback((palavra) => [palavra])

export type Assinante = {
  nome: string
  conselho: string | null
  numero: string | null
  uf: string | null
}

/** Anexo confirmado da evolução. `imagem` só vem preenchido para JPEG/PNG (formatos que o PDF embute). */
export type AnexoImpressao = {
  id: string
  tipo: TipoAnexo
  descricao: string
  dataExame: string
  mime: string
  imagem: { data: Uint8Array; formato: 'jpg' | 'png' } | null
  /** Imagem embutível que não pôde ser baixada para a miniatura (impressão sem imagens). */
  miniaturaIndisponivel: boolean
}

/** Dados de evolução impressa: modelo médico (`medica@1`) ou simples (`simples@1`), conforme a categoria. */
export type DadosImpressao = DadosMedica | DadosSimples

export type EvolucaoImpressao = {
  evolucao: {
    id: string
    categoria: string
    dados: DadosImpressao
    texto_livre?: string
    finalizada_em: string
    validada_em: string | null
    snapshot_autor: Assinante | null
    snapshot_validador: Assinante | null
    /** Autor e validador (ids) para decidir se a linha "Registrado por" aparece. */
    autor_id: string
    validada_por: string | null
    /** Perfil atual do autor: só usado para o rótulo de acadêmico sem conselho. */
    autor_perfil: string | null
    /** Evolução original quando esta é um adendo. */
    adendo_de: { id: string; finalizada_em: string } | null
    conteudo_hash: string | null
    hash_versao: number
  }
  internacao: {
    leito_ala: string
    equipe_nome: string
  }
  paciente: {
    nome: string
    data_nascimento: string
    convenio: string
  }
  via: number
  anexos: AnexoImpressao[]
}

/** Legenda de um anexo: `<Tipo> · <dd/mm/aaaa> · <descrição>`; sem descrição, sem o último trecho. */
export function legendaAnexo(anexo: Pick<AnexoImpressao, 'tipo' | 'dataExame' | 'descricao'>): string {
  return [ROTULO_TIPO_ANEXO[anexo.tipo], formatarDataAnexo(anexo.dataExame), anexo.descricao.trim()]
    .filter((parte) => parte !== '')
    .join(' · ')
}

/** Código curto impresso no rodapé: 8 primeiros caracteres do uuid, em maiúsculas. */
export function codigoCurto(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

const ROTULOS_EXAME_FISICO: [keyof DadosMedica['exame_fisico'], string][] = [
  ['geral', 'Geral'],
  ['ar', 'AR'],
  ['acv', 'ACV'],
  ['abdome', 'Abdome'],
  ['membros', 'Membros'],
  ['neuro', 'Neuro'],
]

/** Seções do documento, na ordem impressa. Seção sem texto some. */
export function secoesVisiveis(dados: DadosMedica, textoLivre = ''): { titulo: string; texto: string }[] {
  const exameFisico = ROTULOS_EXAME_FISICO.filter(([k]) => dados.exame_fisico[k].trim() !== '')
    .map(([k, rotulo]) => `${rotulo}: ${dados.exame_fisico[k].trim()}`)
    .join('\n')

  const candidatas: { titulo: string; texto: string }[] = [
    { titulo: 'Diagnósticos', texto: dados.diagnosticos },
    { titulo: 'Comorbidades', texto: dados.comorbidades },
    { titulo: 'MUC', texto: dados.muc },
    { titulo: 'Evolução clínica', texto: dados.evolucao_clinica },
    { titulo: 'Exame físico', texto: exameFisico },
    { titulo: 'ECG', texto: dados.ecg },
    { titulo: 'Exames de imagem', texto: dados.exames_imagem },
    { titulo: 'Exames laboratoriais', texto: dados.exames_laboratoriais },
    { titulo: 'Conduta', texto: dados.conduta },
    { titulo: 'Observações', texto: textoLivre },
  ]
  return candidatas
    .map((s) => ({ titulo: s.titulo, texto: s.texto.trim() }))
    .filter((s) => s.texto !== '')
}

/** Seções do modelo simples@1, na ordem impressa: Evolução, (sinais vitais), Plano. Seção sem texto some. */
export function secoesSimplesVisiveis(dados: DadosSimples): { titulo: string; texto: string }[] {
  return [
    { titulo: 'Evolução', texto: dados.texto },
    { titulo: 'Plano', texto: dados.plano },
  ]
    .map((s) => ({ titulo: s.titulo, texto: s.texto.trim() }))
    .filter((s) => s.texto !== '')
}

/** Sinais vitais informados, com unidade. Vazio quando nenhum foi preenchido. */
export function sinaisVisiveis(dados: Pick<DadosMedica, 'sinais'>): { rotulo: string; valor: string }[] {
  const s = dados.sinais
  const decimal = (n: number) => String(n).replace('.', ',')
  const candidatos: ({ rotulo: string; valor: string | null })[] = [
    { rotulo: 'PA', valor: s.pa.trim() !== '' ? `${s.pa.trim()} mmHg` : null },
    { rotulo: 'FC', valor: s.fc !== null ? `${decimal(s.fc)} bpm` : null },
    { rotulo: 'FR', valor: s.fr !== null ? `${decimal(s.fr)} irpm` : null },
    { rotulo: 'Temp.', valor: s.temp !== null ? `${decimal(s.temp)} °C` : null },
    { rotulo: 'SatO2', valor: s.sato2 !== null ? `${decimal(s.sato2)} %` : null },
    { rotulo: 'Dextro', valor: s.dextro !== null ? `${decimal(s.dextro)} mg/dL` : null },
    { rotulo: 'Diurese', valor: s.diurese !== null ? `${decimal(s.diurese)} mL/24 h` : null },
  ]
  return candidatos.filter((c): c is { rotulo: string; valor: string } => c.valor !== null)
}

/** dd/mm/aaaa hh:mm no horário de São Paulo. */
export function formatarDataHoraSP(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_SP,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${valor('day')}/${valor('month')}/${valor('year')} ${valor('hour')}:${valor('minute')}`
}

/** Registro no conselho como texto: `COREN 123456/SP`, `CRM 145892/SP`. */
function textoRegistro(assinante: Assinante): string {
  return [assinante.conselho, assinante.numero && assinante.uf ? `${assinante.numero}/${assinante.uf}` : assinante.numero]
    .filter(Boolean)
    .join(' ')
}

/**
 * "Registrado por: <nome> – <conselho> <nº>/<UF>", só quando o autor não é o validador.
 * Acadêmico sem conselho: "– Acadêmico(a) de Medicina". Sem autor identificado, não imprime.
 */
export function linhaRegistro(evolucao: EvolucaoImpressao['evolucao']): string | null {
  const autor = evolucao.snapshot_autor
  if (!autor?.nome || evolucao.validada_por === null || evolucao.validada_por === evolucao.autor_id) return null
  const complemento =
    autor.conselho === null && evolucao.autor_perfil === 'academico'
      ? 'Acadêmico(a) de Medicina'
      : textoRegistro(autor)
  return `Registrado por: ${autor.nome}${complemento ? ` – ${complemento}` : ''}`
}

/** Linha de validação; nunca usa identidade padrão. */
export function linhaValidacao(evolucao: EvolucaoImpressao['evolucao']): string {
  const assinante = evolucao.snapshot_validador
  if (!assinante?.nome) return 'Identificação não disponível'
  const registro = textoRegistro(assinante)
  const quando = formatarDataHoraSP(evolucao.validada_em ?? evolucao.finalizada_em)
  return `Validado por ${assinante.nome}${registro ? ` – ${registro}` : ''} em ${quando}`
}

const TITULO_POR_CATEGORIA: Record<string, string> = {
  medica: 'EVOLUÇÃO MÉDICA DIÁRIA',
  enfermagem: 'EVOLUÇÃO DE ENFERMAGEM',
  fisioterapia: 'EVOLUÇÃO DE FISIOTERAPIA',
  nutricao: 'EVOLUÇÃO DE NUTRIÇÃO',
  psicologia: 'EVOLUÇÃO DE PSICOLOGIA',
  fonoaudiologia: 'EVOLUÇÃO DE FONOAUDIOLOGIA',
  servico_social: 'EVOLUÇÃO DO SERVIÇO SOCIAL',
}

/** Título do documento: por categoria; adendo: "ADENDO À EVOLUÇÃO DE dd/mm/aaaa hh:mm (CÓDIGO <original>)". */
export function tituloDocumento(evolucao: Pick<EvolucaoImpressao['evolucao'], 'categoria' | 'adendo_de'>): string {
  if (evolucao.adendo_de) {
    const original = evolucao.adendo_de
    return `ADENDO À EVOLUÇÃO DE ${formatarDataHoraSP(original.finalizada_em)} (CÓDIGO ${codigoCurto(original.id)})`
  }
  return TITULO_POR_CATEGORIA[evolucao.categoria] ?? `EVOLUÇÃO · ${(ROTULO_CATEGORIA[evolucao.categoria] ?? evolucao.categoria).toUpperCase()}`
}

const cinza = '#444444'

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 92,
    paddingBottom: 70,
    paddingHorizontal: 42,
    fontSize: 10.5,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  cabecalho: {
    position: 'absolute',
    top: 28,
    left: 42,
    right: 42,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  cabecalhoLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hospital: { fontSize: 13, fontWeight: 'bold' },
  via: { fontSize: 12, fontWeight: 'bold' },
  titulo: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  identificacao: { fontSize: 10, marginTop: 2 },
  rodape: {
    position: 'absolute',
    bottom: 24,
    left: 42,
    right: 42,
    fontSize: 9,
    color: cinza,
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: cinza,
    paddingTop: 4,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.75, borderColor: '#000000', marginBottom: 10 },
  campo: { width: '50%', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 0.5, borderColor: '#777777' },
  campoLargo: { width: '100%', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 0.5, borderColor: '#777777' },
  rotulo: { fontSize: 9, color: cinza, fontWeight: 'bold' },
  valor: { fontSize: 10.5, lineHeight: 1.4 },
  tabelaSinais: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.75, borderColor: '#000000', marginBottom: 10 },
  celulaSinal: { width: '14.2857%', paddingVertical: 4, paddingHorizontal: 5, borderRightWidth: 0.5, borderColor: '#777777' },
  secao: { marginBottom: 9 },
  tituloSecao: { fontSize: 10.5, fontWeight: 'bold', marginBottom: 2 },
  textoSecao: { fontSize: 10.5, lineHeight: 1.4 },
  blocoAssinatura: { marginTop: 14 },
  validacao: { fontSize: 10, marginBottom: 6 },
  caixaAssinatura: {
    height: 78,
    borderWidth: 0.75,
    borderColor: '#000000',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  linhaAssinatura: { borderTopWidth: 0.75, borderColor: '#000000', marginBottom: 4 },
  rotuloAssinatura: { fontSize: 10, textAlign: 'center' },
  tabelaAnexos: { borderWidth: 0.75, borderColor: '#000000', marginBottom: 9 },
  linhaAnexo: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderColor: '#777777' },
  celulaAnexo: { paddingVertical: 4, paddingHorizontal: 5 },
  cabecalhoAnexo: { fontSize: 9, fontWeight: 'bold', color: cinza },
  miniatura: { width: 100, height: 75, objectFit: 'contain' },
  legendaImagem: { fontSize: 10.5, fontWeight: 'bold', marginBottom: 2 },
  imagemPagina: { width: 511, height: 600, objectFit: 'contain' },
})

/** Fonte da imagem no formato que o react-pdf espera (bytes + formato). */
function fonteImagem(imagem: NonNullable<AnexoImpressao['imagem']>) {
  return { data: Buffer.from(imagem.data), format: imagem.formato }
}

const LARGURAS_ANEXO = { tipo: '15%', data: '15%', descricao: '35%', formato: '12%', miniatura: '23%' } as const

function RodapeEvolucao({ evolucao }: { evolucao: EvolucaoImpressao['evolucao'] }) {
  const codigo = codigoCurto(evolucao.id)
  const hash = evolucao.conteudo_hash?.slice(0, 12) ?? '—'
  return (
    <Text
      fixed
      style={estilos.rodape}
      render={({ pageNumber, totalPages }) =>
        `Código ${codigo} · Hash v${evolucao.hash_versao} ${hash} · Página ${pageNumber} de ${totalPages}`
      }
    />
  )
}

/** Identificação do paciente, repetida no cabeçalho fixo de toda página (inclusive as de imagem). */
export function identificacaoPaciente(item: Pick<EvolucaoImpressao, 'paciente' | 'internacao'>): string {
  const nascimento = item.paciente.data_nascimento ? formatarData(item.paciente.data_nascimento) : '—'
  const leito = item.internacao.leito_ala.trim() || '—'
  return `Paciente: ${item.paciente.nome} · D.N. ${nascimento} · Leito ${leito}`
}

function CabecalhoDocumento({ item }: { item: EvolucaoImpressao }) {
  const { evolucao, via } = item
  return (
    <View fixed style={estilos.cabecalho}>
      <View style={estilos.cabecalhoLinha}>
        <Text style={estilos.hospital}>Santa Casa de Dracena</Text>
        {via > 1 && <Text style={estilos.via}>{`${via}ª via`}</Text>}
      </View>
      <Text style={estilos.titulo}>{tituloDocumento(evolucao)}</Text>
      <Text style={estilos.identificacao}>{identificacaoPaciente(item)}</Text>
    </View>
  )
}

/** Tabela de anexos da evolução. Não renderiza nada sem anexos. */
function TabelaAnexos({ anexos }: { anexos: AnexoImpressao[] }) {
  if (anexos.length === 0) return null
  return (
    <View style={estilos.secao} wrap>
      <Text style={estilos.tituloSecao}>Anexos</Text>
      <View style={estilos.tabelaAnexos}>
        <View style={estilos.linhaAnexo} wrap={false}>
          <Text style={[estilos.celulaAnexo, estilos.cabecalhoAnexo, { width: LARGURAS_ANEXO.tipo }]}>Tipo</Text>
          <Text style={[estilos.celulaAnexo, estilos.cabecalhoAnexo, { width: LARGURAS_ANEXO.data }]}>Data do exame</Text>
          <Text style={[estilos.celulaAnexo, estilos.cabecalhoAnexo, { width: LARGURAS_ANEXO.descricao }]}>Descrição</Text>
          <Text style={[estilos.celulaAnexo, estilos.cabecalhoAnexo, { width: LARGURAS_ANEXO.formato }]}>Formato</Text>
          <Text style={[estilos.celulaAnexo, estilos.cabecalhoAnexo, { width: LARGURAS_ANEXO.miniatura }]}>Miniatura</Text>
        </View>
        {anexos.map((a) => (
          <View key={a.id} style={estilos.linhaAnexo} wrap={false}>
            <Text style={[estilos.celulaAnexo, estilos.valor, { width: LARGURAS_ANEXO.tipo }]}>{ROTULO_TIPO_ANEXO[a.tipo]}</Text>
            <Text style={[estilos.celulaAnexo, estilos.valor, { width: LARGURAS_ANEXO.data }]}>{formatarDataAnexo(a.dataExame)}</Text>
            <Text style={[estilos.celulaAnexo, estilos.valor, { width: LARGURAS_ANEXO.descricao }]}>{a.descricao || '—'}</Text>
            <Text style={[estilos.celulaAnexo, estilos.valor, { width: LARGURAS_ANEXO.formato }]}>
              {a.mime.startsWith('image/') ? 'Imagem' : 'PDF'}
            </Text>
            <View style={[estilos.celulaAnexo, { width: LARGURAS_ANEXO.miniatura }]}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF do react-pdf não tem alt; a legenda é o texto da página */}
              {a.imagem && <Image style={estilos.miniatura} src={fonteImagem(a.imagem)} />}
              {!a.imagem && a.miniaturaIndisponivel && <Text style={estilos.valor}>Miniatura indisponível</Text>}
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

/** Página própria de uma imagem anexada: legenda acima, imagem ajustada às margens, mesmo rodapé. */
function PaginaImagem({ item, anexo }: { item: EvolucaoImpressao; anexo: AnexoImpressao & { imagem: NonNullable<AnexoImpressao['imagem']> } }) {
  return (
    <Page size="A4" style={estilos.pagina} wrap={false}>
      <CabecalhoDocumento item={item} />
      <Text style={estilos.legendaImagem}>{legendaAnexo(anexo)}</Text>
      <Text style={estilos.valor}>{`Evolução ${codigoCurto(item.evolucao.id)}`}</Text>
      <View style={{ marginTop: 8 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- PDF do react-pdf não tem alt; a legenda é o texto da página */}
        <Image style={estilos.imagemPagina} src={fonteImagem(anexo.imagem)} />
      </View>
      <RodapeEvolucao evolucao={item.evolucao} />
    </Page>
  )
}

function PaginaEvolucao({ item }: { item: EvolucaoImpressao }) {
  const { evolucao, internacao, paciente } = item
  const dados = evolucao.dados
  const simples = dados.modelo_versao === 'simples@1'
  const sinais = sinaisVisiveis(dados)
  const secoes = dados.modelo_versao === 'simples@1' ? secoesSimplesVisiveis(dados) : secoesVisiveis(dados, evolucao.texto_livre ?? '')
  // Simples: Evolução, Sinais vitais, Plano. Médico: sinais vitais no topo, depois as seções.
  const secoesAntesSinais = simples ? secoes.filter((s) => s.titulo === 'Evolução') : []
  const secoesDepoisSinais = simples ? secoes.filter((s) => s.titulo !== 'Evolução') : secoes
  const linhaSinais = sinais.length > 0 && (
    <View style={estilos.tabelaSinais}>
      {sinais.map((s) => (
        <View key={s.rotulo} style={estilos.celulaSinal}>
          <Text style={estilos.rotulo}>{s.rotulo}</Text>
          <Text style={estilos.valor}>{s.valor}</Text>
        </View>
      ))}
    </View>
  )
  const registro = linhaRegistro(evolucao)

  const campos: [string, string][] = [
    ['Paciente', paciente.nome],
    ['Data de nascimento', `${formatarData(paciente.data_nascimento)} (${idade(paciente.data_nascimento, new Date(evolucao.finalizada_em))} anos)`],
    ['Leito / ala', internacao.leito_ala],
    ['Convênio', paciente.convenio],
    ['Equipe responsável', internacao.equipe_nome],
  ]

  return (
    <Page size="A4" style={estilos.pagina} wrap>
      <CabecalhoDocumento item={item} />

      <View style={estilos.grade}>
        {campos.map(([rotulo, valor]) => (
          <View key={rotulo} style={estilos.campo}>
            <Text style={estilos.rotulo}>{rotulo}</Text>
            <Text style={estilos.valor}>{valor}</Text>
          </View>
        ))}
        <View style={estilos.campoLargo}>
          <Text style={estilos.rotulo}>Data e hora da evolução</Text>
          <Text style={estilos.valor}>{formatarDataHoraSP(evolucao.finalizada_em)}</Text>
        </View>
      </View>

      {secoesAntesSinais.map((s) => (
        <View key={s.titulo} style={estilos.secao}>
          <Text style={estilos.tituloSecao}>{s.titulo}</Text>
          <Text style={estilos.textoSecao}>{s.texto}</Text>
        </View>
      ))}

      {simples && linhaSinais && (
        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Sinais vitais</Text>
          {linhaSinais}
        </View>
      )}
      {!simples && linhaSinais}

      {secoesDepoisSinais.map((s) => (
        <View key={s.titulo} style={estilos.secao}>
          <Text style={estilos.tituloSecao}>{s.titulo}</Text>
          <Text style={estilos.textoSecao}>{s.texto}</Text>
        </View>
      ))}

      <TabelaAnexos anexos={item.anexos} />

      <View wrap={false} style={estilos.blocoAssinatura}>
        {registro && <Text style={estilos.validacao}>{registro}</Text>}
        <Text style={estilos.validacao}>{linhaValidacao(evolucao)}</Text>
        <View style={estilos.caixaAssinatura}>
          <View style={estilos.linhaAssinatura} />
          <Text style={estilos.rotuloAssinatura}>Assinatura e carimbo do médico</Text>
        </View>
      </View>

      <RodapeEvolucao evolucao={evolucao} />
    </Page>
  )
}

/** Uma evolução: a página da evolução e, com `incluirImagens`, uma página por imagem anexada. */
function BlocoEvolucao({ item, incluirImagens }: { item: EvolucaoImpressao; incluirImagens: boolean }) {
  const imagens = incluirImagens
    ? item.anexos.filter(
        (a): a is AnexoImpressao & { imagem: NonNullable<AnexoImpressao['imagem']> } => a.imagem !== null,
      )
    : []
  return (
    <>
      <PaginaEvolucao item={item} />
      {imagens.map((a) => (
        <PaginaImagem key={a.id} item={item} anexo={a} />
      ))}
    </>
  )
}

export function DocumentoEvolucao({
  evolucoes,
  incluirImagens = false,
}: {
  evolucoes: EvolucaoImpressao[]
  incluirImagens?: boolean
}) {
  return (
    <Document title="Evolução médica" author="Santa Casa de Dracena">
      {evolucoes.map((item) => (
        <BlocoEvolucao key={item.evolucao.id} item={item} incluirImagens={incluirImagens} />
      ))}
    </Document>
  )
}
