import { describe, expect, it } from 'vitest';
import { dimensoesAlvo, sha256Hex, validarArquivo, validarTamanhoFinal } from './processar-arquivo';

const MB = 1024 * 1024;

describe('dimensoesAlvo', () => {
  it('reduz mantendo proporção quando o lado maior passa de 2000', () => {
    expect(dimensoesAlvo(4000, 3000)).toEqual({ largura: 2000, altura: 1500 });
    expect(dimensoesAlvo(3000, 6000)).toEqual({ largura: 1000, altura: 2000 });
  });

  it('não amplia imagem menor que o limite', () => {
    expect(dimensoesAlvo(1200, 800)).toEqual({ largura: 1200, altura: 800 });
  });

  it('nunca zera um lado: faixa de 1 × 5000 vira 1 × 2000', () => {
    expect(dimensoesAlvo(1, 5000)).toEqual({ largura: 1, altura: 2000 });
  });
});

describe('validarArquivo', () => {
  it('recusa PDF acima de 20 MB antes de qualquer processamento', () => {
    expect(validarArquivo({ type: 'application/pdf', size: 20 * MB + 1 })).toBe('Arquivo maior que 20 MB.');
  });

  it('aceita PDF com exatamente 20 MB', () => {
    expect(validarArquivo({ type: 'application/pdf', size: 20 * MB })).toBeNull();
  });

  it('aceita imagem acima de 20 MB: o limite de 20 MB vale depois da compressão', () => {
    expect(validarArquivo({ type: 'image/jpeg', size: 30 * MB })).toBeNull();
  });

  it('recusa imagem acima de 60 MB antes de decodificar', () => {
    expect(validarArquivo({ type: 'image/jpeg', size: 60 * MB + 1 })).toBe('Arquivo muito grande para processar.');
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

describe('validarTamanhoFinal', () => {
  it('recusa acima de 20 MB depois da compressão', () => {
    expect(validarTamanhoFinal(20 * MB + 1)).toBe('Arquivo maior que 20 MB.');
  });

  it('aceita exatamente 20 MB', () => {
    expect(validarTamanhoFinal(20 * MB)).toBeNull();
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
