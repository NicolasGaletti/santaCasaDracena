begin;
select plan(20);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);

insert into public.equipes (id, nome) values
  ('10000000-0000-0000-0000-000000000001', 'Clinica Medica');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '10000000-0000-0000-0000-000000000001');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('20000000-0000-0000-0000-000000000001', 'Paciente 1', '1950-01-01', 'SUS'),
  ('20000000-0000-0000-0000-000000000002', 'Paciente 2', '1960-01-01', 'SUS'),
  ('20000000-0000-0000-0000-000000000003', 'Paciente 3', '1970-01-01', 'SUS'),
  ('20000000-0000-0000-0000-000000000004', 'Paciente 4', '1980-01-01', 'SUS'),
  ('20000000-0000-0000-0000-000000000005', 'Paciente 5', '1990-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'A-01'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'B-01'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'C-01'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'D-01'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, 'E-01');

-- R1..R4: rascunhos do médico A. F1: finalizada antiga (hash_versao default = 1).
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evo R1","conduta":"Cond R1"}', 'Texto R1', null, null, null, null, null, null),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evo R2","conduta":"Cond R2"}', 'Texto R2', null, null, null, null, null, null),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evo R3","conduta":"Cond R3"}', 'Texto R3', null, null, null, null, null, null),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"evolucao_clinica":"Evo R4","conduta":"Cond R4"}', 'Texto R4', null, null, null, null, null, null),
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', 'medica', current_setting('tst.medico_a')::uuid, 'FINALIZADA', '{"evolucao_clinica":"Evo F1","conduta":"Cond F1"}', 'Texto F1', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64));

-- anexos (inseridos como postgres)
-- R2: um confirmado e um não confirmado (para descartar)
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('50000000-0000-0000-0000-000000000021', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'LABORATORIO', 'Hemograma', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000021', 'application/pdf', 1000, repeat('1', 64), true, current_setting('tst.medico_a')::uuid),
  ('50000000-0000-0000-0000-000000000022', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'OUTRO', 'Pendente', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000002/50000000-0000-0000-0000-000000000022', 'image/jpeg', 1000, repeat('2', 64), false, current_setting('tst.medico_a')::uuid);

-- R3: dois confirmados com objeto (ids fora de ordem de inserção) e um não confirmado sem objeto
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('ff000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'IMAGEM', 'Raio-X', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000003/ff000000-0000-0000-0000-000000000001', 'image/jpeg', 2000, repeat('b', 64), true, current_setting('tst.medico_a')::uuid),
  ('0a000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'ECG', 'Eletro', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000003/0a000000-0000-0000-0000-000000000001', 'application/pdf', 3000, repeat('a', 64), true, current_setting('tst.medico_a')::uuid),
  ('0b000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'OUTRO', 'Metade', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000003/0b000000-0000-0000-0000-000000000001', 'application/pdf', 4000, repeat('c', 64), false, current_setting('tst.medico_a')::uuid);

insert into storage.objects (bucket_id, name, owner, metadata) values
  ('anexos', 'internacoes/30000000-0000-0000-0000-000000000003/ff000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, '{}'),
  ('anexos', 'internacoes/30000000-0000-0000-0000-000000000003/0a000000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid, '{}');

-- R4: confirmado SEM objeto (estado inconsistente)
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('50000000-0000-0000-0000-000000000041', '40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'OUTRO', 'Sem arquivo', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000004/50000000-0000-0000-0000-000000000041', 'application/pdf', 1000, repeat('4', 64), true, current_setting('tst.medico_a')::uuid);

-- F1: anexo confirmado de evolução finalizada
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('50000000-0000-0000-0000-000000000091', '40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', 'ECG', 'Final', '2026-10-24', 'internacoes/30000000-0000-0000-0000-000000000005/50000000-0000-0000-0000-000000000091', 'application/pdf', 1000, repeat('9', 64), true, current_setting('tst.medico_a')::uuid);

-- 1. descartar rascunho com anexos funciona (confirmados e não confirmados)
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.descartar_rascunho('40000000-0000-0000-0000-000000000002')$$,
  'descartar rascunho com anexos funciona'
);
reset role;
select is(
  (select count(*)::int from public.evolucoes where id = '40000000-0000-0000-0000-000000000002'),
  0,
  'descartar apaga a evolução'
);
select is(
  (select count(*)::int from public.anexos where evolucao_id = '40000000-0000-0000-0000-000000000002'),
  0,
  'descartar apaga todos os anexos da evolução'
);

-- 2. descartar de evolução finalizada continua negado
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.descartar_rascunho('40000000-0000-0000-0000-000000000009')$$,
  'P0001', 'Somente rascunhos podem ser descartados.',
  'descartar evolução finalizada falha'
);

-- 3. flag de descarte não libera anexo de evolução finalizada (trigger)
reset role;
select set_config('app.descartando', 'on', true);
select throws_ok(
  $$delete from public.anexos where id = '50000000-0000-0000-0000-000000000091'$$,
  'P0001', 'Anexo de evolução finalizada não pode ser alterado.',
  'flag de descarte não libera anexo finalizado'
);
select set_config('app.descartando', 'off', true);

-- 4. descrição: 500 caracteres passa, 501 falha
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select * from public.criar_anexo('40000000-0000-0000-0000-000000000001', 'OUTRO', repeat('x', 500), (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('d', 64))$$,
  'descrição com 500 caracteres é aceita'
);
select throws_ok(
  $$select * from public.criar_anexo('40000000-0000-0000-0000-000000000001', 'OUTRO', repeat('x', 501), (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('e', 64))$$,
  '23514', 'new row for relation "anexos" violates check constraint "anexos_descricao_tamanho"',
  'descrição acima de 500 falha'
);

-- 5. finalizar com anexo confirmado sem objeto falha e não muda o status
select throws_ok(
  $$select public.finalizar_evolucao('40000000-0000-0000-0000-000000000004')$$,
  'P0001', 'Um anexo confirmado está sem arquivo. Remova-o e envie de novo.',
  'finalizar com anexo confirmado sem objeto falha'
);
reset role;
select is(
  (select status::text from public.evolucoes where id = '40000000-0000-0000-0000-000000000004'),
  'RASCUNHO',
  'evolução com anexo sem objeto continua rascunho'
);

-- 6. confirmar com objeto em rascunho funciona (trava de status ativa)
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('tst.c1_id', c.id::text, true), set_config('tst.c1_path', c.storage_path, true)
  from public.criar_anexo('40000000-0000-0000-0000-000000000001', 'LABORATORIO', 'Novo', (now() at time zone 'America/Sao_Paulo')::date, 'application/pdf', 1000, repeat('7', 64)) c;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner, metadata) values ('anexos', current_setting('tst.c1_path'), current_setting('tst.medico_a')::uuid, '{}')$$,
  'upload do anexo de rascunho é aceito'
);
select lives_ok(
  $$select public.confirmar_anexo(current_setting('tst.c1_id')::uuid)$$,
  'confirmar anexo com objeto em rascunho funciona'
);

-- 7. finalizar grava hash_versao 2 (R3: dois confirmados com objeto, um não confirmado)
select lives_ok(
  $$select public.finalizar_evolucao('40000000-0000-0000-0000-000000000003')$$,
  'finalizar com anexos confirmados com objeto funciona'
);
reset role;
select is(
  (select hash_versao from public.evolucoes where id = '40000000-0000-0000-0000-000000000003'),
  2,
  'finalizar grava hash_versao 2'
);

-- 8. hash v2 inclui sha256 dos anexos confirmados em ordem de id
select ok(
  exists (
    select 1 from public.evolucoes ev
    where ev.id = '40000000-0000-0000-0000-000000000003'
      and ev.conteudo_hash = encode(extensions.digest(
        jsonb_build_object(
          'v', 2,
          'dados', ev.dados, 'texto', ev.texto_livre, 'internacao', ev.internacao_id,
          'autor', ev.autor_id,
          'finalizada_em', to_char(ev.finalizada_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'anexos', coalesce((
            select jsonb_agg(a.sha256 order by a.id) from public.anexos a
            where a.evolucao_id = ev.id and a.confirmado
          ), '[]'::jsonb)
        )::text, 'sha256'), 'hex')
  ),
  'hash v2 inclui sha256 dos anexos em ordem de id'
);

-- 9. finalizar remove anexos não confirmados (linha) e mantém objetos dos confirmados
select is(
  (select count(*)::int from public.anexos where id = '0b000000-0000-0000-0000-000000000001'),
  0,
  'finalizar remove anexos não confirmados'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'anexos' and name like 'internacoes/30000000-0000-0000-0000-000000000003/%'),
  2,
  'finalizar não apaga objetos dos anexos confirmados'
);

-- 10. evoluções antigas mantêm hash_versao 1
select is(
  (select hash_versao from public.evolucoes where id = '40000000-0000-0000-0000-000000000009'),
  1,
  'evoluções antigas mantêm hash_versao 1'
);

-- 11. timeline expõe hash_versao e qtd_anexos
select has_column('public', 'vw_evolucoes_timeline', 'hash_versao', 'timeline expõe hash_versao');
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select is(
  (select qtd_anexos from public.vw_evolucoes_timeline where id = '40000000-0000-0000-0000-000000000003'),
  2,
  'timeline expõe qtd_anexos'
);

-- 12. confirmar em evolução finalizada falha (trava)
select throws_ok(
  $$select public.confirmar_anexo('0a000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Somente rascunhos podem receber anexos.',
  'confirmar trava evolução finalizada'
);

select * from finish();
rollback;
