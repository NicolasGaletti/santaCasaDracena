-- Endurecimento pós-revisão do plano 1. Migrações 0001–0004 já estão em staging: não são editadas aqui.

-- 1. Impressão idempotente: a mesma chave devolve a via já registrada, sem nova linha.
alter table public.impressoes add column chave uuid;
create unique index impressoes_evolucao_chave
  on public.impressoes (evolucao_id, chave)
  where chave is not null;

-- Substitui a assinatura de 1 argumento (evita ambiguidade na chamada por nome).
drop function public.registrar_impressoes(uuid[]);

create function public.registrar_impressoes(p_ids uuid[], p_chave uuid default null)
returns table (evolucao_id uuid, via integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_status public.status_evolucao;
  v_via integer;
begin
  if not (app.profissional_ativo() and app.eh_clinico()) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  for v_id in select distinct u.id from unnest(p_ids) as u(id) order by u.id loop
    select e.status into v_status from public.evolucoes e where e.id = v_id for update;
    if not found then
      raise exception 'Evolução não encontrada.' using errcode = 'P0001';
    end if;
    if v_status <> 'FINALIZADA' then
      raise exception 'Somente evoluções finalizadas podem ser impressas.' using errcode = 'P0001';
    end if;

    v_via := null;
    if p_chave is not null then
      select i.via into v_via from public.impressoes i
      where i.evolucao_id = v_id and i.chave = p_chave;
    end if;

    if v_via is null then
      select (count(*) + 1)::integer into v_via from public.impressoes i where i.evolucao_id = v_id;
      insert into public.impressoes (evolucao_id, impresso_por, via, chave)
      values (v_id, auth.uid(), v_via, p_chave);
    end if;

    evolucao_id := v_id;
    via := v_via;
    return next;
  end loop;
end;
$$;

revoke execute on function public.registrar_impressoes(uuid[], uuid) from public, anon;
grant execute on function public.registrar_impressoes(uuid[], uuid) to authenticated;

-- 2. Campos obrigatórios para finalizar, validados no servidor (mesma regra do cliente).
-- Corpo idêntico ao de 0002, com a checagem nova após a do conselho.
create or replace function public.finalizar_evolucao(p_evolucao_id uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_ev public.evolucoes%rowtype;
  v_prof public.profissionais%rowtype;
  v_snapshot jsonb;
  v_hash text;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  -- autor e perfil antes do status: não-autor não descobre o estado da evolução
  if v_ev.autor_id <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if app.perfil_atual() <> 'medico' then
    raise exception 'Apenas médicos podem finalizar evoluções.' using errcode = 'P0001';
  end if;
  if v_ev.status = 'FINALIZADA' then
    raise exception 'Evolução finalizada não pode ser alterada.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem ser finalizados.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if nullif(trim(v_prof.conselho), '') is null
     or nullif(trim(v_prof.numero_conselho), '') is null
     or nullif(trim(v_prof.uf_conselho), '') is null then
    raise exception 'Complete seu registro profissional antes de finalizar.' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(v_ev.dados->>'evolucao_clinica', '')), '') is null
     or nullif(trim(coalesce(v_ev.dados->>'conduta', '')), '') is null then
    raise exception 'Preencha a evolução clínica e a conduta antes de finalizar.' using errcode = 'P0001';
  end if;

  v_snapshot := jsonb_build_object(
    'nome', v_prof.nome,
    'conselho', v_prof.conselho,
    'numero', v_prof.numero_conselho,
    'uf', v_prof.uf_conselho
  );
  v_hash := encode(extensions.digest(
    jsonb_build_object(
      'dados', v_ev.dados,
      'texto', v_ev.texto_livre,
      'internacao', v_ev.internacao_id,
      'autor', v_ev.autor_id,
      'finalizada_em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text,
    'sha256'
  ), 'hex');

  update public.evolucoes set
    status = 'FINALIZADA',
    snapshot_autor = v_snapshot,
    snapshot_validador = v_snapshot,
    validada_por = auth.uid(),
    validada_em = v_agora,
    finalizada_em = v_agora,
    conteudo_hash = v_hash
  where id = p_evolucao_id;

  return v_agora;
end;
$$;

-- 3. Auditoria: edição de rascunho (RASCUNHO -> RASCUNHO) não gera linha; o resto segue igual.
create or replace function app.auditar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and tg_table_name = 'evolucoes'
     and to_jsonb(old)->>'status' = 'RASCUNHO' and to_jsonb(new)->>'status' = 'RASCUNHO' then
    return null;
  end if;

  insert into public.auditoria (tabela, registro_id, operacao, antes, depois, por)
  values (
    tg_table_name,
    coalesce(r->>'id', r->>'internacao_id', (r->>'profissional_id') || '/' || (r->>'equipe_id')),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

-- 4. Privilégios padrão: objetos futuros não dão TRUNCATE/REFERENCES/TRIGGER a authenticated
-- e não dão EXECUTE a anon/public.
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges in schema public revoke maintain on tables from authenticated';
  end if;
end;
$$;
alter default privileges in schema public revoke execute on functions from anon, public;

revoke truncate, references, trigger on public.vw_internacoes_lista, public.vw_evolucoes_timeline from authenticated;
