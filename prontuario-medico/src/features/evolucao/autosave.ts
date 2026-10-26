import { del, get, set } from 'idb-keyval';
import type { DadosMedica } from './modelos/medica';

export type PayloadRascunho<D = DadosMedica> = { internacaoId: string; dados: D; textoLivre: string };

/**
 * Cópia local do rascunho. `sincronizado: true` só depois que o servidor confirmou esta mesma versão;
 * ausente (registro antigo) ou false conta como NÃO sincronizado e nunca é apagado na saída da sessão.
 */
export type CopiaLocal<D = DadosMedica> = PayloadRascunho<D> & { salvoLocalEm: string; sincronizado?: boolean };

export type Armazenamento<D = DadosMedica> = {
  get(chave: string): Promise<CopiaLocal<D> | undefined>;
  set(chave: string, valor: CopiaLocal<D>): Promise<void>;
  del(chave: string): Promise<void>;
};

export type EstadoAutosave = 'salvo' | 'pendente' | 'offline' | 'erro';

/** Erro do servidor com mensagem pt-BR para o usuário (P0001): não se resolve sozinho, não tenta de novo. */
export function ehErroTerminal(erro: unknown): erro is { code: 'P0001'; message: string } {
  return typeof erro === 'object' && erro !== null && (erro as { code?: unknown }).code === 'P0001';
}

export type FilaAutosave<D = DadosMedica> = {
  agendar(p: PayloadRascunho<D>): void;
  /** Espera envios em andamento e garante que a versão mais nova foi salva. Rejeita se falhar. */
  forcar(): Promise<void>;
  readonly estado: EstadoAutosave;
  readonly ultimoSalvoEm: Date | null;
  readonly evolucaoId: string | undefined;
  /** Mensagem do servidor quando `estado` é 'erro'; null nos demais estados. */
  readonly mensagemErro: string | null;
  /** Nenhuma digitação registrada ainda nesta fila. */
  readonly pristina: boolean;
  assinar(cb: () => void): () => void;
  /** Handler do evento `online`: reenvia o pendente. Quem registra o ouvinte é o componente. */
  aoVoltarConexao(): void;
  /** Cancela o timer e envia o pendente em segundo plano (ao desmontar). */
  encerrar(): void;
  /** Espera envio em andamento e impede novos envios. Não apaga a cópia local. */
  cancelar(): Promise<void>;
  /** Desfaz `cancelar`: envios voltam a funcionar (usado quando o descarte falha). */
  reabrir(): void;
  /** Apaga a cópia local. Chamar só depois que o descarte deu certo. */
  apagarCopiaLocal(): Promise<void>;
};

type OpcoesFila<D> = {
  salvar: (p: PayloadRascunho<D>) => Promise<{ id: string; atualizado_em: string }>;
  armazenamento: Armazenamento<D>;
  chave: string;
  esperaMs?: number;
  evolucaoId?: string;
};

/** Armazenamento de produção: IndexedDB via idb-keyval. */
export function armazenamentoIdb<D = DadosMedica>(): Armazenamento<D> {
  return {
    get: (chave) => get<CopiaLocal<D>>(chave),
    set: (chave, valor) => set(chave, valor),
    del: (chave) => del(chave),
  };
}

export function criarFilaAutosave<D = DadosMedica>(opts: OpcoesFila<D>): FilaAutosave<D> {
  const esperaMs = opts.esperaMs ?? 3000;
  const { armazenamento, chave, salvar } = opts;

  let estado: EstadoAutosave = 'salvo';
  let mensagemErro: string | null = null;
  let ultimoSalvoEm: Date | null = null;
  let evolucaoId = opts.evolucaoId;
  let atual: PayloadRascunho<D> | null = null;
  let versao = 0; // incrementa a cada agendar
  let versaoSalva = 0; // última versão confirmada pelo servidor
  let cancelado = false;
  let gravacaoLocal: Promise<void> = Promise.resolve();
  // Cadeia única: todo envio entra aqui, então nunca há dois `salvar` simultâneos.
  let fila: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ouvintes = new Set<() => void>();

  function mudar(novo: EstadoAutosave, mensagem: string | null = null) {
    estado = novo;
    mensagemErro = mensagem;
    ouvintes.forEach((cb) => cb());
  }

  /** Envia a versão mais nova no momento em que o envio começa, não quando foi pedido. */
  function enviarUltimo(): Promise<void> {
    const envio = fila.then(async () => {
      if (cancelado || !atual || versaoSalva === versao) return;
      await gravacaoLocal;
      const enviado = atual;
      const versaoEnviada = versao;
      try {
        const retorno = await salvar(enviado);
        evolucaoId = retorno.id;
        ultimoSalvoEm = new Date(retorno.atualizado_em);
        versaoSalva = versaoEnviada;
        // Se houve digitação depois deste envio, a cópia local e o timer novos continuam valendo.
        if (versaoEnviada === versao) {
          // Marca como sincronizada na mesma cadeia das gravações locais: nenhuma gravação mais nova é sobrescrita.
          const marcada: CopiaLocal<D> = { ...enviado, salvoLocalEm: new Date().toISOString(), sincronizado: true };
          gravacaoLocal = gravacaoLocal.then(() => armazenamento.set(chave, marcada)).catch(() => {});
          await gravacaoLocal;
          mudar('salvo');
        }
      } catch (erro) {
        if (ehErroTerminal(erro)) mudar('erro', erro.message);
        else mudar('offline');
        throw erro;
      }
    });
    fila = envio.catch(() => {});
    return envio;
  }

  return {
    agendar(p) {
      if (cancelado) return;
      atual = p;
      versao += 1;
      const copia: CopiaLocal<D> = { ...p, salvoLocalEm: new Date().toISOString(), sincronizado: false };
      gravacaoLocal = gravacaoLocal.then(() => armazenamento.set(chave, copia));
      clearTimeout(timer);
      timer = setTimeout(() => {
        void enviarUltimo().catch(() => {});
      }, esperaMs);
      if (estado !== 'pendente') mudar('pendente');
    },

    async forcar() {
      clearTimeout(timer);
      while (!cancelado && atual && versaoSalva !== versao) {
        await enviarUltimo();
      }
    },

    get estado() {
      return estado;
    },
    get ultimoSalvoEm() {
      return ultimoSalvoEm;
    },
    get mensagemErro() {
      return mensagemErro;
    },
    get evolucaoId() {
      return evolucaoId;
    },
    get pristina() {
      return versao === 0;
    },

    assinar(cb) {
      ouvintes.add(cb);
      return () => {
        ouvintes.delete(cb);
      };
    },

    aoVoltarConexao() {
      if (estado === 'offline') void enviarUltimo().catch(() => {});
    },

    encerrar() {
      clearTimeout(timer);
      if (atual && versaoSalva !== versao) void enviarUltimo().catch(() => {});
    },

    async cancelar() {
      cancelado = true;
      clearTimeout(timer);
      await fila;
      await gravacaoLocal;
    },

    reabrir() {
      cancelado = false;
    },

    async apagarCopiaLocal() {
      await armazenamento.del(chave);
      mudar('salvo');
    },
  };
}

export type RascunhoResolvido<D = DadosMedica> = {
  origem: 'local' | 'servidor';
  dados: D;
  textoLivre: string;
};

/**
 * Ao abrir o form: cópia local não sincronizada vence o servidor: é mais nova por definição. Sem comparação de relógios.
 */
export function resolverRascunho<D = DadosMedica>(
  local: CopiaLocal<D> | undefined,
  servidor: { dados: D; textoLivre: string } | null,
): RascunhoResolvido<D> | null {
  // Cópia já confirmada pelo servidor não vence: o servidor pode ter versão mais nova (outro aparelho).
  if (local && local.sincronizado !== true) return { origem: 'local', dados: local.dados, textoLivre: local.textoLivre };
  if (servidor) return { origem: 'servidor', dados: servidor.dados, textoLivre: servidor.textoLivre };
  return null;
}
