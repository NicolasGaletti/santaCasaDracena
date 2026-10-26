begin;
select plan(7);

select set_config('tst.admin', tests.criar_profissional('admin', false)::text, true);
select set_config('tst.medico', tests.criar_profissional('medico')::text, true);

-- admin com sessão aal1 (só senha) é recusado em toda função admin_*
select tests.autenticar(current_setting('tst.admin')::uuid, 'aal1');
select throws_ok($$select public.admin_salvar_equipe(null, 'Equipe 16', true)$$, 'P0001', 'Confirme o código do autenticador para continuar.', 'admin aal1 não cria equipe');
select throws_ok($$select * from public.admin_listar_profissionais()$$, 'P0001', 'Confirme o código do autenticador para continuar.', 'admin aal1 não lista profissionais');
select throws_ok($$select public.admin_definir_ativo(current_setting('tst.medico')::uuid, false)$$, 'P0001', 'Confirme o código do autenticador para continuar.', 'admin aal1 não desativa');

-- sem claim aal também é recusado
select set_config('request.jwt.claims', json_build_object('sub', current_setting('tst.admin'), 'role', 'authenticated')::text, true);
select throws_ok($$select public.admin_salvar_equipe(null, 'Equipe 16', true)$$, 'P0001', 'Confirme o código do autenticador para continuar.', 'admin sem aal não cria equipe');

-- admin aal2 funciona
reset role;
select tests.autenticar(current_setting('tst.admin')::uuid, 'aal2');
select lives_ok($$select public.admin_salvar_equipe(null, 'Equipe 16', true)$$, 'admin aal2 cria equipe');

-- médico aal1 segue normalmente (exige_aal2 só vale para admin)
reset role;
select tests.autenticar(current_setting('tst.medico')::uuid, 'aal1');
select lives_ok($$select count(*) from public.internacoes$$, 'médico aal1 lê internações');
select throws_ok($$select public.admin_salvar_equipe(null, 'X', true)$$, 'P0001', 'Acesso negado.', 'médico aal1 segue recebendo Acesso negado');

select * from finish();
rollback;
