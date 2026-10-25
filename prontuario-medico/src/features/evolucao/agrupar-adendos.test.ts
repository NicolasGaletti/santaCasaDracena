import { describe, expect, it } from 'vitest';
import { agruparAdendos } from './agrupar-adendos';

type Item = { id: string; adendo_de?: string | null; criado_em: string };

const original1: Item = { id: 'o1', adendo_de: null, criado_em: '2026-10-25T10:00:00Z' };
const original2: Item = { id: 'o2', adendo_de: null, criado_em: '2026-10-25T08:00:00Z' };
const adendoA: Item = { id: 'a1', adendo_de: 'o1', criado_em: '2026-10-25T12:00:00Z' };
const adendoB: Item = { id: 'a2', adendo_de: 'o1', criado_em: '2026-10-25T11:00:00Z' };

const ids = (lista: { item: Item; recuo: boolean }[]) => lista.map((e) => `${e.item.id}${e.recuo ? '<' : ''}`);

describe('agruparAdendos', () => {
  it('coloca os adendos logo abaixo da original, em ordem cronológica e recuados', () => {
    const resultado = agruparAdendos([original1, adendoA, adendoB, original2]);
    expect(ids(resultado)).toEqual(['o1', 'a2<', 'a1<', 'o2']);
  });

  it('adendo cuja original não está na lista vira item comum', () => {
    const resultado = agruparAdendos([adendoA]);
    expect(ids(resultado)).toEqual(['a1']);
    expect(resultado[0].recuo).toBe(false);
  });

  it('com filtro, só entra o que passa; adendo sem original visível aparece sem recuo', () => {
    const soAdendo = (e: Item) => e.id === 'a1';
    expect(ids(agruparAdendos([original1, adendoA, adendoB, original2], soAdendo))).toEqual(['a1']);

    const soOriginal = (e: Item) => e.id === 'o1';
    expect(ids(agruparAdendos([original1, adendoA, adendoB, original2], soOriginal))).toEqual(['o1']);
  });
});
