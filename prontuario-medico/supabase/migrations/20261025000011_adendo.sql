-- Adendo de evolução finalizada. Migrações 0001–0010 já estão em uso: não são editadas aqui.
-- Regra nova: internação com alta só aceita escrita em evolução com adendo_de not null.
-- Demais regras iguais às de 0010.

-- 1. Trava de evolução: FINALIZADA continua imutável; internação com alta bloqueia,
-- exceto adendo (adendo_de not null).
create or replace function app.bloquear_finalizada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'FINALIZADA' then
    raise exception 'Evolução finalizada não pode ser alterada.' using errcode = 'P0001';
  end if;
  -- vínculo do adendo é fixo: nem o próprio update muda adendo_de
  if tg_op = 'UPDATE' and new.adendo_de is distinct from old.adendo_de then
    raise exception 'Vínculo do adendo não pode ser alterado.' using errcode = 'P0001';
  end if;
  if old.adendo_de is null and exists (
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

revoke execute on function app.bloquear_finalizada() from public;

-- 2. salvar_rascunho: igual a 0010, com a exceção de alta para o rascunho de adendo.
create or replace function public.salvar_rascunho(p_internacao_id uuid, p_dados jsonb, p_texto_livre text)
returns table(id uuid, atualizado_em timestamptz)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_perfil public.perfil_profissional;
  v_categoria public.categoria_evolucao;
  v_int public.internacoes%rowtype;
  v_adendo_de uuid;
  v_id uuid;
  v_at timestamptz;
  v_modelo text;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor, internação): serializa com enviar_evolucao, devolver_evolucao e criar_adendo
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

  -- rascunho aberto do autor nesta internação (pode ser adendo); null se não há
  select e.adendo_de into v_adendo_de from public.evolucoes e
  where e.autor_id = auth.uid()
    and e.internacao_id = p_internacao_id
    and e.status = 'RASCUNHO';

  -- alta: só o rascunho de adendo pode ser editado
  if v_int.status = 'ALTA' and v_adendo_de is null then
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

-- 3. criar_adendo: nova evolução RASCUNHO ligada à finalizada (adendo_de).
-- Chamador: autor da original, ou médico membro da equipe. Permitido com internação em alta.
create function public.criar_adendo(p_evolucao_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_internacao uuid;
  v_orig public.evolucoes%rowtype;
  v_int public.internacoes%rowtype;
  v_perfil public.perfil_profissional;
  v_categoria public.categoria_evolucao;
  v_modelo text;
  v_dados jsonb;
  v_id uuid;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor, internação) do chamador antes da linha: mesma chave de salvar_rascunho
  select e.internacao_id into v_internacao from public.evolucoes e where e.id = p_evolucao_id;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || v_internacao::text, 0));

  select e.* into v_orig from public.evolucoes e where e.id = p_evolucao_id for share;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  select i.* into v_int from public.internacoes i where i.id = v_orig.internacao_id for share;

  -- quem pode: autor da original, ou médico membro da equipe (checado antes do status)
  if not (v_orig.autor_id = auth.uid() or (app.eh_medico() and app.membro_equipe(v_int.equipe_id))) then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_orig.status <> 'FINALIZADA' then
    raise exception 'Somente evoluções finalizadas podem ter adendo.' using errcode = 'P0001';
  end if;

  -- categoria e modelo do chamador (mesma regra de salvar_rascunho)
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

  -- uma evolução aberta por autor e internação
  if exists (
    select 1 from public.evolucoes e
    where e.autor_id = auth.uid()
      and e.internacao_id = v_orig.internacao_id
      and e.status = 'RASCUNHO'
  ) then
    raise exception 'Você já tem um rascunho aberto nesta internação.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.evolucoes e
    where e.autor_id = auth.uid()
      and e.internacao_id = v_orig.internacao_id
      and e.status = 'AGUARDANDO_VALIDACAO'
  ) then
    raise exception 'Você tem uma evolução aguardando validação nesta internação.' using errcode = 'P0001';
  end if;

  if v_categoria = 'medica' then
    v_modelo := 'medica@1';
    v_dados := jsonb_build_object('modelo_versao', v_modelo, 'evolucao_clinica', '', 'conduta', '');
  else
    v_modelo := 'simples@1';
    v_dados := jsonb_build_object('modelo_versao', v_modelo, 'texto', '', 'plano', '');
  end if;

  -- adendo sempre aponta para a original: se o clicado é adendo, usa o vínculo dele
  insert into public.evolucoes (internacao_id, categoria, autor_id, dados, texto_livre, adendo_de)
  values (v_orig.internacao_id, v_categoria, auth.uid(), v_dados, '', coalesce(v_orig.adendo_de, p_evolucao_id))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.criar_adendo(uuid) from public, anon;
grant execute on function public.criar_adendo(uuid) to authenticated;

-- 4. Anexos: criar/confirmar/remover recusam internação com alta, exceto em adendo.
-- criar_anexo: igual a 0007, com a exceção de adendo.
create or replace function public.criar_anexo(
  p_evolucao_id uuid,
  p_tipo public.tipo_anexo,
  p_descricao text,
  p_data_exame date,
  p_mime text,
  p_tamanho_bytes int,
  p_sha256 text
) returns table (id uuid, storage_path text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_ev public.evolucoes%rowtype;
  v_status_int public.status_internacao;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- share: impede finalizar_evolucao de concorrer com a reserva
  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for share;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  if v_ev.autor_id <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'RASCUNHO' then
    raise exception 'Somente rascunhos podem receber anexos.' using errcode = 'P0001';
  end if;

  select i.status into v_status_int from public.internacoes i where i.id = v_ev.internacao_id;
  if v_status_int = 'ALTA' and v_ev.adendo_de is null then
    raise exception 'Internação com alta: evolução não pode ser alterada.' using errcode = 'P0001';
  end if;

  if p_tipo is null then
    raise exception 'Informe o tipo do anexo.' using errcode = 'P0001';
  end if;
  if p_mime is null or p_mime not in ('image/jpeg','image/png','image/webp','application/pdf') then
    raise exception 'Formato não suportado. Envie foto ou PDF.' using errcode = 'P0001';
  end if;
  if p_tamanho_bytes is null or p_tamanho_bytes < 1 then
    raise exception 'Arquivo vazio.' using errcode = 'P0001';
  end if;
  if p_tamanho_bytes > 20971520 then
    raise exception 'Arquivo maior que 20 MB.' using errcode = 'P0001';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Assinatura do arquivo inválida.' using errcode = 'P0001';
  end if;
  if p_data_exame is null then
    raise exception 'Informe a data do exame.' using errcode = 'P0001';
  end if;
  if p_data_exame > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data do exame não pode ser futura.' using errcode = 'P0001';
  end if;

  v_path := 'internacoes/' || v_ev.internacao_id || '/' || v_id;

  insert into public.anexos (id, evolucao_id, internacao_id, tipo, descricao, data_exame,
    storage_path, mime, tamanho_bytes, sha256, enviado_por)
  values (v_id, p_evolucao_id, v_ev.internacao_id, p_tipo, coalesce(trim(p_descricao), ''), p_data_exame,
    v_path, p_mime, p_tamanho_bytes, p_sha256, auth.uid());

  return query select v_id, v_path;
end;
$$;

revoke all on function public.criar_anexo(uuid, public.tipo_anexo, text, date, text, int, text) from public, anon;
grant execute on function public.criar_anexo(uuid, public.tipo_anexo, text, date, text, int, text) to authenticated;

-- confirmar_anexo: igual a 0008, com a recusa de alta (exceto adendo).
create or replace function public.confirmar_anexo(p_anexo_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_an public.anexos%rowtype;
  v_evolucao_id uuid;
  v_status public.status_evolucao;
  v_adendo_de uuid;
  v_status_int public.status_internacao;
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

  select e.adendo_de, i.status into v_adendo_de, v_status_int
  from public.evolucoes e
  join public.internacoes i on i.id = e.internacao_id
  where e.id = v_evolucao_id;
  if v_status_int = 'ALTA' and v_adendo_de is null then
    raise exception 'Internação com alta: evolução não pode ser alterada.' using errcode = 'P0001';
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

-- remover_anexo: igual a 0007, com a recusa de alta (exceto adendo).
create or replace function public.remover_anexo(p_anexo_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_an public.anexos%rowtype;
  v_status public.status_evolucao;
  v_adendo_de uuid;
  v_status_int public.status_internacao;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select a.* into v_an from public.anexos a where a.id = p_anexo_id for update;
  if not found then
    raise exception 'Anexo não encontrado.' using errcode = 'P0001';
  end if;
  if v_an.enviado_por <> auth.uid() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  select e.status, e.adendo_de, i.status into v_status, v_adendo_de, v_status_int
  from public.evolucoes e
  join public.internacoes i on i.id = e.internacao_id
  where e.id = v_an.evolucao_id;
  if v_status <> 'RASCUNHO' then
    raise exception 'Anexo de evolução finalizada não pode ser alterado.' using errcode = 'P0001';
  end if;
  if v_status_int = 'ALTA' and v_adendo_de is null then
    raise exception 'Internação com alta: evolução não pode ser alterada.' using errcode = 'P0001';
  end if;

  delete from public.anexos where anexos.id = p_anexo_id;
end;
$$;

revoke all on function public.remover_anexo(uuid) from public, anon;
grant execute on function public.remover_anexo(uuid) to authenticated;

-- 5. enviar_evolucao, validar_evolucao, devolver_evolucao, finalizar_evolucao, descartar_rascunho
-- não mudam: a recusa de alta vive em app.bloquear_finalizada (exceção de adendo acima),
-- e as funções de anexo do bloco 4 cobrem criação, confirmação e remoção.
