export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
export const LADO_MAXIMO_PX = 2000;
export const QUALIDADE_JPEG = 0.8;

export const MIMES_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

const MSG_FORMATO = 'Formato não suportado. Envie foto ou PDF.';
const MSG_TAMANHO = 'Arquivo maior que 20 MB.';
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

/** Mantém a proporção; reduz o lado maior para `max`; nunca amplia. */
export function dimensoesAlvo(
  largura: number,
  altura: number,
  max = LADO_MAXIMO_PX,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura, altura };
  const escala = max / maior;
  return {
    largura: Math.round(largura * escala),
    altura: Math.round(altura * escala),
  };
}

/** Retorna a mensagem de erro em pt-BR, ou `null` se o arquivo for aceito. */
export function validarArquivo(f: { type: string; size: number }): string | null {
  if (!(MIMES_PERMITIDOS as readonly string[]).includes(f.type)) return MSG_FORMATO;
  if (f.size > TAMANHO_MAXIMO_BYTES) return MSG_TAMANHO;
  return null;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function comprimirImagem(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(MSG_LEITURA);
  }

  try {
    const { largura, altura } = dimensoesAlvo(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(MSG_LEITURA);
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG),
    );
    if (!blob) throw new Error(MSG_LEITURA);
    return blob;
  } finally {
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

  const blob = file.type === 'application/pdf' ? file : await comprimirImagem(file);
  const mime = file.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg';

  const erroFinal = validarArquivo({ type: mime, size: blob.size });
  if (erroFinal) throw new Error(erroFinal);

  const sha256 = await sha256Hex(await blob.arrayBuffer());
  const previewUrl = URL.createObjectURL(blob);

  return { blob, mime, tamanho: blob.size, sha256, previewUrl };
}
