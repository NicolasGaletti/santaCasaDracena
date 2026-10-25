import { describe, expect, it } from 'vitest'
import { rotuloIdentificacao } from './rotulos-perfil'

describe('rotuloIdentificacao', () => {
  it('mostra o registro no conselho com UF quando existe', () => {
    expect(rotuloIdentificacao({ perfil: 'medico', conselho: 'CRM', numero_conselho: '123', uf_conselho: 'SP' })).toBe('CRM 123/SP')
  })

  it('rótulo pt-BR por perfil sem registro, nunca o slug', () => {
    expect(rotuloIdentificacao({ perfil: 'academico' })).toBe('Acadêmico(a) de Medicina')
    expect(rotuloIdentificacao({ perfil: 'residente' })).toBe('Residente')
    expect(rotuloIdentificacao({ perfil: 'recepcao' })).toBe('Recepção')
    expect(rotuloIdentificacao({ perfil: 'auditoria' })).toBe('Auditoria')
    expect(rotuloIdentificacao({ perfil: 'admin' })).toBe('Administrador(a)')
    expect(rotuloIdentificacao({ perfil: 'medico' })).toBe('Médico(a)')
  })

  it('multiprofissional mostra a categoria em pt-BR', () => {
    expect(rotuloIdentificacao({ perfil: 'multiprofissional', categoria: 'enfermagem' })).toBe('Enfermagem')
    expect(rotuloIdentificacao({ perfil: 'multiprofissional', categoria: 'servico_social' })).toBe('Serviço social')
    expect(rotuloIdentificacao({ perfil: 'multiprofissional', categoria: 'enfermagem', conselho: 'COREN', numero_conselho: '99', uf_conselho: 'SP' })).toBe('COREN 99/SP')
  })
})
