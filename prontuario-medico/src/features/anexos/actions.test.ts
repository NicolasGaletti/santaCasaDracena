import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSignedUrl = vi.fn();
const maybeSingle = vi.fn();

vi.mock('@/lib/auth', () => ({ exigirProfissional: vi.fn(async () => ({ id: 'u1', perfil: 'recepcao' })) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    storage: { from: () => ({ createSignedUrl }) },
  })),
}));

import { urlAssinada } from './actions';

describe('urlAssinada', () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    maybeSingle.mockReset();
  });

  it('linha invisível pelo RLS (ex.: recepção) devolve erro e não gera URL', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const resultado = await urlAssinada('11111111-1111-1111-1111-111111111111');

    expect(resultado).toEqual({ erro: 'Anexo não encontrado.' });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('linha visível gera URL assinada de 300 s para o caminho do objeto', async () => {
    maybeSingle.mockResolvedValue({ data: { storage_path: 'internacoes/i/a' }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://x/assinada' }, error: null });

    const resultado = await urlAssinada('11111111-1111-1111-1111-111111111111');

    expect(createSignedUrl).toHaveBeenCalledWith('internacoes/i/a', 300);
    expect(resultado).toEqual({ url: 'https://x/assinada' });
  });
});
