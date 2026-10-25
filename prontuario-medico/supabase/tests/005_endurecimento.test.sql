begin;
select plan(17);

-- setup como postgres (transaction-local)
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);

insert into public.equipes (id, nome) values ('51515151-5151-5151-5151-515151515151', 'Equipe 005');
insert into public.pacientes (id, nome, data_nascimento, convenio)
  values ('52525252-5252-5252-5252-525252525252', 'Paciente 005', '1950-01-01', 'SUS');
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
  values ('53535353-5353-5353-5353-535353535353', '52525252-5252-5252-5252-525252525252',
          '51515151-5151-5151-5151-515151515151', current_setting('tst.medico')::uuid, 'Z-01');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em) values
  ('54545454-5454-5454-5454-545454545451', '53535353-5353-5353-5353-535353535353', 'medica', current_setting('tst.medico')::uuid,
   'FINALIZADA', '{"evolucao_clinica":"ok","conduta":"ok"}', '', now(), current_setting('tst.medico')::uuid, now()),
  ('54545454-5454-5454-5454-545454545452', '53535353-5353-5353-5353-535353535353', 'medica', current_setting('tst.medico')::uuid,
   'RASCUNHO', '{}', 'rascunho 005', null, null, null);

-- 1. impressão com chave: primeira chamada numera via 1
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select is(
  (select r.via from public.registrar_impressoes(array['54545454-5454-5454-5454-545454545451']::uuid[], '55555555-5555-5555-5555-555555555501'::uuid) r),
  1,
  'chave nova numera via 1'
);

-- 2. mesma chave de novo: devolve a mesma via
select is(
  (select r.via from public.registrar_impressoes(array['54545454-5454-5454-5454-545454545451']::uuid[], '55555555-5555-5555-5555-555555555501'::uuid) r),
  1,
  'mesma chave devolve a via já registrada'
);

-- 3. mesma chave não gera nova linha
reset role;
select is(
  (select count(*)::int from public.impressoes where evolucao_id = '54545454-5454-5454-5454-545454545451'),
  1,
  'mesma chave não grava segunda linha'
);
select is(
  (select count(*)::int from public.impressoes where chave = '55555555-5555-5555-5555-555555555501'),
  1,
  'a chave fica gravada na linha da via 1'
);

-- 4. chave diferente numera via 2
select tests.autenticar(current_setting('tst.medico')::uuid);
select is(
  (select r.via from public.registrar_impressoes(array['54545454-5454-5454-5454-545454545451']::uuid[], '55555555-5555-5555-5555-555555555502'::uuid) r),
  2,
  'chave diferente numera via 2'
);

-- 5. sem chave é não idempotente (via 3)
select is(
  (select r.via from public.registrar_impressoes(array['54545454-5454-5454-5454-545454545451']::uuid[]) r),
  3,
  'sem chave cada chamada numera uma via nova'
);

-- 6. finalizar exige evolução clínica e conduta (rascunho com dados vazios)
select throws_ok(
  $$select public.finalizar_evolucao('54545454-5454-5454-5454-545454545452')$$,
  'P0001', 'Preencha a evolução clínica e a conduta antes de finalizar.',
  'finalizar sem campos obrigatórios falha'
);

-- 7. conduta só com espaços continua falhando
reset role;
update public.evolucoes set dados = '{"evolucao_clinica":"Evolução","conduta":"   "}'::jsonb
  where id = '54545454-5454-5454-5454-545454545452';
select tests.autenticar(current_setting('tst.medico')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('54545454-5454-5454-5454-545454545452')$$,
  'P0001', 'Preencha a evolução clínica e a conduta antes de finalizar.',
  'conduta só com espaços falha'
);

-- 8. com os dois campos preenchidos finaliza
reset role;
update public.evolucoes set dados = '{"evolucao_clinica":"Evolução","conduta":"Conduta"}'::jsonb
  where id = '54545454-5454-5454-5454-545454545452';
select tests.autenticar(current_setting('tst.medico')::uuid);
select isnt(public.finalizar_evolucao('54545454-5454-5454-5454-545454545452'), null, 'finaliza com campos obrigatórios');

-- 9. auditoria: edição de rascunho não gera linha; inserção gera
reset role;
select set_config('tst.aud_antes', (select count(*)::text from public.auditoria where registro_id = '54545454-5454-5454-5454-545454545451'), true);
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('54545454-5454-5454-5454-545454545453', '53535353-5353-5353-5353-535353535353', 'medica', current_setting('tst.medico')::uuid, 'RASCUNHO', '{}', '');
select is(
  (select count(*)::int from public.auditoria where registro_id = '54545454-5454-5454-5454-545454545453' and operacao = 'INSERT'),
  1,
  'inserção de evolução continua auditada'
);
update public.evolucoes set texto_livre = 'editado' where id = '54545454-5454-5454-5454-545454545453';
select is(
  (select count(*)::int from public.auditoria where registro_id = '54545454-5454-5454-5454-545454545453' and operacao = 'UPDATE'),
  0,
  'UPDATE rascunho -> rascunho não é auditado'
);
update public.evolucoes set status = 'FINALIZADA', finalizada_em = now(), validada_em = now(), validada_por = current_setting('tst.medico')::uuid
  where id = '54545454-5454-5454-5454-545454545453';
select is(
  (select count(*)::int from public.auditoria where registro_id = '54545454-5454-5454-5454-545454545453' and operacao = 'UPDATE'),
  1,
  'UPDATE que muda o status continua auditado'
);

-- 10. privilégios padrão: objetos novos não dão TRUNCATE/REFERENCES/TRIGGER a authenticated
create table public.tst_acl_005 (id integer);
create function public.tst_fn_005() returns integer language sql as $$ select 1 $$;
select ok(not has_table_privilege('authenticated', 'public.tst_acl_005', 'TRUNCATE'), 'tabela nova: authenticated sem TRUNCATE');
select ok(not has_table_privilege('authenticated', 'public.tst_acl_005', 'REFERENCES'), 'tabela nova: authenticated sem REFERENCES');
select ok(not has_table_privilege('authenticated', 'public.tst_acl_005', 'TRIGGER'), 'tabela nova: authenticated sem TRIGGER');
create function public.tst_fn_acl_005() returns integer language sql as $$ select 1 $$;
select ok(
  not has_function_privilege('anon', 'public.tst_fn_acl_005()', 'execute'),
  'função nova em public: anon sem EXECUTE'
);
select ok(
  not has_table_privilege('authenticated', 'public.vw_internacoes_lista', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.vw_evolucoes_timeline', 'TRUNCATE'),
  'views de leitura: authenticated sem TRUNCATE'
);

select * from finish();
rollback;
