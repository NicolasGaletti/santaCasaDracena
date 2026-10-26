begin;
select plan(24);

select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.medico_fora', tests.criar_profissional('medico')::text, true);
select set_config('tst.residente', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.sem_registro', tests.criar_profissional('medico', false)::text, true);
select set_config('tst.multi', tests.criar_profissional('multiprofissional', true, 'fisioterapia')::text, true);

insert into public.equipes (id, nome) values
  ('14000000-0000-0000-0000-000000000001', 'Clinica Medica 14'),
  ('14000000-0000-0000-0000-000000000002', 'Outra Equipe 14');

insert into public.membros_equipe (profissional_id, equipe_id) values
  (current_setting('tst.medico')::uuid, '14000000-0000-0000-0000-000000000001'),
  (current_setting('tst.residente')::uuid, '14000000-0000-0000-0000-000000000001'),
  (current_setting('tst.multi')::uuid, '14000000-0000-0000-0000-000000000001'),
  (current_setting('tst.medico_fora')::uuid, '14000000-0000-0000-0000-000000000002'),
  (current_setting('tst.sem_registro')::uuid, '14000000-0000-0000-0000-000000000001');

insert into public.pacientes (id, nome, data_nascimento, convenio)
select ('14100000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Paciente Alta ' || g, '1950-01-01', 'SUS'
from generate_series(1, 5) g;

-- I1 alta feliz | I2 com evolução aguardando | I3 alta recusada (perfil/equipe/data) | I4 desfecho p/ leito
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
select ('14200000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       ('14100000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '14000000-0000-0000-0000-000000000001',
       current_setting('tst.medico')::uuid,
       'AL-' || g
from generate_series(1, 5) g;

insert into public.leitos_historico (internacao_id, leito_ala, de, por)
select ('14200000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'AL-' || g, now(), current_setting('tst.medico')::uuid
from generate_series(1, 5) g;

-- F1 finalizada (I1) para o adendo pós-alta; A2 aguardando (I2)
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash, enviada_em) values
  ('14300000-0000-0000-0000-000000000001', '14200000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F1","conduta":"Cond F1"}', 'Texto F1', now(), current_setting('tst.medico')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('f', 64), now());
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, enviada_em) values
  ('14300000-0000-0000-0000-000000000002', '14200000-0000-0000-0000-000000000002', 'medica', current_setting('tst.residente')::uuid, 'AGUARDANDO_VALIDACAO', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo A2","conduta":"Cond A2"}', 'Texto A2', now());

-- rascunho pendente em I1 (congelado após alta); I4 leito trocado "no futuro"; I5 evolução finalizada "no futuro"
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('14300000-0000-0000-0000-000000000004', '14200000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1","evolucao_clinica":"Rasc","conduta":"Rasc"}', 'Rascunho pendente');
update public.leitos_historico set de = now() + interval '1 minute' where internacao_id = '14200000-0000-0000-0000-000000000004';
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash, enviada_em) values
  ('14300000-0000-0000-0000-000000000005', '14200000-0000-0000-0000-000000000005', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"Evo F5","conduta":"Cond F5"}', 'Texto F5', now() + interval '1 minute', current_setting('tst.medico')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('e', 64), now());

-- 1. residente não dá alta
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo')$$,
  'P0001', 'Acesso negado.', 'residente não dá alta'
);

-- 2. multiprofissional não dá alta
reset role;
select tests.autenticar(current_setting('tst.multi')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo')$$,
  'P0001', 'Acesso negado.', 'multiprofissional não dá alta'
);

-- 3. médico de outra equipe não dá alta
reset role;
select tests.autenticar(current_setting('tst.medico_fora')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo')$$,
  'P0001', 'Acesso negado.', 'médico de outra equipe não dá alta'
);

-- 4-8. validações do médico da equipe
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo', now() + interval '1 hour')$$,
  'P0001', 'A data da alta não pode ser futura.', 'alta futura falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo', now() - interval '1 day')$$,
  'P0001', 'A data da alta não pode ser anterior à admissão.', 'alta antes da admissão falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', '   ')$$,
  'P0001', 'Informe o resumo da alta (até 2000 caracteres).', 'resumo vazio falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', repeat('x', 2001))$$,
  'P0001', 'Informe o resumo da alta (até 2000 caracteres).', 'resumo longo falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000002', 'MELHORADA', 'Resumo')$$,
  'P0001', 'Há evoluções aguardando validação nesta internação.', 'alta recusada com evolução aguardando validação'
);

select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', null, 'Resumo')$$,
  'P0001', 'Informe o tipo da alta.', 'tipo nulo falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000004', 'MELHORADA', 'Resumo')$$,
  'P0001', 'A data da alta não pode ser anterior à última troca de leito.', 'alta antes da última troca de leito falha'
);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000005', 'MELHORADA', 'Resumo')$$,
  'P0001', 'A data da alta não pode ser anterior à última evolução finalizada.', 'alta antes da última evolução finalizada falha'
);

-- 9. médico da equipe dá alta
select lives_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000001', 'CURADA', ' Resumo da alta ')$$,
  'médico da equipe dá alta'
);
reset role;
select ok(
  exists (
    select 1 from public.internacoes
    where id = '14200000-0000-0000-0000-000000000001'
      and status = 'ALTA' and tipo_alta = 'CURADA' and motivo_alta = 'Resumo da alta'
      and alta_em is not null and alta_por = current_setting('tst.medico')::uuid
  ),
  'alta grava status, tipo, resumo, data e autor'
);
select ok(
  not exists (select 1 from public.leitos_historico where internacao_id = '14200000-0000-0000-0000-000000000001' and ate is null),
  'alta fecha leito aberto'
);

-- 12. segunda alta falha
select tests.autenticar(current_setting('tst.medico')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000001', 'CURADA', 'Resumo')$$,
  'P0001', 'Internação já recebeu alta.', 'internação com alta não recebe nova alta'
);

-- 13. após alta não salva rascunho
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.salvar_rascunho('14200000-0000-0000-0000-000000000001', '{"modelo_versao":"medica@1","evolucao_clinica":"x","conduta":"y"}', 'x')$$,
  'P0001', 'Internação com alta não permite novas evoluções.', 'após alta não salva rascunho'
);

-- rascunho pendente continua congelado após alta
reset role;
select tests.autenticar(current_setting('tst.residente')::uuid);
select throws_ok(
  $$select public.enviar_evolucao('14300000-0000-0000-0000-000000000004')$$,
  'P0001', 'Internação com alta: evolução não pode ser alterada.', 'após alta rascunho pendente continua congelado'
);

-- 14. após alta adendo continua permitido
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select lives_ok(
  $$select public.criar_adendo('14300000-0000-0000-0000-000000000001')$$,
  'após alta adendo continua permitido'
);

-- 15. vw_internacoes_lista expõe tipo_alta e alta_em
select ok(
  exists (select 1 from public.vw_internacoes_lista
          where internacao_id = '14200000-0000-0000-0000-000000000001' and tipo_alta = 'CURADA' and alta_em is not null),
  'vw_internacoes_lista expõe tipo_alta e alta_em'
);

-- snapshot_alta: médico + equipe ativa ordenada por nome, congelados na alta
reset role;
select ok(
  (select snapshot_alta->'medico' from public.internacoes_clinico where internacao_id = '14200000-0000-0000-0000-000000000001')
    = jsonb_build_object('nome', 'Teste medico', 'conselho', 'CRM', 'numero', '123456', 'uf', 'SP'),
  'snapshot_alta guarda o médico'
);
select is(
  (select jsonb_array_length(snapshot_alta->'equipe') from public.internacoes_clinico where internacao_id = '14200000-0000-0000-0000-000000000001'),
  4, 'snapshot_alta guarda a equipe (4 membros ativos)'
);
update public.profissionais set conselho = 'COREN', numero_conselho = '999', nome = 'Nome Novo'
where id = current_setting('tst.medico')::uuid;
delete from public.membros_equipe where profissional_id = current_setting('tst.multi')::uuid;
select ok(
  (select snapshot_alta->'medico'->>'conselho' = 'CRM' and snapshot_alta->'medico'->>'nome' = 'Teste medico'
          and jsonb_array_length(snapshot_alta->'equipe') = 4
   from public.internacoes_clinico where internacao_id = '14200000-0000-0000-0000-000000000001'),
  'mudar conselho/equipe depois da alta não altera o snapshot'
);

-- médico sem registro completo não dá alta
select tests.autenticar(current_setting('tst.sem_registro')::uuid);
select throws_ok(
  $$select public.dar_alta('14200000-0000-0000-0000-000000000003', 'MELHORADA', 'Resumo')$$,
  'P0001', 'Complete seu registro profissional antes de dar alta.', 'médico sem registro não dá alta'
);

-- recepção não lê snapshot_alta
reset role;
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select is(
  (select count(*)::int from public.internacoes_clinico where snapshot_alta is not null),
  0, 'recepção não lê snapshot_alta'
);

select * from finish();
rollback;
