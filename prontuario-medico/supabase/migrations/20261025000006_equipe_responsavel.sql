-- Equipe responsável no lugar do médico responsável obrigatório.
-- Migrações 0001–0005 já estão em staging: não são editadas aqui.

alter table public.internacoes alter column medico_responsavel_id drop not null;

-- Assinatura sem p_medico_responsavel_id; mesmas regras da 0002.
drop function public.admitir_paciente(text, date, text, uuid, text, text, text, text, uuid);

create function public.admitir_paciente(
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

  return v_internacao;
end;
$$;

revoke execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) from public, anon;
grant execute on function public.admitir_paciente(text, date, text, uuid, text, text, text, text) to authenticated;

-- Padrão global: objetos futuros criados por postgres não dão EXECUTE a PUBLIC.
alter default privileges for role postgres revoke execute on functions from public;
