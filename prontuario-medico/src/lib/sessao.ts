/** Claim `amr`: verifyOtp (invite e recovery) emite [{method:'otp'}] no Supabase local; os demais são tolerados. */
const METODOS_LINK_EMAIL = ['otp', 'recovery', 'invite']

/** True se a sessão nasceu de um link de e-mail (convite/recuperação), não de login com senha. */
export function sessaoPorLinkDeEmail(claims: { amr?: unknown }): boolean {
  if (!Array.isArray(claims.amr)) return false
  return claims.amr.some(
    (a) => typeof a === 'object' && a !== null && METODOS_LINK_EMAIL.includes((a as { method?: string }).method ?? ''),
  )
}
