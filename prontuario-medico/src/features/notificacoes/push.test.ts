import { describe, expect, it } from 'vitest'
import { base64UrlParaBytes, bytesParaBase64Url } from './push'

describe('base64UrlParaBytes', () => {
  it('decodifica base64url com - e _ e sem padding', () => {
    // 0xfb 0xff 0xfe -> "-__-" em base64url
    expect(Array.from(base64UrlParaBytes('-__-'))).toEqual([0xfb, 0xff, 0xfe])
  })

  it('completa o padding ausente', () => {
    expect(Array.from(base64UrlParaBytes('aGk'))).toEqual([104, 105])
  })
})

describe('bytesParaBase64Url', () => {
  it('ida e volta sem padding', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 1])
    const texto = bytesParaBase64Url(bytes.buffer)
    expect(texto).not.toMatch(/[+/=]/)
    expect(Array.from(base64UrlParaBytes(texto))).toEqual(Array.from(bytes))
  })

  it('buffer ausente vira vazio', () => {
    expect(bytesParaBase64Url(null)).toBe('')
  })
})
