import type { NextRequest } from 'next/server'
import { gerarPdf } from '@/features/impressao/gerar-pdf'

export const runtime = 'nodejs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gerarPdf([id], request.nextUrl.searchParams.get('k'))
}
