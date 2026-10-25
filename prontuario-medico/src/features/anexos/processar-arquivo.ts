export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
/** Foto de entrada acima disso nem é decodificada (memória do aparelho). */
export const TAMANHO_MAXIMO_ENTRADA_IMAGEM_BYTES = 60 * 1024 * 1024;
export const LADO_MAXIMO_PX = 2000;
export const QUALIDADE_JPEG = 0.8;

export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const MSG_FORMATO = 'Formato não suportado. Envie foto ou PDF.';
const MSG_TAMANHO = 'Arquivo maior que 20 MB.';
const MSG_MUITO_GRANDE = 'Arquivo muito grande para processar.';
const MSG_LEITURA = 'Não foi possível ler esta imagem. Tente outra foto ou envie em PDF.';

export type ArquivoPreparado = {
  blob: Blob;
  mime: string;
  tamanho: number;
  sha256: string;
  /**
   * URL de objeto para prévia. O chamador é responsável por chamar
   * `URL.revokeObjectURL(previewUrl)` quando a prévia não for mais necessária.
   */
  previewUrl: string;
};

/** Mantém a proporção; reduz o lado maior para `max`; nunca amplia nem zera um lado. */
export function dimensoesAlvo(
  largura: number,
  altura: number,
  max = LADO_MAXIMO_PX,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const escala = max / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

/**
 * Validação de entrada. PDF tem o limite de 20 MB já aqui; imagem só é recusada acima de 60 MB
 * (antes de decodificar) e o limite de 20 MB vale depois da compressão, em `validarTamanhoFinal`.
 * Retorna a mensagem de erro em pt-BR, ou `null` se o arquivo for aceito.
 */
export function validarArquivo(f: { type: string; size: number }): string | null {
  if (!(MIMES_PERMITIDOS as readonly string[]).includes(f.type)) return MSG_FORMATO;
  if (f.type === 'application/pdf') return f.size > TAMANHO_MAXIMO_BYTES ? MSG_TAMANHO : null;
  return f.size > TAMANHO_MAXIMO_ENTRADA_IMAGEM_BYTES ? MSG_MUITO_GRANDE : null;
}

/** Limite de 20 MB sobre os bytes que vão ao servidor (já comprimidos, se for imagem). */
export function validarTamanhoFinal(bytes: number): string | null {
  return bytes > TAMANHO_MAXIMO_BYTES ? MSG_TAMANHO : null;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function comprimirImagem(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(MSG_LEITURA);
  }

  const canvas = document.createElement('canvas');
  try {
    const { largura, altura } = dimensoesAlvo(bitmap.width, bitmap.height);
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(MSG_LEITURA);
    // JPEG não tem transparência: fundo branco evita PNG com fundo preto.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG),
    );
    if (!blob) throw new Error(MSG_LEITURA);
    return blob;
  } finally {
    // Libera a memória do bitmap e do canvas (pode ser grande em celulares).
    canvas.width = 0;
    canvas.height = 0;
    bitmap.close();
  }
}

/**
 * Prepara o arquivo no aparelho: valida, comprime imagens (JPEG q=0.8, lado maior
 * ≤ 2000 px) e calcula o sha256 dos bytes enviados. PDF segue como está.
 * Lança `Error` com mensagem pt-BR quando recusado.
 */
export async function prepararArquivo(file: File): Promise<ArquivoPreparado> {
  const erroInicial = validarArquivo(file);
  if (erroInicial) throw new Error(erroInicial);

  const ehPdf = file.type === 'application/pdf';
  const blob = ehPdf ? file : await comprimirImagem(file);
  const mime = ehPdf ? 'application/pdf' : 'image/jpeg';

  const erroFinal = validarTamanhoFinal(blob.size);
  if (erroFinal) throw new Error(erroFinal);

  const sha256 = await sha256Hex(await blob.arrayBuffer());
  const previewUrl = URL.createObjectURL(blob);

  return { blob, mime, tamanho: blob.size, sha256, previewUrl };
}
