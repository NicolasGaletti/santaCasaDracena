import { del, get, set } from 'idb-keyval';
import type { DadosMedica } from './modelos/medica';

export type PayloadRascunho = { internacaoId: string; dados: DadosMedica; textoLivre: string };

/** Cópia local: existe só enquanto o último envio não foi confirmado pelo servidor. */
export type CopiaLocal = PayloadRascunho & { salvoLocalEm: string };

export type Armazenamento = {
  get(chave: string): Promise<CopiaLocal | undefined>;
  set(chave: string, valor: CopiaLocal): Promise<void>;
  del(chave: string): Promise<void>;
};

export type EstadoAutosave = 'salvo' | 'pendente' | 'offline' | 'erro';

/** Erro do servidor com mensagem pt-BR para o usuário (P0001): não se resolve sozinho, não tenta de novo. */
export function ehErroTerminal(erro: unknown): erro is { code: 'P0001'; message: string } {
  return typeof erro === 'object' && erro !== null && (erro as { code?: unknown }).code === 'P0001';
}

export type FilaAutosave = {
  agendar(p: PayloadRascunho): void;
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
  let mensagemErro: string | null = null;
  let ultimoSalvoEm: Date | null = null;
  let evolucaoId = opts.evolucaoId;
  let atual: PayloadRascunho | null = null;
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
          await armazenamento.del(chave);
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
      const copia: CopiaLocal = { ...p, salvoLocalEm: new Date().toISOString() };
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

export type RascunhoResolvido = {
  origem: 'local' | 'servidor';
  dados: DadosMedica;
  textoLivre: string;
};

/**
 * Ao abrir o form: se existe cópia local, ela vence. Ela só existe quando o último envio não
 * completou, então é mais nova que o servidor por definição. Sem comparação de relógios.
 */
export function resolverRascunho(
  local: CopiaLocal | undefined,
  servidor: { dados: DadosMedica; textoLivre: string } | null,
): RascunhoResolvido | null {
  if (local) return { origem: 'local', dados: local.dados, textoLivre: local.textoLivre };
  if (servidor) return { origem: 'servidor', dados: servidor.dados, textoLivre: servidor.textoLivre };
  return null;
}
