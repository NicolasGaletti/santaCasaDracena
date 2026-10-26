-- Plano 4, Task 7b: notificações (sino + push). Migrações 0001–0016 não são editadas.
-- Funções recriadas copiam a última definição (0006, 0010, 0013) e só acrescentam geração de notificações
-- (e, em enviar/devolver, a coluna evolucoes.devolvida_por).

-- 1. Tabelas
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profissionais(id),
  tipo text not null check (tipo in ('validacao_pendente','evolucao_devolvida','evolucao_validada','evolucao_equipe','admissao_equipe')),
  internacao_id uuid references public.internacoes(id),
  evolucao_id uuid references public.evolucoes(id),
  texto text not null,
  lida_em timestamptz,
  criada_em timestamptz not null default now()
);
create index notificacoes_destinatario_idx on public.notificacoes (destinatario_id, criada_em desc);

create table public.preferencias_notificacao (
  profissional_id uuid primary key references public.profissionais(id),
  push_validacao boolean not null default true,
  push_devolvida boolean not null default true
);

create table public.push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criada_em timestamptz not null default now()
);
create index push_assinaturas_prof_idx on public.push_assinaturas (profissional_id);

alter table public.evolucoes add column devolvida_por uuid references public.profissionais(id);

-- 2. RLS: cliente só lê as próprias notificações/preferências; push_assinaturas sem acesso direto.
alter table public.notificacoes enable row level security;
alter table public.preferencias_notificacao enable row level security;
alter table public.push_assinaturas enable row level security;

revoke all on public.notificacoes, public.preferencias_notificacao, public.push_assinaturas from anon, public, authenticated;
grant select on public.notificacoes, public.preferencias_notificacao to authenticated;

create policy notificacoes_select_proprias on public.notificacoes
  for select to authenticated using (destinatario_id = (select auth.uid()));
create policy preferencias_select_proprias on public.preferencias_notificacao
  for select to authenticated using (profissional_id = (select auth.uid()));

-- Realtime (o sino da Task 7c assina INSERTs; RLS vale para o realtime)
alter publication supabase_realtime add table public.notificacoes;

-- 3. Auxiliares internos (sem EXECUTE para clientes)
create function app.sufixo_leito(p_leito text) returns text
language sql immutable set search_path = ''
as $$ select case when nullif(trim(coalesce(p_leito, '')), '') is null then '' else ' · Leito ' || trim(p_leito) end $$;

-- médicos ativos da equipe, menos os excluídos
create function app.notificar_medicos_equipe(
  p_equipe uuid, p_excluir uuid[], p_tipo text, p_internacao uuid, p_evolucao uuid, p_texto text
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notificacoes (destinatario_id, tipo, internacao_id, evolucao_id, texto)
  select p.id, p_tipo, p_internacao, p_evolucao, p_texto
  from public.membros_equipe m
  join public.profissionais p on p.id = m.profissional_id
  where m.equipe_id = p_equipe
    and p.ativo
    and p.perfil = 'medico'
    and p.id <> all (p_excluir)
$$;

revoke all on function app.sufixo_leito(text) from public, anon, authenticated;
revoke all on function app.notificar_medicos_equipe(uuid, uuid[], text, uuid, uuid, text) from public, anon, authenticated;

-- 4. Funções do cliente
create function public.marcar_lida(p_id uuid) returns void
language sql security definer set search_path = ''
as $$
  update public.notificacoes set lida_em = coalesce(lida_em, now())
  where id = p_id and destinatario_id = auth.uid() and app.profissional_ativo()
$$;

create function public.marcar_todas_lidas() returns void
language sql security definer set search_path = ''
as $$
  update public.notificacoes set lida_em = now()
  where destinatario_id = auth.uid() and lida_em is null and app.profissional_ativo()
$$;

create function public.salvar_preferencias_notificacao(p_push_validacao boolean, p_push_devolvida boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  insert into public.preferencias_notificacao (profissional_id, push_validacao, push_devolvida)
  values (auth.uid(), coalesce(p_push_validacao, true), coalesce(p_push_devolvida, true))
  on conflict (profissional_id) do update
    set push_validacao = excluded.push_validacao, push_devolvida = excluded.push_devolvida;
end;
$$;

create function public.registrar_assinatura_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if nullif(trim(coalesce(p_endpoint, '')), '') is null
     or nullif(trim(coalesce(p_p256dh, '')), '') is null
     or nullif(trim(coalesce(p_auth, '')), '') is null then
    raise exception 'Assinatura de notificação inválida.' using errcode = 'P0001';
  end if;
  -- mesmo endpoint: o dono passa a ser quem registrou agora (dispositivo trocou de usuário)
  insert into public.push_assinaturas (profissional_id, endpoint, p256dh, auth)
  values (auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth))
  on conflict (endpoint) do update
    set profissional_id = excluded.profissional_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.remover_assinatura_push(p_endpoint text) returns void
language sql security definer set search_path = ''
as $$
  delete from public.push_assinaturas where endpoint = p_endpoint and profissional_id = auth.uid()
$$;

revoke all on function public.marcar_lida(uuid) from public, anon;
revoke all on function public.marcar_todas_lidas() from public, anon;
revoke all on function public.salvar_preferencias_notificacao(boolean, boolean) from public, anon;
revoke all on function public.registrar_assinatura_push(text, text, text) from public, anon;
revoke all on function public.remover_assinatura_push(text) from public, anon;
grant execute on function public.marcar_lida(uuid) to authenticated;
grant execute on function public.marcar_todas_lidas() to authenticated;
grant execute on function public.salvar_preferencias_notificacao(boolean, boolean) to authenticated;
grant execute on function public.registrar_assinatura_push(text, text, text) to authenticated;
grant execute on function public.remover_assinatura_push(text) to authenticated;

-- 5. Timeline expõe devolvida_por e o nome de quem devolveu (para o banner "Devolvida por <médico>").
-- Recriada como em 0008; novas colunas no fim.
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
  ), 0) as qtd_anexos,
  pd.nome as devolvida_por_nome
from public.evolucoes ev
left join public.vw_profissionais_publico pa on pa.id = ev.autor_id
left join public.vw_profissionais_publico pd on pd.id = ev.devolvida_por;

revoke all on public.vw_evolucoes_timeline from anon, public;
grant select on public.vw_evolucoes_timeline to authenticated;
revoke truncate, references, trigger on public.vw_evolucoes_timeline from authenticated;

-- 6. Geração (create or replace; diferença vs. fonte = só os blocos marcados "Plano 4, Task 7b")

-- app.finalizar_core (fonte: 0013)
create or replace function app.finalizar_core(p_evolucao_id uuid, p_validador uuid) returns timestamptz
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
  v_int public.internacoes%rowtype;
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
    'uf', v_autor.uf_conselho,
    'perfil', v_autor.perfil
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

  -- notificações (Plano 4, Task 7b): autor se validador <> autor; médicos da equipe exceto validador e autor
  select i.* into v_int from public.internacoes i where i.id = v_ev.internacao_id;
  if v_ev.autor_id <> p_validador then
    insert into public.notificacoes (destinatario_id, tipo, internacao_id, evolucao_id, texto)
    values (v_ev.autor_id, 'evolucao_validada', v_ev.internacao_id, p_evolucao_id,
            'Sua evolução foi validada' || app.sufixo_leito(v_int.leito_ala));
  end if;
  perform app.notificar_medicos_equipe(v_int.equipe_id, array[p_validador, v_ev.autor_id], 'evolucao_equipe',
    v_ev.internacao_id, p_evolucao_id, 'Nova evolução finalizada na equipe' || app.sufixo_leito(v_int.leito_ala));

  return v_agora;
end;
$$;
revoke all on function app.finalizar_core(uuid, uuid) from public, anon, authenticated;

-- public.enviar_evolucao (fonte: 0010)
create or replace function public.enviar_evolucao(p_evolucao_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_perfil public.perfil_profissional;
  v_prof public.profissionais%rowtype;
  v_autor uuid;
  v_int uuid;
  v_internacao public.internacoes%rowtype;
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
    devolvida_motivo = null,
    devolvida_por = null
  where id = p_evolucao_id;

  -- notificações (Plano 4, Task 7b): médicos ativos da equipe, exceto o autor
  select i.* into v_internacao from public.internacoes i where i.id = v_ev.internacao_id;
  perform app.notificar_medicos_equipe(v_internacao.equipe_id, array[v_ev.autor_id], 'validacao_pendente',
    v_ev.internacao_id, p_evolucao_id, 'Nova evolução aguardando sua validação' || app.sufixo_leito(v_internacao.leito_ala));
end;
$$;
revoke all on function public.enviar_evolucao(uuid) from public, anon;
grant execute on function public.enviar_evolucao(uuid) to authenticated;

-- public.devolver_evolucao (fonte: 0010)
create or replace function public.devolver_evolucao(p_evolucao_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.evolucoes%rowtype;
  v_equipe uuid;
  v_prof public.profissionais%rowtype;
  v_motivo text;
  v_autor uuid;
  v_int uuid;
  v_internacao public.internacoes%rowtype;
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
    devolvida_motivo = v_motivo,
    devolvida_por = auth.uid()
  where id = p_evolucao_id;

  -- notificações (Plano 4, Task 7b): avisa o autor
  select i.* into v_internacao from public.internacoes i where i.id = v_ev.internacao_id;
  insert into public.notificacoes (destinatario_id, tipo, internacao_id, evolucao_id, texto)
  values (v_ev.autor_id, 'evolucao_devolvida', v_ev.internacao_id, p_evolucao_id,
          'Sua evolução foi devolvida' || app.sufixo_leito(v_internacao.leito_ala));
end;
$$;
revoke all on function public.devolver_evolucao(uuid, text) from public, anon;
grant execute on function public.devolver_evolucao(uuid, text) to authenticated;

-- public.admitir_paciente (fonte: 0006)
create or replace function public.admitir_paciente(
  p_nome text,
  p_data_nascimento date,
  p_convenio text,
  p_equipe_id uuid,
  p_leito_ala text,
  p_diagnostico_inicial text,
  p_comorbidades text,
  p_muc text
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

  insert into public.pacientes (nome, data_nascimento, convenio)
  values (trim(p_nome), p_data_nascimento, trim(p_convenio))
  returning id into v_paciente;

  insert into public.internacoes (paciente_id, equipe_id, leito_ala)
  values (v_paciente, p_equipe_id, trim(p_leito_ala))
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

  -- notificações (Plano 4, Task 7b): médicos ativos da equipe
  perform app.notificar_medicos_equipe(p_equipe_id, array[]::uuid[], 'admissao_equipe',
    v_internacao, null, 'Paciente admitido na equipe' || app.sufixo_leito(trim(p_leito_ala)));

  return v_internacao;
end;
$$;
revoke execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) to authenticated;
