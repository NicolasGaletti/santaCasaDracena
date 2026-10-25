import type { NextRequest } from 'next/server'
import { gerarPdf } from '@/features/impressao/gerar-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams
  const bruto = busca.get('ids')
  return gerarPdf(bruto ? bruto.split(',') : [], {
    chave: busca.get('k'),
    incluirImagens: busca.get('anexos') === '1',
  })
}
