-- Impressão em lote, atômica: ou todas as evoluções recebem via, ou nenhuma.
-- Mesmas regras de registrar_impressao; bloqueio por linha em ordem de id (evita deadlock).
create function public.registrar_impressoes(p_ids uuid[])
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

    select (count(*) + 1)::integer into v_via from public.impressoes i where i.evolucao_id = v_id;

    insert into public.impressoes (evolucao_id, impresso_por, via)
    values (v_id, auth.uid(), v_via);

    evolucao_id := v_id;
    via := v_via;
    return next;
  end loop;
end;
$$;

revoke execute on function public.registrar_impressoes(uuid[]) from public, anon;
grant execute on function public.registrar_impressoes(uuid[]) to authenticated;
