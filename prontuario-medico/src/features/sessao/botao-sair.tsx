'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { sairLimpando } from './encerrar'

/** "Sair" que apaga as cópias locais de rascunho antes de encerrar a sessão. */
export function BotaoSair({
  className,
  formClassName,
  variant = 'outline',
}: Pick<ComponentProps<typeof Button>, 'className' | 'variant'> & { formClassName?: string }) {
  return (
    <form action={sairLimpando} className={formClassName}>
      <Button type="submit" variant={variant} className={className}>
        Sair
      </Button>
    </form>
  )
}
