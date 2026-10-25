begin;
select plan(8);

-- setup como postgres (transaction-local)
select set_config('tst.recepcao', tests.criar_profissional('recepcao')::text, true);
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);

insert into public.equipes (id, nome) values ('61616161-6161-6161-6161-616161616161', 'Equipe 006');

-- 1. admitir sem médico responsável cria internação com equipe
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select set_config('tst.admitido_006', public.admitir_paciente(
  'Paciente Sem Medico', '1975-03-03', 'SUS', '61616161-6161-6161-6161-616161616161', 'E-01',
  'Pneumonia', null, null
)::text, true);
reset role;
select ok(
  exists (
    select 1 from public.internacoes
    where id = current_setting('tst.admitido_006')::uuid
      and status = 'INTERNADO'
      and equipe_id = '61616161-6161-6161-6161-616161616161'
      and medico_responsavel_id is null
  ),
  'admitir sem médico responsável cria internação com equipe'
);

-- 2. assinatura antiga (9 argumentos) não existe mais
select hasnt_function(
  'public', 'admitir_paciente',
  array['text', 'date', 'text', 'uuid', 'text', 'text', 'text', 'text', 'uuid'],
  'assinatura antiga não existe mais'
);

-- 3. assinatura nova existe
select has_function(
  'public', 'admitir_paciente',
  array['text', 'date', 'text', 'uuid', 'text', 'text', 'text', 'text'],
  'assinatura nova de admitir_paciente existe'
);

-- 4. admitir sem equipe falha
reset role;
select tests.autenticar(current_setting('tst.recepcao')::uuid);
select throws_ok(
  $$select public.admitir_paciente('Paciente Sem Equipe', '1975-03-03', 'SUS', null, 'E-02', null, null, null)$$,
  'P0001', 'Preencha os campos obrigatórios.',
  'admitir sem equipe falha'
);

-- 5. médico também admite sem informar médico responsável
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid);
select lives_ok(
  $$select public.admitir_paciente('Paciente Medico', '1975-03-03', 'SUS', '61616161-6161-6161-6161-616161616161', 'E-03', null, null, null)$$,
  'médico admite sem médico responsável'
);

-- 6. privilégios: função nova em public não dá EXECUTE a anon (ACL padrão do postgres)
reset role;
create function public.tst_fn_006() returns integer language sql as $$ select 1 $$;
select ok(
  not has_function_privilege('anon', 'public.tst_fn_006()', 'execute'),
  'função nova em public: anon sem EXECUTE'
);

-- 7. privilégios: admitir_paciente executável só por authenticated
select ok(
  not has_function_privilege('anon', 'public.admitir_paciente(text,date,text,uuid,text,text,text,text)', 'execute')
  and has_function_privilege('authenticated', 'public.admitir_paciente(text,date,text,uuid,text,text,text,text)', 'execute'),
  'admitir_paciente: anon sem EXECUTE, authenticated com EXECUTE'
);

-- 8. privilégios: função nova em public não dá EXECUTE a PUBLIC
select ok(
  not has_function_privilege('public', 'public.tst_fn_006()', 'execute'),
  'função nova em public: PUBLIC sem EXECUTE'
);

select * from finish();
rollback;
