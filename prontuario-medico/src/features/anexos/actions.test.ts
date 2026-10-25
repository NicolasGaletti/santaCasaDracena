import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSignedUrl = vi.fn();
const maybeSingle = vi.fn();
const rpc = vi.fn();

vi.mock('@/lib/auth', () => ({ exigirProfissional: vi.fn(async () => ({ id: 'u1', perfil: 'recepcao' })) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    storage: { from: () => ({ createSignedUrl }) },
    rpc,
  })),
}));

import { urlAssinada } from './actions';

const ANEXO = '11111111-1111-1111-1111-111111111111';
const INTERNACAO = '22222222-2222-2222-2222-222222222222';

describe('urlAssinada', () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    maybeSingle.mockReset();
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it('linha invisível pelo RLS (ex.: recepção) devolve erro e não gera URL', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const resultado = await urlAssinada(ANEXO);

    expect(resultado).toEqual({ erro: 'Anexo não encontrado.' });
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('linha visível gera URL assinada de 300 s para o caminho do objeto', async () => {
    maybeSingle.mockResolvedValue({ data: { storage_path: 'internacoes/i/a', internacao_id: INTERNACAO }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null });

    const resultado = await urlAssinada(ANEXO);

    expect(createSignedUrl).toHaveBeenCalledWith('internacoes/i/a', 300);
    expect(resultado).toEqual({ url: 'https://x/assinada' });
  });

  it('registra acesso ver_anexo quando a linha é visível', async () => {
    maybeSingle.mockResolvedValue({ data: { storage_path: 'internacoes/i/a', internacao_id: INTERNACAO }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null });

    await urlAssinada(ANEXO);

    expect(rpc).toHaveBeenCalledWith('registrar_acesso', { p_internacao_id: INTERNACAO, p_acao: 'ver_anexo' });
  });

  it('falha ao registrar acesso não impede a URL assinada', async () => {
    maybeSingle.mockResolvedValue({ data: { storage_path: 'internacoes/i/a', internacao_id: INTERNACAO }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null });
    rpc.mockRejectedValue(new Error('rede'));

    const resultado = await urlAssinada(ANEXO);

    expect(resultado).toEqual({ url: 'https://x/assinada' });
  });
});
