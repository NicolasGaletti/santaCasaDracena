import type { NextRequest } from 'next/server'
import { gerarPdf } from '@/features/impressao/gerar-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const bruto = request.nextUrl.searchParams.get('ids')
  return gerarPdf(bruto ? bruto.split(',') : [])
}
