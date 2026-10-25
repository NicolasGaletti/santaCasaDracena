begin;
select plan(23);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_sem_conselho', tests.criar_profissional('medico', false)::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.residente_outra', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.multi', tests.criar_profissional('multiprofissional', true, 'fisioterapia')::text, true);
select set_config('tst.multi_sem_categoria', tests.criar_profissional('multiprofissional')::text, true);

insert into public.equipes (id, nome) values
  ('11111111-1111-1111-1111-111111111111', 'Clinica Medica'),
  ('77777777-7777-7777-7777-777777777777', 'Outra Equipe');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '11111111-1111-1111-1111-111111111111'),
  (current_setting('tst.residente')::uuid, '11111111-1111-1111-1111-111111111111'),
  (current_setting('tst.multi')::uuid, '11111111-1111-1111-1111-111111111111'),
  (current_setting('tst.residente_outra')::uuid, '77777777-7777-7777-7777-777777777777');

insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('22222222-2222-2222-2222-222222222222', 'Paciente Teste', '1950-01-01', 'SUS'),
  ('22222222-2222-2222-2222-222222222223', 'Paciente Dois', '1960-01-01', 'SUS'),
  ('22222222-2222-2222-2222-222222222224', 'Paciente Alta', '1970-01-01', 'SUS');

-- internações: 3333 INTERNADO, dddd INTERNADO (sem rascunhos), eeee ALTA
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, status, alta_em, alta_por, motivo_alta)
values
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'A-01', 'INTERNADO', null, null, null),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'C-01', 'INTERNADO', null, null, null),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', current_setting('tst.medico_a')::uuid, 'D-01', 'ALTA', now(), current_setting('tst.medico_a')::uuid, 'Melhora');

insert into public.internacoes_clinico (internacao_id, diagnostico_inicial, comorbidades, muc) values
  ('33333333-3333-3333-3333-333333333333', 'Pneumonia', '', 'MUC-1');

insert into public.leitos_historico (internacao_id, leito_ala, por) values
  ('33333333-3333-3333-3333-333333333333', 'A-01', current_setting('tst.medico_a')::uuid),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'C-01', current_setting('tst.medico_a')::uuid),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'D-01', current_setting('tst.medico_a')::uuid);

-- evoluções
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador) values
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', 'Rascunho A', null, null, null, null, null),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_b')::uuid, 'RASCUNHO', 'Rascunho B', null, null, null, null, null),
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_a')::uuid, 'FINALIZADA', 'Evolucao finalizada', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}'::jsonb, '{"nome":"x"}'::jsonb),
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', 'Rascunho residente', null, null, null, null, null),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'medica', current_setting('tst.medico_sem_conselho')::uuid, 'RASCUNHO', 'Rascunho sem conselho', null, null, null, null, null);

-- 1. admitir cria paciente e internação INTERNADO
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select set_config('tst.admitido', public.admitir_paciente(
  'Paciente Novo', '1980-05-10', 'Unimed', '11111111-1111-1111-1111-111111111111', 'B-01',
  'Pneumonia', '   ', 'MUC-9', current_setting('tst.medico_a')::uuid
)::text, true);
reset role;
select ok(
  exists (select 1 from public.pacientes where nome = 'Paciente Novo')
  and exists (select 1 from public.internacoes where id = current_setting('tst.admitido')::uuid and status = 'INTERNADO')
  and exists (
    select 1 from public.internacoes_clinico
    where internacao_id = current_setting('tst.admitido')::uuid
      and diagnostico_inicial = 'Pneumonia' and comorbidades is null and muc = 'MUC-9'
  )
  and exists (
    select 1 from public.leitos_historico
    where internacao_id = current_setting('tst.admitido')::uuid and leito_ala = 'B-01' and ate is null
  ),
  'admitir cria paciente e internação INTERNADO'
);

-- 2. admitir com nascimento futuro falha
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select public.admitir_paciente('Paciente Futuro', '2999-01-01', 'SUS', '11111111-1111-1111-1111-111111111111', 'B-02', null, null, null, current_setting('tst.medico_a')::uuid)$$,
  'P0001', 'Data de nascimento não pode ser futura.',
  'admitir com nascimento futuro falha'
);

-- 3. multiprofissional não admite
reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select throws_ok(
  $$select public.admitir_paciente('Paciente Multi', '1980-01-01', 'SUS', '11111111-1111-1111-1111-111111111111', 'B-03', null, null, null, current_setting('tst.medico_a')::uuid)$$,
  'P0001', 'Acesso negado.',
  'multiprofissional não admite'
);

-- 4. trocar_leito vazio falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.trocar_leito('33333333-3333-3333-3333-333333333333', '   ')$$,
  'P0001', 'Informe o leito.',
  'trocar_leito vazio falha'
);

-- 5. trocar_leito grava histórico
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select public.trocar_leito('33333333-3333-3333-3333-333333333333', 'B-02');
reset role;
select ok(
  (select count(*) from public.leitos_historico where internacao_id = '33333333-3333-3333-3333-333333333333') = 2
  and exists (
    select 1 from public.leitos_historico
    where internacao_id = '33333333-3333-3333-3333-333333333333' and leito_ala = 'A-01' and ate is not null
  )
  and exists (
    select 1 from public.leitos_historico
    where internacao_id = '33333333-3333-3333-3333-333333333333' and leito_ala = 'B-02' and ate is null
  ),
  'trocar_leito grava histórico'
);

-- 6. trocar_leito em internação com alta falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.trocar_leito('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'X-01')$$,
  'P0001', 'Internação com alta não pode trocar de leito.',
  'trocar_leito em internação com alta falha'
);

-- 7. salvar_rascunho duas vezes mantém uma linha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select public.salvar_rascunho('dddddddd-dddd-dddd-dddd-dddddddddddd', '{"v":1}'::jsonb, 'primeiro');
select public.salvar_rascunho('dddddddd-dddd-dddd-dddd-dddddddddddd', '{"v":2}'::jsonb, 'segundo');
reset role;
select ok(
  (select count(*) from public.evolucoes
    where internacao_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      and autor_id = current_setting('tst.medico_a')::uuid and status = 'RASCUNHO') = 1
  and (select dados from public.evolucoes
    where internacao_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
      and autor_id = current_setting('tst.medico_a')::uuid and status = 'RASCUNHO') = '{"v":2}'::jsonb,
  'salvar_rascunho duas vezes mantém uma linha'
);

-- 8. salvar_rascunho em internação com alta falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.salvar_rascunho('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '{}'::jsonb, 'x')$$,
  'P0001', 'Internação com alta não permite novas evoluções.',
  'salvar_rascunho em internação com alta falha'
);

-- 9. finalizar sem conselho falha
reset role;
select tests.autenticar(current_setting('tst.medico_sem_conselho')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$,
  'P0001', 'Complete seu registro profissional antes de finalizar.',
  'finalizar sem conselho falha'
);

-- 10. finalizar grava snapshot, hash e finalizada_em
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('tst.fin_em', public.finalizar_evolucao('44444444-4444-4444-4444-444444444444')::text, true);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44444444-4444-4444-4444-444444444444'
      and status = 'FINALIZADA'
      and finalizada_em = current_setting('tst.fin_em')::timestamptz
      and validada_em = finalizada_em
      and validada_por = current_setting('tst.medico_a')::uuid
      and snapshot_autor = snapshot_validador
      and snapshot_autor->>'nome' = 'Teste medico'
      and snapshot_autor->>'conselho' = 'CRM'
      and snapshot_autor->>'numero' = '123456'
      and snapshot_autor->>'uf' = 'SP'
      and conteudo_hash = encode(extensions.digest(
        jsonb_build_object(
          'dados', dados, 'texto', texto_livre, 'internacao', internacao_id,
          'autor', autor_id,
          'finalizada_em', to_char(finalizada_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )::text, 'sha256'), 'hex')
  ),
  'finalizar grava snapshot, hash e finalizada_em'
);

-- 10b. hash independe do fuso horário da sessão
set local timezone = 'Asia/Tokyo';
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44444444-4444-4444-4444-444444444444'
      and conteudo_hash = encode(extensions.digest(
        jsonb_build_object(
          'dados', dados, 'texto', texto_livre, 'internacao', internacao_id,
          'autor', autor_id,
          'finalizada_em', to_char(finalizada_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
        )::text, 'sha256'), 'hex')
  ),
  'hash independe do fuso horário da sessão'
);
set local timezone = 'UTC';

-- 11. finalizar duas vezes falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('44444444-4444-4444-4444-444444444444')$$,
  'P0001', 'Evolução finalizada não pode ser alterada.',
  'finalizar duas vezes falha'
);

-- 12. UPDATE direto em finalizada falha, inclusive como postgres
reset role;
select throws_ok(
  $$update public.evolucoes set texto_livre = 'x' where id = '66666666-6666-6666-6666-666666666666'$$,
  'P0001', 'Evolução finalizada não pode ser alterada.',
  'UPDATE direto em finalizada falha, inclusive como postgres'
);

-- 13. DELETE direto em finalizada falha
select throws_ok(
  $$delete from public.evolucoes where id = '66666666-6666-6666-6666-666666666666'$$,
  'P0001', 'Evolução finalizada não pode ser alterada.',
  'DELETE direto em finalizada falha'
);

-- 14. residente não finaliza
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('88888888-8888-8888-8888-888888888888')$$,
  'P0001', 'Apenas médicos podem finalizar evoluções.',
  'residente não finaliza'
);

-- 15. registrar_impressao numera vias 1, 2
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select set_config('tst.via1', public.registrar_impressao('66666666-6666-6666-6666-666666666666')::text, true);
select set_config('tst.via2', public.registrar_impressao('66666666-6666-6666-6666-666666666666')::text, true);
select is(
  current_setting('tst.via1') || '-' || current_setting('tst.via2'),
  '1-2',
  'registrar_impressao numera vias 1, 2'
);

-- 16. imprimir rascunho falha
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.registrar_impressao('55555555-5555-5555-5555-555555555555')$$,
  'P0001', 'Somente evoluções finalizadas podem ser impressas.',
  'imprimir rascunho falha'
);

-- 17. descartar_rascunho de outro autor falha
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.descartar_rascunho('44444444-4444-4444-4444-444444444444')$$,
  'P0001', 'Acesso negado.',
  'descartar_rascunho de outro autor falha'
);

-- 18. registrar_acesso grava acesso
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select public.registrar_acesso('33333333-3333-3333-3333-333333333333', 'TESTE_ACESSO');
reset role;
select is(
  (select count(*) from public.acessos
    where acao = 'TESTE_ACESSO' and profissional_id = current_setting('tst.medico_a')::uuid
      and internacao_id = '33333333-3333-3333-3333-333333333333'),
  1::bigint,
  'registrar_acesso grava acesso'
);

-- 19. recepcao não salva rascunho
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select public.salvar_rascunho('33333333-3333-3333-3333-333333333333', '{}'::jsonb, 'x')$$,
  'P0001', 'Acesso negado.',
  'recepcao não salva rascunho'
);

-- 20. não autor não finaliza
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('44444444-4444-4444-4444-444444444444')$$,
  'P0001', 'Acesso negado.',
  'não autor não finaliza'
);

-- 21. não membro (residente de outra equipe) não troca leito
reset role;
select tests.autenticar(current_setting('tst.residente_outra')::uuid);
select throws_ok(
  $$select public.trocar_leito('33333333-3333-3333-3333-333333333333', 'Z-01')$$,
  'P0001', 'Acesso negado.',
  'não membro (residente de outra equipe) não troca leito'
);

-- 22. multiprofissional sem categoria não salva rascunho
reset role;
select tests.autenticar(current_setting('tst.multi_sem_categoria')::uuid);
select throws_ok(
  $$select public.salvar_rascunho('dddddddd-dddd-dddd-dddd-dddddddddddd', '{}'::jsonb, 'x')$$,
  'P0001', 'Defina sua categoria profissional antes de registrar evoluções.',
  'multiprofissional sem categoria não salva rascunho'
);

select * from finish();
rollback;
