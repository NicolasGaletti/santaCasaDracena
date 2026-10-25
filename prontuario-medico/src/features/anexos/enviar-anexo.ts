import { createBrowserSupabase } from '@/lib/supabase/client';
import { prepararArquivo } from './processar-arquivo';
import type { TipoAnexo } from './rotulos';

export type AnexoRascunho = {
  id: string;
  tipo: TipoAnexo;
  descricao: string;
  dataExame: string;
  mime: string;
  /** URL de prévia: `blob:` (envio deste aparelho) ou assinada de 300 s (carregada do servidor). */
  previewUrl?: string;
};

export type FaseEnvio = 'preparando' | 'enviando' | 'confirmando';

export type ParamsEnvio = {
  evolucaoId: string;
  tipo: TipoAnexo;
  descricao: string;
  dataExame: string;
  arquivo: File;
  onProgresso?: (fase: FaseEnvio) => void;
};

export const MENSAGEM_SEM_CONEXAO_ANEXO = 'Sem conexão. Tente enviar o anexo novamente.';
const MENSAGEM_ENVIO = 'Não foi possível enviar o anexo. Tente novamente.';

/** Erro com mensagem pronta para o usuário (pt-BR). */
export class ErroAnexo extends Error {}

const PADRAO_REDE = /failed to fetch|networkerror|network request failed|load failed|StorageUnknownError/i;

export function ehFalhaDeRede(erro: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (erro instanceof TypeError) return true;
  const texto =
    typeof erro === 'object' && erro !== null
      ? `${(erro as { name?: unknown }).name ?? ''} ${(erro as { message?: unknown }).message ?? ''}`
      : '';
  return PADRAO_REDE.test(texto);
}

/** Mensagem para o usuário a partir de qualquer falha do envio ou da remoção. */
export function mensagemDeEnvio(erro: unknown): string {
  if (erro instanceof ErroAnexo) return erro.message;
  if (ehFalhaDeRede(erro)) return MENSAGEM_SEM_CONEXAO_ANEXO;
  if (typeof erro === 'object' && erro !== null && (erro as { code?: unknown }).code === 'P0001') {
    return (erro as { message: string }).message;
  }
  return MENSAGEM_ENVIO;
}

/**
 * Remoção de upload que falhou ou de anexo não confirmado: apaga o objeto e depois a linha.
 * Se o objeto não pôde ser apagado, a linha fica (não confirmada, invisível) e a finalização a limpa.
 */
async function desfazerEnvio(supabase: ReturnType<typeof createBrowserSupabase>, anexoId: string, caminho: string) {
  try {
    const { error } = await supabase.storage.from('anexos').remove([caminho]);
    if (error) return;
    await supabase.rpc('remover_anexo', { p_anexo_id: anexoId });
  } catch {
    // Melhor esforço: a linha não confirmada some na finalização.
  }
}

/**
 * Envia um anexo do rascunho: comprime/valida no aparelho, reserva a linha (`criar_anexo`),
 * envia o objeto ao bucket privado e confirma (`confirmar_anexo`).
 */
export async function enviarAnexo(p: ParamsEnvio): Promise<AnexoRascunho> {
  const supabase = createBrowserSupabase();

  p.onProgresso?.('preparando');
  let preparado: Awaited<ReturnType<typeof prepararArquivo>>;
  try {
    preparado = await prepararArquivo(p.arquivo);
  } catch (erro) {
    throw new ErroAnexo(erro instanceof Error ? erro.message : MENSAGEM_ENVIO);
  }

  try {
    const { data, error } = await supabase.rpc('criar_anexo', {
      p_evolucao_id: p.evolucaoId,
      p_tipo: p.tipo,
      p_descricao: p.descricao,
      p_data_exame: p.dataExame,
      p_mime: preparado.mime,
      p_tamanho_bytes: preparado.tamanho,
      p_sha256: preparado.sha256,
    });
    if (error) throw error;
    const linha = data?.[0];
    if (!linha) throw new ErroAnexo(MENSAGEM_ENVIO);

    p.onProgresso?.('enviando');
    const { error: erroUpload } = await supabase.storage
      .from('anexos')
      .upload(linha.storage_path, preparado.blob, { contentType: preparado.mime, upsert: false });
    if (erroUpload) {
      await desfazerEnvio(supabase, linha.id, linha.storage_path);
      throw erroUpload;
    }

    p.onProgresso?.('confirmando');
    const { error: erroConfirmar } = await supabase.rpc('confirmar_anexo', { p_anexo_id: linha.id });
    if (erroConfirmar) {
      await desfazerEnvio(supabase, linha.id, linha.storage_path);
      throw erroConfirmar;
    }

    return {
      id: linha.id,
      tipo: p.tipo,
      descricao: p.descricao,
      dataExame: p.dataExame,
      mime: preparado.mime,
      previewUrl: preparado.previewUrl,
    };
  } catch (erro) {
    URL.revokeObjectURL(preparado.previewUrl);
    if (erro instanceof ErroAnexo) throw erro;
    throw new ErroAnexo(mensagemDeEnvio(erro));
  }
}
