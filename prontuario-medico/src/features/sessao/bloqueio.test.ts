// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { bloquearTela, desbloquearTela } from './bloqueio'

afterEach(() => {
  desbloquearTela()
  document.body.innerHTML = ''
})

describe('bloquearTela', () => {
  it('mostra Saindo… com aria-busy e deixa o resto inerte; desbloquear desfaz', () => {
    document.body.innerHTML = '<form id="f"><textarea id="t"></textarea></form>'
    bloquearTela()
    const tela = document.getElementById('tela-saindo')!
    expect(tela.textContent).toBe('Saindo…')
    expect(tela.getAttribute('aria-busy')).toBe('true')
    expect(document.getElementById('f')!.hasAttribute('inert')).toBe(true)
    expect(tela.hasAttribute('inert')).toBe(false)
    bloquearTela()
    expect(document.querySelectorAll('#tela-saindo')).toHaveLength(1)

    desbloquearTela()
    expect(document.getElementById('tela-saindo')).toBeNull()
    expect(document.getElementById('f')!.hasAttribute('inert')).toBe(false)
  })
})
