-- Reabrir a própria evolução finalizada por até 15 minutos. Migrações 0001–0018 já estão
-- aplicadas e não são editadas aqui.
--
-- Garantia legal mantida (CFM 1.638/2002): evolução FINALIZADA continua imutável para qualquer
-- UPDATE/DELETE. A única exceção é a transição FINALIZADA -> RASCUNHO feita por
-- public.reabrir_evolucao, que só aceita: autor médico, finalizada direto por ele (sem outro
-- validador), que não é adendo, dentro de 15 minutos, sem impressão, a mais recente da
-- internação, internação INTERNADO. Passado o prazo ou depois de impressa, só adendo.

-- 1. Trava de evolução (fonte: 0011). Mesma lógica; acrescenta apenas a exceção estreita da
-- reabertura. O sinal é uma configuração local da transação (app.reabrindo = id da evolução)
-- ligada por reabrir_evolucao imediatamente antes do UPDATE e desligada logo depois.
-- Authenticated não tem UPDATE em public.evolucoes e PostgREST só expõe funções do schema
-- public (não expõe pg_catalog.set_config), então o sinal não é acionável por fora.
create or replace function app.bloquear_finalizada() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'FINALIZADA' then
    -- exceção estreita: só a transição de reabertura, da própria linha, para RASCUNHO
    if tg_op = 'UPDATE'
       and new.status = 'RASCUNHO'
       and new.id = old.id
       and new.autor_id = old.autor_id
       and new.internacao_id = old.internacao_id
       and new.adendo_de is not distinct from old.adendo_de
       and current_setting('app.reabrindo', true) = old.id::text then
      return new;
    end if;
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

-- 2. reabrir_evolucao: todas as regras são checadas aqui (a UI só espelha).
create function public.reabrir_evolucao(p_evolucao_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_autor uuid;
  v_int uuid;
  v_ev public.evolucoes%rowtype;
  v_internacao public.internacoes%rowtype;
begin
  if not app.profissional_ativo() then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;

  -- trava por (autor, internação) antes da linha: mesma chave de salvar_rascunho e criar_adendo
  select e.autor_id, e.internacao_id into v_autor, v_int from public.evolucoes e where e.id = p_evolucao_id;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_autor::text || ':' || v_int::text, 0));

  select e.* into v_ev from public.evolucoes e where e.id = p_evolucao_id for update;
  if not found then
    raise exception 'Evolução não encontrada.' using errcode = 'P0001';
  end if;

  -- autor e perfil antes do status: não-autor não descobre o estado da evolução
  if v_ev.autor_id <> auth.uid() or app.perfil_atual() <> 'medico' then
    raise exception 'Acesso negado.' using errcode = 'P0001';
  end if;
  if v_ev.status <> 'FINALIZADA' then
    raise exception 'Somente evoluções finalizadas podem ser reabertas.' using errcode = 'P0001';
  end if;
  if v_ev.adendo_de is not null then
    raise exception 'Adendo não pode ser reaberto. Crie um novo adendo para corrigir.' using errcode = 'P0001';
  end if;
  if v_ev.validada_por is distinct from v_ev.autor_id then
    raise exception 'Esta evolução foi validada por outro médico e não pode ser reaberta. Use um adendo para corrigir.' using errcode = 'P0001';
  end if;
  if v_ev.finalizada_em is null or v_ev.finalizada_em <= now() - interval '15 minutes' then
    raise exception 'O prazo de 15 minutos para reabrir terminou. Use um adendo para corrigir.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.impressoes im where im.evolucao_id = p_evolucao_id) then
    raise exception 'Esta evolução já foi impressa. Use um adendo para corrigir.' using errcode = 'P0001';
  end if;

  -- só a finalizada mais recente da internação; adendo apontando para ela (mesmo rascunho) também impede
  if exists (
    select 1 from public.evolucoes o
    where o.internacao_id = v_ev.internacao_id
      and o.id <> v_ev.id
      and ((o.status = 'FINALIZADA' and o.finalizada_em >= v_ev.finalizada_em) or o.adendo_de = v_ev.id)
  ) then
    raise exception 'Há uma evolução mais recente nesta internação. Use um adendo para corrigir.' using errcode = 'P0001';
  end if;

  select i.* into v_internacao from public.internacoes i where i.id = v_ev.internacao_id for share;
  if v_internacao.status <> 'INTERNADO' then
    raise exception 'Internação com alta: use um adendo para corrigir.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.evolucoes o
    where o.autor_id = v_ev.autor_id and o.internacao_id = v_ev.internacao_id and o.status = 'RASCUNHO'
  ) then
    raise exception 'Você já tem um rascunho aberto nesta internação. Finalize ou descarte antes de reabrir.' using errcode = 'P0001';
  end if;

  -- desfaz exatamente o que app.finalizar_core grava (0017): status, snapshots, validação,
  -- finalizada_em, hash e hash_versao (volta ao default 1; a próxima finalização grava 2).
  perform set_config('app.reabrindo', p_evolucao_id::text, true);
  update public.evolucoes set
    status = 'RASCUNHO',
    snapshot_autor = null,
    snapshot_validador = null,
    validada_por = null,
    validada_em = null,
    finalizada_em = null,
    conteudo_hash = null,
    hash_versao = 1,
    atualizado_em = now()
  where id = p_evolucao_id;
  perform set_config('app.reabrindo', '', true);

  -- notificações geradas na finalização: finalizar_core avisa os outros médicos da equipe
  -- ('evolucao_equipe'); com a evolução de volta a rascunho esse aviso fica falso, então some.
  -- Finalizar de novo gera os avisos outra vez. ('evolucao_validada' só existe com validador
  -- distinto do autor, caso que a reabertura recusa.)
  delete from public.notificacoes where evolucao_id = p_evolucao_id and tipo = 'evolucao_equipe';

  -- registro explícito (o trigger app.auditar já grava o UPDATE; este o torna identificável)
  insert into public.auditoria (tabela, registro_id, operacao, antes, depois, por)
  values (
    'evolucoes',
    p_evolucao_id::text,
    'UPDATE',
    jsonb_build_object('status', 'FINALIZADA', 'finalizada_em', v_ev.finalizada_em),
    jsonb_build_object('status', 'RASCUNHO', 'acao', 'REABERTURA'),
    auth.uid()
  );
end;
$$;

revoke all on function public.reabrir_evolucao(uuid) from public, anon;
grant execute on function public.reabrir_evolucao(uuid) to authenticated;
