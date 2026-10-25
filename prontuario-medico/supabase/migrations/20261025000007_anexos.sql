-- Anexos de exames: tabela, bucket privado, políticas de Storage e funções de escrita.
-- Migrações 0001–0006 já estão em uso: não são editadas aqui.

-- 1. Tipo de anexo
create type public.tipo_anexo as enum ('LABORATORIO','IMAGEM','ECG','OUTRO');

-- 2. Tabela de anexos (metadados; o arquivo fica no bucket 'anexos')
create table public.anexos (
  id uuid primary key default gen_random_uuid(),
  evolucao_id uuid not null references public.evolucoes on delete restrict,
  internacao_id uuid not null references public.internacoes on delete restrict,
  tipo public.tipo_anexo not null,
  descricao text not null default '',
  data_exame date not null,
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp','application/pdf')),
  tamanho_bytes int not null check (tamanho_bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  confirmado boolean not null default false,
  enviado_por uuid not null references public.profissionais,
  enviado_em timestamptz not null default now()
);

create index anexos_evolucao_idx on public.anexos (evolucao_id);

alter table public.anexos enable row level security;

-- Leitura: perfil clínico, anexo confirmado, evolução finalizada ou do próprio autor
create policy anexos_select on public.anexos for select to authenticated
  using (
    app.eh_clinico() and confirmado and exists (
      select 1 from public.evolucoes e
      where e.id = anexos.evolucao_id
        and (e.status = 'FINALIZADA' or e.autor_id = auth.uid())
    )
  );

revoke all on table public.anexos from anon, authenticated;
grant select on table public.anexos to authenticated;

-- 3. Trava: anexo de evolução que não está em rascunho não muda.
-- Exceção: DELETE de linha não confirmada feito por finalizar_evolucao (flag transaction-local).
create function app.bloquear_anexo_finalizado() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.status_evolucao;
begin
  if tg_op = 'DELETE' and not old.confirmado
     and current_setting('app.finalizando', true) = 'on' then
    return old;
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

create trigger bloquear_anexo_finalizado before update or delete on public.anexos
  for each row execute function app.bloquear_anexo_finalizado();

create trigger auditar_anexos after insert or update or delete on public.anexos
  for each row execute function app.auditar();

-- 4. Bucket privado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 20971520, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- 5. Helpers de Storage (security definer: leem anexos sem depender da RLS do chamador)
create function app.anexo_pode_enviar(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.profissional_ativo() and exists (
    select 1 from public.anexos a
    join public.evolucoes e on e.id = a.evolucao_id
    where a.storage_path = p_name
      and a.enviado_por = auth.uid()
      and not a.confirmado
      and e.status = 'RASCUNHO'
  )
$$;

create function app.anexo_pode_ler(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.eh_clinico() and exists (
    select 1 from public.anexos a
    join public.evolucoes e on e.id = a.evolucao_id
    where a.storage_path = p_name
      and (a.confirmado or a.enviado_por = auth.uid())
      and (e.status = 'FINALIZADA' or e.autor_id = auth.uid())
  )
$$;

create function app.anexo_pode_apagar(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.profissional_ativo() and exists (
    select 1 from public.anexos a
    join public.evolucoes e on e.id = a.evolucao_id
    where a.storage_path = p_name
      and a.enviado_por = auth.uid()
      and e.status = 'RASCUNHO'
  )
$$;

revoke all on function app.anexo_pode_enviar(text) from public, anon;
revoke all on function app.anexo_pode_ler(text) from public, anon;
revoke all on function app.anexo_pode_apagar(text) from public, anon;
grant execute on function app.anexo_pode_enviar(text) to authenticated;
grant execute on function app.anexo_pode_ler(text) to authenticated;
grant execute on function app.anexo_pode_apagar(text) to authenticated;

-- 6. Políticas de Storage (sem UPDATE)
create policy anexos_objetos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and app.anexo_pode_enviar(name));

create policy anexos_objetos_select on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and app.anexo_pode_ler(name));

create policy anexos_objetos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and app.anexo_pode_apagar(name));

-- 7. Funções de escrita

-- Reserva a linha do anexo (sem objeto ainda). Só o autor, só rascunho.
create function public.criar_anexo(
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
  if v_status_int = 'ALTA' then
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

-- Confirma o anexo depois do upload: exige o objeto no bucket.
create function public.confirmar_anexo(p_anexo_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_an public.anexos%rowtype;
  v_status public.status_evolucao;
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

  select e.status into v_status from public.evolucoes e where e.id = v_an.evolucao_id;
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

-- Remove a linha de um anexo de rascunho (o app apaga o objeto antes).
create function public.remover_anexo(p_anexo_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_an public.anexos%rowtype;
  v_status public.status_evolucao;
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

  select e.status into v_status from public.evolucoes e where e.id = v_an.evolucao_id;
  if v_status <> 'RASCUNHO' then
    raise exception 'Anexo de evolução finalizada não pode ser alterado.' using errcode = 'P0001';
  end if;

  delete from public.anexos where anexos.id = p_anexo_id;
end;
$$;

-- 8. Privilégios: só authenticated executa
revoke all on function public.criar_anexo(uuid, public.tipo_anexo, text, date, text, int, text) from public, anon;
revoke all on function public.confirmar_anexo(uuid) from public, anon;
revoke all on function public.remover_anexo(uuid) from public, anon;
grant execute on function public.criar_anexo(uuid, public.tipo_anexo, text, date, text, int, text) to authenticated;
grant execute on function public.confirmar_anexo(uuid) to authenticated;
grant execute on function public.remover_anexo(uuid) to authenticated;
