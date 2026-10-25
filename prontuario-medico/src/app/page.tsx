'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Printer, Lock, Copy, FileText, UserPlus, LogOut, Activity, FlaskConical, Stethoscope } from 'lucide-react'

export default function Dashboard() {
  const [pacientes, setPacientes] = useState<any[]>([])
  const [equipes, setEquipes] = useState<any[]>([])
  const [equipeFiltro, setEquipeFiltro] = useState<string>('TODAS')
  const [pacienteSelecionado, setPacienteSelecionado] = useState<any>(null)
  const [historicoEvolucoes, setHistoricoEvolucoes] = useState<any[]>([])
  const [abaHistorico, setAbaHistorico] = useState<'todas' | 'ecg' | 'imagem' | 'lab'>('todas')
  const [abaPrincipal, setAbaPrincipal] = useState<'internados' | 'anteriores'>('internados')

  // Modais
  const [modalNovoPaciente, setModalNovoPaciente] = useState(false)
  const [modalNovaEvolucao, setModalNovaEvolucao] = useState(false)

  // Formulário de Cadastro de Paciente
  const [formPaciente, setFormPaciente] = useState({
    nome: '',
    data_nascimento: '',
    idadeCalculada: 0,
    convenio: '',
    leito_ala: '',
    equipe_id: '',
    diagnostico_inicial: '',
    comorbidades: '',
    muc: ''
  })

  // Formulário de Evolução
  const [formEvolucao, setFormEvolucao] = useState({
    id: '',
    evolucao_texto: '',
    conduta: '',
    ecg: '',
    exames_imagem: '',
    exames_laboratoriais: '',
    scores: '',
    pa: '120/80',
    fc: 75,
    fr: 16,
    temp: 36.5,
    sato2: 98,
    dextro: 90,
    diurese: 1500,
    exame_fisico_geral: 'REG, hidratada, hipocorada +2/+4, anictérica, acianótica, afebril',
    exame_fisico_ar: 'MV + bilateralmente, SRA',
    exame_fisico_acv: 'RCR, 2T, BNF, taquicárdicas, sem sopro audível',
    exame_fisico_abdome: 'globoso, RHA +, flácido, sem VCM, indolor a palpação.',
    exame_fisico_membros: 'simétricos, panturrilhas livres, sem edemas, TEC < 3 seg.',
    exame_fisico_neuro: 'pupilas isocóricas e fotorreagentes',
    status: 'RASCUNHO'
  })

  // Carregar dados iniciais
  useEffect(() => {
    carregarEquipes()
    carregarPacientes()
  }, [abaPrincipal])

  const carregarEquipes = async () => {
    const { data, error } = await supabase.from('equipes').select('*')
    
    if (error) {
      alert('Erro no Supabase: ' + error.message)
      return
    }
    
    if (data) {
      console.log('Dados vindos do Supabase:', data)
      setEquipes(data)
    }
  }
  // const carregarEquipes = async () => {
  //   try {
  //     const { data, error } = await supabase.from('equipes').select('*')
      
  //     if (error) {
  //       console.error('Erro ao buscar equipes:', error.message)
  //       return
  //     }

  //     if (data) {
  //       console.log('Equipes carregadas com sucesso:', data)
  //       setEquipes(data)
  //     }
  //   } catch (err) {
  //     console.error('Erro de conexão ao carregar equipes:', err)
  //   }
  // }

  const carregarPacientes = async () => {
    const status = abaPrincipal === 'internados' ? 'INTERNADO' : 'ALTA'
    const { data } = await supabase
      .from('vw_pacientes_internados')
      .select('*')
      .eq('status_internacao', status)
    if (data) setPacientes(data)
  }

  // Função para abrir o modal garantindo que as equipes sejam buscadas
  const handleAbrirModalNovoPaciente = async () => {
    await carregarEquipes() // Busca as equipes no Supabase antes de abrir
    setModalNovoPaciente(true)
  }

  // Cálculo de idade em tempo real ao cadastrar paciente
  const handleDataNascimentoChange = (dataNasc: string) => {
    let idade = 0
    if (dataNasc) {
      const birth = new Date(dataNasc)
      const today = new Date()
      idade = today.getFullYear() - birth.getFullYear()
      const m = today.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        idade--
      }
    }
    setFormPaciente({ ...formPaciente, data_nascimento: dataNasc, idadeCalculada: idade < 0 ? 0 : idade })
  }

  // Salvar Novo Paciente
  const handleCadastrarPaciente = async (e: React.FormEvent) => {
    e.preventDefault()
    // 1. Inserir Paciente
    const { data: paciente, error: errP } = await supabase
      .from('pacientes')
      .insert([{
        nome: formPaciente.nome,
        data_nascimento: formPaciente.data_nascimento,
        convenio: formPaciente.convenio
      }])
      .select().single()

    if (errP) return alert('Erro ao cadastrar paciente: ' + errP.message)

    // 2. Inserir Internação
    const { error: errI } = await supabase
      .from('internacoes')
      .insert([{
        paciente_id: paciente.id,
        equipe_id: formPaciente.equipe_id,
        leito_ala: formPaciente.leito_ala,
        diagnostico_inicial: formPaciente.diagnostico_inicial,
        comorbidades: formPaciente.comorbidades,
        muc: formPaciente.muc
      }])

    if (errI) return alert('Erro ao registrar internação: ' + errI.message)

    setModalNovoPaciente(false)
    carregarPacientes()
  }

  // Selecionar Paciente e Carregar Histórico
  const selecionarPaciente = async (paciente: any) => {
    setPacienteSelecionado(paciente)
    carregarHistorico(paciente.internacao_id)
  }

  const carregarHistorico = async (internacaoId: string) => {
    const { data } = await supabase
      .from('evolucoes')
      .select('*')
      .eq('internacao_id', internacaoId)
      .order('data_evolucao', { ascending: false })

    if (data) setHistoricoEvolucoes(data)
  }

  // Copiar do Dia Anterior
  const handleCopiarDiaAnterior = async () => {
    if (historicoEvolucoes.length === 0) return alert('Não há evoluções anteriores para copiar.')
    const ultima = historicoEvolucoes[0]
    setFormEvolucao({
      ...formEvolucao,
      evolucao_texto: ultima.evolucao_texto || '',
      conduta: ultima.conduta || '',
      ecg: ultima.ecg || '',
      exames_imagem: ultima.exames_imagem || '',
      exames_laboratoriais: ultima.exames_laboratoriais || '',
      scores: ultima.scores || '',
      exame_fisico_geral: ultima.exame_fisico_geral,
      exame_fisico_ar: ultima.exame_fisico_ar,
      exame_fisico_acv: ultima.exame_fisico_acv,
      exame_fisico_abdome: ultima.exame_fisico_abdome,
      exame_fisico_membros: ultima.exame_fisico_membros,
      exame_fisico_neuro: ultima.exame_fisico_neuro
    })
  }

  // Salvar Evolução (Rascunho ou Fechar)
  const handleSalvarEvolucao = async (statusFinal: 'RASCUNHO' | 'CONCLUIDO') => {
    const user = (await supabase.auth.getUser()).data.user

    const payload = {
      internacao_id: pacienteSelecionado.internacao_id,
      medico_id: user?.id,
      medico_nome: user?.user_metadata?.full_name || 'Dr. Médico Responsável',
      medico_crm: user?.user_metadata?.crm || 'CRM/SP 123456',
      ...formEvolucao,
      status: statusFinal
    }

    const { error } = await supabase.from('evolucoes').insert([payload])

    if (error) {
      alert('Erro ao salvar evolução: ' + error.message)
    } else {
      alert(statusFinal === 'CONCLUIDO' ? 'Evolução assinada e finalizada!' : 'Rascunho salvo!')
      setModalNovaEvolucao(false)
      carregarHistorico(pacienteSelecionado.internacao_id)
    }
  }

  // Atualizar Leito
  const handleAlterarLeito = async (novoLeito: string) => {
    await supabase.from('internacoes').update({ leito_ala: novoLeito }).eq('id', pacienteSelecionado.internacao_id)
    setPacienteSelecionado({ ...pacienteSelecionado, leito_ala: novoLeito })
    carregarPacientes()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-10">
      {/* Topbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 text-white p-2 rounded-lg"><Stethoscope className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Prontuário Santa Casa</h1>
            <p className="text-xs text-slate-500">Módulo de Evolução e Internação</p>
          </div>
        </div>
        <button
          onClick={handleAbrirModalNovoPaciente}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition"
        >
          <UserPlus className="w-4 h-4" /> Cadastrar Paciente
        </button>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 mt-6 grid grid-cols-12 gap-6">

        {/* Coluna Esquerda: Pacientes */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          {/* Abas Internados / Anteriores */}
          <div className="flex border-b border-slate-200 mb-4">
            <button
              onClick={() => setAbaPrincipal('internados')}
              className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 ${abaPrincipal === 'internados' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400'}`}
            >
              Internados Atuais
            </button>
            <button
              onClick={() => setAbaPrincipal('anteriores')}
              className={`flex-1 py-2 text-sm font-semibold text-center border-b-2 ${abaPrincipal === 'anteriores' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-400'}`}
            >
              Internações Anteriores
            </button>
          </div>

          {/* Filtro por Equipe */}
          <div className="mb-4">
            <select
              value={equipeFiltro}
              onChange={(e) => setEquipeFiltro(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg p-2 bg-slate-50 text-slate-700"
            >
              <option value="TODAS">Todas as Equipes</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.nome}>{e.nome}</option>
              ))}
            </select>
          </div>

          {/* Lista de Pacientes */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {pacientes
              .filter(p => equipeFiltro === 'TODAS' || p.equipe_nome === equipeFiltro)
              .map((p) => (
                <div
                  key={p.internacao_id}
                  onClick={() => selecionarPaciente(p)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${pacienteSelecionado?.internacao_id === p.internacao_id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 text-sm">{p.nome}</span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">{p.leito_ala}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex gap-3">
                    <span>Nasc: {p.data_nascimento} ({p.idade} anos)</span>
                    <span className="font-medium text-teal-700">{p.convenio}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Equipe: {p.equipe_nome}</div>
                </div>
              ))}
          </div>
        </div>

        {/* Coluna Direita: Prontuário do Paciente Selecionado */}
        <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {pacienteSelecionado ? (
            <div>
              {/* Header do Paciente */}
              <div className="border-b border-slate-200 pb-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{pacienteSelecionado.nome}</h2>
                    <p className="text-xs text-slate-500">
                      Nascimento: {pacienteSelecionado.data_nascimento} ({pacienteSelecionado.idade} anos) | Convênio: {pacienteSelecionado.convenio}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Leito:</span>
                    <input
                      type="text"
                      value={pacienteSelecionado.leito_ala}
                      onChange={(e) => handleAlterarLeito(e.target.value)}
                      className="border border-slate-300 text-xs px-2 py-1 rounded w-20 font-bold text-center"
                    />
                  </div>
                </div>

                {abaPrincipal === 'internados' && (
                  <button
                    onClick={() => setModalNovaEvolucao(true)}
                    className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Nova Evolução Diária
                  </button>
                )}
              </div>

              {/* Abas do Histórico de Exames */}
              <div className="flex gap-2 border-b border-slate-200 pb-2 mb-4">
                {(['todas', 'ecg', 'imagem', 'lab'] as const).map((aba) => (
                  <button
                    key={aba}
                    onClick={() => setAbaHistorico(aba)}
                    className={`px-3 py-1 rounded text-xs font-semibold capitalize ${abaHistorico === aba ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {aba === 'todas' ? 'Evoluções Completa' : aba === 'lab' ? 'Laboratório' : aba}
                  </button>
                ))}
              </div>

              {/* Lista de Evoluções e Exames */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {historicoEvolucoes.map((ev) => (
                  <div key={ev.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500">
                        {new Date(ev.data_evolucao).toLocaleDateString()} às {new Date(ev.data_evolucao).toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {ev.status === 'CONCLUIDO' ? (
                          <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                            <Lock className="w-3 h-3" /> Assinado
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Rascunho</span>
                        )}
                        {ev.status === 'CONCLUIDO' && (
                          <button
                            onClick={() => window.print()}
                            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" /> Imprimir
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Exibição condicional de acordo com a aba selecionada */}
                    {abaHistorico === 'todas' && (
                      <div className="text-xs text-slate-700 space-y-2">
                        <p><strong>Evolução:</strong> {ev.evolucao_texto}</p>
                        <p><strong>Conduta:</strong> {ev.conduta}</p>
                      </div>
                    )}

                    {abaHistorico === 'ecg' && (
                      <p className="text-xs text-slate-700"><strong>ECG:</strong> {ev.ecg || 'Sem alteração registrada.'}</p>
                    )}

                    {abaHistorico === 'imagem' && (
                      <p className="text-xs text-slate-700"><strong>Exames de Imagem:</strong> {ev.exames_imagem || 'Sem registros.'}</p>
                    )}

                    {abaHistorico === 'lab' && (
                      <p className="text-xs text-slate-700"><strong>Laboratório Relevante:</strong> {ev.exames_laboratoriais || 'Sem alterações relativas.'}</p>
                    )}

                    <div className="mt-2 text-[10px] text-slate-400">Assinado por: {ev.medico_nome} ({ev.medico_crm})</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Selecione um paciente na lista para visualizar o prontuário.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CADASTRAR PACIENTE */}
      {modalNovoPaciente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full">
            <h3 className="text-lg font-bold mb-4">Cadastrar Novo Paciente</h3>
            <form onSubmit={handleCadastrarPaciente} className="space-y-3">
              <div>
                <label className="text-xs font-semibold">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={formPaciente.nome}
                  onChange={(e) => setFormPaciente({ ...formPaciente, nome: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Data de Nascimento</label>
                  <input
                    type="date"
                    required
                    value={formPaciente.data_nascimento}
                    onChange={(e) => handleDataNascimentoChange(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Idade (Automática)</label>
                  <input
                    type="text"
                    disabled
                    value={`${formPaciente.idadeCalculada} anos`}
                    className="w-full border rounded p-2 text-sm bg-slate-100 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Leito / Ala</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Leito 102 - UTI"
                    value={formPaciente.leito_ala}
                    onChange={(e) => setFormPaciente({ ...formPaciente, leito_ala: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Convênio</label>
                  <input
                    type="text"
                    required
                    value={formPaciente.convenio}
                    onChange={(e) => setFormPaciente({ ...formPaciente, convenio: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Equipe Responsável</label>
                <select
                  required
                  value={formPaciente.equipe_id}
                  onChange={(e) => setFormPaciente({ ...formPaciente, equipe_id: e.target.value })}
                  className="w-full border border-slate-300 rounded p-2 text-sm bg-white text-slate-800 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">
                    {equipes.length === 0 ? 'Carregando equipes...' : 'Selecione uma equipe...'}
                  </option>
                  {equipes.map((equipe) => (
                    <option key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Diagnóstico Inicial</label>
                <textarea
                  required
                  value={formPaciente.diagnostico_inicial}
                  onChange={(e) => setFormPaciente({ ...formPaciente, diagnostico_inicial: e.target.value })}
                  className="w-full border rounded p-2 text-sm h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoPaciente(false)}
                  className="px-4 py-2 border rounded text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-semibold">
                  Salvar Paciente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA EVOLUÇÃO (Modelo Santa Casa) */}
      {modalNovaEvolucao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-lg font-bold text-slate-800">Evolução Médica - {pacienteSelecionado?.nome}</h3>
              <button
                type="button"
                onClick={handleCopiarDiaAnterior}
                className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar do Dia Anterior
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600">Evolução Clínica</label>
                <textarea
                  value={formEvolucao.evolucao_texto}
                  onChange={(e) => setFormEvolucao({ ...formEvolucao, evolucao_texto: e.target.value })}
                  className="w-full border rounded p-2 text-sm h-20"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">ECG</label>
                  <input
                    type="text"
                    value={formEvolucao.ecg}
                    onChange={(e) => setFormEvolucao({ ...formEvolucao, ecg: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Exames Imagem</label>
                  <input
                    type="text"
                    value={formEvolucao.exames_imagem}
                    onChange={(e) => setFormEvolucao({ ...formEvolucao, exames_imagem: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Exames Laboratoriais</label>
                  <input
                    type="text"
                    value={formEvolucao.exames_laboratoriais}
                    onChange={(e) => setFormEvolucao({ ...formEvolucao, exames_laboratoriais: e.target.value })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600">Conduta Médica</label>
                <textarea
                  value={formEvolucao.conduta}
                  onChange={(e) => setFormEvolucao({ ...formEvolucao, conduta: e.target.value })}
                  className="w-full border rounded p-2 text-sm h-16"
                />
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalNovaEvolucao(false)}
                  className="px-4 py-2 border rounded text-sm"
                >
                  Cancelar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSalvarEvolucao('RASCUNHO')}
                    className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded text-sm font-semibold"
                  >
                    Salvar Rascunho
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSalvarEvolucao('CONCLUIDO')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold flex items-center gap-1"
                  >
                    <Lock className="w-4 h-4" /> Salvar e Fechar (Assinar)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}