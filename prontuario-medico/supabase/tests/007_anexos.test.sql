begin;
select plan(34);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);

insert into public.equipes (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Clinica Medica');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '11111111-1111-1111-1111-111111111111');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('22222222-2222-2222-2222-222222222222', 'Paciente 1', '1950-01-01', 'SUS'),
  ('22222222-2222-2222-2222-222222222223', 'Paciente 2', '1960-01-01', 'SUS'),
  ('22222222-2222-2222-2222-222222222224', 'Paciente 3', '1970-01-01', 'SUS');

-- I1 com rascunho E1 (autor A); I2 com evolução finalizada F1 (autor A); I3 com rascunho G1 (autor A)
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala) values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'A-01'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'C-01'),
  ('12121212-1212-1212-1212-121212121212', '22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'E-01');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evolucao E1","conduta":"Conduta E1"}', '', null, null, null, null, null),
  ('66666666-6666-6666-6666-666666666666', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'medica', current_setting('tst.medico_a')::uuid, 'FINALIZADA', '{"evolucao_clinica":"Evolucao F1","conduta":"Conduta F1"}', 'Evolucao F1', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}'),
  ('13131313-1313-1313-1313-131313131313', '12121212-1212-1212-1212-121212121212', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evolucao G1","conduta":"Conduta G1"}', '', null, null, null, null, null);

-- anexos confirmados já existentes (inseridos como postgres)
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('99999999-9999-9999-9999-999999999991', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'LABORATORIO', 'Hemograma', (now() at time zone 'America/Sao_Paulo')::date, 'internacoes/33333333-3333-3333-3333-333333333333/99999999-9999-9999-9999-999999999991', 'application/pdf', 1000, repeat('a', 64), true, current_setting('tst.medico_a')::uuid),
  ('99999999-9999-9999-9999-999999999992', '66666666-6666-6666-6666-666666666666', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'IMAGEM', 'Raio-X', (now() at time zone 'America/Sao_Paulo')::date, 'internacoes/dddddddd-dddd-dddd-dddd-dddddddddddd/99999999-9999-9999-9999-999999999992', 'image/jpeg', 2000, repeat('b', 64), true, current_setting('tst.medico_a')::uuid);

-- 1. criar_anexo gera caminho por internação
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('tst.c1_id', c.id::text, true), set_config('tst.c1_path', c.storage_path, true)
  from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'LABORATORIO', 'Hemograma', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('c', 64)) c;
reset role;
select is(
  current_setting('tst.c1_path'),
  'internacoes/33333333-3333-3333-3333-333333333333/' || current_setting('tst.c1_id'),
  'criar_anexo gera caminho por internação'
);

-- 2. não autor não cria anexo
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('c', 64))$$,
  'P0001', 'Acesso negado.',
  'não autor não cria anexo'
);

-- 3. criar em evolução finalizada falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select * from public.criar_anexo('66666666-6666-6666-6666-666666666666', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('c', 64))$$,
  'P0001', 'Somente rascunhos podem receber anexos.',
  'criar em evolução finalizada falha'
);

-- 4. mime não permitido falha
select throws_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'image/gif', 1000, repeat('c', 64))$$,
  'P0001', 'Formato não suportado. Envie foto ou PDF.',
  'mime não permitido falha'
);

-- 5. tamanho acima de 20 MB falha
select throws_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 20971521, repeat('c', 64))$$,
  'P0001', 'Arquivo maior que 20 MB.',
  'tamanho acima de 20 MB falha'
);

-- 6. data do exame futura falha
select throws_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', '2999-01-01', 'application/pdf', 1000, repeat('c', 64))$$,
  'P0001', 'Data do exame não pode ser futura.',
  'data do exame futura falha'
);

-- 6b. limite de data em SP: hoje é aceita, amanhã é recusada
select lives_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('c', 64))$$,
  'data do exame hoje em SP é aceita'
);
select throws_ok(
  $$select * from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', ((now() at time zone 'America/Sao_Paulo')::date + 1), 'application/pdf', 1000, repeat('c', 64))$$,
  'P0001', 'Data do exame não pode ser futura.',
  'data do exame amanhã em SP é recusada'
);

-- 7. cliente não insere linha de anexo diretamente
select throws_ok(
  $$insert into public.anexos (evolucao_id, internacao_id, tipo, data_exame, storage_path, mime, tamanho_bytes, sha256, enviado_por)
    values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'OUTRO', (now() at time zone 'America/Sao_Paulo')::date, 'x', 'image/jpeg', 1, repeat('c', 64), current_setting('tst.medico_a')::uuid)$$,
  '42501', 'permission denied for table anexos',
  'cliente não insere anexo diretamente'
);

-- 8. confirmar sem objeto falha
select set_config('tst.sem_id', c.id::text, true)
  from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', '', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('d', 64)) c;
select throws_ok(
  $$select public.confirmar_anexo(current_setting('tst.sem_id')::uuid)$$,
  'P0001', 'Arquivo do anexo não foi recebido.',
  'confirmar sem objeto falha'
);

-- 9. upload em caminho sem anexo reservado é negado
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('anexos', 'internacoes/33333333-3333-3333-3333-333333333333/' || gen_random_uuid(), current_setting('tst.medico_a')::uuid, '{}')$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'upload em caminho sem anexo reservado é negado'
);

-- 10. upload com anexo reservado + confirmar
select set_config('tst.g1_id', c.id::text, true), set_config('tst.g1_path', c.storage_path, true)
  from public.criar_anexo('13131313-1313-1313-1313-131313131313', 'ECG', 'Eletro', (now() at time zone 'America/Sao_Paulo')::date, 'image/jpeg', 3000, repeat('e', 64)) c;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('anexos', current_setting('tst.g1_path'), current_setting('tst.medico_a')::uuid, '{}')$$,
  'upload com anexo reservado é aceito'
);
select lives_ok(
  $$select public.confirmar_anexo(current_setting('tst.g1_id')::uuid)$$,
  'confirmar com objeto é aceito'
);
reset role;
select is(
  (select confirmado from public.anexos where id = current_setting('tst.g1_id')::uuid),
  true,
  'confirmar com objeto marca confirmado'
);

-- 10b. outro médico não vê objeto de rascunho alheio nem envia no caminho reservado a outro
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'anexos' and name = current_setting('tst.g1_path')),
  0,
  'outro médico não vê objeto de rascunho alheio'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('anexos', current_setting('tst.g1_path'), current_setting('tst.medico_b')::uuid, '{}')$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'outro médico não envia objeto em caminho reservado a outro'
);

-- 11. recepção não lê anexos
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is((select count(*)::int from public.anexos), 0, 'recepção não lê anexos');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'anexos'),
  0,
  'recepção não lê objetos de anexos'
);

-- 12. outro médico não vê anexo de rascunho alheio
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select is(
  (select count(*)::int from public.anexos where evolucao_id = '44444444-4444-4444-4444-444444444444'),
  0,
  'outro médico não vê anexo de rascunho alheio'
);

-- 13. outro médico vê anexo de evolução finalizada
select is(
  (select count(*)::int from public.anexos where evolucao_id = '66666666-6666-6666-6666-666666666666'),
  1,
  'outro médico vê anexo de evolução finalizada'
);

-- 14. autor vê anexo confirmado do próprio rascunho
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select is(
  (select count(*)::int from public.anexos where evolucao_id = '44444444-4444-4444-4444-444444444444'),
  1,
  'autor vê anexo confirmado do próprio rascunho'
);

-- 14b. storage de anexo finalizado: upload no caminho é negado ao autor; outro médico vê o objeto
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('anexos', 'internacoes/dddddddd-dddd-dddd-dddd-dddddddddddd/99999999-9999-9999-9999-999999999992', current_setting('tst.medico_a')::uuid, '{}')$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'upload no caminho de anexo finalizado é negado'
);
reset role;
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('anexos', 'internacoes/dddddddd-dddd-dddd-dddd-dddddddddddd/99999999-9999-9999-9999-999999999992', current_setting('tst.medico_a')::uuid, '{}');
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'anexos' and name = 'internacoes/dddddddd-dddd-dddd-dddd-dddddddddddd/99999999-9999-9999-9999-999999999992'),
  1,
  'outro médico vê objeto de anexo finalizado'
);

-- 15. update direto em anexo de evolução finalizada é bloqueado (trigger)
reset role;
select throws_ok(
  $$update public.anexos set descricao = 'x' where id = '99999999-9999-9999-9999-999999999992'$$,
  'P0001', 'Anexo de evolução finalizada não pode ser alterado.',
  'update em anexo de evolução finalizada é bloqueado'
);

-- 16. remover_anexo em rascunho apaga a linha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('tst.rm_id', c.id::text, true)
  from public.criar_anexo('44444444-4444-4444-4444-444444444444', 'OUTRO', 'Remover', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('f', 64)) c;
select lives_ok(
  $$select public.remover_anexo(current_setting('tst.rm_id')::uuid)$$,
  'remover anexo de rascunho é aceito'
);
reset role;
select is(
  (select count(*)::int from public.anexos where id = current_setting('tst.rm_id')::uuid),
  0,
  'remover_anexo apaga a linha do rascunho'
);

-- 17. remover_anexo após finalizar falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.remover_anexo('99999999-9999-9999-9999-999999999992')$$,
  'P0001', 'Anexo de evolução finalizada não pode ser alterado.',
  'remover_anexo após finalizar falha'
);

-- 18a. controle positivo: antes de finalizar, o autor apaga o objeto do próprio rascunho.
-- storage.protect_delete bloqueia DELETE direto por padrão; liga a flag para testar só a RLS.
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('storage.allow_delete_query', 'true', true);
select set_config('tst.x_path', c.storage_path, true)
  from public.criar_anexo('13131313-1313-1313-1313-131313131313', 'OUTRO', 'Controle', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('9', 64)) c;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata)
    values ('anexos', current_setting('tst.x_path'), current_setting('tst.medico_a')::uuid, '{}')$$,
  'upload do controle em rascunho é aceito'
);
with d as (
  delete from storage.objects
  where bucket_id = 'anexos' and name = current_setting('tst.x_path')
  returning 1
)
select is((select count(*)::int from d), 1, 'autor apaga objeto do próprio rascunho antes de finalizar (controle)');

-- 18b. após finalizar, o mesmo DELETE não remove nada
select lives_ok(
  $$select public.finalizar_evolucao('13131313-1313-1313-1313-131313131313')$$,
  'finalizar evolução com anexo confirmado é aceito'
);
with d as (
  delete from storage.objects
  where bucket_id = 'anexos' and name = current_setting('tst.g1_path')
  returning 1
)
select is((select count(*)::int from d), 0, 'autor não apaga objeto após finalizar');
reset role;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'anexos' and name = current_setting('tst.g1_path')),
  1,
  'objeto continua no bucket após finalizar'
);

-- 19. bucket privado com limite e MIME
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'anexos'
      and public = false
      and file_size_limit = 20971520
      and cardinality(allowed_mime_types) = 4
      and allowed_mime_types @> array['image/jpeg','image/png','image/webp','application/pdf']::text[]
  ),
  'bucket anexos privado com limite de 20 MB e MIME permitidos'
);

-- 20. RLS ligado em anexos
select ok(
  (select relrowsecurity from pg_class where oid = 'public.anexos'::regclass),
  'RLS ligado em anexos'
);

select * from finish();
rollback;
