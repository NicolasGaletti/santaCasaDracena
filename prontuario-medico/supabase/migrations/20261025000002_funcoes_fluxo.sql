-- Funções de transição: único caminho de escrita para dados clínicos.
-- Todas security definer, search_path vazio, referências qualificadas.

create extension if not exists pgcrypto with schema extensions;

-- Trava: evolução finalizada é imutável (inclusive para postgres);
-- evolução de internação com alta também não muda (adendo entra no Plano 3).
create function app.bloquear_finalizada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'FINALIZADA' then
    raise exception 'Evolução finalizada não pode ser alterada.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.internacoes i
    where i.id = old.internacao_id and i.status = 'ALTA'
  ) then
    raise exception 'Internação com alta: evolução não pode ser alterada.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger bloquear_finalizada before update or delete on public.evolucoes
  for each row execute function app.bloquear_finalizada();

revoke execute on function app.bloquear_finalizada() from public;

-- Admissão: paciente + internação + dados clínicos + primeiro leito
create function public.admitir_paciente(
  p_nome text,
  p_data_nascimento date,
  p_convenio text,
  p_equipe_id uuid,
  p_leito_ala text,
  p_diagnostico_inicial text,
  p_comorbidades text,
  p_muc text,
  p_medico_responsavel_id uuid
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_paciente uuid;
  v_internacao uuid;
begin
  if not (app.profissional_ativo() and app.perfil_atual() in ('medico','recepcao')) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if nullif(trim(p_nome), '') is null
     or p_data_nascimento is null
     or nullif(trim(p_convenio), '') is null
     or p_equipe_id is null
     or nullif(trim(p_leito_ala), '') is null then
    raise exception 'Preencha os campos obrigatórios.' using errcode = 'P0001';
  end if;
  if p_data_nascimento > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data de nascimento não pode ser futura.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.profissionais p
    where p.id = p_medico_responsavel_id and p.ativo and p.perfil = 'medico'
  ) then
    raise exception 'Médico responsável inválido.' using errcode = 'P0001';
  end if;

  insert into public.pacientes (nome, data_nascimento, convenio)
  values (trim(p_nome), p_data_nascimento, trim(p_convenio))
  returning id into v_paciente;

  insert into public.internacoes (paciente_id, equipe_id, medico_responsavel_id, leito_ala)
  values (v_paciente, p_equipe_id, p_medico_responsavel_id, trim(p_leito_ala))
  returning id into v_internacao;

  insert into public.internacoes_clinico (internacao_id, diagnostico_inicial, comorbidades, muc)
  values (
    v_internacao,
    nullif(trim(p_diagnostico_inicial), ''),
    nullif(trim(p_comorbidades), ''),
    nullif(trim(p_muc), '')
  );

  insert into public.leitos_historico (internacao_id, leito_ala, de, ate, por)
  values (v_internacao, trim(p_leito_ala), now(), null, auth.uid());

  return v_internacao;
end;
$$;

-- Troca de leito: fecha a linha aberta e abre outra
create function public.trocar_leito(p_internacao_id uuid, p_leito_ala text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_int public.internacoes%rowtype;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if nullif(trim(p_leito_ala), '') is null then
    raise exception 'Informe o leito.' using errcode = 'P0001';
  end if;

  select i.* into v_int from public.internacoes i where i.id = p_internacao_id for update;
  if not found then
    raise exception 'Internação não encontrada.' using errcode = 'P0001';
  end if;
  if v_int.status = 'ALTA' then
    raise exception 'Internação com alta não pode trocar de leito.' using errcode = 'P0001';
  end if;
  if not (
    app.perfil_atual() in ('medico','recepcao')
    or (app.eh_clinico() and app.membro_equipe(v_int.equipe_id))
  ) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  update public.leitos_historico set ate = now()
  where internacao_id = p_internacao_id and ate is null;

  insert into public.leitos_historico (internacao_id, leito_ala, de, ate, por)
  values (p_internacao_id, trim(p_leito_ala), now(), null, auth.uid());

  update public.internacoes set leito_ala = trim(p_leito_ala)
  where id = p_internacao_id;
end;
$$;

-- Rascunho: upsert no rascunho único (autor, internação)
create function public.salvar_rascunho(p_internacao_id uuid, p_dados jsonb, p_texto_livre text)
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
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  v_perfil := app.perfil_atual();
  if v_perfil in ('medico','residente') then
    v_categoria := 'medica';
  elsif v_perfil = 'multiprofissional' then
    select p.categoria into v_categoria from public.profissionais p where p.id = auth.uid();
    if v_categoria is null then
      raise exception 'Defina sua categoria profissional antes de registrar evoluções.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select i.* into v_int from public.internacoes i where i.id = p_internacao_id;
  if not found then
    raise exception 'Internação não encontrada.' using errcode = 'P0001';
  end if;
  if v_int.status = 'ALTA' then
    raise exception 'Internação com alta não permite novas evoluções.' using errcode = 'P0001';
  end if;
  if not (app.eh_medico() or app.membro_equipe(v_int.equipe_id)) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

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

-- Descarte: só o autor, só rascunho
create function public.descartar_rascunho(p_evolucao_id uuid) returns void
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

  delete from public.evolucoes where id = p_evolucao_id;
end;
$$;

-- Finalização: só o autor médico, só a partir de rascunho, com conselho preenchido
create function public.finalizar_evolucao(p_evolucao_id uuid) returns timestamptz
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
  if v_ev.status = 'FINALIZADA' then
    raise exception 'Evolução finalizada não pode ser alterada.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem ser finalizados.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if app.perfil_atual() <> 'medico' then
    raise exception 'Apenas médicos podem finalizar evoluções.' using errcode = 'P0001';
  end if;

  select p.* into v_prof from public.profissionais p where p.id = auth.uid();
  if nullif(trim(v_prof.conselho), '') is null
     or nullif(trim(v_prof.numero_conselho), '') is null
     or nullif(trim(v_prof.uf_conselho), '') is null then
    raise exception 'Complete seu registro profissional antes de finalizar.' using errcode = 'P0001';
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
      'finalizada_em', v_agora
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

-- Impressão: só evolução finalizada; número da via calculado após o lock
create function public.registrar_impressao(p_evolucao_id uuid) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.status_evolucao;
  v_via integer;
begin
  if not (app.profissional_ativo() and app.eh_clinico()) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select e.status into v_status from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  if v_status <> 'FINALIZADA' then
    raise exception 'Somente evoluções finalizadas podem ser impressas.' using errcode = 'P0001';
  end if;

  select (count(*) + 1)::integer into v_via from public.impressoes i where i.evolucao_id = p_evolucao_id;

  insert into public.impressoes (evolucao_id, impresso_por, via)
  values (p_evolucao_id, auth.uid(), v_via);

  return v_via;
end;
$$;

-- Acesso: registro de leitura do prontuário por profissional ativo
create function public.registrar_acesso(p_internacao_id uuid, p_acao text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  insert into public.acessos (profissional_id, internacao_id, acao, em)
  values (auth.uid(), p_internacao_id, p_acao, now());
end;
$$;

-- Privilégios: só authenticated executa
revoke execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text, uuid) from public, anon;
revoke execute on function public.trocar_leito(uuid, text) from public, anon;
revoke execute on function public.salvar_rascunho(uuid, jsonb, text) from public, anon;
revoke execute on function public.descartar_rascunho(uuid) from public, anon;
revoke execute on function public.finalizar_evolucao(uuid) from public, anon;
revoke execute on function public.registrar_impressao(uuid) from public, anon;
revoke execute on function public.registrar_acesso(uuid, text) from public, anon;

grant execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text, uuid) to authenticated;
grant execute on function public.trocar_leito(uuid, text) to authenticated;
grant execute on function public.salvar_rascunho(uuid, jsonb, text) to authenticated;
grant execute on function public.descartar_rascunho(uuid) to authenticated;
grant execute on function public.finalizar_evolucao(uuid) to authenticated;
grant execute on function public.registrar_impressao(uuid) to authenticated;
grant execute on function public.registrar_acesso(uuid, text) to authenticated;
