'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CadastrarMfa } from './cadastrar-mfa'

/** Cadastro opcional: só gera o QR code depois do clique, para não deixar fatores pendentes. */
export function ConfigurarMfa() {
  const [aberto, setAberto] = useState(false)
  if (!aberto) {
    return (
      <Button type="button" variant="primaria" size="lg" onClick={() => setAberto(true)}>
        Configurar autenticador
      </Button>
    )
  }
  return <CadastrarMfa destino="/conta/seguranca" />
}
