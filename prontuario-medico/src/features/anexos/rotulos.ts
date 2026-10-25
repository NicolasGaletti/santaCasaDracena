import type { Database } from '@/lib/supabase/database.types';

export const TIPOS_ANEXO = ['LABORATORIO', 'IMAGEM', 'ECG', 'OUTRO'] as const;

export type TipoAnexo = (typeof TIPOS_ANEXO)[number];

export const ROTULO_TIPO_ANEXO: Record<TipoAnexo, string> = {
  LABORATORIO: 'Laboratório',
  IMAGEM: 'Imagem',
  ECG: 'ECG',
  OUTRO: 'Outro',
};

type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Falha na compilação se a lista local divergir do enum do banco.
export const TIPOS_ANEXO_CONFEREM_COM_BANCO: Igual<
  TipoAnexo,
  Database['public']['Enums']['tipo_anexo']
> = true;

/** Data do exame como DD/MM/AAAA, a partir de AAAA-MM-DD. */
export function formatarDataAnexo(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
