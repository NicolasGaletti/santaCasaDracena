export const MENSAGEM_SENHA_CURTA = 'A senha deve ter pelo menos 10 caracteres.'
export const MENSAGEM_SENHA_FRACA = 'A senha deve ter pelo menos uma letra e um número.'

/** Regra de senha: ≥ 10 caracteres, com ao menos uma letra e um número. Retorna a mensagem de erro ou null. */
export function validarSenha(senha: string): string | null {
  if (senha.length < 10) return MENSAGEM_SENHA_CURTA
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return MENSAGEM_SENHA_FRACA
  return null
}
