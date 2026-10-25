import { describe, expect, it } from 'vitest';
import { dimensoesAlvo, sha256Hex, validarArquivo } from './processar-arquivo';

describe('dimensoesAlvo', () => {
  it('reduz mantendo proporção quando o lado maior passa de 2000', () => {
    expect(dimensoesAlvo(4000, 3000)).toEqual({ largura: 2000, altura: 1500 });
    expect(dimensoesAlvo(3000, 6000)).toEqual({ largura: 1000, altura: 2000 });
  });

  it('não amplia imagem menor que o limite', () => {
    expect(dimensoesAlvo(1200, 800)).toEqual({ largura: 1200, altura: 800 });
  });
});

describe('validarArquivo', () => {
  it('recusa acima de 20 MB', () => {
    expect(validarArquivo({ type: 'application/pdf', size: 20 * 1024 * 1024 + 1 })).toBe(
      'Arquivo maior que 20 MB.',
    );
  });

  it('aceita exatamente 20 MB', () => {
    expect(validarArquivo({ type: 'application/pdf', size: 20 * 1024 * 1024 })).toBeNull();
  });

  it('recusa formato não suportado', () => {
    expect(validarArquivo({ type: 'image/gif', size: 1000 })).toBe('Formato não suportado. Envie foto ou PDF.');
  });

  it('aceita os quatro MIME permitidos', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(validarArquivo({ type, size: 1000 })).toBeNull();
    }
  });
});

describe('sha256Hex', () => {
  it("calcula o sha256 de 'abc'", async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await sha256Hex(bytes.buffer as ArrayBuffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
