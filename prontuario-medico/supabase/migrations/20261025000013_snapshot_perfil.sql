-- Snapshot do autor passa a gravar o perfil vigente na finalização (ex.: 'academico').
-- Assim a 2ª via não muda quando o autor é promovido. Migrações 0001–0012 não são editadas.

-- finalizar_core: idêntico a 0010, exceto pelo campo 'perfil' em snapshot_autor. Hash não muda.
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

  return v_agora;
end;
$$;

revoke all on function app.finalizar_core(uuid, uuid) from public, anon, authenticated;
