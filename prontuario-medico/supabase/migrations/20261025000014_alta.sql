-- Alta médica (Plano 4, Task 1).
-- motivo_alta guarda o resumo da alta; alta_em e alta_por já existem desde 0001.

create type public.tipo_alta as enum ('MELHORADA','CURADA','A_PEDIDO','TRANSFERENCIA','EVASAO','OBITO');

alter table public.internacoes add column tipo_alta public.tipo_alta;

-- dar_alta: médico ativo da equipe da internação. Rascunhos pendentes ficam congelados
-- (a trava de ALTA já impede alterá-los; só adendo é permitido).
create function public.dar_alta(
  p_internacao_id uuid,
  p_tipo public.tipo_alta,
  p_resumo text,
  p_alta_em timestamptz default now()
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_int public.internacoes%rowtype;
  v_resumo text := nullif(trim(p_resumo), '');
begin
  if not (app.profissional_ativo() and app.eh_medico()) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select i.* into v_int from public.internacoes i where i.id = p_internacao_id for update;
  if not found then
    raise exception 'Internação não encontrada.' using errcode = 'P0001';
  end if;
  if not app.membro_equipe(v_int.equipe_id) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_int.status = 'ALTA' then
    raise exception 'Internação já recebeu alta.' using errcode = 'P0001';
  end if;
  if p_tipo is null then
    raise exception 'Informe o tipo da alta.' using errcode = 'P0001';
  end if;
  if v_resumo is null or char_length(v_resumo) > 2000 then
    raise exception 'Informe o resumo da alta (até 2000 caracteres).' using errcode = 'P0001';
  end if;
  if p_alta_em is null then
    p_alta_em := now();
  end if;
  if p_alta_em > now() then
    raise exception 'A data da alta não pode ser futura.' using errcode = 'P0001';
  end if;
  if p_alta_em < v_int.admitido_em then
    raise exception 'A data da alta não pode ser anterior à admissão.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.evolucoes e
    where e.internacao_id = p_internacao_id and e.status = 'AGUARDANDO_VALIDACAO'
  ) then
    raise exception 'Há evoluções aguardando validação nesta internação.' using errcode = 'P0001';
  end if;

  update public.internacoes
  set status = 'ALTA', alta_em = p_alta_em, alta_por = auth.uid(),
      tipo_alta = p_tipo, motivo_alta = v_resumo
  where id = p_internacao_id;

  update public.leitos_historico set ate = greatest(p_alta_em, de)
  where internacao_id = p_internacao_id and ate is null;
end;
$$;

revoke all on function public.dar_alta(uuid, public.tipo_alta, text, timestamptz) from public, anon;
grant execute on function public.dar_alta(uuid, public.tipo_alta, text, timestamptz) to authenticated;

-- vw_internacoes_lista: definição de 0003 + tipo_alta (alta_em já existia). Coluna nova só no fim.
create or replace view public.vw_internacoes_lista with (security_invoker = true) as
select
  i.id as internacao_id,
  p.id as paciente_id,
  p.nome,
  p.data_nascimento,
  p.convenio,
  i.leito_ala,
  i.equipe_id,
  e.nome as equipe_nome,
  mr.nome as medico_responsavel_nome,
  i.status,
  i.admitido_em,
  i.alta_em,
  case
    when exists (
      select 1 from public.evolucoes ev
      where ev.internacao_id = i.id
        and ev.categoria = 'medica'
        and ev.status = 'FINALIZADA'
        and (ev.finalizada_em at time zone 'America/Sao_Paulo')::date
            = (now() at time zone 'America/Sao_Paulo')::date
    ) then 'FINALIZADA'
    when exists (
      select 1 from public.evolucoes ev
      where ev.internacao_id = i.id
        and ev.status = 'RASCUNHO'
        and ev.autor_id = auth.uid()
    ) then 'RASCUNHO'
    else 'NENHUMA'
  end as status_hoje,
  i.tipo_alta
from public.internacoes i
join public.pacientes p on p.id = i.paciente_id
join public.equipes e on e.id = i.equipe_id
left join public.vw_profissionais_publico mr on mr.id = i.medico_responsavel_id;
