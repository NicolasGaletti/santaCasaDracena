begin;
select plan(7);

-- setup como postgres (transaction-local)
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.academico', tests.criar_profissional('academico', false)::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);

insert into public.equipes (id, nome) values ('13000000-0000-0000-0000-000000000001', 'Clinica Medica 13');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico')::uuid, '13000000-0000-0000-0000-000000000001'),
  (current_setting('tst.academico')::uuid, '13000000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente')::uuid, '13000000-0000-0000-0000-000000000001');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('13100000-0000-0000-0000-000000000001', 'Paciente 13', '1960-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala) values
  ('13200000-0000-0000-0000-000000000001', '13100000-0000-0000-0000-000000000001',
   '13000000-0000-0000-0000-000000000001', current_setting('tst.medico')::uuid, 'L-13');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, enviada_em) values
  ('13300000-0000-0000-0000-000000000001', '13200000-0000-0000-0000-000000000001', 'medica', current_setting('tst.academico')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('13300000-0000-0000-0000-000000000002', '13200000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now());

-- 1. validação de acadêmico grava o perfil no snapshot do autor
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select lives_ok(
  $$select public.validar_evolucao('13300000-0000-0000-0000-000000000001')$$,
  'médico valida evolução de acadêmico'
);
reset role;
select is(
  (select snapshot_autor->>'perfil' from public.evolucoes where id = '13300000-0000-0000-0000-000000000001'),
  'academico',
  'snapshot do autor acadêmico grava perfil academico'
);

-- 2. validação de residente grava o perfil residente
select tests.autenticar(current_setting('tst.medico')::uuid);
select lives_ok(
  $$select public.validar_evolucao('13300000-0000-0000-0000-000000000002')$$,
  'médico valida evolução de residente'
);
reset role;
select is(
  (select snapshot_autor->>'perfil' from public.evolucoes where id = '13300000-0000-0000-0000-000000000002'),
  'residente',
  'snapshot do autor residente grava perfil residente'
);

-- 3. snapshot continua com os campos de conselho (acadêmico sem conselho = null)
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '13300000-0000-0000-0000-000000000001'
      and snapshot_autor->>'nome' = 'Teste academico'
      and snapshot_autor->>'conselho' is null
  ),
  'snapshot do acadêmico mantém nome e conselho nulo'
);

-- 4. finalizar_core segue sem acesso para authenticated/anon/public e como security definer
select ok(
  not has_function_privilege('authenticated', 'app.finalizar_core(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'app.finalizar_core(uuid, uuid)', 'execute')
  and not has_function_privilege('public', 'app.finalizar_core(uuid, uuid)', 'execute'),
  'finalizar_core não executável por authenticated, anon ou public'
);
select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'finalizar_core' and p.prosecdef
      and p.proconfig @> array['search_path=""']
  ),
  'finalizar_core é security definer com search_path vazio'
);

select * from finish();
rollback;
