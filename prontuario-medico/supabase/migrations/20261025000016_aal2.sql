-- MFA obrigatório para admin (Plano 4, Task 7).
-- Admin precisa de sessão aal2 (senha + TOTP) para qualquer função admin_*.
-- Todas as funções admin_* chamam app.exige_admin() primeiro; basta recriá-la.

create function app.exige_aal2() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if app.perfil_atual() = 'admin'
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Confirme o código do autenticador para continuar.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app.exige_aal2() from public, anon;
grant execute on function app.exige_aal2() to authenticated;

create or replace function app.exige_admin() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if app.perfil_atual() is distinct from 'admin' then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  perform app.exige_aal2();
end;
$$;
revoke all on function app.exige_admin() from public, anon;
grant execute on function app.exige_admin() to authenticated;

-- Leitura de todos os profissionais pelo admin exige aal2 (a policy própria
-- profissionais_select_proprio segue permitindo ler a própria linha em aal1,
-- necessária às páginas de MFA).
drop policy profissionais_select_admin on public.profissionais;
create policy profissionais_select_admin on public.profissionais for select to authenticated
  using (app.perfil_atual() = 'admin' and coalesce(auth.jwt()->>'aal', '') = 'aal2');
