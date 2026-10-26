import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { rotuloTipoAlta } from '@/features/alta/tipos'
import { formatarData, idade } from '@/lib/datas'
import { formatarDataHoraSP } from './documento-evolucao'

Font.registerHyphenationCallback((palavra) => [palavra])

export type Pessoa = { nome: string; conselho: string | null; numero: string | null; uf: string | null }

export type FolhaAlta = {
  internacaoId: string
  paciente: { nome: string; data_nascimento: string; convenio: string }
  leito_ala: string
  equipe_nome: string
  admitido_em: string
  alta_em: string
  tipo_alta: string
  resumo: string
  equipe: Pessoa[]
  medico: Pessoa | null
}

function registro(p: Pessoa): string {
  return [p.conselho, p.numero && p.uf ? `${p.numero}/${p.uf}` : p.numero].filter(Boolean).join(' ')
}

/** "Alta dada por <médico> – <conselho> <nº>/<UF>"; sem identificação, nunca assume um médico. */
export function linhaAltaDadaPor(medico: Pessoa | null): string {
  if (!medico) return 'Identificação não disponível'
  const r = registro(medico)
  return `Alta dada por ${medico.nome}${r ? ` – ${r}` : ''}`
}

const cinza = '#444444'
const estilos = StyleSheet.create({
  pagina: { paddingTop: 92, paddingBottom: 70, paddingHorizontal: 42, fontSize: 10.5, color: '#000000', backgroundColor: '#ffffff' },
  cabecalho: { position: 'absolute', top: 28, left: 42, right: 42, borderBottomWidth: 1, borderBottomColor: '#000000', paddingBottom: 6 },
  hospital: { fontSize: 13, fontWeight: 'bold' },
  titulo: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  identificacao: { fontSize: 10, marginTop: 2 },
  rodape: { position: 'absolute', bottom: 24, left: 42, right: 42, fontSize: 9, color: cinza, textAlign: 'center', borderTopWidth: 0.5, borderTopColor: cinza, paddingTop: 4 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.75, borderColor: '#000000', marginBottom: 10 },
  campo: { width: '50%', paddingVertical: 3, paddingHorizontal: 5, borderBottomWidth: 0.5, borderColor: '#777777' },
  rotulo: { fontSize: 9, color: cinza, fontWeight: 'bold' },
  valor: { fontSize: 10.5, lineHeight: 1.4 },
  secao: { marginBottom: 9 },
  tituloSecao: { fontSize: 10.5, fontWeight: 'bold', marginBottom: 2 },
  bloco: { marginTop: 14 },
  dadaPor: { fontSize: 10, marginBottom: 6 },
  caixaAssinatura: { height: 78, borderWidth: 0.75, borderColor: '#000000', justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: 6 },
  linhaAssinatura: { borderTopWidth: 0.75, borderColor: '#000000', marginBottom: 4 },
  rotuloAssinatura: { fontSize: 10, textAlign: 'center' },
})

export function DocumentoAlta({ folha }: { folha: FolhaAlta }) {
  const { paciente } = folha
  const nascimento = paciente.data_nascimento ? formatarData(paciente.data_nascimento) : '—'
  const campos: [string, string][] = [
    ['Paciente', paciente.nome],
    ['Data de nascimento', `${nascimento} (${idade(paciente.data_nascimento, new Date(folha.alta_em))} anos)`],
    ['Leito / ala', folha.leito_ala || '—'],
    ['Convênio', paciente.convenio],
    ['Admissão', formatarDataHoraSP(folha.admitido_em)],
    ['Alta', formatarDataHoraSP(folha.alta_em)],
    ['Tipo da alta', rotuloTipoAlta(folha.tipo_alta)],
    ['Equipe responsável', folha.equipe_nome],
  ]
  return (
    <Document title="Folha de alta" author="Santa Casa de Dracena">
      <Page size="A4" style={estilos.pagina} wrap>
        <View fixed style={estilos.cabecalho}>
          <Text style={estilos.hospital}>Santa Casa de Dracena</Text>
          <Text style={estilos.titulo}>FOLHA DE ALTA</Text>
          <Text style={estilos.identificacao}>
            {`Paciente: ${paciente.nome} · D.N. ${nascimento} · Leito ${folha.leito_ala.trim() || '—'}`}
          </Text>
        </View>

        <View style={estilos.grade}>
          {campos.map(([rotulo, valor]) => (
            <View key={rotulo} style={estilos.campo}>
              <Text style={estilos.rotulo}>{rotulo}</Text>
              <Text style={estilos.valor}>{valor}</Text>
            </View>
          ))}
        </View>

        <View style={estilos.secao}>
          <Text style={estilos.tituloSecao}>Resumo da alta</Text>
          <Text style={estilos.valor}>{folha.resumo}</Text>
        </View>

        {folha.equipe.length > 0 && (
          <View style={estilos.secao}>
            <Text style={estilos.tituloSecao}>Equipe</Text>
            {folha.equipe.map((m) => (
              <Text key={m.nome} style={estilos.valor}>
                {`${m.nome}${registro(m) ? ` – ${registro(m)}` : ''}`}
              </Text>
            ))}
          </View>
        )}

        <View wrap={false} style={estilos.bloco}>
          <Text style={estilos.dadaPor}>{linhaAltaDadaPor(folha.medico)}</Text>
          <View style={estilos.caixaAssinatura}>
            <View style={estilos.linhaAssinatura} />
            <Text style={estilos.rotuloAssinatura}>Assinatura e carimbo do médico</Text>
          </View>
        </View>

        <Text
          fixed
          style={estilos.rodape}
          render={({ pageNumber, totalPages }) =>
            `Internação ${folha.internacaoId.slice(0, 8).toUpperCase()} · Página ${pageNumber} de ${totalPages}`
          }
        />
      </Page>
    </Document>
  )
}
