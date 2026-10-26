begin;
select plan(31);

-- setup como postgres (transaction-local)
select set_config('tst.medico_a', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_b', tests.criar_profissional('medico')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.multi', tests.criar_profissional('multiprofissional', true, 'fisioterapia')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao', false)::text, true);
select set_config('tst.res_fora', tests.criar_profissional('residente', true, 'medica')::text, true);

insert into public.equipes (id, nome) values
  ('77700000-0000-0000-0000-000000000001', 'Clinica Medica'),
  ('77700000-0000-0000-0000-000000000002', 'Outra Equipe');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico_a')::uuid, '77700000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente')::uuid, '77700000-0000-0000-0000-000000000001'),
  (current_setting('tst.multi')::uuid, '77700000-0000-0000-0000-000000000001'),
  (current_setting('tst.medico_b')::uuid, '77700000-0000-0000-0000-000000000002');

-- 5 pacientes e 5 internações: I1 INTERNADO, I2 ALTA, I3 e I4 INTERNADO, I5 INTERNADO
insert into public.pacientes (id, nome, data_nascimento, convenio)
select ('99900000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Paciente Adendo ' || g, '1950-01-01', 'SUS'
from generate_series(1, 5) g;

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, status, alta_em, alta_por, motivo_alta)
select ('88800000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       ('99900000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '77700000-0000-0000-0000-000000000001',
       current_setting('tst.medico_a')::uuid,
       'AD-' || g,
       case when g = 2 then 'ALTA'::status_internacao else 'INTERNADO'::status_internacao end,
       case when g = 2 then now() end,
       case when g = 2 then current_setting('tst.medico_a')::uuid end,
       case when g = 2 then 'Melhora' end
from generate_series(1, 5) g;

-- Evoluções
-- 1 FINALIZADA residente (I1) | 2 FINALIZADA residente (I2, alta) | 3 FINALIZADA multi fisio (I2, alta)
-- 4 RASCUNHO multi simples completo sem adendo (I2, alta) | 5 FINALIZADA residente (I3)
-- 6 RASCUNHO residente medica (I3) | 7 FINALIZADA residente (I4) | 8 AGUARDANDO residente (I4)
-- 9 FINALIZADA multi fisio (I5)
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash, enviada_em) values
  ('66600000-0000-0000-0000-000000000001', '88800000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F1","conduta":"Cond F1"}', 'Texto F1', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now()),
  ('66600000-0000-0000-0000-000000000002', '88800000-0000-0000-0000-000000000002', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F2","conduta":"Cond F2"}', 'Texto F2', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now()),
  ('66600000-0000-0000-0000-000000000003', '88800000-0000-0000-0000-000000000002', 'fisioterapia', current_setting('tst.multi')::uuid, 'FINALIZADA', '{"modelo_versao":"simples@1","texto":"Evo F3","plano":"Plano F3"}', 'Texto F3', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now()),
  ('66600000-0000-0000-0000-000000000004', '88800000-0000-0000-0000-000000000002', 'fisioterapia', current_setting('tst.multi')::uuid, 'RASCUNHO', '{"modelo_versao":"simples@1","texto":"Evo R4","plano":"Plano R4"}', 'Texto R4', null, null, null, null, null, null, null),
  ('66600000-0000-0000-0000-000000000005', '88800000-0000-0000-0000-000000000003', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F5","conduta":"Cond F5"}', 'Texto F5', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now()),
  ('66600000-0000-0000-0000-000000000006', '88800000-0000-0000-0000-000000000003', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo R6","conduta":"Cond R6"}', 'Texto R6', null, null, null, null, null, null, null),
  ('66600000-0000-0000-0000-000000000007', '88800000-0000-0000-0000-000000000004', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F7","conduta":"Cond F7"}', 'Texto F7', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now()),
  ('66600000-0000-0000-0000-000000000008', '88800000-0000-0000-0000-000000000004', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo A8","conduta":"Cond A8"}', 'Texto A8', null, null, null, null, null, null, now()),
  ('66600000-0000-0000-0000-000000000009', '88800000-0000-0000-0000-000000000005', 'fisioterapia', current_setting('tst.multi')::uuid, 'FINALIZADA', '{"modelo_versao":"simples@1","texto":"Evo F9","plano":"Plano F9"}', 'Texto F9', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now());

-- I6 ALTA com rascunho comum (não adendo) do médico A, para finalizar recusado
insert into public.pacientes (id, nome, data_nascimento, convenio)
values ('99900000-0000-0000-0000-000000000006', 'Paciente Adendo 6', '1950-01-01', 'SUS');

insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, status, alta_em, alta_por, motivo_alta)
values ('88800000-0000-0000-0000-000000000006', '99900000-0000-0000-0000-000000000006',
        '77700000-0000-0000-0000-000000000001', current_setting('tst.medico_a')::uuid,
        'AD-6', 'ALTA', now(), current_setting('tst.medico_a')::uuid, 'Melhora');

insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('66600000-0000-0000-0000-000000000010', '88800000-0000-0000-0000-000000000006', 'medica', current_setting('tst.medico_a')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo R10","conduta":"Cond R10"}', 'Texto R10');

-- A11: adendo já finalizado (de F2, residente, I2) para testar adendo de adendo
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, adendo_de, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash) values
  ('66600000-0000-0000-0000-000000000011', '88800000-0000-0000-0000-000000000002', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo A11","conduta":"Cond A11"}', 'Texto A11', '66600000-0000-0000-0000-000000000002', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('a', 64));

-- A12: finalizada do residente fora da equipe (I1), para testar autoria sem vínculo
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash, enviada_em) values
  ('66600000-0000-0000-0000-000000000012', '88800000-0000-0000-0000-000000000001', 'medica', current_setting('tst.res_fora')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F12","conduta":"Cond F12"}', 'Texto F12', now(), current_setting('tst.medico_a')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now());

-- ===== criar_adendo =====

-- 1. autor cria adendo de evolução finalizada
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select set_config('tst.adendo_res1', public.criar_adendo('66600000-0000-0000-0000-000000000001')::text, true)$$,
  'autor cria adendo de evolução finalizada'
);

-- 2. o adendo nasce RASCUNHO, na mesma internação, com adendo_de e modelo médico
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = current_setting('tst.adendo_res1', true)::uuid
      and status = 'RASCUNHO'
      and adendo_de = '66600000-0000-0000-0000-000000000001'
      and internacao_id = '88800000-0000-0000-0000-000000000001'
      and autor_id = current_setting('tst.residente')::uuid
      and categoria = 'medica'
      and dados->>'modelo_versao' = 'medica@1'
  ),
  'adendo nasce RASCUNHO com adendo_de, mesma internação e modelo medica@1'
);

-- 3. adendo de rascunho falha (residente tem rascunho em I3, original é rascunho)
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000006')$$,
  'P0001', 'Somente evoluções finalizadas podem ter adendo.',
  'adendo de rascunho falha'
);

-- 4. adendo após alta permitido ao autor
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select set_config('tst.adendo_res2', public.criar_adendo('66600000-0000-0000-0000-000000000002')::text, true)$$,
  'adendo após alta permitido ao autor'
);

-- 5. adendo após alta permitido à médica da equipe
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select set_config('tst.adendo_med2', public.criar_adendo('66600000-0000-0000-0000-000000000002')::text, true)$$,
  'adendo após alta permitido à médica da equipe'
);

-- 6. adendo após alta negado a médico de outra equipe
reset role;
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000002')$$,
  'P0001', 'Acesso negado.',
  'adendo após alta negado a médico de outra equipe'
);

-- 7. adendo após alta negado à recepção
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000002')$$,
  'P0001', 'Acesso negado.',
  'adendo após alta negado à recepção'
);

-- 8. rascunho aberto do autor na internação bloqueia novo adendo (residente tem D6 em I3)
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000005')$$,
  'P0001', 'Você já tem um rascunho aberto nesta internação.',
  'criar adendo com rascunho aberto falha'
);

-- 9. evolução aguardando validação do autor bloqueia novo adendo (residente tem A8 em I4)
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000007')$$,
  'P0001', 'Você tem uma evolução aguardando validação nesta internação.',
  'criar adendo com evolução aguardando validação falha'
);

-- 10. multiprofissional: categoria do perfil e modelo simples@1
reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select lives_ok(
  $$select set_config('tst.adendo_multi', public.criar_adendo('66600000-0000-0000-0000-000000000009')::text, true)$$,
  'multiprofissional cria adendo'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = current_setting('tst.adendo_multi', true)::uuid
      and categoria = 'fisioterapia'
      and dados->>'modelo_versao' = 'simples@1'
      and status = 'RASCUNHO'
  ),
  'adendo de multiprofissional usa categoria do perfil e modelo simples@1'
);

-- ===== salvar, enviar, validar adendo em internação com alta =====

-- 11. salvar_rascunho atualiza o adendo em internação com alta
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select public.salvar_rascunho('88800000-0000-0000-0000-000000000002', '{"modelo_versao":"medica@1","evolucao_clinica":"Adendo clínico","conduta":"Adendo conduta"}', 'Texto adendo')$$,
  'salvar_rascunho atualiza adendo em internação com alta'
);
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = current_setting('tst.adendo_res2', true)::uuid
      and dados->>'evolucao_clinica' = 'Adendo clínico' and texto_livre = 'Texto adendo'
  ),
  'adendo em alta recebe o texto salvo'
);

-- 12. enviar adendo em internação com alta
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select public.enviar_evolucao(current_setting('tst.adendo_res2', true)::uuid)$$,
  'enviar adendo em internação com alta'
);

-- 13. validar adendo em internação com alta (médica da equipe, não autora)
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.validar_evolucao(current_setting('tst.adendo_res2', true)::uuid)$$,
  'validar adendo em internação com alta'
);

-- 14. evolução original não muda após adendo finalizado
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = '66600000-0000-0000-0000-000000000002'
      and status = 'FINALIZADA'
      and dados->>'evolucao_clinica' = 'Evo F2'
      and texto_livre = 'Texto F2'
      and conteudo_hash = repeat('f', 64)
  ),
  'evolução original não muda após adendo finalizado'
);

-- ===== rascunho comum em internação com alta continua bloqueado =====

-- 15. salvar_rascunho sem adendo falha (multi tem D4 comum em I2)
reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select throws_ok(
  $$select public.salvar_rascunho('88800000-0000-0000-0000-000000000002', '{"modelo_versao":"simples@1","texto":"x","plano":"y"}', 'x')$$,
  'P0001', 'Internação com alta não permite novas evoluções.',
  'rascunho comum em internação com alta: salvar falha'
);

-- 16. enviar rascunho comum em internação com alta falha
select throws_ok(
  $$select public.enviar_evolucao('66600000-0000-0000-0000-000000000004')$$,
  'P0001', 'Internação com alta: evolução não pode ser alterada.',
  'rascunho comum em internação com alta: enviar falha'
);

-- 17. anexo em rascunho comum de internação com alta falha
select throws_ok(
  $$select public.criar_anexo('66600000-0000-0000-0000-000000000004', 'OUTRO', 'Exame', '2026-10-24', 'application/pdf', 1000, repeat('3', 64))$$,
  'P0001', 'Internação com alta: evolução não pode ser alterada.',
  'rascunho comum em internação com alta: anexo falha'
);

-- 18. descartar rascunho comum em internação com alta falha
select throws_ok(
  $$select public.descartar_rascunho('66600000-0000-0000-0000-000000000004')$$,
  'P0001', 'Internação com alta: evolução não pode ser alterada.',
  'rascunho comum em internação com alta: descartar falha'
);

-- ===== anexo e descarte de adendo em internação com alta =====

-- 19. anexo em rascunho de adendo em alta permitido
reset role;
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.criar_anexo(current_setting('tst.adendo_med2', true)::uuid, 'OUTRO', 'Exame adendo', '2026-10-24', 'application/pdf', 1000, repeat('4', 64))$$,
  'anexo em rascunho de adendo em internação com alta permitido'
);

-- 20. remover anexo de rascunho de adendo em alta permitido
reset role;
select set_config('tst.anexo_adendo', (select a.id::text from public.anexos a where a.evolucao_id = current_setting('tst.adendo_med2', true)::uuid), true);
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select lives_ok(
  $$select public.remover_anexo(current_setting('tst.anexo_adendo', true)::uuid)$$,
  'remover anexo de rascunho de adendo em internação com alta permitido'
);

-- 21. descartar rascunho de adendo em alta permitido
select lives_ok(
  $$select public.descartar_rascunho(current_setting('tst.adendo_med2', true)::uuid)$$,
  'descartar rascunho de adendo em internação com alta permitido'
);

-- 22. adendo descartado sumiu
reset role;
select ok(
  not exists (select 1 from public.evolucoes where id = current_setting('tst.adendo_med2', true)::uuid),
  'adendo descartado não existe mais'
);

-- 23. adendo de multiprofissional segue com o rascunho aberto (não tocado pelos testes de alta)
select ok(
  exists (select 1 from public.evolucoes where id = current_setting('tst.adendo_multi', true)::uuid and status = 'RASCUNHO'),
  'adendo de multiprofissional segue RASCUNHO'
);

-- ===== vínculo do adendo e finalização em alta =====

-- 24. adendo de um adendo: criado pelo autor do adendo (residente), vínculo na original
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select lives_ok(
  $$select set_config('tst.adendo_neto', public.criar_adendo('66600000-0000-0000-0000-000000000011')::text, true)$$,
  'criar adendo de um adendo'
);

-- 25. adendo de um adendo aponta para a original
reset role;
select ok(
  exists (
    select 1 from public.evolucoes
    where id = current_setting('tst.adendo_neto', true)::uuid
      and adendo_de = '66600000-0000-0000-0000-000000000002'
      and status = 'RASCUNHO'
  ),
  'adendo de um adendo aponta para a original'
);

-- 26. adendo de um adendo: autorização pela evolução clicada (médico de outra equipe nega)
select tests.autenticar(current_setting('tst.medico_b')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000011')$$,
  'P0001', 'Acesso negado.',
  'adendo de um adendo: médico de outra equipe é negado'
);

-- 27. vínculo do adendo não muda por update direto (postgres)
reset role;
select throws_ok(
  $$update public.evolucoes set adendo_de = null where id = current_setting('tst.adendo_res1', true)::uuid$$,
  'P0001', 'Vínculo do adendo não pode ser alterado.',
  'vínculo do adendo não pode ser alterado por update'
);

-- 28. finalizar rascunho comum em internação com alta é recusado
select tests.autenticar(current_setting('tst.medico_a')::uuid);
select throws_ok(
  $$select public.finalizar_evolucao('66600000-0000-0000-0000-000000000010')$$,
  'P0001', 'Internação com alta: evolução não pode ser alterada.',
  'finalizar rascunho comum em internação com alta é recusado'
);

-- ===== autoria exige vínculo com a equipe =====

-- 29. autor fora da equipe não cria adendo, mesmo sendo o autor da original (residente fora de I1)
reset role;
select tests.autenticar(current_setting('tst.res_fora')::uuid);
select throws_ok(
  $$select public.criar_adendo('66600000-0000-0000-0000-000000000012')$$,
  'P0001', 'Acesso negado.',
  'autor fora da equipe não cria adendo'
);

select * from finish();
rollback;
