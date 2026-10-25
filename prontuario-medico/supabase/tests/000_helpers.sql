create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

create or replace function tests.autenticar(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;

create or replace function tests.criar_profissional(p_perfil perfil_profissional, p_conselho boolean default true)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-' || v_id || '@teste.local');

  insert into public.profissionais (id, nome, perfil, conselho, numero_conselho, uf_conselho)
  values (
    v_id,
    'Teste ' || p_perfil::text,
    p_perfil,
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
