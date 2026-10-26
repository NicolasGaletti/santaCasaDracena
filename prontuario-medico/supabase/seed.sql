-- Seed de desenvolvimento: dados totalmente fictícios.
-- Senha de todos os usuários: Teste@123
-- Roda como postgres em `supabase db reset`.

-- Usuários de autenticação
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'medico1@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'medico2@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'medico.semcrm@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'recepcao@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'inativo@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'residente@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'enfermeira@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'academico@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

-- Admin e usuário descartável para testes da Edge Function admin-usuarios (Plano 4).
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sessao@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'desativavel@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  -- Admin sem fator TOTP: usado só por e2e/mfa.spec.ts (cadastro obrigatório).
  ('a0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin.semmfa@teste.local', extensions.crypt('Teste@123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  now(), now(), now()
from auth.users u
where u.email like '%@teste.local';

-- Equipes
insert into public.equipes (id, nome) values
  ('e0000000-0000-0000-0000-000000000001', 'Cardiologia'),
  ('e0000000-0000-0000-0000-000000000002', 'Clínica Médica'),
  ('e0000000-0000-0000-0000-000000000003', 'Nefrologia'),
  ('e0000000-0000-0000-0000-000000000004', 'Cirurgia Geral');

-- Profissionais
insert into public.profissionais (id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho) values
  ('a0000000-0000-0000-0000-000000000001', 'Dra. Marina Lopes (teste)', 'medico', null, 'CRM', '145892', 'SP'),
  ('a0000000-0000-0000-0000-000000000002', 'Dr. Felipe Ramos (teste)', 'medico', null, 'CRM', '208117', 'SP'),
  ('a0000000-0000-0000-0000-000000000003', 'Dr. Sem Registro (teste)', 'medico', null, null, null, null),
  ('a0000000-0000-0000-0000-000000000004', 'Recepção Teste', 'recepcao', null, null, null, null);

insert into public.profissionais (id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho) values
  ('a0000000-0000-0000-0000-000000000006', 'Residente Teste (teste)', 'residente', 'medica', 'CRM', '310555', 'SP');

insert into public.profissionais (id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho) values
  ('a0000000-0000-0000-0000-000000000007', 'Enfermeira Teste (teste)', 'multiprofissional', 'enfermagem', 'COREN', '123456', 'SP'),
  ('a0000000-0000-0000-0000-000000000008', 'Acadêmico Teste (teste)', 'academico', 'medica', null, null, null);

insert into public.profissionais (id, nome, perfil, ativo) values
  ('a0000000-0000-0000-0000-000000000005', 'Dr. Inativo (teste)', 'medico', false);

insert into public.profissionais (id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho) values
  ('a0000000-0000-0000-0000-000000000009', 'Admin Teste', 'admin', null, null, null, null),
  ('a0000000-0000-0000-0000-00000000000a', 'Fisioterapeuta Sessão (teste)', 'multiprofissional', 'fisioterapia', 'CREFITO', '55555', 'SP'),
  ('a0000000-0000-0000-0000-00000000000b', 'Recepção Desativável (teste)', 'recepcao', null, null, null, null),
  ('a0000000-0000-0000-0000-00000000000c', 'Admin Sem MFA (teste)', 'admin', null, null, null, null);

-- Fator TOTP verificado do admin@teste.local. Secret fictício, só para dev/e2e
-- (e2e/helpers/mfa.ts usa o mesmo valor para gerar os códigos).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
values ('f0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000009', 'Autenticador (teste)',
        'totp', 'verified', 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', now(), now());

insert into public.membros_equipe (profissional_id, equipe_id) values
  ('a0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003'),
  ('a0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000001');

-- Pacientes fictícios
insert into public.pacientes (id, nome, data_nascimento, convenio) values
  ('b0000000-0000-0000-0000-000000000001', 'Paciente Fictício 01', '1948-02-14', 'SUS'),
  ('b0000000-0000-0000-0000-000000000002', 'Paciente Fictício 02', '1962-07-30', 'Unimed'),
  ('b0000000-0000-0000-0000-000000000003', 'Paciente Fictício 03', '1975-11-05', 'SUS'),
  ('b0000000-0000-0000-0000-000000000004', 'Paciente Fictício 04', '1953-04-21', 'Bradesco Saúde'),
  ('b0000000-0000-0000-0000-000000000005', 'Paciente Fictício 05', '1989-09-09', 'SUS'),
  ('b0000000-0000-0000-0000-000000000006', 'Paciente Fictício 06', '1971-01-17', 'Unimed'),
  ('b0000000-0000-0000-0000-000000000007', 'Paciente Fictício 07', '1960-06-02', 'SUS'),
  ('b0000000-0000-0000-0000-000000000008', 'Paciente Fictício 08', '1980-12-12', 'SUS');

-- Internações: 1-6 INTERNADO, 7-8 ALTA
insert into public.internacoes (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, status, admitido_em, alta_em, motivo_alta, alta_por) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'A-01', 'INTERNADO', '2026-10-20 09:00:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'A-02', 'INTERNADO', '2026-10-21 14:10:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'B-01', 'INTERNADO', '2026-10-22 08:30:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'A-03', 'INTERNADO', '2026-10-22 16:45:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'C-01', 'INTERNADO', '2026-10-23 10:00:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'C-02', 'INTERNADO', '2026-10-24 11:20:00-03', null, null, null),
  ('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'D-01', 'ALTA', '2026-10-15 09:00:00-03', '2026-10-19 15:00:00-03', 'Melhora clínica', 'a0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'D-02', 'ALTA', '2026-10-12 13:00:00-03', '2026-10-18 10:30:00-03', 'Transferência para outro serviço', 'a0000000-0000-0000-0000-000000000002');

insert into public.internacoes_clinico (internacao_id, diagnostico_inicial, comorbidades, muc) values
  ('c0000000-0000-0000-0000-000000000001', 'Insuficiência cardíaca descompensada', 'HAS, DM2', 'MUC-0101'),
  ('c0000000-0000-0000-0000-000000000002', 'Infarto agudo do miocárdio', 'Dislipidemia', 'MUC-0102'),
  ('c0000000-0000-0000-0000-000000000003', 'Pneumonia comunitária', null, 'MUC-0103'),
  ('c0000000-0000-0000-0000-000000000004', 'Arritmia (fibrilação atrial)', 'HAS', 'MUC-0104'),
  ('c0000000-0000-0000-0000-000000000005', 'Injúria renal aguda', 'DRC estágio 3', 'MUC-0105'),
  ('c0000000-0000-0000-0000-000000000006', 'Hipercalemia', null, 'MUC-0106'),
  ('c0000000-0000-0000-0000-000000000007', 'Síncope', 'HAS', 'MUC-0107'),
  ('c0000000-0000-0000-0000-000000000008', 'Edema agudo de pulmão', 'DRC estágio 4', 'MUC-0108');

-- Histórico de leitos: uma linha por internação (ativa ou encerrada na alta)
insert into public.leitos_historico (internacao_id, leito_ala, de, ate, por)
select i.id, i.leito_ala, i.admitido_em, i.alta_em, i.medico_responsavel_id
from public.internacoes i;

-- Evoluções médicas finalizadas (hash canônico igual ao de finalizar_evolucao)
insert into public.evolucoes (
  id, internacao_id, categoria, autor_id, status, dados, texto_livre,
  criado_em, atualizado_em, validada_por, validada_em, finalizada_em,
  snapshot_autor, snapshot_validador, conteudo_hash
)
select
  v.id, v.internacao_id, 'medica', v.autor_id, 'FINALIZADA', v.dados, v.texto,
  v.fin - interval '1 hour', v.fin, v.autor_id, v.fin, v.fin,
  v.snap, v.snap,
  encode(extensions.digest(
    jsonb_build_object(
      'dados', v.dados,
      'texto', v.texto,
      'internacao', v.internacao_id,
      'autor', v.autor_id,
      'finalizada_em', to_char(v.fin at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )::text,
    'sha256'
  ), 'hex')
from (values
  ('d0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid,
   '{"modelo_versao":"medica@1","diagnosticos":"Insuficiência cardíaca descompensada","comorbidades":"HAS, DM2","muc":"MUC-0101","evolucao_clinica":"Paciente em recuperação, dispneia em melhora, sem edema de membros inferiores.","ecg":"","exames_imagem":"","exames_laboratoriais":"","sinais":{"pa":"130/85","fc":88,"fr":null,"temp":null,"sato2":96,"dextro":null,"diurese":null},"exame_fisico":{"geral":"","ar":"","acv":"","abdome":"","membros":"","neuro":""},"conduta":"Ajuste de diurético e controle de peso diário"}'::jsonb,
   '',
   '2026-10-22 18:00:00-03'::timestamptz,
   '{"nome":"Dra. Marina Lopes (teste)","conselho":"CRM","numero":"145892","uf":"SP"}'::jsonb),
  ('d0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid,
   '{"modelo_versao":"medica@1","diagnosticos":"Infarto agudo do miocárdio","comorbidades":"Dislipidemia","muc":"MUC-0102","evolucao_clinica":"Dor torácica ausente desde a admissão. Troponina em queda.","ecg":"","exames_imagem":"","exames_laboratoriais":"Troponina em queda","sinais":{"pa":"120/78","fc":74,"fr":null,"temp":null,"sato2":null,"dextro":null,"diurese":null},"exame_fisico":{"geral":"","ar":"","acv":"","abdome":"","membros":"","neuro":""},"conduta":"Manter antiagregação e estatina"}'::jsonb,
   '',
   '2026-10-23 08:30:00-03'::timestamptz,
   '{"nome":"Dra. Marina Lopes (teste)","conselho":"CRM","numero":"145892","uf":"SP"}'::jsonb),
  ('d0000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid,
   '{"modelo_versao":"medica@1","diagnosticos":"Injúria renal aguda","comorbidades":"DRC estágio 3","muc":"MUC-0105","evolucao_clinica":"Creatinina em queda discreta. Diurese adequada.","ecg":"","exames_imagem":"","exames_laboratoriais":"Creatinina 2,1 mg/dL","sinais":{"pa":"","fc":null,"fr":null,"temp":null,"sato2":null,"dextro":null,"diurese":1450},"exame_fisico":{"geral":"","ar":"","acv":"","abdome":"","membros":"","neuro":""},"conduta":"Reavaliar função renal em 48 horas"}'::jsonb,
   '',
   '2026-10-24 07:45:00-03'::timestamptz,
   '{"nome":"Dr. Felipe Ramos (teste)","conselho":"CRM","numero":"208117","uf":"SP"}'::jsonb)
) as v(id, internacao_id, autor_id, dados, texto, fin, snap);
