begin;
select plan(7);

-- setup como postgres (transaction-local)
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);

insert into public.equipes (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Clinica');
insert into public.pacientes (id, nome, data_nascimento, convenio)
  values ('22222222-2222-2222-2222-222222222222', 'Paciente Lote', '1950-01-01', 'SUS');
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
  values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
          '11111111-1111-1111-1111-111111111111', current_setting('tst.medico')::uuid, 'L-01');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, finalizada_em, validada_por, validada_em) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico')::uuid, 'FINALIZADA', now(), current_setting('tst.medico')::uuid, now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico')::uuid, 'FINALIZADA', now(), current_setting('tst.medico')::uuid, now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico')::uuid, 'FINALIZADA', now(), current_setting('tst.medico')::uuid, now()),
  ('aaaaaaaa-0000-0000-0000-0000000000ff', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico')::uuid, 'RASCUNHO', null, null, null);

-- 1. primeira impressão em lote numera via 1 para cada evolução
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select is(
  (select count(*)::int from public.registrar_impressoes(array['aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002']::uuid[]) r where r.via = 1),
  2,
  'lote: cada evolução recebe via 1 na primeira impressão'
);

-- 2. segunda impressão de uma evolução numera via 2
select is(
  (select r.via from public.registrar_impressoes(array['aaaaaaaa-0000-0000-0000-000000000001']::uuid[]) r),
  2,
  'lote: segunda impressão numera via 2'
);

-- 3. lote com rascunho falha e não grava nada para as outras evoluções
select throws_ok(
  $$select * from public.registrar_impressoes(array['aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000ff']::uuid[])$$,
  'P0001', 'Somente evoluções finalizadas podem ser impressas.',
  'lote com rascunho falha'
);
select is(
  (select count(*)::int from public.impressoes where evolucao_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0,
  'lote com rascunho não grava vias das outras evoluções'
);

-- 4. lote com id inexistente falha
select throws_ok(
  $$select * from public.registrar_impressoes(array['aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000000']::uuid[])$$,
  'P0001', 'Evolução não encontrada.',
  'lote com id inexistente falha'
);
select is(
  (select count(*)::int from public.impressoes where evolucao_id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  0,
  'lote com id inexistente não grava nada'
);

-- 5. recepção não imprime
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select * from public.registrar_impressoes(array['aaaaaaaa-0000-0000-0000-000000000003']::uuid[])$$,
  'P0001', 'Acesso negado.',
  'recepção não registra impressão em lote'
);

select * from finish();
rollback;
