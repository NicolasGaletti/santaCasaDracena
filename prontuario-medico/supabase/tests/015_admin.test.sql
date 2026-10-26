begin;
select plan(37);

select set_config('tst.admin', tests.criar_profissional('admin', false)::text, true);
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.admin2', tests.criar_profissional('admin', false)::text, true);
select set_config('tst.alvo', tests.criar_profissional('recepcao', false)::text, true);

-- dados clínicos para o teste de leitura negada
select set_config('tst.residente', tests.criar_profissional('residente')::text, true);
insert into public.equipes (id, nome) values ('15000000-0000-0000-0000-000000000001', 'Equipe Base 15');
insert into public.pacientes (id, nome, data_nascimento, convenio) values ('15100000-0000-0000-0000-000000000001', 'Paciente 15', '1950-01-01', 'SUS');
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala)
values ('15200000-0000-0000-0000-000000000001', '15100000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', current_setting('tst.medico')::uuid, 'AD-1');
insert into public.internacoes_clinico (internacao_id, diagnostico_inicial) values ('15200000-0000-0000-0000-000000000001', 'Dx');
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em, snapshot_autor, snapshot_validador, conteudo_hash, enviada_em)
values ('15300000-0000-0000-0000-000000000001', '15200000-0000-0000-0000-000000000001', 'medica', current_setting('tst.residente')::uuid, 'FINALIZADA', '{"modelo_versao":"medica@1","evolucao_clinica":"E","conduta":"C"}', 'T', now(), current_setting('tst.medico')::uuid, now(), '{"nome":"x"}', '{"nome":"x"}', repeat('a', 64), now());
insert into public.anexos (evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por)
values ('15300000-0000-0000-0000-000000000001', '15200000-0000-0000-0000-000000000001', 'OUTRO', 'd', current_date, 'x/15.png', 'image/png', 10, repeat('a', 64), true, current_setting('tst.residente')::uuid);

-- 1. médico não chama funções admin
select tests.autenticar(current_setting('tst.medico')::uuid);
select throws_ok($$select public.admin_salvar_equipe(null, 'X', true)$$, 'P0001', 'Acesso negado.', 'médico não cria equipe');
select throws_ok($$select public.admin_vincular(current_setting('tst.alvo')::uuid, '15000000-0000-0000-0000-000000000001')$$, 'P0001', 'Acesso negado.', 'médico não vincula');
select throws_ok($$select public.admin_desvincular(current_setting('tst.alvo')::uuid, '15000000-0000-0000-0000-000000000001')$$, 'P0001', 'Acesso negado.', 'médico não desvincula');
select throws_ok($$select public.admin_definir_ativo(current_setting('tst.alvo')::uuid, false)$$, 'P0001', 'Acesso negado.', 'médico não desativa');
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'N', 'recepcao', null, null, null, null)$$, 'P0001', 'Acesso negado.', 'médico não atualiza profissional');

-- 2. admin cria equipe
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid);
select set_config('tst.equipe', public.admin_salvar_equipe(null, 'Equipe Nova 15', true)::text, true);
select is((select nome from public.equipes where id = current_setting('tst.equipe')::uuid), 'Equipe Nova 15', 'admin cria equipe');
select throws_ok($$select public.admin_salvar_equipe(null, '  equipe nova 15 ', true)$$, 'P0001', 'Já existe uma equipe com esse nome.', 'nome de equipe duplicado');
select throws_ok($$select public.admin_salvar_equipe(null, '   ', true)$$, 'P0001', 'Informe o nome da equipe.', 'nome vazio');
select lives_ok($$select public.admin_salvar_equipe(current_setting('tst.equipe')::uuid, 'Equipe Renomeada 15', false)$$, 'admin edita equipe');
select is((select ativo from public.equipes where id = current_setting('tst.equipe')::uuid), false, 'equipe inativada');

-- 3. vincula e desvincula
select lives_ok($$select public.admin_vincular(current_setting('tst.alvo')::uuid, current_setting('tst.equipe')::uuid)$$, 'admin vincula');
select is((select count(*)::int from public.membros_equipe where profissional_id = current_setting('tst.alvo')::uuid), 1, 'vínculo existe');
select lives_ok($$select public.admin_vincular(current_setting('tst.alvo')::uuid, current_setting('tst.equipe')::uuid)$$, 'vincular é idempotente');
select lives_ok($$select public.admin_desvincular(current_setting('tst.alvo')::uuid, current_setting('tst.equipe')::uuid)$$, 'admin desvincula');
select is((select count(*)::int from public.membros_equipe where profissional_id = current_setting('tst.alvo')::uuid), 0, 'vínculo removido');

-- 4. atualizar profissional
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'Fulana', 'multiprofissional', null, 'COREN', '123', 'SP')$$, 'P0001', 'Multiprofissional exige categoria.', 'multiprofissional sem categoria falha');
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'Fulana', 'medico', 'medica', 'CRM', '123', 'SP')$$, 'P0001', 'Somente multiprofissional tem categoria.', 'categoria fora de multiprofissional falha');
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'Fulana', 'medico', null, null, null, null)$$, 'P0001', 'Conselho, número e UF são obrigatórios para esta função.', 'médico sem conselho falha');
select lives_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'Fulana Enf', 'multiprofissional', 'enfermagem', 'COREN', '123', 'SP')$$, 'atualiza multiprofissional');
select lives_ok($$select public.admin_definir_ativo(current_setting('tst.alvo')::uuid, false)$$, 'admin desativa');

-- 4b. proteções do próprio perfil e do último admin
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.admin')::uuid, 'Admin', 'medico', null, 'CRM', '1', 'SP')$$, 'P0001', 'Você não pode alterar o seu próprio perfil.', 'admin não altera o próprio perfil');
select is((select perfil::text from public.profissionais where id = current_setting('tst.admin')::uuid), 'admin', 'perfil do admin intacto');
select lives_ok($$select public.admin_atualizar_profissional(current_setting('tst.admin')::uuid, 'Admin Renomeado', 'admin', null, null, null, null)$$, 'admin edita o próprio nome');
select throws_ok($$select public.admin_definir_ativo(current_setting('tst.admin')::uuid, false)$$, 'P0001', 'Você não pode desativar a si mesmo.', 'admin não desativa a si mesmo');
select throws_ok($$select public.admin_atualizar_profissional(current_setting('tst.alvo')::uuid, 'Fulana', null, null, null, null, null)$$, 'P0001', 'Informe o perfil.', 'perfil nulo falha');
select lives_ok($$select public.admin_atualizar_profissional(current_setting('tst.admin2')::uuid, 'Admin Dois', 'recepcao', null, null, null, null)$$, 'admin rebaixa outro admin (resta um ativo)');
select is((select perfil::text from public.profissionais where id = current_setting('tst.admin2')::uuid), 'recepcao', 'outro admin rebaixado');
select lives_ok($$select public.admin_atualizar_profissional(current_setting('tst.admin2')::uuid, 'Admin Dois', 'admin', null, null, null, null)$$, 'admin promove outro a admin');

-- 5. admin vê todos os profissionais, mas não conteúdo clínico
select cmp_ok((select count(*) from public.profissionais), '>=', 4::bigint, 'admin lê todos os profissionais');
select is(
  (select count(*)::int from public.evolucoes) + (select count(*)::int from public.anexos) + (select count(*)::int from public.internacoes_clinico),
  0, 'admin não lê conteúdo clínico');

-- 6. auditoria
reset role;
select ok(
  (select count(*) from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'equipes') >= 1
  and (select count(*) from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'membros_equipe') >= 2
  and (select count(*) from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'profissionais') >= 2,
  'ações do admin vão para auditoria');

select ok(
  exists (select 1 from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'equipes' and operacao = 'INSERT' and registro_id = current_setting('tst.equipe'))
  and exists (select 1 from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'profissionais' and operacao = 'UPDATE' and registro_id = current_setting('tst.alvo')),
  'auditoria registra o admin como autor de INSERT em equipes e UPDATE em profissionais');

-- 7. unicidade de nome de equipe no banco (case-insensitive)
select throws_ok($$insert into public.equipes (nome) values (' EQUIPE RENOMEADA 15 ')$$, '23505', null, 'índice único de nome de equipe');

-- 8. revogação de sessões: só service_role
reset role;
insert into auth.sessions (id, user_id) values ('15400000-0000-0000-0000-000000000001', current_setting('tst.alvo')::uuid);
select tests.autenticar(current_setting('tst.admin')::uuid);
select throws_ok($$select public.admin_revogar_sessoes(current_setting('tst.alvo')::uuid)$$, '42501', null, 'admin autenticado não revoga sessões');
reset role;
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.admin_revogar_sessoes(current_setting('tst.alvo')::uuid)$$, '42501', null, 'anon não revoga sessões');
reset role;
select ok(exists (select 1 from auth.sessions where user_id = current_setting('tst.alvo')::uuid), 'sessões intactas após tentativas negadas');
select set_config('role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.admin_revogar_sessoes(current_setting('tst.alvo')::uuid);
reset role;
select ok(not exists (select 1 from auth.sessions where user_id = current_setting('tst.alvo')::uuid), 'service_role revoga as sessões');

select * from finish();
rollback;
