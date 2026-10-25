begin;
select plan(10);

-- setup como postgres (transaction-local); dados próprios, sem depender do seed
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);

insert into public.equipes (id, nome) values ('ffffffff-0000-0000-0000-000000000001', 'Equipe Views Teste');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico')::uuid, 'ffffffff-0000-0000-0000-000000000001');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('ffffffff-0000-0000-0000-000000000002', 'Paciente Views', '1955-03-03', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala) values
  ('ffffffff-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000001', current_setting('tst.medico')::uuid, 'V-01');

insert into public.internacoes_clinico (internacao_id, diagnostico_inicial, comorbidades, muc) values
  ('ffffffff-0000-0000-0000-000000000003', 'Diagnóstico views', 'Nenhuma', 'MUC-V');

insert into public.leitos_historico (internacao_id, leito_ala, por) values
  ('ffffffff-0000-0000-0000-000000000003', 'V-01', current_setting('tst.medico')::uuid);

-- 1. status_hoje reflete evolução finalizada hoje
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select public.salvar_rascunho('ffffffff-0000-0000-0000-000000000003', '{"v":1,"evolucao_clinica":"Evolucao views","conduta":"Conduta views"}'::jsonb, 'Evolucao views');
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select is(
  (select status_hoje from public.vw_internacoes_lista where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  'RASCUNHO',
  'status_hoje é RASCUNHO com rascunho do próprio autor'
);
select public.finalizar_evolucao(
  (select e.id from public.evolucoes e where e.internacao_id = 'ffffffff-0000-0000-0000-000000000003' and e.status = 'RASCUNHO')
);
select is(
  (select status_hoje from public.vw_internacoes_lista where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  'FINALIZADA',
  'status_hoje reflete evolução finalizada hoje'
);

-- 2. vw respeita RLS (recepcao vê lista mas não timeline)
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select ok(
  exists (select 1 from public.vw_internacoes_lista where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  'recepcao vê a internação na lista'
);
select is(
  (select status_hoje from public.vw_internacoes_lista where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  'NENHUMA',
  'recepcao não vê evoluções: status_hoje NENHUMA'
);
select is_empty(
  $$select * from public.vw_evolucoes_timeline where internacao_id = 'ffffffff-0000-0000-0000-000000000003'$$,
  'recepcao não vê timeline'
);
select hasnt_column(
  'public', 'vw_internacoes_lista', 'diagnostico_inicial',
  'vw_internacoes_lista não expõe dados clínicos'
);
select ok(
  not has_table_privilege('anon', 'public.vw_internacoes_lista', 'select')
  and not has_table_privilege('anon', 'public.vw_evolucoes_timeline', 'select'),
  'anon não lê as views'
);

-- 3. timeline traz autor_nome e vias_impressas
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select is(
  (select vias_impressas from public.vw_evolucoes_timeline where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  0,
  'timeline: vias_impressas 0 antes de imprimir'
);
select public.registrar_impressao(
  (select e.id from public.evolucoes e where e.internacao_id = 'ffffffff-0000-0000-0000-000000000003' and e.status = 'FINALIZADA')
);
select is(
  (select t.vias_impressas from public.vw_evolucoes_timeline t where t.internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  1,
  'timeline: vias_impressas conta impressões'
);
select is(
  (select autor_nome from public.vw_evolucoes_timeline where internacao_id = 'ffffffff-0000-0000-0000-000000000003'),
  'Teste medico',
  'timeline traz autor_nome'
);

select * from finish();
rollback;
