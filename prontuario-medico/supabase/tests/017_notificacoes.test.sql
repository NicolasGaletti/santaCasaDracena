begin;
select plan(33);

select set_config('tst.m1', tests.criar_profissional('medico')::text, true);
select set_config('tst.m2', tests.criar_profissional('medico')::text, true);
select set_config('tst.m3', tests.criar_profissional('medico')::text, true);   -- fora da equipe
select set_config('tst.minativo', tests.criar_profissional('medico')::text, true);
select set_config('tst.res', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.rec', tests.criar_profissional('recepcao', false)::text, true);
select set_config('tst.adm', tests.criar_profissional('admin', false)::text, true);

insert into public.equipes (id, nome) values ('17000000-0000-0000-0000-000000000001', 'Equipe 17');
insert into public.membros_equipe (profissional_id, equipe_id)
select x::uuid, '17000000-0000-0000-0000-000000000001'
from unnest(array[current_setting('tst.m1'), current_setting('tst.m2'), current_setting('tst.minativo'),
                  current_setting('tst.res'), current_setting('tst.rec'), current_setting('tst.adm')]) x;
update public.profissionais set ativo = false where id = current_setting('tst.minativo')::uuid;

-- 1. admissão: médicos ativos da equipe recebem; recepção/admin/residente/inativo/fora não
reset role;
select tests.autenticar(current_setting('tst.rec')::uuid);
select set_config('tst.int', public.admitir_paciente('Paciente 17', '1960-01-01', 'SUS',
  '17000000-0000-0000-0000-000000000001', 'A-02', null, null, null)::text, true);
reset role;
select is((select count(*) from public.notificacoes where tipo = 'admissao_equipe'), 2::bigint, 'admissão notifica 2 médicos ativos da equipe');
select is((select count(*) from public.notificacoes where tipo = 'admissao_equipe'
  and destinatario_id in (current_setting('tst.m1')::uuid, current_setting('tst.m2')::uuid)), 2::bigint, 'destinatários são m1 e m2');
select is((select texto from public.notificacoes where tipo = 'admissao_equipe' limit 1), 'Paciente admitido na equipe · Leito A-02', 'texto da admissão');
select is((select count(*) from public.notificacoes where destinatario_id in
  (current_setting('tst.rec')::uuid, current_setting('tst.adm')::uuid, current_setting('tst.res')::uuid,
   current_setting('tst.minativo')::uuid, current_setting('tst.m3')::uuid)), 0::bigint, 'recepção, admin, residente, inativo e fora da equipe não recebem');

-- 2. rascunho do residente -> enviar -> validacao_pendente para m1, m2 (não autor)
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('17300000-0000-0000-0000-000000000001', current_setting('tst.int')::uuid, 'medica', current_setting('tst.res')::uuid, 'RASCUNHO',
   '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'T');
reset role;
select tests.autenticar(current_setting('tst.res')::uuid);
select lives_ok($$select public.enviar_evolucao('17300000-0000-0000-0000-000000000001')$$, 'residente envia');
reset role;
select is((select count(*) from public.notificacoes where tipo = 'validacao_pendente'
  and evolucao_id = '17300000-0000-0000-0000-000000000001'), 2::bigint, 'enviar gera validacao_pendente para 2 médicos');
select is((select texto from public.notificacoes where tipo = 'validacao_pendente' limit 1),
  'Nova evolução aguardando sua validação · Leito A-02', 'texto validacao_pendente');

-- 3. devolver (m1) -> evolucao_devolvida ao autor, devolvida_por = m1
reset role;
select tests.autenticar(current_setting('tst.m1')::uuid);
select lives_ok($$select public.devolver_evolucao('17300000-0000-0000-0000-000000000001', 'Ajustar')$$, 'm1 devolve');
reset role;
select is((select count(*) from public.notificacoes where tipo = 'evolucao_devolvida'
  and destinatario_id = current_setting('tst.res')::uuid), 1::bigint, 'devolução notifica o autor');
select is((select texto from public.notificacoes where tipo = 'evolucao_devolvida'), 'Sua evolução foi devolvida · Leito A-02', 'texto devolvida');
select is((select devolvida_por from public.evolucoes where id = '17300000-0000-0000-0000-000000000001'),
  current_setting('tst.m1')::uuid, 'devolvida_por gravado');
select is((select devolvida_por from public.vw_evolucoes_timeline where id = '17300000-0000-0000-0000-000000000001'),
  current_setting('tst.m1')::uuid, 'view expõe devolvida_por');

-- reenvio limpa devolvida_por
reset role;
select tests.autenticar(current_setting('tst.res')::uuid);
select public.enviar_evolucao('17300000-0000-0000-0000-000000000001');
reset role;
select is((select devolvida_por from public.evolucoes where id = '17300000-0000-0000-0000-000000000001'), null, 'reenvio limpa devolvida_por');

-- 4. validar (m2) -> evolucao_validada ao autor; evolucao_equipe a m1 (não validador, não autor)
reset role;
select tests.autenticar(current_setting('tst.m2')::uuid);
select lives_ok($$select public.validar_evolucao('17300000-0000-0000-0000-000000000001')$$, 'm2 valida');
reset role;
select is((select count(*) from public.notificacoes where tipo = 'evolucao_validada'
  and destinatario_id = current_setting('tst.res')::uuid), 1::bigint, 'validada notifica autor');
select is((select texto from public.notificacoes where tipo = 'evolucao_validada'), 'Sua evolução foi validada · Leito A-02', 'texto validada');
select is((select array_agg(destinatario_id order by destinatario_id) from public.notificacoes where tipo = 'evolucao_equipe'),
  array[current_setting('tst.m1')::uuid], 'evolucao_equipe: só m1 (exclui validador m2)');
select is((select texto from public.notificacoes where tipo = 'evolucao_equipe'), 'Nova evolução finalizada na equipe · Leito A-02', 'texto equipe');

-- 5. médico finaliza a própria: sem validada; evolucao_equipe a m2 (exclui m1 autor/validador)
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('17300000-0000-0000-0000-000000000002', current_setting('tst.int')::uuid, 'medica', current_setting('tst.m1')::uuid, 'RASCUNHO',
   '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'T');
reset role;
select tests.autenticar(current_setting('tst.m1')::uuid);
select lives_ok($$select public.finalizar_evolucao('17300000-0000-0000-0000-000000000002')$$, 'm1 finaliza a própria');
reset role;
select is((select count(*) from public.notificacoes where tipo = 'evolucao_validada'), 1::bigint, 'sem validada quando validador = autor');
select is((select count(*) from public.notificacoes where tipo = 'evolucao_equipe' and evolucao_id = '17300000-0000-0000-0000-000000000002'
  and destinatario_id = current_setting('tst.m2')::uuid), 1::bigint, 'equipe notifica m2');

-- 6. RLS: destinatário lê só as suas; sem escrita direta
reset role;
select tests.autenticar(current_setting('tst.res')::uuid);
select is((select count(*) from public.notificacoes where destinatario_id <> current_setting('tst.res')::uuid), 0::bigint, 'residente só lê as suas');
select throws_ok($$update public.notificacoes set lida_em = now()$$, '42501', null, 'sem UPDATE direto');
select throws_ok($$delete from public.notificacoes$$, '42501', null, 'sem DELETE direto');
select throws_ok($$insert into public.notificacoes (destinatario_id, tipo, texto) values (auth.uid(), 'evolucao_validada', 'x')$$, '42501', null, 'sem INSERT direto');
reset role;
select tests.autenticar(current_setting('tst.rec')::uuid);
select is((select count(*) from public.notificacoes), 0::bigint, 'recepção não lê nada');

-- 7. marcar_lida só das próprias
reset role;
select tests.autenticar(current_setting('tst.m1')::uuid);
select public.marcar_lida((select id from public.notificacoes where tipo = 'admissao_equipe' limit 1));
select is((select count(*) from public.notificacoes where lida_em is not null), 1::bigint, 'marcar_lida marca a própria');
reset role;
select tests.autenticar(current_setting('tst.m2')::uuid);
select public.marcar_lida((select id from public.notificacoes where destinatario_id = current_setting('tst.m1')::uuid limit 1));
reset role;
select is((select count(*) from public.notificacoes where destinatario_id = current_setting('tst.m1')::uuid and lida_em is not null), 1::bigint,
  'm2 não marca de m1 (ainda só 1 lida)');

-- 8. todas lidas, assinaturas e preferências
reset role;
select tests.autenticar(current_setting('tst.m2')::uuid);
select public.marcar_todas_lidas();
select public.registrar_assinatura_push('https://push.exemplo/1', 'p', 'a');
select public.salvar_preferencias_notificacao(false, true);
select is((select count(*) from public.notificacoes where lida_em is null), 0::bigint, 'marcar_todas_lidas');
select throws_ok($$select * from public.push_assinaturas$$, '42501', null, 'cliente não lê assinaturas');
select is((select push_validacao from public.preferencias_notificacao), false, 'preferência salva e lida');

reset role;
select is((select profissional_id from public.push_assinaturas where endpoint = 'https://push.exemplo/1'), current_setting('tst.m2')::uuid, 'assinatura registrada com dono = auth.uid()');
select tests.autenticar(current_setting('tst.m1')::uuid);
select public.remover_assinatura_push('https://push.exemplo/1');
reset role;
select is((select count(*) from public.push_assinaturas), 1::bigint, 'remover só remove a própria');

select * from finish();
rollback;
