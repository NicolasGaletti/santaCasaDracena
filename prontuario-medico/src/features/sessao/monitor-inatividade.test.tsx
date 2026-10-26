import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const encerrar = vi.fn(async () => {})
vi.mock('./encerrar', () => ({ encerrarPorInatividade: () => encerrar() }))

import { MonitorInatividade } from './monitor-inatividade'

const MIN = 60_000

/** Node recente define `localStorage` global sem backend; o stub dá um Storage simples e previsível. */
function stubStorage() {
  const m = new Map<string, string>()
  const armazem = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  }
  vi.stubGlobal('localStorage', armazem)
  return armazem
}

beforeEach(() => {
  vi.useFakeTimers()
  stubStorage()
  encerrar.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('MonitorInatividade', () => {
  it('expira após 30 min sem interação', () => {
    render(<MonitorInatividade />)
    act(() => vi.advanceTimersByTime(29 * MIN))
    expect(encerrar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1 * MIN + 1000))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('interação reinicia a contagem', () => {
    render(<MonitorInatividade />)
    act(() => vi.advanceTimersByTime(20 * MIN))
    act(() => {
      window.dispatchEvent(new Event('keydown'))
    })
    act(() => vi.advanceTimersByTime(20 * MIN))
    expect(encerrar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(11 * MIN))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('atividade em outra aba (localStorage) mantém esta viva', () => {
    render(<MonitorInatividade />)
    act(() => vi.advanceTimersByTime(25 * MIN))
    localStorage.setItem('ultima-atividade', String(Date.now()))
    act(() => vi.advanceTimersByTime(10 * MIN))
    expect(encerrar).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(21 * MIN))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('grava a atividade no máximo uma vez a cada 30 s', () => {
    render(<MonitorInatividade />)
    const espia = vi.spyOn(localStorage, 'setItem')
    for (let i = 0; i < 5; i++) act(() => void window.dispatchEvent(new Event('pointerdown')))
    expect(espia.mock.calls.length).toBeLessThanOrEqual(1)
    act(() => vi.advanceTimersByTime(31_000))
    act(() => void window.dispatchEvent(new Event('pointerdown')))
    expect(espia.mock.calls.length).toBeLessThanOrEqual(2)
    espia.mockRestore()
  })

  it('aba voltando a ficar visível após o prazo expira na hora', () => {
    render(<MonitorInatividade minutos={1} />)
    vi.setSystemTime(Date.now() + 5 * MIN)
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('não dispara duas vezes', () => {
    render(<MonitorInatividade minutos={1} />)
    act(() => vi.advanceTimersByTime(10 * MIN))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })

  it('tenta de novo em 30 s se o encerramento falhar', async () => {
    encerrar.mockRejectedValueOnce(new Error('rede'))
    render(<MonitorInatividade minutos={1} />)
    await act(async () => {
      vi.advanceTimersByTime(MIN + 1000)
    })
    expect(encerrar).toHaveBeenCalledTimes(1)
    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })
    expect(encerrar).toHaveBeenCalledTimes(2)
  })

  it('timestamp compartilhado no futuro (relógio voltou) não impede a expiração', () => {
    render(<MonitorInatividade minutos={1} />)
    localStorage.setItem('ultima-atividade', String(Date.now() + 5 * 60 * MIN))
    // 1ª checagem corrige o valor futuro para "agora"; a expiração conta dali.
    act(() => vi.advanceTimersByTime(2 * MIN + 2000))
    expect(encerrar).toHaveBeenCalledTimes(1)
  })
})
