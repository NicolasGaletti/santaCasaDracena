-- Primeiro administrador do sistema (idempotente).
--
-- Pré-requisito: o usuário já existe em Authentication (painel do Supabase ->
-- Authentication -> Users -> Invite user), o que dispara o e-mail de convite.
--
-- Uso (e-mail e nome passados na hora; nunca gravados no repositório):
--   psql "$SUPABASE_DB_URL" -v email='pessoa@exemplo.com' -v nome='Nome Completo' \
--        -f supabase/scripts/primeiro-admin.sql
-- No SQL Editor do Supabase (sem psql): trocar :'email' e :'nome' no select
-- abaixo pelos valores entre aspas simples, ex.: 'pessoa@exemplo.com', e executar.
--
-- Rodar de novo apenas reaplica perfil admin e ativo; não duplica nada.

-- Variáveis do psql não são expandidas dentro de $$...$$; passam por set_config.
select set_config('primeiro_admin.email', :'email', false),
       set_config('primeiro_admin.nome', :'nome', false);

do $$
declare
  v_email text := lower(btrim(current_setting('primeiro_admin.email')));
  v_nome  text := btrim(current_setting('primeiro_admin.nome'));
  v_id    uuid;
begin
  if v_email = '' or v_nome = '' then
    raise exception 'Informe e-mail e nome (-v email=... -v nome=...).';
  end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    raise exception 'Usuário % não existe em auth.users. Convide antes pelo painel (Authentication -> Users -> Invite user).', v_email;
  end if;

  insert into public.profissionais (id, nome, perfil, conselho, numero_conselho, uf_conselho, ativo)
  values (v_id, v_nome, 'admin', null, null, null, true)
  on conflict (id) do update
    set nome = excluded.nome,
        perfil = 'admin',
        conselho = null,
        numero_conselho = null,
        uf_conselho = null,
        ativo = true;

  raise notice 'OK: % agora é administrador (id %). Próximo passo: abrir o convite, definir a senha e cadastrar o autenticador (MFA).', v_email, v_id;
end
$$;
