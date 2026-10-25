-- Views de leitura. security_invoker: RLS das tabelas base vale para quem consulta.

-- Lista de internações: sem dados clínicos (recepção lê esta view).
-- status_hoje: FINALIZADA se houve evolução médica finalizada hoje (dia SP);
-- senão RASCUNHO se há rascunho do próprio usuário; senão NENHUMA.
create view public.vw_internacoes_lista with (security_invoker = true) as
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
  end as status_hoje
from public.internacoes i
join public.pacientes p on p.id = i.paciente_id
join public.equipes e on e.id = i.equipe_id
left join public.vw_profissionais_publico mr on mr.id = i.medico_responsavel_id;

-- Timeline de evoluções com nome do autor e número de vias impressas.
create view public.vw_evolucoes_timeline with (security_invoker = true) as
select
  ev.*,
  pa.nome as autor_nome,
  coalesce((
    select count(*)::int from public.impressoes im where im.evolucao_id = ev.id
  ), 0) as vias_impressas
from public.evolucoes ev
left join public.vw_profissionais_publico pa on pa.id = ev.autor_id;

revoke all on public.vw_internacoes_lista, public.vw_evolucoes_timeline from anon, public;
grant select on public.vw_internacoes_lista, public.vw_evolucoes_timeline to authenticated;
