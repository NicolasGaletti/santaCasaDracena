import { del, get, set } from 'idb-keyval';
import type { DadosMedica } from './modelos/medica';

export type PayloadRascunho = { internacaoId: string; dados: DadosMedica; textoLivre: string };

/** Cópia local: o que foi digitado e ainda não confirmado pelo servidor. */
export type CopiaLocal = PayloadRascunho & { salvoLocalEm: string };

export type Armazenamento = {
  get(chave: string): Promise<CopiaLocal | undefined>;
  set(chave: string, valor: CopiaLocal): Promise<void>;
  del(chave: string): Promise<void>;
};

export type EstadoAutosave = 'salvo' | 'pendente' | 'offline';

export type FilaAutosave = {
  agendar(p: PayloadRascunho): void;
  /** Envia já o que estiver pendente. Rejeita se o envio falhar. */
  forcar(): Promise<void>;
  readonly estado: EstadoAutosave;
  readonly ultimoSalvoEm: Date | null;
  readonly evolucaoId: string | undefined;
  assinar(cb: () => void): () => void;
  /** Handler do evento `online`: reenvia o pendente. Quem registra o ouvinte é o componente. */
  aoVoltarConexao(): void;
  /** Cancela o timer e envia o pendente em segundo plano (ao desmontar). */
  encerrar(): void;
  /** Descarta o pendente e a cópia local, sem enviar (usado ao descartar o rascunho). */
  cancelar(): Promise<void>;
};

type OpcoesFila = {
  salvar: (p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>;
  armazenamento: Armazenamento;
  chave: string;
  esperaMs?: number;
  evolucaoId?: string;
};

/** Armazenamento de produção: IndexedDB via idb-keyval. */
export const armazenamentoIdb: Armazenamento = {
  get: (chave) => get<CopiaLocal>(chave),
  set: (chave, valor) => set(chave, valor),
  del: (chave) => del(chave),
};

export function criarFilaAutosave(opts: OpcoesFila): FilaAutosave {
  const esperaMs = opts.esperaMs ?? 3000;
  const { armazenamento, chave, salvar } = opts;

  let estado: EstadoAutosave = 'salvo';
  let ultimoSalvoEm: Date | null = null;
  let evolucaoId = opts.evolucaoId;
  let atual: PayloadRascunho | null = null;
  let versao = 0;
  let temPendencia = false;
  let gravacaoLocal: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ouvintes = new Set<() => void>();

  function mudar(novo: EstadoAutosave) {
    estado = novo;
    ouvintes.forEach((cb) => cb());
  }

  async function enviar(): Promise<void> {
    await gravacaoLocal;
    if (!atual || !temPendencia) return;
    const enviado = atual;
    const versaoEnviada = versao;
    try {
      const retorno = await salvar(enviado);
      evolucaoId = retorno.id;
      ultimoSalvoEm = new Date(retorno.atualizado_em);
      // Se houve digitação depois do envio, a cópia local e o timer novos continuam valendo.
      if (versaoEnviada === versao) {
        temPendencia = false;
        await armazenamento.del(chave);
        mudar('salvo');
      }
    } catch (erro) {
      mudar('offline');
      throw erro;
    }
  }

  function aoVoltarConexao() {
    if (estado === 'offline' && temPendencia) void enviar().catch(() => {});
  }

  return {
    agendar(p) {
      atual = p;
      versao += 1;
      temPendencia = true;
      const copia: CopiaLocal = { ...p, salvoLocalEm: new Date().toISOString() };
      gravacaoLocal = gravacaoLocal.then(() => armazenamento.set(chave, copia));
      clearTimeout(timer);
      timer = setTimeout(() => {
        void enviar().catch(() => {});
      }, esperaMs);
      if (estado !== 'pendente') mudar('pendente');
    },

    async forcar() {
      clearTimeout(timer);
      await enviar();
    },

    get estado() {
      return estado;
    },
    get ultimoSalvoEm() {
      return ultimoSalvoEm;
    },
    get evolucaoId() {
      return evolucaoId;
    },

    assinar(cb) {
      ouvintes.add(cb);
      return () => {
        ouvintes.delete(cb);
      };
    },

    async cancelar() {
      clearTimeout(timer);
      temPendencia = false;
      versao += 1;
      await gravacaoLocal;
      await armazenamento.del(chave);
      mudar('salvo');
    },

    aoVoltarConexao,

    encerrar() {
      clearTimeout(timer);
      if (temPendencia) void enviar().catch(() => {});
    },
  };
}

export type RascunhoResolvido = {
  origem: 'local' | 'servidor';
  dados: DadosMedica;
  textoLivre: string;
};

/** Ao abrir o form: a cópia local vence se for mais nova que o `atualizado_em` do servidor. */
export function resolverRascunho(
  local: CopiaLocal | undefined,
  servidor: { dados: DadosMedica; textoLivre: string; atualizado_em: string } | null,
): RascunhoResolvido | null {
  if (local && (!servidor || Date.parse(local.salvoLocalEm) > Date.parse(servidor.atualizado_em))) {
    return { origem: 'local', dados: local.dados, textoLivre: local.textoLivre };
  }
  if (servidor) {
    return { origem: 'servidor', dados: servidor.dados, textoLivre: servidor.textoLivre };
  }
  return null;
}
