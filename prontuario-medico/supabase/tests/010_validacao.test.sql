begin;
select plan(37);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.residente_sem_conselho', tests.criar_profissional('residente', false, 'medica')::text, true);
select set_config('tst.academico', tests.criar_profissional('academico', false)::text, true);
select set_config('tst.multi', tests.criar_profissional('multiprofissional', true, 'fisioterapia')::text, true);

insert into public.equipes (id, nome) values
  ('11100000-0000-0000-0000-000000000001', 'Clinica Medica'),
  ('11100000-0000-0000-0000-000000000002', 'Outra Equipe');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '11100000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente')::uuid, '11100000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente_sem_conselho')::uuid, '11100000-0000-0000-0000-000000000001'),
  (current_setting('tst.academico')::uuid, '11100000-0000-0000-0000-000000000001'),
  (current_setting('tst.multi')::uuid, '11100000-0000-0000-0000-000000000001'),
  (current_setting('tst.medico_b')::uuid, '11100000-0000-0000-0000-000000000002');

-- 20 pacientes e 20 internações (todas na Clínica Médica, médico A responsável)
insert into public.pacientes (id, nome, data_nascimento, convenio)
select ('22200000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Paciente ' || g, '1950-01-01', 'SUS'
from generate_series(1, 20) g;

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
select ('33300000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       ('22200000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '11100000-0000-0000-0000-000000000001',
       current_setting('tst.medico_a')::uuid,
       'L-' || g
from generate_series(1, 20) g;

-- Evoluções (autor e status por número; internação de mesmo número, exceto 19 que usa a 18)
-- 1 RASCUNHO residente | 2 RASCUNHO acadêmico | 3 RASCUNHO residente sem conselho
-- 4 RASCUNHO residente sem conduta | 5 RASCUNHO multi simples sem plano
-- 6 AGUARDANDO residente | 7 AGUARDANDO residente | 8 AGUARDANDO médico A (autor)
-- 9 FINALIZADA residente | 10 AGUARDANDO residente | 11 AGUARDANDO residente
-- 12 RASCUNHO médico A | 13 AGUARDANDO residente (anexo não enviado)
-- 14 RASCUNHO residente (anexo não enviado) | 16 AGUARDANDO acadêmico
-- 17 AGUARDANDO residente (anexo confirmado sem arquivo) | 18 AGUARDANDO residente
-- 19 RASCUNHO residente na internação 18
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, enviada_em) values
  ('44400000-0000-0000-0000-000000000001', '33300000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000002', '33300000-0000-0000-0000-000000000002', 'medica', current_setting('tst.academico')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000003', '33300000-0000-0000-0000-000000000003', 'medica', current_setting('tst.residente_sem_conselho')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000004', '33300000-0000-0000-0000-000000000004', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000005', '33300000-0000-0000-0000-000000000005', 'fisioterapia', current_setting('tst.multi')::uuid, 'RASCUNHO', '{"modelo_versao":"simples@1","texto":"Evo fisio"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000006', '33300000-0000-0000-0000-000000000006', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000007', '33300000-0000-0000-0000-000000000007', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000008', '33300000-0000-0000-0000-000000000008', 'medica', current_setting('tst.medico_a')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000010', '33300000-0000-0000-0000-000000000010', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000011', '33300000-0000-0000-0000-000000000011', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000012', '33300000-0000-0000-0000-000000000012', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000013', '33300000-0000-0000-0000-000000000013', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000014', '33300000-0000-0000-0000-000000000014', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null),
  ('44400000-0000-0000-0000-000000000016', '33300000-0000-0000-0000-000000000016', 'medica', current_setting('tst.academico')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000017', '33300000-0000-0000-0000-000000000017', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000018', '33300000-0000-0000-0000-000000000018', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', now()),
  ('44400000-0000-0000-0000-000000000019', '33300000-0000-0000-0000-000000000018', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'Texto', null);

-- 9: finalizada (fixture; campos de finalização preenchidos)
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash) values
  ('44400000-0000-0000-0000-000000000009', '33300000-0000-0000-0000-000000000009', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F","conduta":"Cond F"}', 'Texto F', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64));

-- anexos: 13 e 14 não confirmados (sem objeto); 17 confirmado sem objeto
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por) values
  ('55500000-0000-0000-0000-000000000013', '44400000-0000-0000-0000-000000000013', '33300000-0000-0000-0000-000000000013', 'OUTRO', 'Pendente', '2026-10-24', 'internacoes/33300000-0000-0000-0000-000000000013/55500000-0000-0000-0000-000000000013', 'application/pdf', 1000, repeat('1', 64), false, current_setting('tst.residente')::uuid),
  ('55500000-0000-0000-0000-000000000014', '44400000-0000-0000-0000-000000000014', '33300000-0000-0000-0000-000000000014', 'OUTRO', 'Pendente', '2026-10-24', 'internacoes/33300000-0000-0000-0000-000000000014/55500000-0000-0000-0000-000000000014', 'application/pdf', 1000, repeat('2', 64), false, current_setting('tst.residente')::uuid),
  ('55500000-0000-0000-0000-000000000017', '44400000-0000-0000-0000-000000000017', '33300000-0000-0000-0000-000000000017', 'OUTRO', 'Sem arquivo', '2026-10-24', 'internacoes/33300000-0000-0000-0000-000000000017/55500000-0000-0000-0000-000000000017', 'application/pdf', 1000, repeat('3', 64), true, current_setting('tst.residente')::uuid);

-- 1. residente envia para validação
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000001')$$,
  'residente envia para validação'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000001'
      and status = 'AGUARDANDO_VALIDACAO' and enviada_em is not null and devolvida_motivo is null
  ),
  'residente envia: status vira AGUARDANDO_VALIDACAO'
);

-- 2. acadêmico sem conselho envia
reset role;
select tests.autenticar(current_setting('tst.academico')::uuid);
select lives_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000002')$$,
  'acadêmico sem conselho envia'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000002' and status = 'AGUARDANDO_VALIDACAO'
  ),
  'acadêmico envia: status vira AGUARDANDO_VALIDACAO'
);

-- 3. residente sem conselho não envia
reset role;
select tests.autenticar(current_setting('tst.residente_sem_conselho')::uuid);
select throws_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000003')$$,
  'P0001', 'Complete seu registro profissional antes de enviar.',
  'residente sem conselho não envia'
);

-- 4. enviar sem campos obrigatórios falha (médica e simples)
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000004')$$,
  'P0001', 'Preencha a evolução clínica e a conduta antes de enviar.',
  'enviar sem conduta (médica) falha'
);
reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select throws_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000005')$$,
  'P0001', 'Preencha a evolução e o plano antes de enviar.',
  'enviar sem plano (simples) falha'
);

-- 5. enviar com anexo não confirmado falha
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000014')$$,
  'P0001', 'Há anexo não enviado. Envie de novo ou cancele antes de enviar.',
  'enviar com anexo não enviado falha'
);

-- 6. médico da equipe valida e grava snapshots autor/validador
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000006')$$,
  'médico da equipe valida'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000006'
      and status = 'FINALIZADA'
      and validada_por = current_setting('tst.medico_a')::uuid
      and validada_em is not null and finalizada_em = validada_em
      and snapshot_autor->>'nome' = 'Teste residente'
      and snapshot_validador->>'nome' = 'Teste medico'
      and snapshot_validador->>'conselho' = 'CRM'
      and hash_versao = 2 and conteudo_hash is not null
  ),
  'validar grava snapshots de autor e validador e hash v2'
);

-- 7. validar evolução de acadêmico grava snapshot do autor sem conselho
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000016')$$,
  'médico valida evolução de acadêmico'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000016'
      and status = 'FINALIZADA'
      and snapshot_autor->>'nome' = 'Teste academico'
      and snapshot_autor->>'conselho' is null
      and snapshot_autor->>'numero' is null
      and snapshot_autor->>'uf' is null
  ),
  'validação de acadêmico grava snapshot do autor sem conselho'
);

-- 8. médico de outra equipe não valida
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000007')$$,
  'P0001', 'Apenas médicos da equipe podem validar.',
  'médico de outra equipe não valida'
);

-- 9. autor não valida a própria evolução
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000008')$$,
  'P0001', 'Você não pode validar a própria evolução.',
  'autor não valida a própria evolução'
);

-- 10. validar evolução já finalizada falha
select throws_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000009')$$,
  'P0001', 'Evolução finalizada não pode ser alterada.',
  'validar evolução já finalizada falha'
);

-- 11. validar apaga anexo não confirmado da evolução
select lives_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000013')$$,
  'validar com anexo não confirmado funciona'
);
reset role;
select is(
  (select count(*)::int from public.anexos where evolucao_id = '44400000-0000-0000-0000-000000000013'),
  0,
  'validar apaga o anexo não confirmado'
);

-- 12. validar com anexo confirmado sem arquivo falha e não muda o status
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.validar_evolucao('44400000-0000-0000-0000-000000000017')$$,
  'P0001', 'Um anexo confirmado está sem arquivo. Remova-o e envie de novo.',
  'validar com anexo confirmado sem arquivo falha'
);
reset role;
select is(
  (select status::text from public.evolucoes where id = '44400000-0000-0000-0000-000000000017'),
  'AGUARDANDO_VALIDACAO',
  'validação falha mantém evolução aguardando'
);

-- 13. devolver exige motivo
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.devolver_evolucao('44400000-0000-0000-0000-000000000010', '   ')$$,
  'P0001', 'Informe o motivo da devolução.',
  'devolver exige motivo'
);

-- 14. motivo acima de 500 caracteres falha
select throws_ok(
  $$select public.devolver_evolucao('44400000-0000-0000-0000-000000000010', repeat('x', 501))$$,
  'P0001', 'Motivo da devolução deve ter no máximo 500 caracteres.',
  'motivo acima de 500 caracteres falha'
);

-- 15. médico de outra equipe não devolve
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.devolver_evolucao('44400000-0000-0000-0000-000000000010', 'Falta conduta')$$,
  'P0001', 'Apenas médicos da equipe podem devolver.',
  'médico de outra equipe não devolve'
);

-- 16. devolver com rascunho aberto na mesma internação falha
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.devolver_evolucao('44400000-0000-0000-0000-000000000018', 'Falta conduta')$$,
  'P0001', 'Você já tem um rascunho aberto nesta internação.',
  'devolver com rascunho aberto na mesma internação falha'
);

-- 17. devolver volta a rascunho com motivo
select lives_ok(
  $$select public.devolver_evolucao('44400000-0000-0000-0000-000000000010', 'Falta a conduta')$$,
  'devolver volta a rascunho'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000010'
      and status = 'RASCUNHO' and devolvida_motivo = 'Falta a conduta'
  ),
  'devolução grava motivo e status rascunho'
);

-- 18. reenviar limpa o motivo
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select public.enviar_evolucao('44400000-0000-0000-0000-000000000010')$$,
  'reenviar após devolução funciona'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000010'
      and status = 'AGUARDANDO_VALIDACAO' and devolvida_motivo is null
  ),
  'reenviar limpa o motivo da devolução'
);

-- 19. autor não edita enquanto aguarda validação (salvar_rascunho não toca a evolução enviada)
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select public.salvar_rascunho('33300000-0000-0000-0000-000000000011', '{"modelo_versao":"medica@1","evolucao_clinica":"Alterada","conduta":"Alterada"}'::jsonb, 'Alterada')$$,
  'salvar_rascunho com evolução aguardando validação não falha'
);
reset role;
select is(
  (select dados->>'evolucao_clinica' from public.evolucoes where id = '44400000-0000-0000-0000-000000000011'),
  'Evo',
  'salvar_rascunho não altera evolução aguardando validação'
);
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$update public.evolucoes set texto_livre = 'Alterado' where id = '44400000-0000-0000-0000-000000000011'$$,
  '42501', 'permission denied for table evolucoes',
  'update direto de evolução aguardando validação é negado'
);

-- 20. acadêmico salva rascunho como médica
reset role;
select tests.autenticar(current_setting('tst.academico')::uuid);
select lives_ok(
  $$select public.salvar_rascunho('33300000-0000-0000-0000-000000000015', '{"modelo_versao":"medica@1","evolucao_clinica":"Ac","conduta":"Ac"}'::jsonb, 'Ac')$$,
  'acadêmico salva rascunho'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where internacao_id = '33300000-0000-0000-0000-000000000015'
      and autor_id = current_setting('tst.academico')::uuid
      and status = 'RASCUNHO' and categoria = 'medica'
  ),
  'acadêmico salva rascunho com categoria medica'
);

-- 21. finalizar_evolucao continua funcionando para médico (regressão)
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.finalizar_evolucao('44400000-0000-0000-0000-000000000012')$$,
  'finalizar_evolucao continua funcionando para médico'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '44400000-0000-0000-0000-000000000012'
      and status = 'FINALIZADA' and hash_versao = 2
      and snapshot_autor->>'nome' = 'Teste medico'
      and snapshot_autor = snapshot_validador
  ),
  'finalizar_evolucao grava snapshots e hash v2'
);

-- 22. grants: core não exposto; validar exposto a authenticated
select ok(
  not has_function_privilege('authenticated', 'app.finalizar_core(uuid,uuid)', 'execute'),
  'finalizar_core não executável por authenticated'
);
select ok(
  not has_function_privilege('anon', 'app.finalizar_core(uuid,uuid)', 'execute'),
  'finalizar_core não executável por anon'
);
select ok(
  has_function_privilege('authenticated', 'public.validar_evolucao(uuid)', 'execute'),
  'validar_evolucao executável por authenticated'
);

select * from finish();
rollback;
