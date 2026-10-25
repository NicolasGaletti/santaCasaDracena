begin;
select plan(24);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.residente_outro', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.multi', tests.criar_profissional('multiprofissional', true, 'fisioterapia')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao', false)::text, true);

insert into public.equipes (id, nome) values
  ('79900000-0000-0000-0000-000000000001', 'Equipe A'),
  ('79900000-0000-0000-0000-000000000002', 'Equipe B');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '79900000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente')::uuid, '79900000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente_outro')::uuid, '79900000-0000-0000-0000-000000000001'),
  (current_setting('tst.multi')::uuid, '79900000-0000-0000-0000-000000000001'),
  (current_setting('tst.medico_b')::uuid, '79900000-0000-0000-0000-000000000002');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('77700000-0000-0000-0000-000000000001', 'Paciente anexo 1', '1950-01-01', 'SUS'),
  ('77700000-0000-0000-0000-000000000002', 'Paciente anexo 2', '1950-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala) values
  ('78800000-0000-0000-0000-000000000001', '77700000-0000-0000-0000-000000000001', '79900000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'AN-1'),
  ('78800000-0000-0000-0000-000000000002', '77700000-0000-0000-0000-000000000002', '79900000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'AN-2');

-- E1 (devolvida) e E2 (validada): aguardando validação, autor residente
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, enviada_em) values
  ('7aa00000-0000-0000-0000-000000000001', '78800000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('7aa00000-0000-0000-0000-000000000002', '78800000-0000-0000-0000-000000000002', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now());

-- X1 e X2 confirmados; X3 não confirmado (enviado pelo residente, ainda em envio)
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('7bb00000-0000-0000-0000-000000000001', '7aa00000-0000-0000-0000-000000000001', '78800000-0000-0000-0000-000000000001', 'OUTRO', 'Confirmado 1', '2026-10-24', 'internacoes/78800000-0000-0000-0000-000000000001/x1.jpg', 'image/jpeg', 1000, repeat('1', 64), true, current_setting('tst.residente')::uuid),
  ('7bb00000-0000-0000-0000-000000000002', '7aa00000-0000-0000-0000-000000000002', '78800000-0000-0000-0000-000000000002', 'OUTRO', 'Confirmado 2', '2026-10-24', 'internacoes/78800000-0000-0000-0000-000000000002/x2.jpg', 'image/jpeg', 1000, repeat('2', 64), true, current_setting('tst.residente')::uuid),
  ('7bb00000-0000-0000-0000-000000000003', '7aa00000-0000-0000-0000-000000000001', '78800000-0000-0000-0000-000000000001', 'OUTRO', 'Não confirmado', '2026-10-24', 'internacoes/78800000-0000-0000-0000-000000000001/x3.jpg', 'image/jpeg', 1000, repeat('3', 64), false, current_setting('tst.residente')::uuid);

-- objetos no bucket: validar exige arquivo para cada anexo confirmado
insert into storage.objects (bucket_id, name) values
  ('anexos', 'internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  ('anexos', 'internacoes/78800000-0000-0000-0000-000000000002/x2.jpg');

-- ===== leitura de anexo de evolução aguardando validação =====

reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  1,
  'médico da equipe vê anexo confirmado de evolução aguardando validação'
);
select ok(
  app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'médico da equipe lê o arquivo do anexo (storage)'
);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000002'),
  1,
  'médico da equipe vê o anexo da segunda evolução'
);
select ok(
  app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000002/x2.jpg'),
  'médico da equipe lê o arquivo da segunda evolução (storage)'
);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000003'),
  0,
  'anexo não confirmado não aparece ao médico revisor'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x3.jpg'),
  'anexo não confirmado não é lido pelo storage pelo médico revisor'
);

reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  1,
  'autor continua vendo o anexo da própria evolução aguardando validação'
);

-- ===== negativos =====

reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  0,
  'médico de outra equipe não vê anexo de evolução aguardando validação'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'médico de outra equipe não lê o arquivo (storage)'
);

reset role;
select tests.autenticar(current_setting('tst.residente_outro')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  0,
  'residente que não é autor não vê anexo de evolução aguardando validação'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'residente que não é autor não lê o arquivo (storage)'
);

reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  0,
  'multiprofissional da equipe não vê anexo de evolução aguardando validação'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'multiprofissional não lê o arquivo (storage)'
);

reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  0,
  'recepção não vê anexo de evolução aguardando validação'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'recepção não lê o arquivo (storage)'
);

reset role;
select ok(
  not has_function_privilege('anon', 'app.anexo_pode_ler(text)', 'EXECUTE'),
  'anon não executa app.anexo_pode_ler'
);

-- ===== devolução e validação mudam o acesso =====

reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.devolver_evolucao('7aa00000-0000-0000-0000-000000000001', 'Ajustar a conduta')$$,
  'médico devolve a evolução ao autor'
);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000001'),
  0,
  'após devolver (rascunho), o médico deixa de ver o anexo'
);
select ok(
  not app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'após devolver, o médico deixa de ler o arquivo (storage)'
);

reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select ok(
  app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000001/x1.jpg'),
  'após devolver, o autor continua lendo o arquivo'
);

reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.validar_evolucao('7aa00000-0000-0000-0000-000000000002')$$,
  'médico valida a evolução'
);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000002'),
  1,
  'após validar (finalizada), o médico continua vendo o anexo'
);
select ok(
  app.anexo_pode_ler('internacoes/78800000-0000-0000-0000-000000000002/x2.jpg'),
  'após validar, o médico continua lendo o arquivo'
);

reset role;
select tests.autenticar(current_setting('tst.residente_outro')::uuid);
select is(
  (select count(*)::int from public.anexos where id = '7bb00000-0000-0000-0000-000000000002'),
  1,
  'após validar, qualquer clínico da internação lê o anexo da evolução finalizada'
);

reset role;
select * from finish();
rollback;
