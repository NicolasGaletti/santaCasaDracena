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

function adiado<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

const RETORNO = () => ({ id: 'e1', atualizado_em: new Date().toISOString() });
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
    const salvar = vi.fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>(async () => RETORNO());
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
      .mockResolvedValueOnce(RETORNO());
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

  it('envio lento não sobrepõe o mais novo: forcar envia em ordem e o último carrega a versão nova', async () => {
    const primeiro = adiado<{ id: string; atualizado_em: string }>();
    const salvar = vi
      .fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>()
      .mockImplementationOnce(() => primeiro.promessa)
      .mockImplementation(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });

    fila.agendar(payload('versao 1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);

    fila.agendar(payload('versao 2'));
    const forcado = fila.forcar();
    // A primeira chamada ainda não respondeu: nenhuma outra pode começar.
    await vi.advanceTimersByTimeAsync(0);
    expect(salvar).toHaveBeenCalledTimes(1);

    primeiro.resolver(RETORNO());
    await forcado;

    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar.mock.calls[0][0].dados.conduta).toBe('versao 1');
    expect(salvar.mock.calls[1][0].dados.conduta).toBe('versao 2');
    expect(fila.estado).toBe('salvo');
    fila.encerrar();
  });

  it('cancelar aguarda envio em andamento e impede novos envios', async () => {
    const armazenamento = memoria();
    const envio = adiado<{ id: string; atualizado_em: string }>();
    const salvar = vi
      .fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>()
      .mockImplementationOnce(() => envio.promessa)
      .mockImplementation(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento, chave: CHAVE });

    fila.agendar(payload('pendente'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);

    let concluido = false;
    const cancelamento = fila.cancelar().then(() => {
      concluido = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(concluido).toBe(false);

    envio.resolver(RETORNO());
    await cancelamento;
    expect(concluido).toBe(true);
    expect(await armazenamento.get(CHAVE)).toBeUndefined();

    fila.agendar(payload('depois do cancelamento'));
    await vi.advanceTimersByTimeAsync(5000);
    await fila.forcar();
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it('cópia local existente vence o servidor, sem comparar relógios', () => {
    const local = { ...payload('local'), salvoLocalEm: '2026-10-25T11:00:00.000Z' };
    const servidor = { dados: { ...rascunhoMedicaVazio(), conduta: 'servidor' }, textoLivre: '' };

    const escolhido = resolverRascunho(local, servidor);
    expect(escolhido?.origem).toBe('local');
    expect(escolhido?.dados.conduta).toBe('local');

    expect(resolverRascunho(undefined, servidor)?.origem).toBe('servidor');
    expect(resolverRascunho(undefined, null)).toBeNull();
  });
});
