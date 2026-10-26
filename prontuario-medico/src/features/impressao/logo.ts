import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Proporção largura/altura da logo recortada (600×493). */
export const PROPORCAO_LOGO = 600 / 493
/** Altura impressa: ~14 mm (1 mm = 2,835 pt). */
export const ALTURA_LOGO = 40

let cache: Buffer | null = null

/** Logo da Santa Casa lida do disco (servidor); caminho listado em `outputFileTracingIncludes`. */
export function logoSantaCasa(): { data: Buffer; format: 'png' } {
  cache ??= readFileSync(path.join(process.cwd(), 'src/assets/logo-santa-casa.png'))
  return { data: cache, format: 'png' }
}
