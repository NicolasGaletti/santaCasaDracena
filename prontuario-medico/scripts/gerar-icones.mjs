// Gera os PNGs do PWA a partir de public/icons/icone.svg (cores do design system).
// Uso: node scripts/gerar-icones.mjs  (usa o `sharp` que o Next já instala)
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const dir = new URL('../public/icons/', import.meta.url)
const normal = readFileSync(new URL('icone.svg', dir))
const maskable = readFileSync(new URL('icone-maskable.svg', dir))

for (const [arquivo, svg, tam] of [
  ['icon-192.png', normal, 192],
  ['icon-512.png', normal, 512],
  ['maskable-512.png', maskable, 512],
]) {
  writeFileSync(new URL(arquivo, dir), await sharp(svg).resize(tam, tam).png().toBuffer())
}
