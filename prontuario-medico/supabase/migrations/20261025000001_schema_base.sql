-- Schema base: enums, tabelas (spec 6.2, sem anexos), RLS, helpers, auditoria.

-- Enums
create type perfil_profissional as enum ('medico','residente','multiprofissional','recepcao','auditoria','admin');
create type categoria_evolucao as enum ('medica','enfermagem','fisioterapia','nutricao','psicologia','fonoaudiologia','servico_social');
create type status_internacao as enum ('INTERNADO','ALTA');
create type status_evolucao as enum ('RASCUNHO','AGUARDANDO_VALIDACAO','FINALIZADA');

-- Tabelas
create table public.profissionais (
  id uuid primary key references auth.users(id) on delete restrict,
  nome text not null,
  perfil perfil_profissional not null,
  categoria categoria_evolucao,
  conselho text,
  numero_conselho text,
  uf_conselho text,
  ativo boolean not null default true
);

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);

create table public.membros_equipe (
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  equipe_id uuid not null references public.equipes(id) on delete restrict,
  primary key (profissional_id, equipe_id)
);

create table public.pacientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nascimento date not null,
  cpf text,
  cns text,
  nome_mae text,
  convenio text not null,
  criado_em timestamptz not null default now()
);

create table public.internacoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  equipe_id uuid not null references public.equipes(id) on delete restrict,
  medico_responsavel_id uuid not null references public.profissionais(id) on delete restrict,
  leito_ala text not null,
  diagnostico_inicial text not null,
  comorbidades text not null,
  muc text not null,
  status status_internacao not null default 'INTERNADO',
  admitido_em timestamptz not null default now(),
  alta_em timestamptz,
  motivo_alta text,
  alta_por uuid references public.profissionais(id) on delete restrict
);

create table public.evolucoes (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id) on delete restrict,
  categoria categoria_evolucao not null,
  autor_id uuid not null references public.profissionais(id) on delete restrict,
  status status_evolucao not null default 'RASCUNHO',
  dados jsonb not null default '{}',
  texto_livre text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviada_em timestamptz,
  validada_por uuid references public.profissionais(id) on delete restrict,
  validada_em timestamptz,
  devolvida_motivo text,
  finalizada_em timestamptz,
  snapshot_autor jsonb,
  snapshot_validador jsonb,
  conteudo_hash text,
  assinatura_digital bytea,
  adendo_de uuid references public.evolucoes(id) on delete restrict
);

create unique index evolucoes_um_rascunho
  on public.evolucoes (autor_id, internacao_id)
  where status = 'RASCUNHO';

create table public.impressoes (
  id uuid primary key default gen_random_uuid(),
  evolucao_id uuid not null references public.evolucoes(id) on delete restrict,
  impresso_por uuid not null references public.profissionais(id) on delete restrict,
  impresso_em timestamptz not null default now(),
  via integer not null
);

create table public.acessos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  internacao_id uuid not null references public.internacoes(id) on delete restrict,
  acao text not null,
  em timestamptz not null default now(),
  ip inet,
  user_agent text
);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id text not null,
  operacao text not null check (operacao in ('INSERT','UPDATE','DELETE')),
  antes jsonb,
  depois jsonb,
  por uuid,
  em timestamptz not null default now()
);

create table public.leitos_historico (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id) on delete restrict,
  leito_ala text not null,
  de timestamptz not null default now(),
  ate timestamptz,
  por uuid references public.profissionais(id) on delete restrict
);

-- Helpers (schema app)
create schema app;

create function app.perfil_atual() returns perfil_profissional
language sql stable security definer set search_path = ''
as $$
  select p.perfil from public.profissionais p where p.id = auth.uid() and p.ativo
$$;

create function app.profissional_ativo() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profissionais p where p.id = auth.uid() and p.ativo)
$$;

create function app.eh_clinico() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(app.perfil_atual() not in ('recepcao','admin'), false)
$$;

create function app.eh_medico() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(app.perfil_atual() = 'medico', false)
$$;

create function app.membro_equipe(p_equipe uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membros_equipe m
    where m.equipe_id = p_equipe and m.profissional_id = auth.uid()
  )
$$;

-- Trigger de auditoria
create function app.auditar() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.auditoria (tabela, registro_id, operacao, antes, depois, por)
  values (
    tg_table_name,
    coalesce(r->>'id', (r->>'profissional_id') || '/' || (r->>'equipe_id')),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return null;
end;
$$;

create trigger auditar_pacientes after insert or update or delete on public.pacientes
  for each row execute function app.auditar();
create trigger auditar_internacoes after insert or update or delete on public.internacoes
  for each row execute function app.auditar();
create trigger auditar_evolucoes after insert or update or delete on public.evolucoes
  for each row execute function app.auditar();
create trigger auditar_profissionais after insert or update or delete on public.profissionais
  for each row execute function app.auditar();
create trigger auditar_membros_equipe after insert or update or delete on public.membros_equipe
  for each row execute function app.auditar();

-- View pública: nome e conselho de todos; profissionais só mostra o próprio registro
create view public.vw_profissionais_publico as
  select id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho
  from public.profissionais;

-- RLS em todas as tabelas
alter table public.profissionais enable row level security;
alter table public.equipes enable row level security;
alter table public.membros_equipe enable row level security;
alter table public.pacientes enable row level security;
alter table public.internacoes enable row level security;
alter table public.evolucoes enable row level security;
alter table public.impressoes enable row level security;
alter table public.acessos enable row level security;
alter table public.auditoria enable row level security;
alter table public.leitos_historico enable row level security;

-- Políticas de SELECT (sem INSERT/UPDATE/DELETE para authenticated)
create policy pacientes_select on public.pacientes for select to authenticated
  using (app.profissional_ativo());
create policy internacoes_select on public.internacoes for select to authenticated
  using (app.profissional_ativo());
create policy equipes_select on public.equipes for select to authenticated
  using (app.profissional_ativo());
create policy membros_equipe_select on public.membros_equipe for select to authenticated
  using (app.profissional_ativo());
create policy evolucoes_select on public.evolucoes for select to authenticated
  using (app.eh_clinico() and (status = 'FINALIZADA' or autor_id = auth.uid()));
create policy profissionais_select_proprio on public.profissionais for select to authenticated
  using (id = auth.uid());

-- Privilégios: anon não acessa nada; authenticated só SELECT
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
grant select on all tables in schema public to authenticated;
grant select on public.vw_profissionais_publico to authenticated;
revoke all on public.vw_profissionais_publico from anon, public;

revoke all on schema app from anon, public;
grant usage on schema app to authenticated;
revoke execute on all functions in schema app from public;
grant execute on function app.perfil_atual() to authenticated;
grant execute on function app.profissional_ativo() to authenticated;
grant execute on function app.eh_clinico() to authenticated;
grant execute on function app.eh_medico() to authenticated;
grant execute on function app.membro_equipe(uuid) to authenticated;
revoke execute on function app.auditar() from public;
