-- Validação médica: enviar, validar, devolver; núcleo único de finalização; perfil acadêmico.
-- Migrações 0001–0008 já estão em uso: não são editadas aqui.

-- 1. Trava de anexo: DELETE de linha não confirmada pela finalização também vale em
-- AGUARDANDO_VALIDACAO (validar_evolucao). Demais regras iguais às de 0008.
create or replace function app.bloquear_anexo_finalizado() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.status_evolucao;
begin
  if tg_op = 'DELETE' and not old.confirmado and current_setting('app.finalizando', true) = 'on' then
    select e.status into v_status from public.evolucoes e where e.id = old.evolucao_id;
    if v_status in ('RASCUNHO', 'AGUARDANDO_VALIDACAO') then
      return old;
    end if;
    raise exception 'Anexo de evolução finalizada não pode ser alterado.' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' and current_setting('app.descartando', true) = 'on' then
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

-- 2. Núcleo da finalização (não exposto a authenticated). Chamado por finalizar_evolucao
-- (autor médico) e validar_evolucao (médico validador). Quem chama faz as checagens de quem/estado.
create function app.finalizar_core(p_evolucao_id uuid, p_validador uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_agora timestamptz := now();
  v_ev public.evolucoes%rowtype;
  v_autor public.profissionais%rowtype;
  v_validador public.profissionais%rowtype;
  v_snap_autor jsonb;
  v_snap_validador jsonb;
  v_anexos jsonb;
  v_hash text;
begin
  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;

  select p.* into v_autor from public.profissionais p where p.id = v_ev.autor_id;
  select p.* into v_validador from public.profissionais p where p.id = p_validador;

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

  -- acadêmico sem conselho: campos de conselho ficam null no snapshot
  v_snap_autor := jsonb_build_object(
    'nome', v_autor.nome,
    'conselho', v_autor.conselho,
    'numero', v_autor.numero_conselho,
    'uf', v_autor.uf_conselho
  );
  v_snap_validador := jsonb_build_object(
    'nome', v_validador.nome,
    'conselho', v_validador.conselho,
    'numero', v_validador.numero_conselho,
    'uf', v_validador.uf_conselho
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
    snapshot_autor = v_snap_autor,
    snapshot_validador = v_snap_validador,
    validada_por = p_validador,
    validada_em = v_agora,
    finalizada_em = v_agora,
    conteudo_hash = v_hash,
    hash_versao = 2
  where id = p_evolucao_id;

  return v_agora;
end;
$$;

revoke all on function app.finalizar_core(uuid, uuid) from public, anon, authenticated;

-- 3. finalizar_evolucao: mesmas checagens de 0008, miolo delegado ao núcleo.
create or replace function public.finalizar_evolucao(p_evolucao_id uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_prof public.profissionais%rowtype;
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

  return app.finalizar_core(p_evolucao_id, auth.uid());
end;
$$;

revoke execute on function public.finalizar_evolucao(uuid) from public, anon;
grant execute on function public.finalizar_evolucao(uuid) to authenticated;

-- 4. salvar_rascunho: acadêmico escreve com o modelo médico. Resto igual a 0002.
create or replace function public.salvar_rascunho(p_internacao_id uuid, p_dados jsonb, p_texto_livre text)
returns table(id uuid, atualizado_em timestamptz)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_perfil public.perfil_profissional;
  v_categoria public.categoria_evolucao;
  v_int public.internacoes%rowtype;
  v_id uuid;
  v_at timestamptz;
  v_modelo text;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor, internação): serializa com enviar_evolucao e devolver_evolucao
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_internacao_id::text, 0));

  v_perfil := app.perfil_atual();
  if v_perfil in ('medico','residente','academico') then
    v_categoria := 'medica';
  elsif v_perfil = 'multiprofissional' then
    select p.categoria into v_categoria from public.profissionais p where p.id = auth.uid();
    if v_categoria is null then
      raise exception 'Defina sua categoria profissional antes de registrar evoluções.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- modelo acompanha a categoria; payload sem modelo (cliente antigo) é aceito
  v_modelo := coalesce(p_dados, '{}'::jsonb)->>'modelo_versao';
  if v_modelo is not null
     and v_modelo <> (case when v_categoria = 'medica' then 'medica@1' else 'simples@1' end) then
    raise exception 'Modelo de evolução inválido para sua categoria.' using errcode = 'P0001';
  end if;

  select i.* into v_int from public.internacoes i where i.id = p_internacao_id for share;
  if not found then
    raise exception 'Internação não encontrada.' using errcode = 'P0001';
  end if;
  if v_int.status = 'ALTA' then
    raise exception 'Internação com alta não permite novas evoluções.' using errcode = 'P0001';
  end if;
  if not (app.eh_medico() or app.membro_equipe(v_int.equipe_id)) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- uma evolução aberta por autor e internação: enquanto a enviada aguarda validação, não há novo rascunho
  if exists (
    select 1 from public.evolucoes e
    where e.autor_id = auth.uid()
      and e.internacao_id = p_internacao_id
      and e.status = 'AGUARDANDO_VALIDACAO'
  ) then
    raise exception 'Você tem uma evolução aguardando validação nesta internação.' using errcode = 'P0001';
  end if;

  -- o conflito é só com RASCUNHO: evolução enviada ou finalizada nunca é alterada aqui
  insert into public.evolucoes as e (internacao_id, categoria, autor_id, dados, texto_livre)
  values (
    p_internacao_id,
    v_categoria,
    auth.uid(),
    coalesce(p_dados, '{}'::jsonb),
    coalesce(p_texto_livre, '')
  )
  on conflict (autor_id, internacao_id) where status = 'RASCUNHO'
  do update set
    categoria = excluded.categoria,
    dados = excluded.dados,
    texto_livre = excluded.texto_livre,
    atualizado_em = now()
  returning e.id, e.atualizado_em into v_id, v_at;

  return query select v_id, v_at;
end;
$$;

revoke execute on function public.salvar_rascunho(uuid, jsonb, text) from public, anon;
grant execute on function public.salvar_rascunho(uuid, jsonb, text) to authenticated;

-- 5. Envio para validação (autor, só de rascunho).
create function public.enviar_evolucao(p_evolucao_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_perfil public.perfil_profissional;
  v_prof public.profissionais%rowtype;
  v_autor uuid;
  v_int uuid;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor, internação) antes da linha: serializa com salvar_rascunho
  select e.autor_id, e.internacao_id into v_autor, v_int from public.evolucoes e where e.id = p_evolucao_id;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_autor::text || ':' || v_int::text, 0));

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  v_perfil := app.perfil_atual();
  if v_perfil not in ('residente','academico','multiprofissional') then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem ser enviados para validação.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if v_perfil in ('residente','multiprofissional')
     and (nullif(trim(v_prof.conselho), '') is null
       or nullif(trim(v_prof.numero_conselho), '') is null
       or nullif(trim(v_prof.uf_conselho), '') is null) then
    raise exception 'Complete seu registro profissional antes de enviar.' using errcode = 'P0001';
  end if;

  -- modelo acompanha a categoria: medica -> medica@1; demais -> simples@1
  if v_ev.categoria = 'medica' then
    if v_ev.dados->>'modelo_versao' is distinct from 'medica@1' then
      raise exception 'Modelo de evolução inválido para sua categoria.' using errcode = 'P0001';
    end if;
    if nullif(trim(coalesce(v_ev.dados->>'evolucao_clinica', '')), '') is null
       or nullif(trim(coalesce(v_ev.dados->>'conduta', '')), '') is null then
      raise exception 'Preencha a evolução clínica e a conduta antes de enviar.' using errcode = 'P0001';
    end if;
  else
    if v_ev.dados->>'modelo_versao' is distinct from 'simples@1' then
      raise exception 'Modelo de evolução inválido para sua categoria.' using errcode = 'P0001';
    end if;
    if nullif(trim(coalesce(v_ev.dados->>'texto', '')), '') is null
       or nullif(trim(coalesce(v_ev.dados->>'plano', '')), '') is null then
      raise exception 'Preencha a evolução e o plano antes de enviar.' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1 from public.anexos a where a.evolucao_id = p_evolucao_id and not a.confirmado
  ) then
    raise exception 'Há anexo não enviado. Envie de novo ou cancele antes de enviar.' using errcode = 'P0001';
  end if;

  update public.evolucoes set
    status = 'AGUARDANDO_VALIDACAO',
    enviada_em = now(),
    devolvida_motivo = null
  where id = p_evolucao_id;
end;
$$;

revoke all on function public.enviar_evolucao(uuid) from public, anon;
grant execute on function public.enviar_evolucao(uuid) to authenticated;

-- 6. Validação pelo médico da equipe (não autor). Miolo: app.finalizar_core.
create function public.validar_evolucao(p_evolucao_id uuid) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_equipe uuid;
  v_prof public.profissionais%rowtype;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;

  select i.equipe_id into v_equipe from public.internacoes i where i.id = v_ev.internacao_id;
  if app.perfil_atual() <> 'medico' or not app.membro_equipe(v_equipe) then
    raise exception 'Apenas médicos da equipe podem validar.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id = auth.uid() then
    raise exception 'Você não pode validar a própria evolução.' using errcode = 'P0001';
  end if;
  if v_ev.status = 'FINALIZADA' then
    raise exception 'Evolução finalizada não pode ser alterada.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'AGUARDANDO_VALIDACAO' then
    raise exception 'Somente evoluções aguardando validação podem ser validadas.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if nullif(trim(v_prof.conselho), '') is null
     or nullif(trim(v_prof.numero_conselho), '') is null
     or nullif(trim(v_prof.uf_conselho), '') is null then
    raise exception 'Complete seu registro profissional antes de validar.' using errcode = 'P0001';
  end if;

  return app.finalizar_core(p_evolucao_id, auth.uid());
end;
$$;

revoke all on function public.validar_evolucao(uuid) from public, anon;
grant execute on function public.validar_evolucao(uuid) to authenticated;

-- 7. Devolução pelo médico da equipe (não autor): volta a rascunho com motivo (1–500).
create function public.devolver_evolucao(p_evolucao_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_equipe uuid;
  v_prof public.profissionais%rowtype;
  v_motivo text;
  v_autor uuid;
  v_int uuid;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor da evolução, internação) antes da linha: serializa com salvar_rascunho
  select e.autor_id, e.internacao_id into v_autor, v_int from public.evolucoes e where e.id = p_evolucao_id;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_autor::text || ':' || v_int::text, 0));

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;

  select i.equipe_id into v_equipe from public.internacoes i where i.id = v_ev.internacao_id;
  if app.perfil_atual() <> 'medico' or not app.membro_equipe(v_equipe) then
    raise exception 'Apenas médicos da equipe podem devolver.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id = auth.uid() then
    raise exception 'Você não pode devolver a própria evolução.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'AGUARDANDO_VALIDACAO' then
    raise exception 'Somente evoluções aguardando validação podem ser devolvidas.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if nullif(trim(v_prof.conselho), '') is null
     or nullif(trim(v_prof.numero_conselho), '') is null
     or nullif(trim(v_prof.uf_conselho), '') is null then
    raise exception 'Complete seu registro profissional antes de devolver.' using errcode = 'P0001';
  end if;

  v_motivo := nullif(trim(coalesce(p_motivo, '')), '');
  if v_motivo is null then
    raise exception 'Informe o motivo da devolução.' using errcode = 'P0001';
  end if;
  if char_length(v_motivo) > 500 then
    raise exception 'Motivo da devolução deve ter no máximo 500 caracteres.' using errcode = 'P0001';
  end if;

  -- o autor não pode ter outro rascunho aberto nesta internação (índice único de rascunho)
  if exists (
    select 1 from public.evolucoes e
    where e.autor_id = v_ev.autor_id
      and e.internacao_id = v_ev.internacao_id
      and e.status = 'RASCUNHO'
  ) then
    raise exception 'Você já tem um rascunho aberto nesta internação.' using errcode = 'P0001';
  end if;

  update public.evolucoes set
    status = 'RASCUNHO',
    devolvida_motivo = v_motivo
  where id = p_evolucao_id;
end;
$$;

revoke all on function public.devolver_evolucao(uuid, text) from public, anon;
grant execute on function public.devolver_evolucao(uuid, text) to authenticated;
