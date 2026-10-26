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
    marcarSincronizado: async (chave, id) => {
      const v = mapa.get(chave) as { gravacaoId?: string } | undefined;
      if (v && v.gravacaoId === id) mapa.set(chave, { ...v, sincronizado: true });
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
    expect((await armazenamento.get(CHAVE))?.sincronizado).toBe(true);
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
    expect((await armazenamento.get(CHAVE))?.sincronizado).toBe(true);

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
  it('falha do descarte: reabrir devolve a fila e a cópia local continua salva', async () => {
    const armazenamento = memoria();
    const salvar = vi.fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento, chave: CHAVE });

    fila.agendar(payload('antes do descarte'));
    await fila.cancelar();
    // Como no componente: o descarte falhou, então a cópia local fica e a fila volta a enviar.
    expect(await armazenamento.get(CHAVE)).toBeDefined();
    fila.reabrir();

    fila.agendar(payload('depois da falha'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar.mock.calls[0][0].dados.conduta).toBe('depois da falha');
    fila.encerrar();
  });

  it('sem reabrir, cancelar mantém a fila parada', async () => {
    const salvar = vi.fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });

    await fila.cancelar();
    fila.agendar(payload('ignorado'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('apagarCopiaLocal remove a cópia e volta ao estado salvo', async () => {
    const armazenamento = memoria();
    const fila = criarFilaAutosave({
      salvar: vi.fn(async () => {
        throw new Error('rede');
      }),
      armazenamento,
      chave: CHAVE,
    });
    fila.agendar(payload('pendente'));
    await vi.advanceTimersByTimeAsync(0);
    await fila.cancelar();
    expect(await armazenamento.get(CHAVE)).toBeDefined();

    await fila.apagarCopiaLocal();
    expect(await armazenamento.get(CHAVE)).toBeUndefined();
    expect(fila.estado).toBe('salvo');
  });

  it('erro P0001 do servidor é terminal: estado erro com a mensagem, sem nova tentativa', async () => {
    const salvar = vi
      .fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>()
      .mockRejectedValue(Object.assign(new Error('Internação com alta não permite novas evoluções.'), { code: 'P0001' }));
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });
    window.addEventListener('online', fila.aoVoltarConexao);

    fila.agendar(payload('sem efeito'));
    await vi.advanceTimersByTimeAsync(3000);

    expect(fila.estado).toBe('erro');
    expect(fila.mensagemErro).toBe('Internação com alta não permite novas evoluções.');

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(fila.estado).toBe('erro');

    window.removeEventListener('online', fila.aoVoltarConexao);
    fila.encerrar();
  });

  it('marca a cópia como sincronizada só depois do sucesso do servidor, e como não sincronizada a cada digitação', async () => {
    const armazenamento = memoria();
    const envio = adiado<{ id: string; atualizado_em: string }>();
    const salvar = vi
      .fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>()
      .mockImplementationOnce(() => envio.promessa)
      .mockImplementation(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento, chave: CHAVE });

    fila.agendar(payload('v1'));
    await vi.advanceTimersByTimeAsync(3000);
    expect((await armazenamento.get(CHAVE))?.sincronizado).toBe(false);

    // Digitação durante o envio: o sucesso de v1 NÃO pode marcar a cópia (v2) como sincronizada.
    fila.agendar(payload('v2'));
    envio.resolver(RETORNO());
    await vi.advanceTimersByTimeAsync(0);
    const durante = await armazenamento.get(CHAVE);
    expect(durante?.dados.conduta).toBe('v2');
    expect(durante?.sincronizado).toBe(false);

    await fila.forcar();
    const depois = await armazenamento.get(CHAVE);
    expect(depois?.dados.conduta).toBe('v2');
    expect(depois?.sincronizado).toBe(true);

    fila.agendar(payload('v3'));
    await vi.advanceTimersByTimeAsync(0);
    expect((await armazenamento.get(CHAVE))?.sincronizado).toBe(false);
    fila.encerrar();
  });

  it('falha do servidor deixa a cópia não sincronizada', async () => {
    const armazenamento = memoria();
    const salvar = vi.fn<(p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>>().mockRejectedValue(new Error('rede'));
    const fila = criarFilaAutosave({ salvar, armazenamento, chave: CHAVE });
    fila.agendar(payload('x'));
    await vi.advanceTimersByTimeAsync(3000);
    expect((await armazenamento.get(CHAVE))?.sincronizado).toBe(false);
  });

  it('cópia local já sincronizada ou antiga sem marcador: sincronizada perde para o servidor, sem marcador vence', () => {
    const base = { ...payload('local'), salvoLocalEm: '2026-10-25T11:00:00.000Z' };
    const servidor = { dados: { ...rascunhoMedicaVazio(), conduta: 'servidor' }, textoLivre: '' };
    expect(resolverRascunho({ ...base, sincronizado: true }, servidor)?.origem).toBe('servidor');
    expect(resolverRascunho({ ...base, sincronizado: false }, servidor)?.origem).toBe('local');
    expect(resolverRascunho(base, servidor)?.origem).toBe('local');
  });
});

describe('fila de autosave: abas concorrentes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('confirmação da aba A não marca como sincronizada escrita mais nova da aba B', async () => {
    const mapa = new Map<string, unknown>();
    const compartilhado: Armazenamento = {
      get: async (c) => mapa.get(c) as never,
      set: async (c, v) => void mapa.set(c, v),
      del: async (c) => void mapa.delete(c),
      marcarSincronizado: async (c, id) => {
        const v = mapa.get(c) as { gravacaoId?: string } | undefined;
        if (v && v.gravacaoId === id) mapa.set(c, { ...v, sincronizado: true });
      },
    };
    const envio = adiado<{ id: string; atualizado_em: string }>();
    const filaA = criarFilaAutosave({ salvar: () => envio.promessa, armazenamento: compartilhado, chave: CHAVE });
    const filaB = criarFilaAutosave({ salvar: async () => RETORNO(), armazenamento: compartilhado, chave: CHAVE });

    filaA.agendar(payload('A'));
    await vi.advanceTimersByTimeAsync(3000); // A em voo
    filaB.agendar(payload('B mais nova'));
    await vi.advanceTimersByTimeAsync(0);
    envio.resolver(RETORNO());
    await vi.advanceTimersByTimeAsync(0);

    const guardado = (await compartilhado.get(CHAVE))!;
    expect(guardado.dados.conduta).toBe('B mais nova');
    expect(guardado.sincronizado).toBe(false);
    filaB.encerrar();
  });

  it('reabrir re-arma o timer quando há digitação pendente', async () => {
    const salvar = vi.fn(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });
    fila.agendar(payload('x'));
    await fila.cancelar();
    await vi.advanceTimersByTimeAsync(5000);
    expect(salvar).not.toHaveBeenCalled();
    fila.reabrir();
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it('reabrir sem pendência não agenda envio', async () => {
    const salvar = vi.fn(async () => RETORNO());
    const fila = criarFilaAutosave({ salvar, armazenamento: memoria(), chave: CHAVE });
    await fila.cancelar();
    fila.reabrir();
    await vi.advanceTimersByTimeAsync(5000);
    expect(salvar).not.toHaveBeenCalled();
  });
});
