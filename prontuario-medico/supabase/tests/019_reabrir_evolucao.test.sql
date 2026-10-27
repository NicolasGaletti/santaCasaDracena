begin;
select plan(39);

select set_config('tst.m1', tests.criar_profissional('medico')::text, true);
select set_config('tst.m2', tests.criar_profissional('medico')::text, true);
select set_config('tst.res', tests.criar_profissional('residente', true, 'medica')::text, true);
select set_config('tst.aca', tests.criar_profissional('academico', false, 'medica')::text, true);

insert into public.equipes (id, nome) values ('19000000-0000-0000-0000-000000000001', 'Equipe 19');
insert into public.membros_equipe (profissional_id, equipe_id)
select x::uuid, '19000000-0000-0000-0000-000000000001'
from unnest(array[current_setting('tst.m1'), current_setting('tst.m2'), current_setting('tst.res'), current_setting('tst.aca')]) x;

-- internação n (INTERNADO ou ALTA) e evolução finalizada há p_min minutos
create function tests.nova_int(p_n int, p_status public.status_internacao default 'INTERNADO') returns uuid
language plpgsql as $$
declare
  v_p uuid := ('19900000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid;
  v_i uuid := ('19800000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid;
begin
  insert into public.pacientes (id, nome, data_nascimento, convenio) values (v_p, 'Paciente 19-' || p_n, '1950-01-01', 'SUS');
  insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, status, alta_em, alta_por, motivo_alta)
  values (v_i, v_p, '19000000-0000-0000-0000-000000000001', current_setting('tst.m1')::uuid, 'R-' || p_n, p_status,
          case when p_status = 'ALTA' then now() end,
          case when p_status = 'ALTA' then current_setting('tst.m1')::uuid end,
          case when p_status = 'ALTA' then 'Melhora' end);
  return v_i;
end $$;

create function tests.ev_fin(p_id text, p_int uuid, p_autor uuid, p_validador uuid, p_min numeric, p_adendo_de uuid default null) returns void
language plpgsql as $$
begin
  insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, finalizada_em, validada_por, validada_em,
                                snapshot_autor, snapshot_validador, conteudo_hash, hash_versao, adendo_de)
  values (p_id::uuid, p_int, 'medica', p_autor, 'FINALIZADA',
          '{"modelo_versao":"medica@1","evolucao_clinica":"Evo","conduta":"Cond"}', 'T',
          now() - make_interval(mins => 0, secs => (p_min * 60)::int), p_validador, now(),
          '{"nome":"x"}', '{"nome":"x"}', repeat('a', 64), 2, p_adendo_de);
end $$;

-- ===== sucesso (fluxo real: salvar, finalizar, reabrir, editar, finalizar de novo) =====
select set_config('tst.i1', tests.nova_int(1)::text, true);
reset role;
select tests.autenticar(current_setting('tst.m1')::uuid);
select set_config('tst.e1', (select id::text from public.salvar_rascunho(current_setting('tst.i1')::uuid,
  '{"modelo_versao":"medica@1","evolucao_clinica":"Evo 1","conduta":"Cond 1"}'::jsonb, 'T1')), true);
select lives_ok($$select public.finalizar_evolucao(current_setting('tst.e1')::uuid)$$, 'm1 finaliza');
reset role;
select set_config('tst.hash1', (select conteudo_hash from public.evolucoes where id = current_setting('tst.e1')::uuid), true);
select is((select count(*) from public.notificacoes where tipo = 'evolucao_equipe' and evolucao_id = current_setting('tst.e1')::uuid),
  1::bigint, 'finalização avisou m2 e a equipe');

select tests.autenticar(current_setting('tst.m1')::uuid);
select lives_ok($$select public.reabrir_evolucao(current_setting('tst.e1')::uuid)$$, 'autor reabre dentro do prazo');
reset role;
select is((select status::text from public.evolucoes where id = current_setting('tst.e1')::uuid), 'RASCUNHO', 'voltou a RASCUNHO');
select ok((select finalizada_em is null and conteudo_hash is null and snapshot_autor is null and snapshot_validador is null
                  and validada_por is null and validada_em is null and hash_versao = 1
           from public.evolucoes where id = current_setting('tst.e1')::uuid), 'limpou finalização, hash, snapshots e validação');
select is((select count(*) from public.notificacoes where tipo = 'evolucao_equipe' and evolucao_id = current_setting('tst.e1')::uuid),
  0::bigint, 'aviso de equipe da finalização foi desfeito');
select is((select count(*) from public.auditoria where tabela = 'evolucoes' and registro_id = current_setting('tst.e1')
  and depois->>'acao' = 'REABERTURA' and por = current_setting('tst.m1')::uuid), 1::bigint, 'auditoria registra a reabertura');
select is((select count(*) from public.auditoria where tabela = 'evolucoes' and registro_id = current_setting('tst.e1')
  and antes->>'status' = 'FINALIZADA' and depois->>'status' = 'RASCUNHO' and operacao = 'UPDATE'), 2::bigint,
  'auditoria tem o UPDATE do trigger e o registro explícito');

-- editar e finalizar de novo
select tests.autenticar(current_setting('tst.m1')::uuid);
select lives_ok($$select public.salvar_rascunho(current_setting('tst.i1')::uuid,
  '{"modelo_versao":"medica@1","evolucao_clinica":"Evo 1 corrigida","conduta":"Cond 1"}'::jsonb, 'T1')$$, 'edita depois de reabrir');
select lives_ok($$select public.finalizar_evolucao(current_setting('tst.e1')::uuid)$$, 'finaliza de novo');
reset role;
select ok((select status = 'FINALIZADA' and finalizada_em is not null and conteudo_hash is not null and conteudo_hash <> current_setting('tst.hash1')
                  and dados->>'evolucao_clinica' = 'Evo 1 corrigida' and hash_versao = 2
           from public.evolucoes where id = current_setting('tst.e1')::uuid), 'novo hash e finalizada_em após refinalizar');
select is((select count(*) from public.notificacoes where tipo = 'evolucao_equipe' and evolucao_id = current_setting('tst.e1')::uuid),
  1::bigint, 'refinalizar avisa a equipe de novo');

-- ===== recusas =====
-- prazo: finalizada há 20 min
select set_config('tst.i2', tests.nova_int(2)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000002', current_setting('tst.i2')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 20);
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000002')$$, 'P0001',
  'O prazo de 15 minutos para reabrir terminou. Use um adendo para corrigir.', 'recusa depois de 15 minutos');
reset role;

-- impressa
select set_config('tst.i3', tests.nova_int(3)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000003', current_setting('tst.i3')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 2);
insert into public.impressoes (evolucao_id, impresso_por, via) values ('19600000-0000-0000-0000-000000000003', current_setting('tst.m1')::uuid, 1);
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000003')$$, 'P0001',
  'Esta evolução já foi impressa. Use um adendo para corrigir.', 'recusa depois de impressa');
reset role;

-- não é a mais recente (outra finalizada depois, de outro médico)
select set_config('tst.i4', tests.nova_int(4)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000004', current_setting('tst.i4')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 5);
select tests.ev_fin('19600000-0000-0000-0000-000000000014', current_setting('tst.i4')::uuid, current_setting('tst.m2')::uuid, current_setting('tst.m2')::uuid, 1);
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000004')$$, 'P0001',
  'Há uma evolução mais recente nesta internação. Use um adendo para corrigir.', 'recusa se há finalizada mais recente');
reset role;

-- adendo apontando para ela (rascunho de adendo de m2) impede; e adendo finalizado não reabre
select set_config('tst.i5', tests.nova_int(5)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000005', current_setting('tst.i5')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 5);
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre, adendo_de) values
  ('19600000-0000-0000-0000-000000000015', current_setting('tst.i5')::uuid, 'medica', current_setting('tst.m2')::uuid, 'RASCUNHO',
   '{"modelo_versao":"medica@1"}', '', '19600000-0000-0000-0000-000000000005');
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000005')$$, 'P0001',
  'Há uma evolução mais recente nesta internação. Use um adendo para corrigir.', 'recusa se existe adendo apontando para ela');
reset role;

select set_config('tst.i6', tests.nova_int(6)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000006', current_setting('tst.i6')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 5);
select tests.ev_fin('19600000-0000-0000-0000-000000000016', current_setting('tst.i6')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 1, '19600000-0000-0000-0000-000000000006');
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000016')$$, 'P0001',
  'Adendo não pode ser reaberto. Crie um novo adendo para corrigir.', 'adendo não é reaberto');
reset role;

-- internação com alta
select set_config('tst.i7', tests.nova_int(7, 'ALTA')::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000007', current_setting('tst.i7')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 2);
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000007')$$, 'P0001',
  'Internação com alta: use um adendo para corrigir.', 'recusa com internação em alta');
reset role;

-- outro rascunho aberto do autor na internação
select set_config('tst.i8', tests.nova_int(8)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000008', current_setting('tst.i8')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 2);
insert into public.evolucoes (id, internacao_id, categoria, autor_id, status, dados, texto_livre) values
  ('19600000-0000-0000-0000-000000000018', current_setting('tst.i8')::uuid, 'medica', current_setting('tst.m1')::uuid, 'RASCUNHO', '{"modelo_versao":"medica@1"}', '');
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000008')$$, 'P0001',
  'Você já tem um rascunho aberto nesta internação. Finalize ou descarte antes de reabrir.', 'recusa com outro rascunho aberto');
reset role;

-- validada por outro médico (autor m1, validador m2)
select set_config('tst.i9', tests.nova_int(9)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000009', current_setting('tst.i9')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m2')::uuid, 2);
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000009')$$, 'P0001',
  'Esta evolução foi validada por outro médico e não pode ser reaberta. Use um adendo para corrigir.', 'recusa se validada por outro');
reset role;

-- rascunho não é reaberto
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000018')$$, 'P0001',
  'Somente evoluções finalizadas podem ser reabertas.', 'rascunho não é reaberto');
reset role;

-- id inexistente
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$select public.reabrir_evolucao(gen_random_uuid())$$, 'P0001', 'Evolução não encontrada.', 'id inexistente');
reset role;

-- ===== quem pode =====
select set_config('tst.i10', tests.nova_int(10)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000010', current_setting('tst.i10')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 2);
select tests.autenticar(current_setting('tst.m2')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000010')$$, 'P0001', 'Acesso negado.', 'outro médico não reabre');
reset role;
select is((select status::text from public.evolucoes where id = '19600000-0000-0000-0000-000000000010'), 'FINALIZADA', 'continua finalizada após tentativa de outro médico');

select set_config('tst.i11', tests.nova_int(11)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000011', current_setting('tst.i11')::uuid, current_setting('tst.res')::uuid, current_setting('tst.m1')::uuid, 2);
select tests.autenticar(current_setting('tst.res')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000011')$$, 'P0001', 'Acesso negado.', 'residente (autor) não reabre');
reset role;

select set_config('tst.i12', tests.nova_int(12)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000012', current_setting('tst.i12')::uuid, current_setting('tst.aca')::uuid, current_setting('tst.m1')::uuid, 2);
select tests.autenticar(current_setting('tst.aca')::uuid);
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000012')$$, 'P0001', 'Acesso negado.', 'acadêmico (autor) não reabre');
reset role;

-- anônimo e não autenticado sem execute
set local role anon;
select throws_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000010')$$, '42501', null, 'anon sem EXECUTE');
reset role;

-- ===== imutabilidade continua =====
select tests.autenticar(current_setting('tst.m1')::uuid);
select throws_ok($$update public.evolucoes set texto_livre = 'x' where id = '19600000-0000-0000-0000-000000000010'$$, '42501', null, 'UPDATE direto de authenticated: sem permissão');
-- mesmo com o sinal ligado, authenticated não tem UPDATE em evolucoes
select lives_ok($$select set_config('app.reabrindo', '19600000-0000-0000-0000-000000000010', true)$$, 'sinal pode ser setado na sessão (é só um GUC)');
select throws_ok($$update public.evolucoes set status = 'RASCUNHO' where id = '19600000-0000-0000-0000-000000000010'$$, '42501', null,
  'com o sinal ligado, authenticated ainda não tem UPDATE');
reset role;
select set_config('app.reabrindo', '', true);

-- gatilho (dono): sem sinal, com sinal de outra evolução ou com mudança que não é reabertura, segue bloqueado
select throws_ok($$update public.evolucoes set status = 'RASCUNHO' where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'sem sinal: FINALIZADA->RASCUNHO bloqueado');
select set_config('app.reabrindo', '19600000-0000-0000-0000-000000000002', true);
select throws_ok($$update public.evolucoes set status = 'RASCUNHO' where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'sinal de outra evolução não vale');
select set_config('app.reabrindo', '19600000-0000-0000-0000-000000000010', true);
select throws_ok($$update public.evolucoes set texto_livre = 'alterado' where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'sinal não permite editar conteúdo mantendo FINALIZADA');
select throws_ok($$update public.evolucoes set status = 'AGUARDANDO_VALIDACAO' where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'sinal só vale para a transição para RASCUNHO');
select throws_ok($$update public.evolucoes set status = 'RASCUNHO', adendo_de = id where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'sinal não permite mudar adendo_de');
select throws_ok($$delete from public.evolucoes where id = '19600000-0000-0000-0000-000000000010'$$, 'P0001',
  'Evolução finalizada não pode ser alterada.', 'DELETE de finalizada segue bloqueado mesmo com o sinal');
select set_config('app.reabrindo', '', true);

-- ===== anexos voltam a ser editáveis =====
select set_config('tst.i13', tests.nova_int(13)::text, true);
select tests.ev_fin('19600000-0000-0000-0000-000000000013', current_setting('tst.i13')::uuid, current_setting('tst.m1')::uuid, current_setting('tst.m1')::uuid, 2);
insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame, storage_path, mime, tamanho_bytes, sha256, confirmado, enviado_por)
values ('19700000-0000-0000-0000-000000000001', '19600000-0000-0000-0000-000000000013', current_setting('tst.i13')::uuid, 'OUTRO', 'a',
        current_date, 'p19/anexo1.pdf', 'application/pdf', 10, repeat('b', 64), true, current_setting('tst.m1')::uuid);
select throws_ok($$update public.anexos set descricao = 'b' where id = '19700000-0000-0000-0000-000000000001'$$, 'P0001',
  'Anexo de evolução finalizada não pode ser alterado.', 'anexo travado enquanto finalizada');
select tests.autenticar(current_setting('tst.m1')::uuid);
select lives_ok($$select public.reabrir_evolucao('19600000-0000-0000-0000-000000000013')$$, 'reabre evolução com anexo');
reset role;
select lives_ok($$update public.anexos set descricao = 'b' where id = '19700000-0000-0000-0000-000000000001'$$, 'anexo editável de novo (rascunho)');

select * from finish();
rollback;
