-- Funções de administração (Plano 4, Task 3).
-- Auditoria: os triggers auditar_equipes/membros_equipe/profissionais (0001) já cobrem
-- todas as escritas abaixo, com auth.uid() do admin como autor.
-- Task 7 acrescenta app.exige_aal2() dentro de app.exige_admin().

-- Admin lê todas as linhas de profissionais (equipes e membros_equipe já são
-- legíveis por qualquer profissional ativo). Evolucoes/anexos/internacoes_clinico
-- seguem negados: eh_clinico() exclui admin.
create policy profissionais_select_admin on public.profissionais for select to authenticated
  using (app.perfil_atual() = 'admin');

-- Unicidade de nome de equipe garantida também no banco (a checagem na função só dá a mensagem amigável).
create unique index equipes_nome_unico on public.equipes (lower(btrim(nome)));

create function app.exige_admin() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if app.perfil_atual() is distinct from 'admin' then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app.exige_admin() from public, anon;
grant execute on function app.exige_admin() to authenticated;

-- Falha se, após a mudança em curso, não restar admin ativo. Trava as linhas dos admins
-- ativos para serializar mudanças concorrentes.
create function app.exige_outro_admin_ativo(p_excluir uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profissionais
   where perfil = 'admin' and ativo and id <> p_excluir
   for update;
  if not found then
    raise exception 'Deve existir ao menos um administrador ativo.' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app.exige_outro_admin_ativo(uuid) from public, anon, authenticated;

create function public.admin_salvar_equipe(p_id uuid, p_nome text, p_ativo boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
  v_id uuid := p_id;
begin
  perform app.exige_admin();
  if v_nome is null then
    raise exception 'Informe o nome da equipe.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.equipes e
    where lower(btrim(e.nome)) = lower(v_nome) and e.id is distinct from p_id
  ) then
    raise exception 'Já existe uma equipe com esse nome.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.equipes (nome, ativo) values (v_nome, coalesce(p_ativo, true))
    returning id into v_id;
  else
    update public.equipes set nome = v_nome, ativo = coalesce(p_ativo, ativo) where id = p_id;
    if not found then
      raise exception 'Equipe não encontrada.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.admin_vincular(p_profissional_id uuid, p_equipe_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.exige_admin();
  if not exists (select 1 from public.profissionais where id = p_profissional_id) then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.equipes where id = p_equipe_id) then
    raise exception 'Equipe não encontrada.' using errcode = 'P0001';
  end if;
  insert into public.membros_equipe (profissional_id, equipe_id)
  values (p_profissional_id, p_equipe_id)
  on conflict do nothing;
end;
$$;

create function public.admin_desvincular(p_profissional_id uuid, p_equipe_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.exige_admin();
  delete from public.membros_equipe
  where profissional_id = p_profissional_id and equipe_id = p_equipe_id;
end;
$$;

create function public.admin_atualizar_profissional(
  p_id uuid,
  p_nome text,
  p_perfil public.perfil_profissional,
  p_categoria public.categoria_evolucao,
  p_conselho text,
  p_numero text,
  p_uf text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
  v_conselho text := nullif(btrim(p_conselho), '');
  v_numero text := nullif(btrim(p_numero), '');
  v_uf text := nullif(upper(btrim(p_uf)), '');
  v_perfil_atual public.perfil_profissional;
begin
  perform app.exige_admin();
  if v_nome is null then
    raise exception 'Informe o nome do profissional.' using errcode = 'P0001';
  end if;
  if p_perfil is null then
    raise exception 'Informe o perfil.' using errcode = 'P0001';
  end if;
  select p.perfil into v_perfil_atual from public.profissionais p where p.id = p_id;
  if p_id = auth.uid() and p_perfil is distinct from v_perfil_atual then
    raise exception 'Você não pode alterar o seu próprio perfil.' using errcode = 'P0001';
  end if;
  if v_perfil_atual = 'admin' and p_perfil <> 'admin' then
    perform app.exige_outro_admin_ativo(p_id);
  end if;
  if p_perfil = 'multiprofissional' and p_categoria is null then
    raise exception 'Multiprofissional exige categoria.' using errcode = 'P0001';
  end if;
  if p_perfil <> 'multiprofissional' and p_categoria is not null then
    raise exception 'Somente multiprofissional tem categoria.' using errcode = 'P0001';
  end if;
  if p_perfil in ('medico','residente','multiprofissional')
     and (v_conselho is null or v_numero is null or v_uf is null) then
    raise exception 'Conselho, número e UF são obrigatórios para esta função.' using errcode = 'P0001';
  end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
    raise exception 'UF inválida.' using errcode = 'P0001';
  end if;

  update public.profissionais
     set nome = v_nome, perfil = p_perfil, categoria = p_categoria,
         conselho = v_conselho, numero_conselho = v_numero, uf_conselho = v_uf
   where id = p_id;
  if not found then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

-- A revogação de sessões fica na Edge Function.
create function public.admin_definir_ativo(p_id uuid, p_ativo boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.exige_admin();
  if p_id = auth.uid() and not coalesce(p_ativo, false) then
    raise exception 'Você não pode desativar a si mesmo.' using errcode = 'P0001';
  end if;
  if not coalesce(p_ativo, true)
     and exists (select 1 from public.profissionais where id = p_id and perfil = 'admin' and ativo) then
    perform app.exige_outro_admin_ativo(p_id);
  end if;
  update public.profissionais set ativo = coalesce(p_ativo, ativo) where id = p_id;
  if not found then
    raise exception 'Profissional não encontrado.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.admin_salvar_equipe(uuid, text, boolean) from public, anon;
revoke all on function public.admin_vincular(uuid, uuid) from public, anon;
revoke all on function public.admin_desvincular(uuid, uuid) from public, anon;
revoke all on function public.admin_atualizar_profissional(uuid, text, public.perfil_profissional, public.categoria_evolucao, text, text, text) from public, anon;
revoke all on function public.admin_definir_ativo(uuid, boolean) from public, anon;
grant execute on function public.admin_salvar_equipe(uuid, text, boolean) to authenticated;
grant execute on function public.admin_vincular(uuid, uuid) to authenticated;
grant execute on function public.admin_desvincular(uuid, uuid) to authenticated;
grant execute on function public.admin_atualizar_profissional(uuid, text, public.perfil_profissional, public.categoria_evolucao, text, text, text) to authenticated;
grant execute on function public.admin_definir_ativo(uuid, boolean) to authenticated;
