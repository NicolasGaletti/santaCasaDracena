'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Campo do código de 6 dígitos do app autenticador. */
export function CampoCodigo({ id, valor, aoMudar }: { id: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Código de 6 dígitos</Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
        required
        className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
      />
    </div>
  )
}
