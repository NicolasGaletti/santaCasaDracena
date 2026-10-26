begin;
select plan(14);

select set_config('tst.admin', tests.criar_profissional('admin', false)::text, true);
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);
select set_config('tst.recepcao', tests.criar_profissional('recepcao', false)::text, true);
insert into public.equipes (id, nome) values ('18000000-0000-0000-0000-000000000001', 'Equipe Base 18');

-- 1. seed
select ok(
  exists (select 1 from public.convenios where nome = 'SUS') and exists (select 1 from public.convenios where nome = 'Particular'),
  'seed contém SUS e Particular');

-- 2. valores existentes viram convênios (reaplica a lógica de cópia da migration sobre dados novos)
insert into public.pacientes (nome, data_nascimento, convenio) values ('P18 a', '1950-01-01', '  Convenio Legado 18 ');
insert into public.pacientes (nome, data_nascimento, convenio) values ('P18 b', '1950-01-01', repeat('x', 101));
insert into public.convenios (nome)
select distinct on (lower(btrim(convenio))) btrim(convenio) from public.pacientes
where nullif(btrim(convenio), '') is not null
  and char_length(btrim(convenio)) <= 100
on conflict do nothing;
select ok(exists (select 1 from public.convenios where nome = 'Convenio Legado 18'), 'valores existentes viraram convênios');
select ok(not exists (select 1 from public.convenios where char_length(nome) > 100), 'valor com mais de 100 caracteres é ignorado sem erro');

-- 3. médico não cria
select tests.autenticar(current_setting('tst.medico')::uuid, 'aal2');
select throws_ok($$select public.admin_salvar_convenio(null, 'X18', true)$$, 'P0001', 'Acesso negado.', 'médico não cria');

-- 4. admin aal1 não cria
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid, 'aal1');
select throws_ok($$select public.admin_salvar_convenio(null, 'X18', true)$$, 'P0001', null, 'admin aal1 não cria');

-- 5. admin aal2 cria e renomeia
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid, 'aal2');
select set_config('tst.conv', public.admin_salvar_convenio(null, '  Amil 18 ', true)::text, true);
select is((select nome from public.convenios where id = current_setting('tst.conv')::uuid), 'Amil 18', 'admin aal2 cria');
select lives_ok($$select public.admin_salvar_convenio(current_setting('tst.conv')::uuid, 'Amil Plus 18', true)$$, 'admin renomeia');

-- 6. duplicado com outra caixa
select throws_ok($$select public.admin_salvar_convenio(null, ' amil plus 18', true)$$, 'P0001', 'Já existe um convênio com esse nome.', 'duplicado com outra caixa falha');

-- 7. admitir grava nome canônico
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select set_config('tst.int', public.admitir_paciente('Paciente 18', '1960-01-01', '  amil PLUS 18 ', '18000000-0000-0000-0000-000000000001', 'L-18', null, null, null)::text, true);
select is(
  (select p.convenio from public.pacientes p join public.internacoes i on i.paciente_id = p.id where i.id = current_setting('tst.int')::uuid),
  'Amil Plus 18', 'admitir grava nome canônico');

-- 8. recepção lê convênios ativos
select ok((select count(*) from public.vw_convenios_ordenados where nome = 'Amil Plus 18') = 1, 'recepção lê convênios ativos');
select ok((select usos from public.vw_convenios_ordenados where nome = 'Amil Plus 18') = 1, 'view conta usos');

-- 9. inativo falha
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid, 'aal2');
select public.admin_salvar_convenio(current_setting('tst.conv')::uuid, 'Amil Plus 18', false);
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select public.admitir_paciente('Paciente 18b', '1960-01-01', 'Amil Plus 18', '18000000-0000-0000-0000-000000000001', 'L-19', null, null, null)$$,
  'P0001', 'Escolha um convênio da lista.', 'admitir com convênio inativo falha com a mensagem');
select throws_ok(
  $$select public.admitir_paciente('Paciente 18c', '1960-01-01', 'Inexistente 18', '18000000-0000-0000-0000-000000000001', 'L-20', null, null, null)$$,
  'P0001', 'Escolha um convênio da lista.', 'admitir com convênio inexistente falha');

-- 10. auditoria
reset role;
select ok(
  (select count(*) from public.auditoria where por = current_setting('tst.admin')::uuid and tabela = 'convenios') >= 3,
  'ação do admin vai para auditoria');

select * from finish();
rollback;
