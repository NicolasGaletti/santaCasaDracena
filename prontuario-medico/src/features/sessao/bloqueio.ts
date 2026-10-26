/** Tela de bloqueio durante a saída: ninguém digita enquanto o rascunho é enviado e as cópias são limpas. */
const ID = 'tela-saindo'

export function bloquearTela(): void {
  if (typeof document === 'undefined' || document.getElementById(ID)) return
  const ativo = document.activeElement
  if (ativo instanceof HTMLElement) ativo.blur()
  const tela = document.createElement('div')
  tela.id = ID
  tela.setAttribute('role', 'status')
  tela.setAttribute('aria-busy', 'true')
  tela.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 text-lg font-medium text-slate-700'
  tela.textContent = 'Saindo…'
  Array.from(document.body.children).forEach((el) => el.setAttribute('inert', ''))
  document.body.appendChild(tela)
}

export function desbloquearTela(): void {
  if (typeof document === 'undefined') return
  document.getElementById(ID)?.remove()
  document.querySelectorAll('body > [inert]').forEach((el) => el.removeAttribute('inert'))
}
