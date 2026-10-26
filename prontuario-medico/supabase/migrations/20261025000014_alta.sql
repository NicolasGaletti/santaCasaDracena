-- Alta médica (Plano 4, Task 1).
-- motivo_alta guarda o resumo da alta; alta_em e alta_por já existem desde 0001.

create type public.tipo_alta as enum ('MELHORADA','CURADA','A_PEDIDO','TRANSFERENCIA','EVASAO','OBITO');

alter table public.internacoes add column tipo_alta public.tipo_alta;

-- Snapshot do médico e da equipe no momento da alta (como snapshot_autor em evolucoes).
-- Fica em internacoes_clinico (RLS eh_clinico): recepção/admin não leem.
alter table public.internacoes_clinico add column snapshot_alta jsonb;

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
  v_prof public.profissionais%rowtype;
  v_snapshot jsonb;
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
    select 1 from public.leitos_historico l
    where l.internacao_id = p_internacao_id and l.ate is null and l.de > p_alta_em
  ) then
    raise exception 'A data da alta não pode ser anterior à última troca de leito.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.evolucoes e
    where e.internacao_id = p_internacao_id and e.status = 'FINALIZADA' and e.finalizada_em > p_alta_em
  ) then
    raise exception 'A data da alta não pode ser anterior à última evolução finalizada.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.evolucoes e
    where e.internacao_id = p_internacao_id and e.status = 'AGUARDANDO_VALIDACAO'
  ) then
    raise exception 'Há evoluções aguardando validação nesta internação.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if nullif(trim(v_prof.conselho), '') is null
     or nullif(trim(v_prof.numero_conselho), '') is null
     or nullif(trim(v_prof.uf_conselho), '') is null then
    raise exception 'Complete seu registro profissional antes de dar alta.' using errcode = 'P0001';
  end if;

  v_snapshot := jsonb_build_object(
    'medico', jsonb_build_object(
      'nome', v_prof.nome,
      'conselho', v_prof.conselho,
      'numero', v_prof.numero_conselho,
      'uf', v_prof.uf_conselho
    ),
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', m.nome,
        'conselho', m.conselho,
        'numero', m.numero_conselho,
        'uf', m.uf_conselho
      ) order by m.nome, m.id)
      from public.membros_equipe me
      join public.profissionais m on m.id = me.profissional_id
      where me.equipe_id = v_int.equipe_id and m.ativo
    ), '[]'::jsonb)
  );

  insert into public.internacoes_clinico (internacao_id, snapshot_alta)
  values (p_internacao_id, v_snapshot)
  on conflict (internacao_id) do update set snapshot_alta = excluded.snapshot_alta;

  update public.internacoes
  set status = 'ALTA', alta_em = p_alta_em, alta_por = auth.uid(),
      tipo_alta = p_tipo, motivo_alta = v_resumo
  where id = p_internacao_id;

  update public.leitos_historico set ate = p_alta_em
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
