begin;
select plan(6);

-- setup como postgres
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, false);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, false);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, false);

insert into public.equipes (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Clinica Medica');

insert into public.pacientes (id, nome, data_nascimento, convenio)
values ('22222222-2222-2222-2222-222222222222', 'Paciente Teste', '1950-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, diagnostico_inicial, comorbidades, muc)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  current_setting('tst.medico_a')::uuid,
  'A-01', 'Pneumonia', '', 'MUC-1'
);

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, texto_livre)
values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', 'Rascunho A'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_b')::uuid, 'RASCUNHO', 'Rascunho B'),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'FINALIZADA', 'Evolucao finalizada');

-- 1. todas as tabelas de public têm RLS
select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'todas as tabelas de public têm RLS'
);

-- 2. anon não lê pacientes
set role anon;
select throws_ok('select * from public.pacientes', '42501', null, 'anon não lê pacientes');
reset role;

-- 3. recepção não lê conteúdo de evolução
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is_empty('select * from public.evolucoes', 'recepcao não lê conteúdo de evolução');

-- 4. rascunho de outro autor invisível
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select results_eq(
  'select id from public.evolucoes where status = ''RASCUNHO''',
  'select ''44444444-4444-4444-4444-444444444444''::uuid',
  'rascunho de outro autor invisível'
);

-- 5. view pública mostra nome de todos os profissionais
select is(
  (select count(*) from public.vw_profissionais_publico
    where id::text = any (array[current_setting('tst.medico_a'), current_setting('tst.medico_b')])),
  2::bigint,
  'vw_profissionais_publico mostra todos os profissionais'
);

-- 6. profissionais expõe só o próprio registro
select is((select count(*) from public.profissionais), 1::bigint, 'profissionais: só o próprio registro');

select * from finish();
rollback;
