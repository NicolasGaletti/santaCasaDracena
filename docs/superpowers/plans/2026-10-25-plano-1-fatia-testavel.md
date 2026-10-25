# Plano 1 — Fatia testável (fundação → evolução médica → PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar no Netlify uma versão em que o médico faz login, admite paciente, vê a lista de internados, escreve a evolução médica com autosave, finaliza (trava no banco) e imprime o PDF A4.

**Architecture:** As regras ficam no Postgres (Supabase): RLS em todas as tabelas, mudanças de estado só por funções `security definer`, imutabilidade por trigger. O Next.js 16 lê com Server Components e muda com Server Actions que chamam essas funções (`supabase.rpc`). O cliente browser só é usado no autosave.

**Tech Stack:** Next.js 16.3 (App Router, `src/proxy.ts`), React 19.2, Tailwind 4, shadcn/ui, `@supabase/ssr`, Supabase CLI (`npx supabase`), pgTAP, Vitest, Playwright, zod, `@react-pdf/renderer`, `idb-keyval`, Netlify.

**Spec:** `docs/superpowers/specs/2026-10-25-prontuario-design.md`

**Próximos planos (fora deste):** Plano 2 anexos de exames (6.4.1) · Plano 3 multiprofissional + validação (fluxo AGUARDANDO_VALIDACAO, tela `/validacao`, adendo) · Plano 4 alta, auditoria completa, admin/convites, MFA, expiração de sessão, PWA, headers, backup R2, CI.

## Global Constraints

- App em `prontuario-medico/`; raiz git em `santaCasaDracena/`. Todos os comandos abaixo rodam em `prontuario-medico/`, salvo indicação.
- Next.js 16: Middleware se chama **Proxy** (`src/proxy.ts`); antes de usar API do Next, conferir `node_modules/next/dist/docs/`. `cookies()` é async.
- Supabase região `sa-east-1`; nenhum `grant` para `anon` em tabela de dados; `service_role` nunca no app nem no Netlify.
- RLS habilitado em **todas** as tabelas de `public`.
- Toda mudança de estado clínico só por função Postgres; o app nunca faz `insert/update` direto em `internacoes` ou `evolucoes`.
- Evolução `FINALIZADA` não aceita `UPDATE`/`DELETE` por nenhum papel.
- Identificação profissional sempre de `profissionais` (`conselho`, `numero_conselho`, `uf_conselho`); proibido valor padrão/fictício como `'CRM/SP 123456'`.
- `finalizada_em`/`criado_em` = `now()` do servidor.
- Idade calculada na leitura, fuso `America/Sao_Paulo`; `data_nascimento` é `date`.
- Interface em português (pt-BR), mobile-first, sem `alert()`.
- Nada de dependência exclusiva da Vercel. Deploy: Netlify Free.
- Dados de desenvolvimento e staging são fictícios.
- Branches: `develop` (desenvolvimento; todo commit deste plano vai aqui) → merge em `staging` (pré-produção: Netlify branch deploy + projeto Supabase `prontuario-staging`) → merge em `main` (produção: Netlify production + projeto Supabase de produção, criado só no go-live). Nunca commitar direto em `staging`/`main`.
- `EstadoForm = { erro?: string }` vive em `src/lib/forms.ts`, compartilhado por todas as Server Actions de formulário.

## Review Focus

1. **Duplo toque em "Finalizar" ou dois aparelhos com o mesmo rascunho:** a evolução finaliza uma vez; a segunda chamada recebe erro claro, sem duplicar. Teste: Task 3 `finalizar duas vezes falha`.
2. **Wi-Fi cai durante o autosave:** o texto fica no IndexedDB, é reenviado quando a rede volta e reaparece ao recarregar a página. Teste: Task 9 `fila de autosave reenvia após falha`.
3. **Médico sem CRM cadastrado tenta finalizar:** bloqueado com mensagem "Complete seu registro profissional". Teste: Task 3 `finalizar sem conselho falha`.
4. **Leito apagado ou digitado pela metade:** só salva ao sair do campo/confirmar; string vazia é rejeitada. Teste: Task 3 `trocar_leito vazio falha`.
5. **Aniversário hoje / data de nascimento futura / UTC às 22h:** a idade usa o dia de São Paulo; data futura é rejeitada na admissão. Teste: Task 6 `idade em fuso SP`, Task 3 `admitir com nascimento futuro falha`.

---

### Task 1: Fundação de ferramentas

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `vitest.config.ts`, `src/test/setup.ts`, `playwright.config.ts`, `.env.example`, `../.gitignore`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: scripts `npm run test` (Vitest), `npm run test:db` (`supabase test db`), `npm run test:e2e` (Playwright), `npm run db:types` (gera `src/lib/supabase/database.types.ts`), `npm run typecheck` (`tsc --noEmit`).

- [ ] **Step 1:** Criar `../.gitignore` (raiz do repo) com `passDB`, `.DS_Store`, `**/.env*`, `!**/.env.example`. Rodar `git -C .. status --short` e confirmar que `passDB` não aparece mais.
- [ ] **Step 2:** `npx supabase init` (aceitar defaults; sem VS Code settings). Em `supabase/config.toml`: `[auth] enable_signup = false`, `site_url = "http://localhost:3000"`.
- [ ] **Step 3:** Instalar: `npm i zod idb-keyval @react-pdf/renderer` e `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @playwright/test supabase`. `npx playwright install chromium`.
- [ ] **Step 4:** `vitest.config.ts` com `environment: 'jsdom'`, alias `@` → `src`, `include: ['src/**/*.test.ts?(x)']`. `playwright.config.ts` com `webServer: npm run dev`, `baseURL http://localhost:3000`, projetos `mobile` (devices['Pixel 7']) e `desktop`.
- [ ] **Step 5:** `.env.example` com `NEXT_PUBLIC_SUPABASE_URL=` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` (renomear a variável `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` para esse nome).
- [ ] **Step 6:** Verificar: `docker info` responde; `npx supabase start` sobe; `npm run test` sai 0 ("No test files found" aceito com `--passWithNoTests`); `npm run typecheck` sai 0.
- [ ] **Step 7:** Commit `chore: tooling de testes e supabase local`.

---

### Task 2: Schema base + RLS

**Files:**
- Create: `supabase/migrations/20261025000001_schema_base.sql`, `supabase/tests/001_schema_rls.test.sql`

**Interfaces:**
- Produces (SQL):
  - enums `perfil_profissional ('medico','residente','multiprofissional','recepcao','auditoria','admin')`, `categoria_evolucao ('medica','enfermagem','fisioterapia','nutricao','psicologia','fonoaudiologia','servico_social')`, `status_internacao ('INTERNADO','ALTA')`, `status_evolucao ('RASCUNHO','AGUARDANDO_VALIDACAO','FINALIZADA')`.
  - tabelas exatamente como na seção 6.2 do spec (`profissionais`, `equipes`, `membros_equipe`, `pacientes`, `internacoes`, `evolucoes`, `impressoes`, `acessos`, `auditoria`, `leitos_historico`). `anexos` fica para o Plano 2. `evolucoes.dados jsonb not null default '{}'`, `conteudo_hash text`, `assinatura_digital bytea`, `adendo_de uuid references evolucoes`.
  - índice único parcial `evolucoes_um_rascunho on evolucoes (autor_id, internacao_id) where status = 'RASCUNHO'`.
  - helpers `stable security definer` com `search_path = ''`: `app.perfil_atual() returns perfil_profissional`, `app.eh_clinico() returns boolean` (todos os perfis exceto `recepcao` e `admin`), `app.eh_medico() returns boolean`, `app.membro_equipe(p_equipe uuid) returns boolean`. Schema `app` sem `usage` para `anon`.
  - Políticas de SELECT para `authenticated`: `pacientes`, `internacoes`, `equipes`, `membros_equipe` → qualquer profissional ativo; `evolucoes` → `app.eh_clinico()` e (`status = 'FINALIZADA'` ou `autor_id = auth.uid()`); `profissionais` → próprio registro + nome/conselho de todos (via view `vw_profissionais_publico`). Nenhuma política de INSERT/UPDATE/DELETE em `internacoes`, `evolucoes`, `impressoes`, `acessos`, `auditoria`.
  - Trigger genérico `app.auditar()` (AFTER INSERT/UPDATE/DELETE) em `pacientes`, `internacoes`, `evolucoes`, `profissionais`, `membros_equipe`, gravando `antes`/`depois`/`auth.uid()`.

- [ ] **Step 1: Teste pgTAP que falha** (`001_schema_rls.test.sql`):
  - `todas as tabelas de public têm RLS`: `select is((select count(*) from pg_tables where schemaname='public' and not rowsecurity), 0::bigint)`.
  - `anon não lê pacientes`: `set role anon; select throws_ok('select * from pacientes', '42501')` (ou `is_empty`, conforme grant).
  - `recepcao não lê conteúdo de evolução`: autenticar como usuário `recepcao` (helper `tests.autenticar(uuid)` que faz `set local role authenticated` e `set local request.jwt.claims`) e `is_empty('select * from evolucoes')`.
  - `rascunho de outro autor invisível`: inserir 2 rascunhos de médicos diferentes como `postgres`, autenticar como o primeiro, `results_eq` retorna só o dele.
- [ ] **Step 2:** `npm run test:db` → FAIL (tabelas não existem).
- [ ] **Step 3:** Escrever a migration conforme o Interfaces acima; criar `supabase/tests/000_helpers.sql` com `tests.autenticar(p_user uuid)` e `tests.criar_profissional(p_perfil, p_conselho boolean default true) returns uuid` (insere em `auth.users` e `profissionais`).
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS.
- [ ] **Step 5:** `npm run db:types`; commit `feat(db): schema base com RLS e auditoria`.

---

### Task 3: Funções de transição (admissão, leito, rascunho, finalização, impressão, acesso)

**Files:**
- Create: `supabase/migrations/20261025000002_funcoes_fluxo.sql`, `supabase/tests/002_fluxo.test.sql`

**Interfaces:**
- Consumes: Task 2.
- Produces (todas `security definer`, `search_path = ''`, `grant execute to authenticated`; erros por `raise exception using errcode = 'P0001', message = '<texto pt-BR>'`):
  - `admitir_paciente(p_nome text, p_data_nascimento date, p_convenio text, p_equipe_id uuid, p_leito_ala text, p_diagnostico_inicial text, p_comorbidades text, p_muc text, p_medico_responsavel_id uuid) returns uuid` (id da internação). Perfis: `medico`, `recepcao`. Rejeita nascimento > hoje (SP) e campos obrigatórios vazios (nome, nascimento, convênio, equipe, leito).
  - `trocar_leito(p_internacao_id uuid, p_leito_ala text) returns void`. Perfis: `medico`, `recepcao`, membros da equipe. Rejeita `trim(p_leito_ala) = ''` e internação `ALTA`. Fecha a linha aberta de `leitos_historico` e abre outra.
  - `salvar_rascunho(p_internacao_id uuid, p_dados jsonb, p_texto_livre text) returns table(id uuid, atualizado_em timestamptz)`. Categoria derivada do perfil (`medico`/`residente` → `medica`; `multiprofissional` → `profissionais.categoria`). Upsert no rascunho único (autor, internação). Pode escrever: membro da equipe ou `medico`. Rejeita internação `ALTA`.
  - `descartar_rascunho(p_evolucao_id uuid) returns void` (só o autor, só `RASCUNHO`).
  - `finalizar_evolucao(p_evolucao_id uuid) returns timestamptz`. Só o autor com perfil `medico`, só a partir de `RASCUNHO`. Exige `conselho`, `numero_conselho`, `uf_conselho` não nulos (mensagem: `Complete seu registro profissional antes de finalizar.`). Grava `snapshot_autor = jsonb_build_object('nome','conselho','numero','uf')`, `snapshot_validador = snapshot_autor`, `validada_por = autor_id`, `validada_em = finalizada_em = now()`, `conteudo_hash = encode(extensions.digest(jsonb_build_object('dados',dados,'texto',texto_livre,'internacao',internacao_id,'autor',autor_id,'finalizada_em',now())::text,'sha256'),'hex')`.
  - `registrar_impressao(p_evolucao_id uuid) returns int` (número da via, 1..n). Só `FINALIZADA`.
  - `registrar_acesso(p_internacao_id uuid, p_acao text) returns void`.
  - Trigger `app.bloquear_finalizada()` BEFORE UPDATE OR DELETE em `evolucoes`: se `old.status = 'FINALIZADA'` → `raise exception 'Evolução finalizada não pode ser alterada.'`. Também bloqueia qualquer UPDATE/DELETE em evolução cuja internação está `ALTA` (o Plano 3 abre exceção para adendo).

- [ ] **Step 1: Testes pgTAP que falham** (`002_fluxo.test.sql`), um `subtest` por item:
  - `admitir cria paciente e internação INTERNADO`
  - `admitir com nascimento futuro falha` → `throws_ok(..., 'P0001')`
  - `multiprofissional não admite` → `throws_ok`
  - `trocar_leito vazio falha` / `trocar_leito grava histórico` (2 linhas em `leitos_historico`, a primeira com `ate` preenchido)
  - `salvar_rascunho duas vezes mantém uma linha` (count = 1, `dados` = último payload)
  - `finalizar sem conselho falha` (profissional criado com `p_conselho => false`)
  - `finalizar grava snapshot, hash e finalizada_em`
  - `finalizar duas vezes falha`
  - `UPDATE direto em finalizada falha, inclusive como postgres` → `throws_ok('update evolucoes set texto_livre = ''x'' where id = ...')`
  - `DELETE direto em finalizada falha`
  - `residente não finaliza` (no Plano 1 só médico finaliza; o envio para validação vem no Plano 3)
  - `registrar_impressao numera vias 1, 2` / `imprimir rascunho falha`
- [ ] **Step 2:** `npm run test:db` → FAIL.
- [ ] **Step 3:** Escrever a migration conforme Interfaces (habilitar `create extension if not exists pgcrypto with schema extensions`).
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS em 001 e 002.
- [ ] **Step 5:** `npm run db:types`; commit `feat(db): funções de admissão, rascunho, finalização e trava`.

---

### Task 4: Views de leitura + seed de desenvolvimento

**Files:**
- Create: `supabase/migrations/20261025000003_views.sql`, `supabase/seed.sql`, `supabase/tests/003_views.test.sql`

**Interfaces:**
- Produces:
  - `vw_internacoes_lista` (`security_invoker = true`): `internacao_id, paciente_id, nome, data_nascimento, convenio, leito_ala, equipe_id, equipe_nome, medico_responsavel_nome, status, admitido_em, alta_em, status_hoje` onde `status_hoje in ('FINALIZADA','RASCUNHO','NENHUMA')` = existe evolução `medica` finalizada hoje (dia SP) / rascunho meu / nenhuma.
  - `vw_evolucoes_timeline` (`security_invoker = true`): evolução + `autor_nome`, `snapshot_autor`, `vias_impressas int`.
  - Seed: equipes Cardiologia, Clínica Médica, Nefrologia, Cirurgia Geral; usuários `medico1@teste.local` (Cardiologia, CRM 145892/SP), `medico2@teste.local` (Nefrologia), `medico.semcrm@teste.local`, `recepcao@teste.local`, senha `Teste@123` (via `crypt(..., gen_salt('bf'))` em `auth.users` + `auth.identities`); 6 pacientes fictícios internados e 2 com `ALTA`; 3 evoluções finalizadas.

- [ ] **Step 1:** Teste `status_hoje reflete evolução finalizada hoje` e `vw respeita RLS (recepcao vê lista mas não timeline)`.
- [ ] **Step 2:** `npm run test:db` → FAIL.
- [ ] **Step 3:** Migration + seed.
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS; login de `medico1@teste.local` funciona no Studio local.
- [ ] **Step 5:** `npm run db:types`; commit `feat(db): views de lista e timeline, seed fictício`.

---

### Task 5: Clientes Supabase, Proxy e login

**Files:**
- Create: `src/lib/forms.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`, `src/lib/auth.ts`, `src/app/login/actions.ts`, `e2e/auth.spec.ts`
- Modify: `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/layout.tsx` (`lang="pt-BR"`, título "Prontuário Santa Casa")
- Delete: `src/lib/supabase.ts`

**Interfaces:**
- Produces:
  - `createClient(): Promise<SupabaseClient<Database>>` em `server.ts` (cookies async, `getAll/setAll`).
  - `createBrowserSupabase(): SupabaseClient<Database>` em `client.ts`.
  - `atualizarSessao(request: NextRequest): Promise<NextResponse>` em `lib/supabase/proxy.ts` (padrão `@supabase/ssr`: chama `supabase.auth.getClaims()`; sem usuário e rota ≠ `/login`, `/auth/*` → redirect `/login?next=<path>`).
  - `src/proxy.ts`: `export async function proxy(req)` → `atualizarSessao`; `matcher` exclui `_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, imagens.
  - `exigirProfissional(): Promise<Profissional>` em `lib/auth.ts` (lê `profissionais` do usuário; sem registro ou `ativo = false` → `redirect('/login?error=sem_cadastro')`). Tipo `Profissional = Database['public']['Tables']['profissionais']['Row']`.
  - Server Actions `entrar(prev: EstadoForm, form: FormData): Promise<EstadoForm>` e `sair(): Promise<void>`; `EstadoForm` importado de `src/lib/forms.ts`.
- Login: só e-mail/senha (botões SSO removidos; o callback fica para uso futuro). Mensagem de erro genérica: `E-mail ou senha inválidos.`

- [ ] **Step 1: E2E que falha** (`e2e/auth.spec.ts`): `visitante é redirecionado para /login`; `login inválido mostra erro`; `medico1 entra e vê "Internados"`; `sair volta para /login`.
- [ ] **Step 2:** `npm run test:e2e -- auth` → FAIL.
- [ ] **Step 3:** Implementar conforme Interfaces (login com `useActionState`).
- [ ] **Step 4:** `npm run test:e2e -- auth` → PASS; `npm run typecheck && npm run lint` → 0.
- [ ] **Step 5:** Commit `feat(auth): proxy de sessão e login por server action`.

---

### Task 6: Domínio — modelo da evolução médica e utilitários

**Files:**
- Create: `src/features/evolucao/modelos/medica.ts`, `src/features/evolucao/modelos/medica.test.ts`, `src/lib/datas.ts`, `src/lib/datas.test.ts`

**Interfaces:**
- Produces:
  - `modeloMedicaV1` (zod) e `type DadosMedica = z.infer<typeof modeloMedicaV1>`: `{ modelo_versao: 'medica@1', diagnosticos, comorbidades, muc, evolucao_clinica, ecg, exames_imagem, exames_laboratoriais, sinais: { pa, fc, fr, temp, sato2, dextro, diurese }, exame_fisico: { geral, ar, acv, abdome, membros, neuro }, conduta }`. Textos `string` (default `''`); sinais numéricos `number | null` com faixas: fc 0–300, fr 0–80, temp 25–45, sato2 0–100, dextro 0–1000, diurese 0–20000; `pa` regex `^\d{2,3}/\d{2,3}$` ou `''`.
  - `rascunhoMedicaVazio(): DadosMedica`: os textos padrão de exame físico do código atual (`page.tsx` linhas 47–52) como valores iniciais; sinais `null` (**não** pré-preencher valores como 120/80, porque sinal vital inventado vira registro falso).
  - `validarParaFinalizar(d: DadosMedica): string[]`: exige `evolucao_clinica` e `conduta` não vazios.
  - `idade(nascimento: string, agora?: Date): number` e `hojeSP(agora?: Date): string` (`YYYY-MM-DD` em `America/Sao_Paulo`, via `Intl.DateTimeFormat`); `formatarData(iso: string): string` (`dd/MM/yyyy`, `date-fns`).

- [ ] **Step 1:** Testes: `rascunho vazio passa no schema`; `fc 400 rejeitado`; `pa "12/8" rejeitada, "120/80" aceita`; `finalizar exige evolucao_clinica e conduta`; `idade em fuso SP` (`idade('2000-10-26', new Date('2026-10-26T01:30:00Z'))` → `25`, porque em SP ainda é 25/10); `aniversário hoje conta` (`idade('2000-10-25', new Date('2026-10-25T15:00:00Z'))` → `26`).
- [ ] **Step 2:** `npm run test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm run test` → PASS.
- [ ] **Step 5:** Commit `feat(evolucao): modelo médico v1 e utilitários de data`.

---

### Task 7: Shell do app, lista de internados e admissão

**Files:**
- Create: `components.json` + `src/components/ui/*` (shadcn: button, input, textarea, select, dialog, tabs, card, badge, sonner, label, accordion), `src/components/app-shell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/anteriores/page.tsx`, `src/features/internacoes/lista-internacoes.tsx`, `src/features/internacoes/cartao-internacao.tsx`, `src/features/internacoes/consultas.ts`, `src/app/(app)/internacoes/nova/page.tsx`, `src/features/internacoes/form-admissao.tsx`, `src/features/internacoes/actions.ts`, `e2e/admissao.spec.ts`
- Delete: `src/app/page.tsx` (o código antigo fica só no histórico do git)

**Interfaces:**
- Consumes: `createClient`, `exigirProfissional` (Task 5); `idade`, `formatarData` (Task 6); `vw_internacoes_lista`, `admitir_paciente` (Tasks 3–4).
- Produces:
  - `listarInternacoes(f: { status: 'INTERNADO' | 'ALTA'; equipeId?: string }): Promise<LinhaInternacao[]>` em `consultas.ts`; `LinhaInternacao = Database['public']['Views']['vw_internacoes_lista']['Row']`.
  - `listarEquipes(): Promise<{ id: string; nome: string }[]>`.
  - `admitir(prev: EstadoForm, form: FormData): Promise<EstadoForm>` → em sucesso `redirect('/internacoes/<id>')`; erro do banco vira `{ erro: message }`.
  - Filtro de equipe por search param `?equipe=<id>`.
- Shell: topo com nome do profissional, conselho, botão Sair; navegação Internados / Anteriores; botão "Admitir paciente" (perfis `medico`, `recepcao`). Cartão: nome, `D.N. dd/mm/aaaa (NN anos)`, leito, equipe, convênio, badge `status_hoje` (Evoluído hoje / Rascunho / Sem evolução). Paleta teal do protótipo. Mobile: cartões em coluna; ≥ `lg`: grade.

- [ ] **Step 1:** E2E `admissao.spec.ts` (projeto mobile): `medico1 admite paciente e cai no prontuário`; `admissão sem leito mostra erro e mantém campos`; `filtro Nefrologia esconde pacientes da Cardiologia`; `anteriores mostra só ALTA, sem botão de evoluir`.
- [ ] **Step 2:** `npm run test:e2e -- admissao` → FAIL.
- [ ] **Step 3:** `npx shadcn@latest init` (Tailwind 4, base slate) + componentes; implementar conforme Interfaces.
- [ ] **Step 4:** `npm run test:e2e -- admissao` → PASS; `npm run typecheck && npm run lint` → 0.
- [ ] **Step 5:** Commit `feat(internacoes): lista mobile-first e admissão`.

---

### Task 8: Deploy no Netlify (staging)

**Files:**
- Create: `netlify.toml` (na raiz do repo `santaCasaDracena/`), `docs/deploy.md`

**Interfaces:**
- Produces: URL pública de staging com login funcionando contra um projeto Supabase cloud de staging.

`netlify.toml`:
```toml
[build]
  base = "prontuario-medico"
  command = "npm run build"
  publish = ".next"
```

- [ ] **Step 0:** no Netlify, *Production branch* = `main`; *Branch deploys* = `staging` (cada um com suas env vars, via *deploy contexts*). Até existir produção, só o deploy de `staging` é usado.
- [ ] **Step 1 (usuário):** criar projeto Supabase `prontuario-staging`, região South America (São Paulo), plano Free. Em Auth: desligar "Allow new users to sign up"; Site URL = URL do Netlify.
- [ ] **Step 2:** `npx supabase link --project-ref <ref>` e `npx supabase db push`. Rodar o seed só em staging: `psql "<connection string>" -f supabase/seed.sql` (dados fictícios).
- [ ] **Step 3 (usuário):** subir o repo no GitHub (privado), criar o site no Netlify a partir dele e configurar as env vars `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Não** cadastrar service key.
- [ ] **Step 4:** Verificar: o build no Netlify fica verde; na URL de staging, pelo celular, `medico1@teste.local` entra, vê a lista e admite um paciente.
- [ ] **Step 5:** `docs/deploy.md` com esses passos; commit `chore(deploy): netlify staging`.

---

### Task 9: Prontuário da internação e evolução médica com autosave

**Files:**
- Create: `src/app/(app)/internacoes/[id]/page.tsx`, `src/features/internacoes/cabecalho-paciente.tsx`, `src/features/internacoes/campo-leito.tsx`, `src/features/evolucao/timeline.tsx`, `src/features/evolucao/cartao-evolucao.tsx`, `src/app/(app)/internacoes/[id]/evolucao/page.tsx`, `src/features/evolucao/form-medica.tsx`, `src/features/evolucao/autosave.ts`, `src/features/evolucao/autosave.test.ts`, `src/features/evolucao/actions.ts`, `e2e/evolucao.spec.ts`

**Interfaces:**
- Consumes: Tasks 3–7.
- Produces:
  - Server Actions em `features/evolucao/actions.ts`: `finalizar(evolucaoId: string): Promise<{ erro?: string }>` (em sucesso, `revalidatePath` + `redirect('/internacoes/<id>')`); `descartar(evolucaoId: string): Promise<void>`; `trocarLeito(internacaoId: string, leito: string): Promise<{ erro?: string }>`.
  - `criarFilaAutosave(opts: { salvar: (p: PayloadRascunho) => Promise<{ id: string; atualizado_em: string }>; armazenamento: Armazenamento; chave: string; esperaMs?: number /* 3000 */ }): FilaAutosave` em `autosave.ts`, com `agendar(p: PayloadRascunho): void`, `forcar(): Promise<void>`, `estado: 'salvo' | 'pendente' | 'offline'`, `assinar(cb): () => void`. `Armazenamento` = `{ get, set, del }` (`idb-keyval` em produção, Map em teste). `PayloadRascunho = { internacaoId: string; dados: DadosMedica; textoLivre: string }`. O salvar chama `rpc('salvar_rascunho')` pelo cliente browser.
  - Regras: grava no armazenamento local antes de chamar `salvar`; apaga só após sucesso; em falha mantém, marca `offline` e tenta de novo no evento `online` ou no próximo `agendar`; ao abrir o form, se houver cópia local mais nova que `atualizado_em` do servidor, usa a local.
- Página do prontuário: chama `registrar_acesso(id, 'abrir_prontuario')`; cabeçalho (nome, D.N./idade, convênio, equipe, médico responsável); `campo-leito` salva no blur/Enter, nunca por tecla; timeline com filtro Todas | ECG | Imagem | Laboratório (o filtro mostra a seção correspondente de `dados`); botão "Nova evolução" / "Continuar rascunho" só se `INTERNADO`.
- Form: seções em `accordion` (Diagnósticos, Evolução, Exames, Sinais vitais, Exame físico, Conduta); `inputMode="decimal"` nos sinais; barra fixa no rodapé com indicador "Salvo às hh:mm / Sem conexão" e botões "Copiar anterior" (última finalizada `medica` da internação, preenche tudo menos sinais vitais) e "Finalizar". Finalizar: confirmação "Depois de finalizada a evolução não pode ser alterada" → `forcar()` → `finalizar`. Botão desabilitado enquanto envia (duplo toque).

- [ ] **Step 1: Testes Vitest que falham** (`autosave.test.ts`, timers falsos): `agrupa digitação em uma chamada após 3s`; `fila de autosave reenvia após falha` (1ª chamada rejeita → estado `offline`, cópia local presente; evento `online` → 2ª chamada, cópia apagada, estado `salvo`); `cópia local mais nova vence a do servidor`.
- [ ] **Step 2: E2E que falha** (`evolucao.spec.ts`, mobile): `médico escreve, recarrega e o texto continua`; `copiar anterior preenche conduta`; `finalizar trava: sem botão de editar e badge Finalizada`; `médico sem CRM vê "Complete seu registro profissional"`; `leito muda só ao sair do campo`; `offline: context.setOffline(true) mostra "Sem conexão", volta online e salva`.
- [ ] **Step 3:** `npm run test && npm run test:e2e -- evolucao` → FAIL.
- [ ] **Step 4:** Implementar conforme Interfaces.
- [ ] **Step 5:** `npm run test && npm run test:e2e -- evolucao` → PASS; typecheck/lint 0.
- [ ] **Step 6:** Commit `feat(evolucao): prontuário, formulário médico e autosave resiliente`.

---

### Task 10: PDF A4 e tela de impressão

**Files:**
- Create: `src/app/evolucoes/[id]/pdf/route.ts`, `src/app/evolucoes/lote/pdf/route.ts`, `src/features/impressao/documento-evolucao.tsx`, `src/features/impressao/documento-evolucao.test.tsx`, `src/app/(app)/imprimir/page.tsx`, `public/logo-santa-casa.png` (placeholder até o hospital enviar), `e2e/impressao.spec.ts`
- Modify: `src/features/evolucao/cartao-evolucao.tsx` (botão "Imprimir"), `next.config.ts` (`serverExternalPackages: ['@react-pdf/renderer']` se o build exigir)

**Interfaces:**
- Consumes: `registrar_impressao`, `vw_evolucoes_timeline`, `idade`, `formatarData`.
- Produces:
  - `GET /evolucoes/[id]/pdf` (`export const runtime = 'nodejs'`): autentica pelo cookie; evolução não encontrada ou não `FINALIZADA` → 404; chama `registrar_impressao` → `via`; responde `application/pdf`, `Content-Disposition: inline; filename="evolucao-<codigo>.pdf"`, `Cache-Control: no-store`. `GET /evolucoes/lote/pdf?ids=a,b,c` aplica as mesmas regras a cada id e gera um PDF só (para `/imprimir`); a lógica comum fica em `features/impressao/gerar-pdf.ts`: `gerarPdf(ids: string[]): Promise<Response>`.
  - `DocumentoEvolucao({ evolucoes: EvolucaoImpressao[] })` com `EvolucaoImpressao = { evolucao, internacao, paciente, via }`.
  - `codigoCurto(id: string): string` = 8 primeiros caracteres do uuid, em maiúsculas.
- Conteúdo (spec 6.4): cabeçalho "Santa Casa de Dracena", título "EVOLUÇÃO MÉDICA DIÁRIA"; paciente (nome, D.N., idade, leito, convênio); equipe e médico responsável; data/hora de `finalizada_em` em SP; seções com conteúdo (seções vazias omitidas); sinais vitais em tabela; "Validado por Dr(a). <nome> – <conselho> <numero>/<uf> em dd/mm/aaaa hh:mm"; um campo "Assinatura e carimbo do médico"; rodapé `Código <codigoCurto> · Hash <12 primeiros do hash> · Página x de y`; marca "2ª via" etc. quando `via > 1`.
- `/imprimir`: finalizadas sem impressão, filtros equipe / médico validador / dia (padrão: hoje e eu como validador), checkbox por linha e "Imprimir selecionadas" abrindo `/evolucoes/lote/pdf?ids=...` em nova aba.

- [ ] **Step 1:** Vitest `documento-evolucao.test.tsx`: renderiza com `renderToString` de `@react-pdf/renderer` sem erro; `omite seção vazia` (testar a função pura `secoesVisiveis(dados): {titulo, texto}[]`); `codigoCurto`.
- [ ] **Step 2:** E2E `impressao.spec.ts`: `PDF de finalizada responde 200 application/pdf`; `PDF de rascunho responde 404`; `segunda impressão marca via 2` (consultar `impressoes` via API REST com o token do teste ou conferir o texto extraído do PDF com `pdf-parse` em devDependency).
- [ ] **Step 3:** `npm run test && npm run test:e2e -- impressao` → FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** PASS nos dois; abrir um PDF real e conferir o A4 visualmente; imprimir uma vez pelo celular em staging.
- [ ] **Step 6:** Commit `feat(impressao): PDF A4 da evolução e fila de impressão`.

---

### Task 11: Fechamento da fatia

**Files:**
- Modify: `README.md` (raiz e `prontuario-medico/`): como rodar local, testes, deploy, usuários de teste.

- [ ] **Step 1:** Rodar tudo: `npx supabase db reset && npm run test:db && npm run test && npm run typecheck && npm run lint && npm run build && npm run test:e2e` → tudo 0.
- [ ] **Step 2:** merge `develop` → `staging`; `npx supabase db push` no projeto de staging; deploy no Netlify verde; roteiro manual no celular: login → admitir → evoluir → derrubar o Wi-Fi no meio → voltar → finalizar → imprimir → reimprimir (2ª via).
- [ ] **Step 3:** Commit `docs: guia de execução e teste da fatia 1`.
