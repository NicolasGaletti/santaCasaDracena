import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function CampoTextual({
  id,
  rotulo,
  valor,
  onChange,
  obrigatorio = false,
  linhas = 3,
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  obrigatorio?: boolean
  linhas?: number
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true"> *</span>}
      </Label>
      <Textarea id={id} rows={linhas} value={valor} onChange={(e) => onChange(e.target.value)} className="min-h-24 text-base" />
    </div>
  )
}
