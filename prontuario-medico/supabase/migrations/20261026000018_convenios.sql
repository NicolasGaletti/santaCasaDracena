-- Plano 5, Task 3: lista de convênios. Migrações 0001–0017 não são editadas.
-- pacientes.convenio segue texto histórico; só admitir_paciente valida contra a lista.

create table public.convenios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 100),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index convenios_nome_unico on public.convenios (lower(btrim(nome)));

create trigger auditar_convenios after insert or update or delete on public.convenios
  for each row execute function app.auditar();

alter table public.convenios enable row level security;
revoke all on public.convenios from anon, public, authenticated;
grant select on public.convenios to authenticated;
create policy convenios_select on public.convenios for select to authenticated
  using (app.profissional_ativo());

-- Seed: SUS, Particular e os valores distintos já usados (btrim, sem diferença de caixa)
insert into public.convenios (nome) values ('SUS'), ('Particular');
insert into public.convenios (nome)
select distinct on (lower(btrim(convenio))) btrim(convenio)
from public.pacientes
where nullif(btrim(convenio), '') is not null
  and char_length(btrim(convenio)) <= 100
order by lower(btrim(convenio)), btrim(convenio)
on conflict do nothing;

create function public.admin_salvar_convenio(p_id uuid, p_nome text, p_ativo boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
  v_id uuid := p_id;
begin
  perform app.exige_admin();
  if v_nome is null or char_length(v_nome) > 100 then
    raise exception 'Informe o nome do convênio (até 100 caracteres).' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.convenios c
    where lower(btrim(c.nome)) = lower(v_nome) and c.id is distinct from p_id
  ) then
    raise exception 'Já existe um convênio com esse nome.' using errcode = 'P0001';
  end if;

  if p_id is null then
    insert into public.convenios (nome, ativo) values (v_nome, coalesce(p_ativo, true))
    returning id into v_id;
  else
    update public.convenios set nome = v_nome, ativo = coalesce(p_ativo, ativo) where id = p_id;
    if not found then
      raise exception 'Convênio não encontrado.' using errcode = 'P0001';
    end if;
  end if;
  return v_id;
exception when unique_violation then
  -- Corrida entre duas gravações do mesmo nome: o índice único decide.
  raise exception 'Já existe um convênio com esse nome.' using errcode = 'P0001';
end;
$$;
revoke all on function public.admin_salvar_convenio(uuid, text, boolean) from public, anon;
grant execute on function public.admin_salvar_convenio(uuid, text, boolean) to authenticated;

create view public.vw_convenios_ordenados with (security_invoker = true) as
select
  c.id,
  c.nome,
  (select count(*)::int from public.pacientes p where lower(btrim(p.convenio)) = lower(btrim(c.nome))) as usos
from public.convenios c
where c.ativo
order by usos desc, c.nome;

revoke all on public.vw_convenios_ordenados from anon, public, authenticated;
grant select on public.vw_convenios_ordenados to authenticated;

-- public.admitir_paciente (fonte: 0017; diferença = só o bloco "Plano 5, Task 3")
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
  v_convenio text;
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

  -- Plano 5, Task 3: convênio precisa ser de um convênio ativo da lista; grava o nome canônico
  select c.nome into v_convenio from public.convenios c
  where c.ativo and lower(btrim(c.nome)) = lower(btrim(p_convenio));
  if v_convenio is null then
    raise exception 'Escolha um convênio da lista.' using errcode = 'P0001';
  end if;

  insert into public.pacientes (nome, data_nascimento, convenio)
  values (trim(p_nome), p_data_nascimento, v_convenio)
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

  -- notificações (Plano 4, Task 7b): médicos ativos da equipe, exceto quem admitiu
  perform app.notificar_medicos_equipe(p_equipe_id, array[auth.uid()], 'admissao_equipe',
    v_internacao, null, 'Paciente admitido na equipe' || app.sufixo_leito(trim(p_leito_ala)));

  return v_internacao;
end;
$$;
revoke execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) to authenticated;
