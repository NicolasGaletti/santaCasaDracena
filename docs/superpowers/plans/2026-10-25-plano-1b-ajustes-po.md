# Plano 1b — Ajustes pedidos pelo PO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar "médico responsável" por "equipe responsável", adicionar filtro por convênio na lista e um botão "Salvar" explícito no formulário de evolução.

**Architecture:** Uma migration nova relaxa `internacoes.medico_responsavel_id` e troca a assinatura de `admitir_paciente`; o resto é interface e PDF. A view `vw_internacoes_lista` não muda (a coluna `medico_responsavel_nome` fica nula para novas internações e deixa de ser exibida).

**Tech Stack:** igual ao Plano 1.

**Spec:** `docs/superpowers/specs/2026-10-25-prontuario-design.md` (decisão 13, seção 5)

## Global Constraints

- Todos os do Plano 1. Migrations 0001–0005 imutáveis; nova: `20261025000006_equipe_responsavel.sql`.
- Texto exibido: **"Equipe responsável"** (cabeçalho do prontuário, PDF, formulário de admissão).
- Filtro de convênio: search param `?convenio=<texto exato>`, combinável com `?equipe=`; opções = convênios distintos das internações da aba atual, ordem alfabética pt-BR; "Todos os convênios" limpa.
- Botão "Salvar": força o envio do rascunho agora (`fila.forcar()`), mostra "Salvo às hh:mm"; não finaliza. "Finalizar" continua sendo o "salvar e fechar".

## Review Focus

1. **Internação antiga com médico responsável preenchido:** continua abrindo e imprimindo normalmente, sem mostrar o médico. Teste: Task 2 `seed antigo abre sem médico responsável`.
2. **Convênio com acento/espaço na URL ("Bradesco Saúde"):** filtro funciona e o chip fica ativo. Teste: Task 2 `filtro por convênio com acento`.
3. **Salvar sem conexão:** mostra a mensagem de sem conexão e mantém a cópia local. Teste: Task 3 `salvar offline mostra sem conexão`.

---

### Task 1: Equipe responsável no banco

**Files:**
- Create: `prontuario-medico/supabase/migrations/20261025000006_equipe_responsavel.sql`, `prontuario-medico/supabase/tests/006_equipe_responsavel.test.sql`
- Modify: testes pgTAP existentes que chamam `admitir_paciente` com 9 argumentos (`002_fluxo`, `003_views`, `004_impressoes`, `005_endurecimento`), `prontuario-medico/supabase/seed.sql` só se usar a função

**Interfaces:**
- Produces:
  - `alter table internacoes alter column medico_responsavel_id drop not null;`
  - Correção herdada do Plano 1 (revisão final): `alter default privileges for role postgres revoke execute on functions from public;` (sem `IN SCHEMA`; o `IN SCHEMA` da 0005 não remove o padrão global). pgTAP: criar função de teste dentro do teste e afirmar `not has_function_privilege('anon', 'public.<fn>()', 'execute')`; substituir o teste vácuo de `005_endurecimento.test.sql` (~l.125) por essa checagem.
  - `drop function admitir_paciente(text, date, text, uuid, text, text, text, text, uuid);` e `create function admitir_paciente(p_nome text, p_data_nascimento date, p_convenio text, p_equipe_id uuid, p_leito_ala text, p_diagnostico_inicial text, p_comorbidades text, p_muc text) returns uuid` — mesmas regras da versão atual (perfis `medico`/`recepcao`, validações, `internacoes_clinico`, `leitos_historico`), sem médico responsável; `security definer`, `search_path = ''`, revoke `public, anon`, grant `authenticated`.

- [ ] **Step 1:** pgTAP que falha: `admitir sem médico responsável cria internação com equipe`; `assinatura antiga não existe mais` (`hasnt_function('public','admitir_paciente', array['text','date','text','uuid','text','text','text','text','uuid'])`).
- [ ] **Step 2:** `npm run test:db` → FAIL.
- [ ] **Step 3:** migration + atualizar chamadas nos testes existentes.
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS; `npm run db:types`.
- [ ] **Step 5:** commit `feat(db): internação com equipe responsável, sem médico obrigatório`.

---

### Task 2: Interface — equipe responsável e filtro de convênio

**Files:**
- Modify: `prontuario-medico/src/features/internacoes/form-admissao.tsx`, `prontuario-medico/src/features/internacoes/actions.ts`, `prontuario-medico/src/features/internacoes/consultas.ts` (remover `listarMedicos` se ficar sem uso; adicionar filtro), `prontuario-medico/src/features/internacoes/lista-internacoes.tsx`, `prontuario-medico/src/features/internacoes/cabecalho-paciente.tsx`, `prontuario-medico/src/features/impressao/documento-evolucao.tsx`, `prontuario-medico/src/features/impressao/gerar-pdf.ts`, `prontuario-medico/src/app/(app)/page.tsx`, `prontuario-medico/src/app/(app)/anteriores/page.tsx`, `prontuario-medico/e2e/admissao.spec.ts`, `prontuario-medico/e2e/impressao.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `listarInternacoes(f: { status: 'INTERNADO' | 'ALTA'; equipeId?: string; convenio?: string })`.
  - `listarConvenios(status: 'INTERNADO' | 'ALTA'): Promise<string[]>`.
  - Formulário de admissão sem o campo médico; label do select de equipe = "Equipe responsável".
  - Cabeçalho do prontuário e PDF: linha "Equipe responsável" (sem "Médico responsável").
  - Lista: segunda linha de chips (rolagem horizontal) com os convênios, abaixo dos chips de equipe; contagem reflete os dois filtros.

- [ ] **Step 1:** E2E que falha: `admissão não pede médico responsável`; `cabeçalho mostra Equipe responsável`; `filtro por convênio com acento` (Bradesco Saúde do seed); `equipe + convênio combinados`; `seed antigo abre sem médico responsável`; PDF contém "Equipe responsável" e não contém "Médico responsável".
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar (reusar tokens/estilos existentes; ver `.claude/skills/frontend-design/SKILL.md`).
- [ ] **Step 4:** `npm run test && npm run test:e2e && npm run typecheck && npm run lint && npm run build` → PASS; screenshot mobile da lista com os dois filtros em `.superpowers/sdd/2026-10-25-plano-1b-ajustes-po/task-2-lista.png`.
- [ ] **Step 5:** commit `feat(internacoes): equipe responsável e filtro por convênio`.

---

### Task 3: Botão "Salvar" no formulário

**Files:**
- Modify: `prontuario-medico/src/features/evolucao/form-medica.tsx`, `prontuario-medico/e2e/evolucao.spec.ts`

**Interfaces:**
- Consumes: `FilaAutosave.forcar()`.
- Produces: no rodapé fixo, botão secundário `Salvar` entre o status e `Finalizar` (rodapé continua em uma linha ≤ 72 px; em 360 px, "Copiar anterior" pode virar ícone com `aria-label`). Ao tocar: `await fila.forcar()`; sucesso → "Salvo às hh:mm" + toast `Rascunho salvo.`; falha → mensagem de sem conexão. Desabilitado enquanto envia.

- [ ] **Step 1:** E2E que falha: `botão Salvar grava na hora` (digita, clica Salvar antes de 3 s, recarrega, texto continua); `salvar offline mostra sem conexão`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes + typecheck + lint → PASS; screenshot do rodapé em 360 px `.superpowers/sdd/2026-10-25-plano-1b-ajustes-po/task-3-rodape.png`.
- [ ] **Step 5:** commit `feat(evolucao): botão salvar explícito`.
