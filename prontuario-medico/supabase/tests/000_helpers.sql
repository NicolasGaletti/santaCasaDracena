create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

drop function if exists tests.autenticar(uuid);

-- p_aal: nível de garantia do JWT ('aal1' = só senha; 'aal2' = senha + TOTP).
create or replace function tests.autenticar(p_user uuid, p_aal text default 'aal1')
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end;
$$;

create or replace function tests.criar_profissional(
  p_perfil perfil_profissional,
  p_conselho boolean default true,
  p_categoria categoria_evolucao default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-' || v_id || '@teste.local');

  insert into public.profissionais (id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho)
  values (
    v_id,
    'Teste ' || p_perfil::text,
    p_perfil,
    p_categoria,
    case when p_conselho then 'CRM' end,
    case when p_conselho then '123456' end,
    case when p_conselho then 'SP' end
  );

  return v_id;
end;
$$;

begin;
select plan(1);
select pass('helpers carregados');
select * from finish();
rollback;
