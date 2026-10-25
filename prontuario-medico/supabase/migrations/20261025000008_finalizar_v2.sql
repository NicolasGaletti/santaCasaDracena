-- Finalização v2: hash com anexos, limpeza de não confirmados, descarte com anexos.
-- Migrações 0001–0007 já estão em uso: não são editadas aqui.

-- 1. Versão do hash por evolução (1 para as existentes, 2 nas finalizadas a partir daqui).
alter table public.evolucoes add column hash_versao int not null default 1;

-- 2. Descrição limitada a 500 caracteres.
alter table public.anexos add constraint anexos_descricao_tamanho check (char_length(descricao) <= 500);

-- 3. Trava de anexo: libera DELETE sob flag de descarte ou de finalização (só linha não confirmada),
-- e só enquanto a evolução está em rascunho.
create or replace function app.bloquear_anexo_finalizado() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.status_evolucao;
begin
  if tg_op = 'DELETE' and (
       current_setting('app.descartando', true) = 'on'
    or (not old.confirmado and current_setting('app.finalizando', true) = 'on')
  ) then
    select e.status into v_status from public.evolucoes e where e.id = old.evolucao_id;
    if v_status = 'RASCUNHO' then
      return old;
    end if;
    raise exception 'Anexo de evolução finalizada não pode ser alterado.' using errcode = 'P0001';
  end if;

  select e.status into v_status from public.evolucoes e where e.id = old.evolucao_id;
  if v_status <> 'RASCUNHO' then
    raise exception 'Anexo de evolução finalizada não pode ser alterado.' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function app.bloquear_anexo_finalizado() from public;

-- 4. Confirmar: trava a evolução (share) antes de checar status. Ordem de lock igual à de
-- finalizar_evolucao (evolução primeiro, anexo depois) para evitar deadlock.
create or replace function public.confirmar_anexo(p_anexo_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_an public.anexos%rowtype;
  v_evolucao_id uuid;
  v_status public.status_evolucao;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select a.evolucao_id into v_evolucao_id from public.anexos a where a.id = p_anexo_id;
  if not found then
    raise exception 'Anexo não encontrado.' using errcode = 'P0001';
  end if;

  select e.status into v_status from public.evolucoes e where e.id = v_evolucao_id for share;

  select a.* into v_an from public.anexos a where a.id = p_anexo_id for update;
  if not found then
    raise exception 'Anexo não encontrado.' using errcode = 'P0001';
  end if;
  if v_an.enviado_por <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem receber anexos.' using errcode = 'P0001';
  end if;

  if v_an.confirmado then
    return;
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'anexos' and o.name = v_an.storage_path
  ) then
    raise exception 'Arquivo do anexo não foi recebido.' using errcode = 'P0001';
  end if;

  update public.anexos set confirmado = true where anexos.id = p_anexo_id;
end;
$$;

revoke all on function public.confirmar_anexo(uuid) from public, anon;
grant execute on function public.confirmar_anexo(uuid) to authenticated;

-- 5. Descarte: mesmas regras de 0002/0005; apaga os anexos (confirmados ou não) antes da evolução.
-- Os objetos no Storage são apagados pelo app antes da chamada (SQL não apaga storage.objects).
create or replace function public.descartar_rascunho(p_evolucao_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem ser descartados.' using errcode = 'P0001';
  end if;

  perform set_config('app.descartando', 'on', true);
  delete from public.anexos where evolucao_id = p_evolucao_id;
  perform set_config('app.descartando', 'off', true);

  delete from public.evolucoes where id = p_evolucao_id;
end;
$$;

revoke execute on function public.descartar_rascunho(uuid) from public, anon;
grant execute on function public.descartar_rascunho(uuid) to authenticated;

-- 6. Finalização v2. Mesmas regras de 0005 (ordem das checagens, campos, lock), mais:
-- erro se um anexo confirmado não tem objeto; apaga só linhas não confirmadas; hash v2 com anexos.
create or replace function public.finalizar_evolucao(p_evolucao_id uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_ev public.evolucoes%rowtype;
  v_prof public.profissionais%rowtype;
  v_snapshot jsonb;
  v_anexos jsonb;
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

  -- anexo confirmado precisa ter objeto no bucket
  if exists (
    select 1 from public.anexos a
    where a.evolucao_id = p_evolucao_id
      and a.confirmado
      and not exists (
        select 1 from storage.objects o
        where o.bucket_id = 'anexos' and o.name = a.storage_path
      )
  ) then
    raise exception 'Um anexo confirmado está sem arquivo. Remova-o e envie de novo.' using errcode = 'P0001';
  end if;

  -- apaga só as linhas não confirmadas (objetos no Storage não são tocados aqui)
  perform set_config('app.finalizando', 'on', true);
  delete from public.anexos a where a.evolucao_id = p_evolucao_id and not a.confirmado;
  perform set_config('app.finalizando', 'off', true);

  select coalesce(jsonb_agg(a.sha256 order by a.id), '[]'::jsonb) into v_anexos
  from public.anexos a
  where a.evolucao_id = p_evolucao_id and a.confirmado;

  v_snapshot := jsonb_build_object(
    'nome', v_prof.nome,
    'conselho', v_prof.conselho,
    'numero', v_prof.numero_conselho,
    'uf', v_prof.uf_conselho
  );
  v_hash := encode(extensions.digest(
    jsonb_build_object(
      'v', 2,
      'dados', v_ev.dados,
      'texto', v_ev.texto_livre,
      'internacao', v_ev.internacao_id,
      'autor', v_ev.autor_id,
      'finalizada_em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'anexos', v_anexos
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
    conteudo_hash = v_hash,
    hash_versao = 2
  where id = p_evolucao_id;

  return v_agora;
end;
$$;

revoke execute on function public.finalizar_evolucao(uuid) from public, anon;
grant execute on function public.finalizar_evolucao(uuid) to authenticated;

-- 7. Timeline com hash_versao (via ev.*) e qtd_anexos. Recriada: nova coluna no meio muda a ordem.
drop view public.vw_evolucoes_timeline;

create view public.vw_evolucoes_timeline with (security_invoker = true) as
select
  ev.*,
  pa.nome as autor_nome,
  coalesce((
    select count(*)::int from public.impressoes im where im.evolucao_id = ev.id
  ), 0) as vias_impressas,
  coalesce((
    select count(*)::int from public.anexos an where an.evolucao_id = ev.id and an.confirmado
  ), 0) as qtd_anexos
from public.evolucoes ev
left join public.vw_profissionais_publico pa on pa.id = ev.autor_id;

revoke all on public.vw_evolucoes_timeline from anon, public;
grant select on public.vw_evolucoes_timeline to authenticated;
revoke truncate, references, trigger on public.vw_evolucoes_timeline from authenticated;
