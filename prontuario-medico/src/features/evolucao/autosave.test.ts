import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarFilaAutosave, resolverRascunho, type Armazenamento, type PayloadRascunho } from './autosave';
import { rascunhoMedicaVazio } from './modelos/medica';

function memoria(): Armazenamento {
  const mapa = new Map<string, unknown>();
  return {
    get: async (chave) => mapa.get(chave) as never,
    set: async (chave, valor) => {
      mapa.set(chave, valor);
    },
    del: async (chave) => {
      mapa.delete(chave);
    },
  };
}

function payload(conduta: string): PayloadRascunho {
  return {
    internacaoId: 'c0000000-0000-0000-0000-000000000001',
    dados: { ...rascunhoMedicaVazio(), conduta },
    textoLivre: '',
  };
}

const CHAVE = 'rascunho:c0000000-0000-0000-0000-000000000001:a0000000-0000-0000-0000-000000000001';

describe('fila de autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('agrupa digitação em uma chamada após 3s', async () => {
    const salvar = vi.fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>(async () => ({
      id: 'e1',
      atualizado_em: new Date().toISOString(),
    }));
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });

    fila.agendar(payload('a'));
    await vi.advanceTimersByTimeAsync(1000);
    fila.agendar(payload('ab'));
    await vi.advanceTimersByTimeAsync(1000);
    fila.agendar(payload('abc'));

    await vi.advanceTimersByTimeAsync(2999);
    expect(salvar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar.mock.calls[0][0].dados.conduta).toBe('abc');
    expect(fila.estado).toBe('salvo');
  });

  it('fila de autosave reenvia após falha', async () => {
    const armazenamento = memoria();
    const salvar = vi
      .fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce({ id: 'e1', atualizado_em: new Date().toISOString() });
    const fila = criarFilaAutosave({ salvar, armazenamento, chave: CHAVE });
    // Como no componente: quem escuta `online` é quem monta a fila.
    window.addEventListener('online', fila.aoVoltarConexao);

    fila.agendar(payload('conduta'));
    await vi.advanceTimersByTimeAsync(3000);

    expect(salvar).toHaveBeenCalledTimes(1);
    expect(fila.estado).toBe('offline');
    expect(await armazenamento.get(CHAVE)).toBeDefined();

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(fila.estado).toBe('salvo'));

    expect(salvar).toHaveBeenCalledTimes(2);
    expect(await armazenamento.get(CHAVE)).toBeUndefined();
    window.removeEventListener('online', fila.aoVoltarConexao);
    fila.encerrar();
  });

  it('cópia local mais nova vence a do servidor', () => {
    const local = {
      ...payload('local'),
      salvoLocalEm: '2026-10-25T12:05:00.000Z',
    };
    const servidor = {
      dados: { ...rascunhoMedicaVazio(), conduta: 'servidor' },
      textoLivre: '',
      atualizado_em: '2026-10-25T12:00:00.000Z',
    };

    const escolhido = resolverRascunho(local, servidor);
    expect(escolhido?.origem).toBe('local');
    expect(escolhido?.dados.conduta).toBe('local');

    const localAntiga = { ...local, salvoLocalEm: '2026-10-25T11:59:00.000Z' };
    expect(resolverRascunho(localAntiga, servidor)?.origem).toBe('servidor');
    expect(resolverRascunho(undefined, null)).toBeNull();
  });
});
