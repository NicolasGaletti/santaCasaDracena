# Plano 4 — Alta, administração, segurança e operação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a v1: alta médica com folha de alta; área de administração (equipes, profissionais com função escolhida, vínculos, convites e desativação); recuperação de senha; MFA para admin; notificações (sino + push de pendências); expiração por inatividade; tela de auditoria; PWA; headers de segurança; CI e backup diário.

**Architecture:** Alta e administração por funções Postgres (`security definer`) com checagem de perfil. Convite/desativação de usuários via **Edge Function `admin-usuarios`** (a única peça com `service_role`, que nunca sai do Supabase). MFA TOTP do Supabase Auth com exigência de `aal2` no app e no banco para perfis sensíveis. PWA mínimo (manifest + service worker só para o shell). GitHub Actions para CI e para `pg_dump` criptografado no Cloudflare R2.

**Tech Stack:** Planos 1–3 + Supabase Edge Functions (Deno), Supabase Auth MFA, Serwist (service worker), GitHub Actions, `age` (criptografia do backup), Cloudflare R2 (S3 API).

**Spec:** `docs/superpowers/specs/2026-10-25-prontuario-design.md` (6.6, 6.6.1, 6.7, 6.8, 6.9; decisões 9, 13)

## Global Constraints

- Todos os dos planos anteriores. Migrations existentes imutáveis. Novas a partir de `20261025000012_*`.
- **Só o médico dá alta** (decisão 9): perfil `medico`, ativo, membro da equipe da internação.
- Tipos de alta: `MELHORADA`, `CURADA`, `A_PEDIDO`, `TRANSFERENCIA`, `EVASAO`, `OBITO` (rótulos: Melhorada, Curada, A pedido, Transferência, Evasão, Óbito). Campos: tipo (obrigatório), resumo/motivo (obrigatório, 1–2000), data/hora da alta (padrão agora; não pode ser futura nem anterior à admissão).
- Após a alta: internação `ALTA` somente leitura (trava já existe; adendo é a única exceção — Plano 3). Rascunhos pendentes ficam congelados (sem valor de registro; não aparecem na timeline).
- Admin (`admin`) gerencia equipes, profissionais e vínculos; **não lê conteúdo clínico** (RLS já garante) e toda ação dele vai para `auditoria`.
- Funções na tela de convite (decisão 13 / spec 6.6.1): Médico, Residente, Interno (acadêmico), Enfermagem, Fisioterapia, Nutrição, Psicologia, Fonoaudiologia, Serviço social, Recepção, Auditoria, Admin. Mapeamento → `perfil` + `categoria`: médico→`medico`/null; residente→`residente`/null; interno→`academico`/null; enfermagem…serviço social→`multiprofissional`/categoria correspondente; recepção→`recepcao`; auditoria→`auditoria`; admin→`admin`. Conselho sugerido: médico/residente CRM; enfermagem COREN; fisioterapia CREFITO; nutrição CRN; psicologia CRP; fonoaudiologia CRFa; serviço social CRESS; interno/recepção/auditoria/admin sem conselho.
- `service_role` só dentro da Edge Function (variável automática do Supabase). Nunca no Netlify, nunca no navegador, nunca no repositório.
- MFA TOTP obrigatório **só para `admin`** (decisão do usuário): sem fator → tela de cadastro obrigatória; com fator e sessão `aal1` → tela de código. No banco: `app.exige_aal2()` (perfil `admin` com `aal` ≠ `aal2` → P0001) usado pelas funções `admin_*`. Demais perfis podem cadastrar MFA opcionalmente em `/conta/seguranca`.
- Notificações (decisão do usuário): tabela `notificacoes`; **push só para pendências** — `evolução aguardando validação` (médicos da equipe) e `evolução devolvida` (autor); `validada`, `nova evolução finalizada na equipe` e `paciente admitido na equipe` só no sino. Texto do push sem nome de paciente nem conteúdo clínico (ex.: `Nova evolução aguardando sua validação · Leito A-02`). Preferências por usuário.
- Inatividade: 30 min sem interação → logout e volta ao login com `Sua sessão expirou por inatividade.` Logout (manual ou por inatividade) apaga as cópias locais de rascunho do IndexedDB.
- Headers em todas as respostas: CSP (`default-src 'self'`; `connect-src 'self' https://*.supabase.co wss://*.supabase.co`; `img-src 'self' data: blob: https://*.supabase.co`; `frame-ancestors 'none'`), `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `X-Content-Type-Options: nosniff`; páginas autenticadas e rotas de PDF com `Cache-Control: no-store`.
- PWA: nome "Prontuário Santa Casa", `display: standalone`, ícones 192/512 e maskable; o service worker faz cache **apenas** do shell estático e da página offline (`Sem conexão. Abra o app quando a rede voltar.`); nenhuma rota de dados, PDF ou Storage em cache.
- E-mail de convite/recuperação: SMTP próprio (ex.: Resend camada gratuita) configurado pelo usuário no Supabase — o SMTP padrão do Supabase só serve para teste (limite baixo). Local: Inbucket/Mailpit da CLI.

## Review Focus

1. **Admin tenta ler evolução ou anexo:** continua negado (regressão das RLS). Teste: Task 3 `admin não lê conteúdo clínico`.
2. **Profissional desativado com sessão aberta no celular:** próxima requisição já bloqueada (`exigirProfissional` + `app.profissional_ativo()`), e a Edge Function revoga as sessões. Teste: Task 4 `desativar revoga sessões`.
3. **Admin sem MFA chamando a API direto (fora do app):** funções `admin_*` recusam `aal1`. Teste: Task 7 `admin aal1 não cria equipe`.
4. **Alta com data futura ou antes da admissão:** recusada. Teste: Task 1.
5. **Convite para e-mail já cadastrado / função sem conselho exigido:** mensagem clara, nada duplicado. Teste: Task 4.

---

### Task 1: Alta médica no banco

**Files:** Create `supabase/migrations/20261025000012_alta.sql`, `supabase/tests/012_alta.test.sql`

**Interfaces:**
- enum `tipo_alta`; `internacoes` ganha `tipo_alta tipo_alta`, `resumo_alta text` (os campos `alta_em`, `motivo_alta`, `alta_por` já existem — `motivo_alta` passa a guardar o resumo; não duplicar: usar `motivo_alta` como resumo e só adicionar `tipo_alta`).
- `dar_alta(p_internacao_id uuid, p_tipo tipo_alta, p_resumo text, p_alta_em timestamptz default now()) returns void` — médico ativo da equipe; internação `INTERNADO` (lock); data entre `admitido_em` e `now()`; recusa se houver evolução `AGUARDANDO_VALIDACAO` na internação (`Há evoluções aguardando validação nesta internação.`); seta `status='ALTA'`, `alta_em`, `alta_por`, `tipo_alta`, `motivo_alta`; fecha `leitos_historico` aberto.
- `vw_internacoes_lista`: recriar incluindo `tipo_alta` e `alta_em` (manter colunas existentes, grants e `security_invoker`).

- [ ] Steps: pgTAP que falha (`médico da equipe dá alta`; `médico de outra equipe não dá alta`; `residente não dá alta`; `alta futura falha`; `alta antes da admissão falha`; `após alta não salva rascunho`; `após alta adendo continua permitido`) → FAIL → migration → PASS + `db:types` → commit `feat(db): alta médica`.

---

### Task 2: Alta na interface e folha de alta

**Files:** Create `src/features/alta/dialog-alta.tsx`, `src/features/alta/actions.ts`, `src/features/impressao/documento-alta.tsx`, `src/app/internacoes/[id]/alta/pdf/route.ts`, `e2e/alta.spec.ts`; Modify `src/app/(app)/internacoes/[id]/page.tsx`, `src/features/internacoes/cartao-internacao.tsx` (em Anteriores: data e tipo da alta)

**Interfaces:** botão `Dar alta` (só médico da equipe, internação ativa) → dialog (tipo em chips, resumo, data/hora) com confirmação `Depois da alta, a internação fica somente leitura.`; action `darAlta(internacaoId, dados): Promise<{erro?: string}>`; PDF "FOLHA DE ALTA" (paciente, admissão, alta, tipo, resumo, equipe, "Alta dada por <médico> – CRM", assinatura do médico; mesma regra de no-store e checagens do PDF de evolução, sem via).

- [ ] Steps: E2E que falha (`médico dá alta e paciente vai para Anteriores`; `folha de alta em PDF`; `recepção não vê Dar alta`) → FAIL → implementar (frontend-design + tokens) → PASS + build → commit `feat(alta): alta médica e folha de alta`.

---

### Task 3: Funções de administração no banco

**Files:** Create `supabase/migrations/20261025000013_admin.sql`, `supabase/tests/013_admin.test.sql`

**Interfaces (todas exigem perfil `admin` ativo + `app.exige_aal2()` após a Task 7 — nesta task, só perfil):**
- `admin_salvar_equipe(p_id uuid, p_nome text, p_ativo boolean) returns uuid` (cria se `p_id` null; nome único, sem apagar).
- `admin_vincular(p_profissional_id uuid, p_equipe_id uuid)` / `admin_desvincular(...)`.
- `admin_atualizar_profissional(p_id uuid, p_nome text, p_perfil perfil_profissional, p_categoria categoria_evolucao, p_conselho text, p_numero text, p_uf text)` — valida coerência perfil/categoria (multiprofissional exige categoria; demais categoria null) e conselho obrigatório para médico/residente/multiprofissional.
- `admin_definir_ativo(p_id uuid, p_ativo boolean)` (a revogação de sessões fica na Edge Function).
- RLS: SELECT em `profissionais` para `admin` (todas as linhas). Admin continua sem SELECT em evolucoes/anexos/internacoes_clinico.

- [ ] Steps: pgTAP que falha (`admin cria equipe`; `admin vincula e desvincula`; `médico não chama funções admin`; `perfil multiprofissional sem categoria falha`; `admin não lê conteúdo clínico`; `ações do admin vão para auditoria`) → FAIL → migration → PASS → commit `feat(db): funções de administração`.

---

### Task 4: Edge Function de usuários

**Files:** Create `supabase/functions/admin-usuarios/index.ts`, `supabase/functions/admin-usuarios/deno.json`, `supabase/functions/_shared/cors.ts`, `e2e/admin-usuarios.spec.ts`; Modify `supabase/config.toml` (`[functions.admin-usuarios] verify_jwt = true`)

**Interfaces:** `POST /functions/v1/admin-usuarios` com JWT do usuário; corpo `{ acao: 'convidar', email, nome, funcao, conselho?, numero?, uf? } | { acao: 'reenviar', profissionalId } | { acao: 'desativar' | 'reativar', profissionalId }`.
- Confere o chamador com o cliente do próprio JWT (`profissionais.perfil = 'admin'` e ativo; após Task 7, `aal2`); 403 caso contrário.
- `convidar`: `auth.admin.inviteUserByEmail(email, { redirectTo: <SITE_URL>/auth/callback?next=/definir-senha })` → insere `profissionais` (perfil/categoria pelo mapeamento das Global Constraints) via cliente `service_role`; e-mail já existente → 409 `Este e-mail já está cadastrado.`
- `desativar`: `admin_definir_ativo(false)` + `auth.admin.signOut(userId, 'global')` (ou `updateUserById(id, { ban_duration: '876000h' })`); `reativar` desfaz.
- Respostas JSON `{ ok: true }` ou `{ erro: '<pt-BR>' }`.

- [ ] Steps: E2E que falha contra `npx supabase functions serve` (`admin convida e o e-mail chega no Inbucket`; `médico recebe 403`; `e-mail duplicado dá 409`; `desativar revoga sessões` — usuário logado em outro contexto perde acesso na próxima navegação) → FAIL → implementar → PASS → commit `feat(admin): edge function de convites e desativação`.

---

### Task 5: Telas de administração

**Files:** Create `src/app/(app)/admin/layout.tsx`, `src/app/(app)/admin/profissionais/page.tsx`, `src/app/(app)/admin/equipes/page.tsx`, `src/features/admin/*`, `e2e/admin.spec.ts`; Modify `src/components/app-shell.tsx` (aba "Administração" só para admin; admin não vê Internados/Imprimir conteúdo clínico — redireciona `/` para `/admin/profissionais`)

**Interfaces:** Profissionais: lista com busca, função, conselho, equipes, status (Ativo/Convite pendente/Desativado); `Convidar profissional` (nome, e-mail, **função em select** com as 12 opções, conselho sugerido pela função e editável, número, UF, equipes multiselect); editar; desativar/reativar com confirmação; reenviar convite. Equipes: lista, criar/renomear/desativar, membros (adicionar/remover). Chamadas: Edge Function para convite/desativação (via `supabase.functions.invoke` no servidor com o JWT do usuário) e RPCs `admin_*` para o resto.

- [ ] Steps: E2E que falha (`admin convida enfermeira com COREN sugerido`; `admin cria equipe e vincula`; `admin desativa e usuário perde acesso`; `médico não acessa /admin`) → FAIL → implementar (frontend-design) → PASS + screenshot → commit `feat(admin): telas de profissionais e equipes`.

---

### Task 6: Convite, definição e recuperação de senha

**Files:** Create `src/app/definir-senha/page.tsx`, `src/app/definir-senha/actions.ts`, `src/app/esqueci-senha/page.tsx`, `src/app/esqueci-senha/actions.ts`, `e2e/senha.spec.ts`; Modify `src/app/auth/callback/route.ts` (aceitar `type=invite|recovery` / `token_hash` + `verifyOtp`, redirecionando para `next` seguro via `destinoSeguro`), `src/app/login/page.tsx` (link `Esqueci minha senha`), `src/lib/supabase/proxy.ts` (rotas públicas: `/esqueci-senha`, `/definir-senha` exige sessão de convite/recovery)

**Interfaces:** senha mínima 10 caracteres com letra e número; mensagens pt-BR; após definir, vai para MFA se o perfil exigir (Task 7), senão `/`. Esqueci senha sempre responde `Se o e-mail estiver cadastrado, enviaremos um link.` (não revela existência).

- [ ] Steps: E2E (Inbucket) que falha (`convidado define senha e entra`; `recuperação de senha`; `resposta igual para e-mail inexistente`) → FAIL → implementar → PASS → commit `feat(auth): convite e recuperação de senha`.

---

### Task 7: MFA obrigatório para admin

**Files:** Create `supabase/migrations/20261025000014_aal2.sql`, `supabase/tests/014_aal2.test.sql`, `src/app/mfa/cadastrar/page.tsx`, `src/app/mfa/verificar/page.tsx`, `src/features/mfa/*`, `e2e/mfa.spec.ts`; Modify `src/lib/auth.ts` (`exigirProfissional` checa `aal` para perfis sensíveis), `supabase/config.toml` (`[auth.mfa.totp] enroll_enabled = true, verify_enabled = true`)

**Interfaces:** `app.exige_aal2()` (raise P0001 `Confirme o código do autenticador para continuar.` quando perfil = `admin` e `aal` ≠ `aal2`), chamado no início das funções `admin_*` (recriar com `create or replace` mantendo as regras atuais). Página opcional `/conta/seguranca` para qualquer perfil cadastrar MFA. Telas: cadastro com QR code (`mfa.enroll` → `qr_code`), confirmação do primeiro código, verificação a cada login (`mfa.challengeAndVerify`). Seed/testes: helper para gerar TOTP no e2e (`otplib` como devDependency) a partir do secret do enroll.

- [ ] Steps: pgTAP (`admin aal1 não cria equipe`; `admin aal2 cria equipe`; `médico aal1 finaliza normalmente`) + E2E (`admin sem fator é levado ao cadastro`; `admin com fator pede código no login`; `médico entra só com senha`) → FAIL → implementar → PASS → commit `feat(auth): MFA obrigatório para admin`.

---

### Task 7b: Notificações — banco e envio

**Files:** Create `supabase/migrations/20261025000015_notificacoes.sql`, `supabase/tests/015_notificacoes.test.sql`, `supabase/functions/enviar-push/index.ts`; Modify `supabase/config.toml`

**Interfaces:**
- `notificacoes (id, destinatario_id, tipo text check in ('validacao_pendente','evolucao_devolvida','evolucao_validada','evolucao_equipe','admissao_equipe'), internacao_id, evolucao_id, texto text, lida_em timestamptz, criada_em)`; RLS: destinatário lê/atualiza `lida_em` das próprias (função `marcar_lida(p_id)` / `marcar_todas_lidas()`); nenhum outro acesso.
- `preferencias_notificacao (profissional_id pk, push_validacao boolean default true, push_devolvida boolean default true)`; `push_assinaturas (id, profissional_id, endpoint unique, p256dh, auth, criada_em)` com funções `registrar_assinatura_push(...)` / `remover_assinatura_push(endpoint)`.
- Geração: dentro de `enviar_evolucao` (→ `validacao_pendente` para cada médico ativo da equipe, exceto o autor), `devolver_evolucao` (→ `evolucao_devolvida` ao autor), `app.finalizar_core` (→ `evolucao_validada` ao autor quando validador ≠ autor; `evolucao_equipe` aos médicos da equipe exceto validador), `admitir_paciente` (→ `admissao_equipe` aos médicos da equipe) — `create or replace` mantendo regras.
- Push: Database Webhook (ou `pg_net`) em INSERT de `notificacoes` com tipo ∈ {validacao_pendente, evolucao_devolvida} chama a Edge Function `enviar-push` (Web Push com VAPID; chaves em secrets do Supabase); assinaturas inválidas (410) são removidas.
- Steps: pgTAP (geração de cada tipo; destinatário só lê as suas; recepção não recebe) → FAIL → migration + função → PASS → commit `feat(notificacoes): geração e envio de push`.

### Task 7c: Notificações — interface

**Files:** Create `src/features/notificacoes/*` (sino com contador no `app-shell`, lista em `/notificacoes`, preferências em `/conta/notificacoes`, registro do service worker push), `e2e/notificacoes.spec.ts`

**Interfaces:** sino com contador de não lidas (Supabase Realtime na tabela `notificacoes` filtrada pelo usuário); lista com link para a internação/evolução e "marcar todas como lidas"; ativar push pede permissão do navegador e registra a assinatura (explicar que no iPhone exige app instalado na tela inicial); preferências liga/desliga push de validação e de devolução.

- Steps: E2E (`acadêmico envia e o médico vê o contador subir`; `marcar como lida zera o contador`; `preferências salvam`) → FAIL → implementar (frontend-design) → PASS → commit `feat(notificacoes): sino e preferências`.

### Task 8: Sessão por inatividade e limpeza local

**Files:** Create `src/features/sessao/monitor-inatividade.tsx`, `src/features/sessao/monitor-inatividade.test.tsx`; Modify `src/app/(app)/layout.tsx`, `src/app/login/actions.ts` (`sair` limpa IndexedDB via chamada client antes do submit, ou página `/saindo` client-side que limpa e chama a action), `src/app/login/page.tsx` (mensagem `?motivo=inatividade`)

**Interfaces:** `MonitorInatividade({ minutos = 30 })` escuta pointer/teclado/visibilidade; ao expirar: limpa `rascunho:*` do IndexedDB e faz logout → `/login?motivo=inatividade`. Rascunho em edição já está salvo no servidor pelo autosave (forçar `forcar()` antes de sair se houver fila ativa).

- [ ] Steps: Vitest com timers falsos (`expira após 30 min sem interação`; `interação reinicia`) + E2E (`logout limpa cópias locais`) → FAIL → implementar → PASS → commit `feat(sessao): expiração por inatividade`.

---

### Task 9: Tela de auditoria

**Files:** Create `src/app/(app)/auditoria/page.tsx`, `src/features/auditoria/*`, `e2e/auditoria.spec.ts`

**Interfaces:** só perfil `auditoria`: abas "Acessos" (tabela `acessos`: quando, profissional, paciente/internação, ação) e "Alterações" (tabela `auditoria`: quando, quem, tabela, operação, resumo do diff); filtros por período e profissional; paginação de 50. Somente leitura.

- [ ] Steps: E2E (`auditoria vê acessos de prontuário`; `médico não acessa /auditoria`) → FAIL → implementar → PASS → commit `feat(auditoria): tela de acessos e alterações`.

---

### Task 10: PWA

**Files:** Create `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png` (gerados a partir de um SVG simples com as cores do design system), `src/app/sw.ts`, `src/app/offline/page.tsx`; Modify `next.config.ts` (Serwist conforme exemplo Turbopack oficial — conferir `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`), `package.json`

**Interfaces:** manifest (Global Constraints); SW com precache do shell e fallback offline; `NetworkOnly` para `/evolucoes/*`, `/internacoes/*`, `/api/*`, `*.supabase.co`.

- [ ] Steps: E2E (`manifest válido`; `offline mostra página offline`; `rotas de dados não ficam em cache` — checar `caches.keys()`/conteúdo) → FAIL → implementar → PASS + build → commit `feat(pwa): app instalável com página offline`.

---

### Task 11: Headers de segurança

**Files:** Modify `next.config.ts` (`headers()`), `src/lib/supabase/proxy.ts` (no-store em respostas autenticadas); Create `e2e/headers.spec.ts`

- [ ] Steps: E2E que falha (cada header das Global Constraints presente em `/login` e numa página autenticada; `Cache-Control: no-store` no prontuário e no PDF; CSP não quebra login/PDF/upload — rodar a suíte inteira) → FAIL → implementar → PASS + build → commit `feat(seguranca): headers HTTP`.

---

### Task 12: CI e backup

**Files:** Create `.github/workflows/ci.yml`, `.github/workflows/backup.yml`, `docs/backup.md`

**Interfaces:**
- `ci.yml` (push/PR em `develop`, `staging`, `main`): Node 22, `npm ci`, lint, typecheck, `vitest`, `supabase start` + `supabase test db`, `next build`. (E2E fica opcional/manual por custo de minutos.)
- `backup.yml` (cron diário 06:00 UTC + manual): `pg_dump` do banco do ambiente (`secrets.SUPABASE_DB_URL_STAGING` / `_PROD`), comprime, criptografa com `age -r ${{ secrets.BACKUP_AGE_PUBLIC_KEY }}`, envia ao R2 (`aws s3 cp --endpoint-url ${{ secrets.R2_ENDPOINT }}`) com retenção (lifecycle no bucket: 30 dias diários). Nada de dado em artefato do GitHub.
- **Anexos também:** o backup do Supabase NÃO inclui arquivos do Storage. `backup.yml` sincroniza o bucket `anexos` para o R2 (`rclone sync` via API S3 do Supabase Storage, com credenciais S3 do projeto em secrets), criptografado (rclone `crypt` com senha em secret), sem apagar no destino o que sumir na origem (retenção legal). Restauração documentada.
- `docs/backup.md`: como criar o bucket R2, a chave `age` (privada guardada fora do GitHub), os secrets, e **como restaurar** (testar restauração em projeto descartável antes do go-live).

- [ ] Steps: `actionlint` local (via `npx`/docker) sem erros; CI roda verde no push de `develop` (controller confere no GitHub); commit `ci: pipeline e backup diário criptografado`.

---

### Task 13: Fechamento da v1

**Files:** Create `docs/lgpd.md` (finalidade, base legal, quem acessa, retenção 20 anos, operadores Supabase/Netlify/Cloudflare, região, incidentes), `docs/go-live.md` (checklist: projeto Supabase de produção em São Paulo plano Pro + PITR, SMTP, usuários reais convidados pelo admin, primeiro admin por SQL, remover usuários de teste, proteção do site, backup testado, piloto com uma equipe e papel em paralelo); Modify READMEs.

- [ ] Steps: suíte completa verde; commit `docs: LGPD e checklist de go-live`; controller: `db push` pelo usuário (0012+), merge `develop` → `staging`, push, smoke completo no staging (convite → definir senha → MFA → evoluir → validar → imprimir → alta → folha de alta → auditoria).
