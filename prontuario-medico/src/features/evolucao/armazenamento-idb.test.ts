import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clear, get, set } from 'idb-keyval';
import { apagarSeSincronizada, armazenamentoIdb } from './autosave';

beforeEach(() => clear());

describe('armazenamentoIdb.marcarSincronizado', () => {
  it('marca quando gravacaoId confere', async () => {
    await set('k', { gravacaoId: 'g1', sincronizado: false });
    await armazenamentoIdb().marcarSincronizado('k', 'g1');
    expect(await get('k')).toMatchObject({ gravacaoId: 'g1', sincronizado: true });
  });

  it('não marca quando outra aba gravou depois (gravacaoId diferente)', async () => {
    await set('k', { gravacaoId: 'g2', sincronizado: false });
    await armazenamentoIdb().marcarSincronizado('k', 'g1');
    expect(await get('k')).toMatchObject({ gravacaoId: 'g2', sincronizado: false });
  });

  it('chave ausente continua ausente', async () => {
    await armazenamentoIdb().marcarSincronizado('k', 'g1');
    expect(await get('k')).toBeUndefined();
  });
});

describe('apagarSeSincronizada', () => {
  it('apaga registro sincronizado', async () => {
    await set('k', { sincronizado: true });
    expect(await apagarSeSincronizada('k')).toBe(true);
    expect(await get('k')).toBeUndefined();
  });

  it('mantém registro não sincronizado, sem marcador ou ausente', async () => {
    await set('a', { sincronizado: false });
    await set('b', { x: 1 });
    expect(await apagarSeSincronizada('a')).toBe(false);
    expect(await apagarSeSincronizada('b')).toBe(false);
    expect(await apagarSeSincronizada('c')).toBe(false);
    expect(await get('a')).toEqual({ sincronizado: false });
    expect(await get('b')).toEqual({ x: 1 });
  });

  it('gravação não sincronizada concorrente com a limpeza nunca é perdida', async () => {
    await set('k', { sincronizado: true, textoLivre: 'velho' });
    const limpeza = apagarSeSincronizada('k');
    const escrita = set('k', { sincronizado: false, textoLivre: 'novo' });
    await Promise.all([limpeza, escrita]);
    // Transações readwrite serializam: ou apagou antes e a escrita recriou, ou manteve a nova.
    expect(await get('k')).toEqual({ sincronizado: false, textoLivre: 'novo' });
  });
});
