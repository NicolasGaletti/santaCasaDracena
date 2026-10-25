-- Validação: o médico da equipe lê os anexos confirmados de evoluções aguardando validação.
-- Sem isso a tela de validação não mostra exames. Demais regras de leitura iguais às de 0007.

drop policy anexos_select on public.anexos;

create policy anexos_select on public.anexos for select to authenticated
  using (
    app.eh_clinico() and confirmado and exists (
      select 1 from public.evolucoes e
      join public.internacoes i on i.id = e.internacao_id
      where e.id = anexos.evolucao_id
        and (
          e.status = 'FINALIZADA'
          or e.autor_id = auth.uid()
          or (e.status = 'AGUARDANDO_VALIDACAO' and app.eh_medico() and app.membro_equipe(i.equipe_id))
        )
    )
  );

create or replace function app.anexo_pode_ler(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_clinico() and exists (
    select 1 from public.anexos a
    join public.evolucoes e on e.id = a.evolucao_id
    join public.internacoes i on i.id = e.internacao_id
    where a.storage_path = p_name
      and (a.confirmado or a.enviado_por = auth.uid())
      and (
        e.status = 'FINALIZADA'
        or e.autor_id = auth.uid()
        or (e.status = 'AGUARDANDO_VALIDACAO' and app.eh_medico() and app.membro_equipe(i.equipe_id))
      )
  )
$$;
