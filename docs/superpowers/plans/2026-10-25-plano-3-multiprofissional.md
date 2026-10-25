# Plano 3 — Multiprofissional, validação médica e adendo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enfermagem, fisioterapia, nutrição etc., residentes e internos (acadêmicos, sem CRM) registram evoluções que só viram documento depois que um médico da equipe valida; correções de evoluções finalizadas por adendo, inclusive após a alta.

**Architecture:** Novas funções de transição no Postgres (`enviar_evolucao`, `validar_evolucao`, `devolver_evolucao`, `criar_adendo`) sobre um núcleo único de finalização (`app.finalizar_core`) reutilizado por `finalizar_evolucao`. Novo perfil `academico`. Modelo de dados `simples@1` para as categorias não médicas. Tela `/validacao` para médicos. PDF ajusta título, autor e validador por categoria e adendo.

**Tech Stack:** igual aos Planos 1–2.

**Spec:** `docs/superpowers/specs/2026-10-25-prontuario-design.md` (6.1, 6.3, decisões 2–4, 9, 13)

## Global Constraints

- Todos os dos Planos 1, 1b e 2. Migrations já existentes imutáveis. Novas: `20261025000009_perfil_academico.sql` (só `alter type perfil_profissional add value 'academico'` — precisa ficar sozinha, pois `ADD VALUE` não pode ser usado na mesma transação), `20261025000010_validacao.sql`, `20261025000011_adendo.sql`.
- Fluxo (spec 6.3): `RASCUNHO --enviar--> AGUARDANDO_VALIDACAO --validar--> FINALIZADA`; `AGUARDANDO_VALIDACAO --devolver(motivo)--> RASCUNHO`; autor `medico` finaliza direto.
- Quem envia para validação: `residente`, `academico`, `multiprofissional` (só o autor, só de `RASCUNHO`).
- Quem valida/devolve: perfil `medico`, ativo, **membro da equipe da internação**, diferente do autor. O validador não edita o texto.
- Campos obrigatórios para enviar/finalizar: `medica@1` → `evolucao_clinica` e `conduta`; `simples@1` → `texto` e `plano`. Mensagens: `Preencha a evolução clínica e a conduta antes de finalizar.` / `Preencha a evolução e o plano antes de enviar.`
- Conselho: exigido para finalizar (médico) e para validar (validador). **Não** exigido para enviar quando o perfil é `academico`; exigido para `residente` (CRM) e `multiprofissional` (seu conselho).
- `academico` escreve com o modelo médico (`categoria = 'medica'`).
- Motivo da devolução obrigatório (1–500 caracteres), mostrado ao autor no rascunho devolvido; ao reenviar, o motivo anterior é limpo.
- Adendo: nova evolução com `adendo_de = <id da finalizada>`, mesma internação, mesmo fluxo (médico finaliza; demais enviam para validação). Pode ser criado pelo autor da original ou por médico da equipe; permitido também em internação `ALTA` (única exceção à trava de alta). A evolução original nunca muda.
- Impresso: um único campo de assinatura, do médico (validador, ou autor quando médico) — decisão 9 do spec. Linha "Registrado por: <nome> – <conselho> <nº>/<UF>" para autor não médico; para `academico` sem conselho: "Registrado por: <nome> – Acadêmico(a) de Medicina".
- Títulos do PDF por categoria: `EVOLUÇÃO MÉDICA DIÁRIA`, `EVOLUÇÃO DE ENFERMAGEM`, `EVOLUÇÃO DE FISIOTERAPIA`, `EVOLUÇÃO DE NUTRIÇÃO`, `EVOLUÇÃO DE PSICOLOGIA`, `EVOLUÇÃO DE FONOAUDIOLOGIA`, `EVOLUÇÃO DO SERVIÇO SOCIAL`; adendo: `ADENDO À EVOLUÇÃO DE dd/mm/aaaa hh:mm (CÓDIGO <codigoCurto da original>)`.

## Review Focus

1. **Médico de outra equipe tenta validar (plantonista de outra especialidade):** negado com `Apenas médicos da equipe podem validar.` Teste: Task 1 `médico de outra equipe não valida`.
2. **Autor médico tenta "validar" a própria evolução de residente que ele mesmo escreveu como residente?** (perfil muda depois) — validador ≠ autor sempre. Teste: Task 1 `autor não valida a própria evolução`.
3. **Duas pessoas validam/devolvem ao mesmo tempo:** lock de linha; a segunda recebe erro de estado. Teste: Task 1 `validar evolução já finalizada falha`.
4. **Acadêmico sem conselho imprime?** Não: só a versão validada imprime, com assinatura do médico. Teste: Task 7 `PDF de evolução de acadêmico mostra Acadêmico(a) e validador`.
5. **Adendo em internação com alta, por quem não pode:** recepção/outro profissional fora da regra → negado. Teste: Task 2 `adendo após alta permitido ao autor e negado a terceiros`.

---

### Task 1: Perfil acadêmico e funções de validação

**Files:**
- Create: `prontuario-medico/supabase/migrations/20261025000009_perfil_academico.sql`, `prontuario-medico/supabase/migrations/20261025000010_validacao.sql`, `prontuario-medico/supabase/tests/010_validacao.test.sql`
- Modify: `prontuario-medico/supabase/tests/000_helpers.sql` (nada a mudar se `tests.criar_profissional` já aceita qualquer perfil; conferir)

**Interfaces:**
- Produces (todas `security definer`, `search_path = ''`, revoke `public, anon`, grant `authenticated`, P0001 pt-BR):
  - `app.finalizar_core(p_evolucao_id uuid, p_validador uuid) returns timestamptz` (não exposta: revoke de `authenticated`) — o miolo atual de `finalizar_evolucao` (limpeza de anexos não confirmados, `hash_versao = 2`, snapshots, `finalizada_em = validada_em = v_agora`), agora com `snapshot_autor` do autor e `snapshot_validador` do validador.
  - `finalizar_evolucao(p_evolucao_id)` reescrita para chamar o core (mesmas checagens de hoje).
  - `enviar_evolucao(p_evolucao_id uuid) returns void` — autor, perfil em (`residente`,`academico`,`multiprofissional`), `RASCUNHO`, campos obrigatórios por `dados->>'modelo_versao'`, conselho conforme Global Constraints; seta `status = 'AGUARDANDO_VALIDACAO'`, `enviada_em = now()`, `devolvida_motivo = null`.
  - `validar_evolucao(p_evolucao_id uuid) returns timestamptz` — médico ativo com conselho, membro da equipe, ≠ autor, status `AGUARDANDO_VALIDACAO` (lock); chama `app.finalizar_core(id, auth.uid())`.
  - `devolver_evolucao(p_evolucao_id uuid, p_motivo text) returns void` — mesma regra de quem valida; motivo 1–500; volta a `RASCUNHO`, grava `devolvida_motivo`.
  - `salvar_rascunho`: `academico` → categoria `medica`; continua só para `RASCUNHO`.
  - Ajustar o trigger `app.bloquear_finalizada` se necessário para permitir as transições feitas pelas funções (status `AGUARDANDO_VALIDACAO` não é finalizado — conferir) e impedir `salvar_rascunho` de tocar em `AGUARDANDO_VALIDACAO`.

- [ ] **Step 1: pgTAP que falha:** `residente envia para validação`; `acadêmico sem conselho envia`; `residente sem conselho não envia`; `enviar sem campos obrigatórios falha` (medica e simples); `médico da equipe valida e grava snapshots autor/validador`; `médico de outra equipe não valida`; `autor não valida a própria evolução`; `validar evolução já finalizada falha`; `devolver exige motivo`; `devolver volta a rascunho com motivo e reenviar limpa motivo`; `autor não edita enquanto aguarda validação`; `finalizar_evolucao continua funcionando para médico` (regressão).
- [ ] **Step 2:** FAIL. **Step 3:** migrations. **Step 4:** `npx supabase db reset && npm run test:db` → PASS; `npm run db:types`.
- [ ] **Step 5:** commit `feat(db): validação médica e perfil acadêmico`.

---

### Task 2: Adendo

**Files:**
- Create: `prontuario-medico/supabase/migrations/20261025000011_adendo.sql`, `prontuario-medico/supabase/tests/011_adendo.test.sql`

**Interfaces:**
- Produces:
  - `criar_adendo(p_evolucao_id uuid) returns uuid` — original `FINALIZADA`; chamador = autor da original **ou** médico membro da equipe; cria `RASCUNHO` com `adendo_de`, `categoria` do chamador, `dados` vazio do modelo (`medica@1` ou `simples@1`); permitido com internação `ALTA`. Se o chamador já tem rascunho aberto nessa internação → `Você já tem um rascunho aberto nesta internação.`
  - `salvar_rascunho`/`enviar_evolucao`/`validar_evolucao`/`finalizar_evolucao`/anexos: aceitar internação `ALTA` **somente** quando a evolução é adendo (`adendo_de is not null`); trigger `app.bloquear_finalizada` com a mesma exceção (spec 6.3).
  - `vw_evolucoes_timeline`: recriar incluindo `adendo_de` (se ainda não exposto via `ev.*`, recriar a view mantendo grants e `security_invoker`).

- [ ] **Step 1: pgTAP que falha:** `autor cria adendo de evolução finalizada`; `adendo de rascunho falha`; `adendo após alta permitido ao autor e negado a terceiros`; `evolução original não muda após adendo finalizado`; `rascunho comum em internação com alta continua bloqueado`.
- [ ] **Step 2:** FAIL. **Step 3:** migration. **Step 4:** PASS; `npm run db:types`.
- [ ] **Step 5:** commit `feat(db): adendo de evolução finalizada`.

---

### Task 3: Modelo simples e formulário multiprofissional

**Files:**
- Create: `prontuario-medico/src/features/evolucao/modelos/simples.ts`, `prontuario-medico/src/features/evolucao/modelos/simples.test.ts`, `prontuario-medico/src/features/evolucao/form-simples.tsx`
- Modify: `prontuario-medico/src/app/(app)/internacoes/[id]/evolucao/page.tsx` (escolhe o formulário pela categoria do profissional), `prontuario-medico/src/features/evolucao/rotulos.ts`

**Interfaces:**
- Produces:
  - `modeloSimplesV1` (zod): `{ modelo_versao: 'simples@1', texto: string, sinais: <mesmo objeto de sinais do médico, todos opcionais>, plano: string }`; `type DadosSimples`; `rascunhoSimplesVazio()`; `validarParaEnviarSimples(d): string[]` (texto e plano).
  - `FormSimples` reutiliza `criarFilaAutosave`, o rodapé (status, Salvar, ação principal) e os campos de sinais do formulário médico — extrair os componentes compartilhados (`rodape-evolucao.tsx`, `campos-sinais.tsx`) em vez de duplicar.
  - Seleção: `medico`/`residente`/`academico` → formulário médico; `multiprofissional` → simples, título "Evolução de <categoria>".

- [ ] **Step 1:** Vitest que falha (schema/validação simples); E2E `enfermeira abre formulário simples` (seed `enfermeira@teste.local`, Cardiologia, COREN).
- [ ] **Step 2:** FAIL. **Step 3:** implementar (usar `.claude/skills/frontend-design/SKILL.md` e tokens). **Step 4:** testes + typecheck + lint → PASS; screenshot `.superpowers/sdd/2026-10-25-plano-3-multiprofissional/task-3-form-simples.png`.
- [ ] **Step 5:** commit `feat(evolucao): formulário multiprofissional`.

---

### Task 4: Envio para validação (lado do autor)

**Files:**
- Modify: `prontuario-medico/src/features/evolucao/form-medica.tsx`, `prontuario-medico/src/features/evolucao/form-simples.tsx` (ou o rodapé compartilhado), `prontuario-medico/src/features/evolucao/actions.ts`, `prontuario-medico/src/features/evolucao/cartao-evolucao.tsx`, `prontuario-medico/src/features/evolucao/timeline.tsx`, `prontuario-medico/e2e/validacao.spec.ts`

**Interfaces:**
- Produces:
  - Server action `enviarParaValidacao(evolucaoId: string): Promise<{ erro?: string }>` (antes: `forcar()` no cliente, igual ao finalizar; try/finally; P0001 → mensagem).
  - Ação principal do rodapé por perfil: médico → `Finalizar`; residente/acadêmico/multiprofissional → `Enviar para validação` (confirmação: `Depois de enviada, a evolução só pode ser alterada se o médico devolver.`). Remove o aviso provisório do Plano 1 para residentes.
  - Rascunho devolvido: faixa no topo do formulário `Devolvida por <médico>: <motivo>`.
  - Cartão/timeline: badge `Aguardando validação` (visível ao autor e aos médicos da equipe, conforme RLS).

- [ ] **Step 1:** E2E que falha: `acadêmico envia e vê Aguardando validação`; `após enviar não há formulário editável`; `devolvida mostra motivo no rascunho`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (+ typecheck/lint).
- [ ] **Step 5:** commit `feat(evolucao): envio para validação médica`.

---

### Task 5: Tela de validação do médico

**Files:**
- Create: `prontuario-medico/src/app/(app)/validacao/page.tsx`, `prontuario-medico/src/features/validacao/lista-pendentes.tsx`, `prontuario-medico/src/features/validacao/revisao-evolucao.tsx`, `prontuario-medico/src/features/validacao/actions.ts`, `prontuario-medico/src/features/validacao/consultas.ts`
- Modify: `prontuario-medico/src/components/app-shell.tsx` (aba "Validar" com contador para médicos), `prontuario-medico/e2e/validacao.spec.ts`

**Interfaces:**
- Produces:
  - `listarPendentes(): Promise<PendenteValidacao[]>` — evoluções `AGUARDANDO_VALIDACAO` das equipes do médico (RLS já restringe), mais antigas primeiro; `PendenteValidacao = { id, internacaoId, pacienteNome, leito, equipeNome, categoria, autorNome, enviadaEm, adendoDe }`.
  - `contarPendentes(): Promise<number>` (no layout para o contador).
  - Server actions `validar(id): Promise<{ erro?: string }>` e `devolver(id, motivo): Promise<{ erro?: string }>` (P0001 → mensagem; sucesso → `revalidatePath('/validacao')`).
  - Tela: lista de cartões (paciente, leito, categoria, autor, há quanto tempo); abrir → leitura completa (mesmo render do cartão da timeline, incluindo anexos) com `Validar` (confirmação `Ao validar, a evolução é finalizada e não pode mais ser alterada.`) e `Devolver` (dialog com motivo obrigatório). Estado vazio: `Nenhuma evolução aguardando validação.`

- [ ] **Step 1:** E2E que falha: `médico da equipe vê pendente e valida`; `médico de outra equipe não vê pendente`; `devolver exige motivo e volta ao autor`; `contador some após validar`.
- [ ] **Step 2–4:** FAIL → implementar → PASS; screenshot `.superpowers/sdd/2026-10-25-plano-3-multiprofissional/task-5-validacao.png`.
- [ ] **Step 5:** commit `feat(validacao): tela de validação do médico`.

---

### Task 6: Adendo na interface

**Files:**
- Modify: `prontuario-medico/src/features/evolucao/cartao-evolucao.tsx`, `prontuario-medico/src/features/evolucao/actions.ts`, `prontuario-medico/src/app/(app)/internacoes/[id]/page.tsx`, `prontuario-medico/src/app/(app)/internacoes/[id]/evolucao/page.tsx`, `prontuario-medico/e2e/adendo.spec.ts`

**Interfaces:**
- Produces:
  - Server action `criarAdendo(evolucaoId: string)` → `rpc('criar_adendo')` → `redirect('/internacoes/<id>/evolucao')`.
  - Cartão de evolução finalizada: botão `Adendo` para quem pode (autor da original ou médico da equipe — calcular no servidor com o perfil e `membros_equipe`). Também em `/anteriores` (internação com alta).
  - Formulário de adendo: título `Adendo à evolução de dd/mm hh:mm`, com a original exibida (somente leitura, recolhível) acima.
  - Timeline: adendo aparece logo abaixo da original, recuado, com rótulo `Adendo`.

- [ ] **Step 1:** E2E que falha: `médico cria adendo e finaliza`; `adendo em internação com alta`; `recepção não vê botão Adendo`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** commit `feat(evolucao): adendo na interface`.

---

### Task 7: PDF por categoria, autor e adendo

**Files:**
- Modify: `prontuario-medico/src/features/impressao/documento-evolucao.tsx`, `prontuario-medico/src/features/impressao/gerar-pdf.ts`, `prontuario-medico/src/features/impressao/documento-evolucao.test.tsx`, `prontuario-medico/e2e/impressao.spec.ts`

**Interfaces:**
- Produces: título por categoria/adendo (Global Constraints); corpo do `simples@1` (Evolução, Sinais vitais, Plano); linha "Registrado por" quando autor ≠ validador; "Validado por" sempre do `snapshot_validador`; assinatura única do médico.

- [ ] **Step 1:** Testes que falham: Vitest `título de enfermagem`, `título de adendo com código da original`, `linha Registrado por para acadêmico`; E2E `PDF de evolução de acadêmico mostra Acadêmico(a) e validador`.
- [ ] **Step 2–4:** FAIL → implementar → PASS (+ build); exemplo em `.superpowers/sdd/2026-10-25-plano-3-multiprofissional/task-7-exemplo.pdf`.
- [ ] **Step 5:** commit `feat(impressao): PDF multiprofissional e adendo`.

---

### Task 8: Seed, documentação e staging

**Files:**
- Modify: `prontuario-medico/supabase/seed.sql` (adicionar `academico@teste.local` — Cardiologia, sem conselho; `enfermeira@teste.local` — Cardiologia, COREN; senha local `Teste@123`), `docs/deploy.md`, `prontuario-medico/README.md`

- [ ] **Step 1:** seed + docs (perfis novos e fluxo de validação).
- [ ] **Step 2:** suíte completa (`db reset`, `test:db`, `test`, `typecheck`, `lint`, `build`, `test:e2e`) → tudo 0.
- [ ] **Step 3:** commit `docs: perfis multiprofissionais e validação`.
- [ ] **Step 4 (controller + usuário):** `npx supabase db push` (0009–0011) pelo usuário; merge `develop` → `staging` + push pelo controller; smoke no staging.
