begin;
select plan(17);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);
select set_config('tst.admin', tests.criar_profissional('admin')::text, true);
select set_config('tst.auditor', tests.criar_profissional('auditoria')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.inativo', tests.criar_profissional('medico')::text, true);
update public.profissionais set ativo = false where id = current_setting('tst.inativo')::uuid;

insert into public.equipes (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Clinica Medica'),
  ('77777777-7777-7777-7777-777777777777', 'Outra Equipe');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '11111111-1111-1111-1111-111111111111'),
  (current_setting('tst.residente')::uuid, '11111111-1111-1111-1111-111111111111'),
  (current_setting('tst.medico_b')::uuid, '77777777-7777-7777-7777-777777777777');

insert into public.pacientes (id, nome, data_nascimento, convenio)
values ('22222222-2222-2222-2222-222222222222', 'Paciente Teste', '1950-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  current_setting('tst.medico_a')::uuid,
  'A-01'
);

insert into public.internacoes_clinico (internacao_id, diagnostico_inicial, comorbidades, muc)
values ('33333333-3333-3333-3333-333333333333', 'Pneumonia', '', 'MUC-1');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, texto_livre)
values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', 'Rascunho A'),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_b')::uuid, 'RASCUNHO', 'Rascunho B'),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'FINALIZADA', 'Evolucao finalizada'),
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', 'Aguardando validacao');

insert into public.acessos (profissional_id, internacao_id, acao)
values (current_setting('tst.medico_a')::uuid, '33333333-3333-3333-3333-333333333333', 'ABRIR_PRONTUARIO');

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

-- 3. anon sem usage no schema app
set role anon;
select throws_ok('select app.eh_medico()', '42501', null, 'anon sem usage em app');
reset role;

-- 4. recepção não lê conteúdo de evolução
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is_empty('select * from public.evolucoes', 'recepcao não lê conteúdo de evolução');

-- 5. recepção não lê internacoes_clinico
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is_empty('select * from public.internacoes_clinico', 'recepcao não lê internacoes_clinico');

-- 6. admin não lê evolucoes
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid);
select is_empty('select * from public.evolucoes', 'admin não lê evolucoes');

-- 7. rascunho de outro autor invisível
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select results_eq(
  'select id from public.evolucoes where status = ''RASCUNHO''',
  'select ''44444444-4444-4444-4444-444444444444''::uuid',
  'rascunho de outro autor invisível'
);

-- 8. médico da equipe vê AGUARDANDO_VALIDACAO
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select is(
  (select count(*) from public.evolucoes where status = 'AGUARDANDO_VALIDACAO'),
  1::bigint,
  'médico da equipe vê AGUARDANDO_VALIDACAO'
);

-- 9. médico de outra equipe não vê AGUARDANDO_VALIDACAO
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select is_empty(
  'select * from public.evolucoes where status = ''AGUARDANDO_VALIDACAO''',
  'médico de outra equipe não vê AGUARDANDO_VALIDACAO'
);

-- 10. usuário inativo não vê pacientes
reset role;
select tests.autenticar(current_setting('tst.inativo')::uuid);
select is_empty('select * from public.pacientes', 'usuário inativo não vê pacientes');

-- 11. authenticated não insere em evolucoes
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$insert into public.evolucoes (internacao_id, categoria, autor_id) values ('33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid)$$,
  '42501', null,
  'authenticated não insere em evolucoes'
);

-- 12. authenticated não atualiza internacoes
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$update public.internacoes set leito_ala = 'X'$$,
  '42501', null,
  'authenticated não atualiza internacoes'
);

-- 13. trigger de auditoria grava insert em equipes
reset role;
select set_config('tst.aud_antes', (select count(*) from public.auditoria where tabela = 'equipes')::text, true);
insert into public.equipes (nome) values ('Equipe Teste');
select is(
  (select count(*) from public.auditoria where tabela = 'equipes'),
  current_setting('tst.aud_antes')::bigint + 1,
  'trigger de auditoria grava insert em equipes'
);

-- 14. auditoria lê acessos
reset role;
select tests.autenticar(current_setting('tst.auditor')::uuid);
select is((select count(*) from public.acessos), 1::bigint, 'auditoria lê acessos');

-- 15. médico não lê acessos
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select is_empty('select * from public.acessos', 'médico não lê acessos');

-- 16. view pública mostra nome de todos os profissionais ativos
select is(
  (select count(*) from public.vw_profissionais_publico
    where id::text = any (array[current_setting('tst.medico_a'), current_setting('tst.medico_b')])),
  2::bigint,
  'vw_profissionais_publico mostra todos os profissionais'
);

-- 17. profissionais expõe só o próprio registro
select is((select count(*) from public.profissionais), 1::bigint, 'profissionais: só o próprio registro');

select * from finish();
rollback;
