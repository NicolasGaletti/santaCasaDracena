# Plano 1 — Decisões tomadas durante a execução

Decisões que o Claude tomou em nome do usuário durante a execução do Plano 1 (fatia testável), na ordem. Cada uma traz, quando registrado, o custo se estiver errada. Fonte: ledger da execução.

7:## Rulings
- Ruling: work directly on `develop`, no worktree — user defined develop as the dev branch; `prontuario-medico/` is still untracked so a worktree would not contain it — cost if wrong: none, branch is isolated from main.
- Ruling: controller pre-created root `.gitignore` (passDB, .DS_Store, **/.env*, !**/.env.example, .superpowers/); Task 1 keeps it and commits it — prevents committing passDB/workspace.
- Ruling: Task 1 first commits the existing `prontuario-medico/` baseline (respecting its .gitignore: no node_modules/.next/.env.local/tsbuildinfo) before tooling changes; `.agents/` and `skills-lock.json` stay untracked — out of scope.
- Ruling: Docker daemon was down; controller ran `open -a Docker`. If still unavailable, DB tests block → stop and ask user.
- Ruling: review scope excludes baseline commit 459f33a (pre-existing code) — cost if wrong: old code unreviewed, but it is replaced in Tasks 5/7.
- Ruling: lint failure in old src/app/page.tsx accepted until Task 7 deletes it — Task 7 must end with lint 0.
- Ruling: Task 2 must create src/lib/supabase/ before running db:types.
- Ruling (I1, plan-mandated): evolucoes_select also shows AGUARDANDO_VALIDACAO to médicos who are members of the internação's equipe — spec 6.3 validation needs it; cheap now — cost if wrong: Plan 3 adjusts policy.
- Ruling (I2, plan-mandated): split clinical columns into new table `internacoes_clinico (internacao_id pk/fk, diagnostico_inicial, comorbidades, muc — all nullable)` with SELECT only `app.eh_clinico()`; `internacoes` keeps administrative columns readable by any active professional — spec 6.1 forbids recepcao/admin clinical access; column grants can't vary by profile — cost if wrong: one extra join in Tasks 3/4/7/9.
- Ruling (I3/I4): SELECT policies: impressoes → eh_clinico(); leitos_historico → profissional_ativo(); acessos & auditoria → perfil_atual() = 'auditoria'.
- Ruling (I5): clinical columns nullable (moved to internacoes_clinico). `medico_responsavel_id` stays NOT NULL — spec says each internação has one; Task 7 admission form must include a médico select — cost if wrong: recepcao friction.
- Ruling (plan-mandated, equipes audit): add audit trigger on `equipes` (spec 6.6.1).
- Ruling: edit migration 20261025000001 in place (never deployed anywhere).
- Ruling: also fix minors cheaply in same round: vw_profissionais_publico only returns rows when caller profissional_ativo(); test set_config local=true; tests.criar_profissional gets p_categoria param; alter default privileges revoke insert/update/delete on tables from authenticated.
- Ruling (user preference 2026-10-25): UI tasks (7, 9, 10 /imprimir) must use the frontend-design skill (plugin frontend-design@claude-plugins-official, user installing); prototype ~/Downloads/medsystem_pro_v3.html = screen structure reference only. If skill not available at Task 7, check with user.
- Ruling (plan-mandated hash): hash input uses `to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` for finalizada_em; test recomputes under `set local timezone = 'Asia/Tokyo'` — spec needs verifiable hash — cost if wrong: none (nothing finalized in prod yet). Plan 2 (anexos sha256 into hash) must reuse this canonical form.
- Ruling: fold cheap security minors into the same round: salvar_rascunho locks internação `for share`; finalizar_evolucao checks author before status; weak tests assert exact messages; add negative tests (recepcao salvar_rascunho, non-author finalizar, non-member trocar_leito, multiprofissional sem categoria).
- Ruling (Task 5): old src/app/page.tsx uses deleted client + dropped tables → Task 5 replaces it with a minimal server placeholder ("Internados" heading, profissional name, Sair); Task 7 moves home into (app) group.
- Ruling (Task 5): `next dev` / e2e use LOCAL Supabase via new `prontuario-medico/.env.development.local` (local URL + local publishable key from `npx supabase status -o env`; gitignored) — overrides .env.local (cloud) in dev only — cost if wrong: user expects dev against cloud; documented in Task 11 README.
- Ruling (Task 5): also set `[auth.email] enable_signup = false` in config.toml.
- Ruling: fold cheap minors into round 1: sem_cadastro path signs out + e2e with new seed user inativo@teste.local (ativo=false); keep email after failed login; layout description pt-BR.
- Ruling (Task 7): admission form includes "Médico responsável" select (active médicos from vw_profissionais_publico) since medico_responsavel_id NOT NULL; optional diagnóstico/comorbidades/MUC fields.
- Ruling (Task 7): implementer reads .claude/skills/frontend-design/SKILL.md and follows its plan→review→build process; writes the token system into globals.css and the design plan into the report; commits the skill file.
- Task 7 review: Approved (no Critical/Important). Ruling: one polish round anyway — user explicitly prioritized UI quality; controller visual findings + cheap minors (P0001-only messages, vw ativo, vacuous anteriores test, gitignore test-results, drop next-themes).
- Ruling: Task 8 needs user actions (Supabase project, push, Netlify) → run Task 9 first while user prepares; Task 8 after. Tasks are independent (8 only deploys).
- Ruling (plan-mandated comparison): local IndexedDB copy exists only after a failed/unsent save → local wins without clock comparison (avoids client clock skew dropping edits) — cost if wrong: an abandoned local copy could override a newer server draft edited on another device (rare; acceptable).
- Ruling: fold minors into round 1: preserve textoLivre; inline error for invalid vitals (no silent null); useRef lock on finalize + double-click e2e; message on empty leito; key={id} on form. Plus controller visual fixes (compact action bar ≤ 72px, Descartar out of bar, timeline chips single scroll row, 'Médica' label, 2-col header facts, active nav state).
- Ruling: per-evolution "Página x de y" in lote (implementer may render each evolution as its own document and merge with pdf-lib, or two-pass offsets).
- Ruling: all validation/building (incl. late 404s) before any registration; registration through a NEW atomic batch RPC `registrar_impressoes(p_ids uuid[]) returns table(evolucao_id uuid, via int)` in NEW migration 20261025000004 (staging already has 0001–0003 pushed — never edit those in place again). Residual risk: render failure after commit (deterministic after validation) — accepted.
- Ruling: fold minors: P0001 'Acesso negado.' → 403; tests for route 401/403 branches; e2e asserts patient name + "Validado por" in PDF text; imprimir selecionadas test asserts 200.
- Ruling (#3 via inflation): idempotent print — client-generated request key `k` (uuid) per click; impressoes gets `chave uuid` + unique (evolucao_id, chave); new `registrar_impressoes(p_ids, p_chave)` returns existing via for a repeated key; /imprimir refresh on focus/visibilitychange instead of 1.5s timer — cost if wrong: one extra column.
- Ruling (#4 residente): Plan 1 hides Finalizar for residentes with notice; "Nova evolução" only for médico or team member; autosave treats P0001 as terminal error with its message (not offline).
- Ruling (#5 credentials): user rotates/deletes seed-user passwords on staging; docs state staging passwords differ from local and no real data in staging. Local seed keeps Teste@123.
- Ruling (#6): new migration 20261025000005 with default-privilege revokes + view grant hygiene; also server-side required fields in finalizar_evolucao (create or replace) and audit skip for RASCUNHO→RASCUNHO updates.
- Ruling (minors in wave): seed evolutions reshaped to medica@1; PDF prints texto_livre when non-empty; recepção chart hides timeline. Deferred: hash version tag (Plan 2 changes hash), bed-change confirm, reprint shows current leito/médico (note in docs), IndexedDB clear on logout (Plan 4).
- PO requests 2026-10-25 → Plan 1b (docs/superpowers/plans/2026-10-25-plano-1b-ajustes-po.md): equipe responsável, filtro convênio, botão Salvar; interno sem CRM → Plan 3. Ruling: convênio = list filter; médico responsável removed entirely (pending PO confirmation). Plan 2 migrations renumbered 0007/0008.
- Ruling (#6 residual, load-bearing for Plan 2): carry into Plan 1b Task 1 migration 0006: `alter default privileges for role postgres revoke execute on functions from public;` (no IN SCHEMA) + real pgTAP using has_function_privilege('anon', new fn, 'execute') = false. Current app functions already revoke explicitly, so no live exposure.

## Pendências menores adiadas

- Task 2: minor (deferred): test 12 lacks "row unchanged" assertion (privilege already guarantees)
- Task 3: minor (deferred): registrar_acesso p_acao free text / no existence check; registrar_impressao no team check (per brief); FK errors 23503 instead of P0001 for bad equipe_id; test 5 doesn't assert leito_ala updated; TRUNCATE/replica bypass (superuser only).
- Task 3: minor (deferred): for share lock taken before membership check in salvar_rascunho (low risk)
- Task 4: minor (deferred): no midnight-SP boundary test for status_hoje; seed identity_data lacks email_verified; ev.* binds columns at view creation (recreate view when evolucoes changes, e.g. Plan 2/3)
- Task 5: minor (deferred): getClaims local JWT (revocation lag until expiry — Plan 4 session hardening); matcher extension skip; Cache-Control no-store on cookie responses (Plan 4 headers).
- Task 6: minor (deferred): no leap-day/Dec31 boundary tests; no in-range sinais acceptance tests; form layer (Task 9) must map '' → null for numeric inputs; idade/formatarData no input validation
- Task 7: minor (deferred): globals.css imports shadcn/tailwind.css while shadcn is devDependency (Netlify installs devDeps by default — verify in Task 8 build); weak "Sem evolução" absence check
- Task 9: minor (deferred): orphaned "Continuar rascunho" when CRM removed; timing-based leito assertion; stale-version save not re-rendering
- Task 10: minor (deferred): 1.5s refresh timer on /imprimir; data_nascimento ?? '' defensive
- Task 10: minor (deferred): render failure after atomic registration leaves via without PDF (accepted); unreachable ?? 1
- Task final: minor (deferred): botao-imprimir href without k (middle-click/long-press not idempotent).
