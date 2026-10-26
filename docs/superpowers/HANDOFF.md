# Passagem de sessão — Prontuário Santa Casa

Leia isto primeiro ao iniciar uma sessão nova. Depois leia só o ledger do plano em andamento.

## Como retomar
1. `git log --oneline -15` (branch `develop`).
2. Abrir o ledger do plano em andamento (seção "Estado atual" abaixo) e continuar pela última linha.
3. Usar `superpowers:subagent-driven-development` com o plano indicado; a referência `references/resuming.md` da skill explica a retomada pelo ledger.

## Documentos
- Design (fonte da verdade): `docs/superpowers/specs/2026-10-25-prontuario-design.md`
- Planos: `docs/superpowers/plans/2026-10-25-plano-{1-fatia-testavel,1b-ajustes-po,2-anexos,3-multiprofissional,4-alta-admin-seguranca}.md`
- Decisões já tomadas: `docs/superpowers/plans/2026-10-25-plano-1-decisoes.md`, `2026-10-25-planos-1b-2-decisoes.md`
- Ledgers (fora do git): `.superpowers/sdd/<plano>/progress.md`
- Deploy: `docs/deploy.md`

## Estado atual (atualizar ao fim de cada sessão)
- Planos 1, 1b, 2: concluídos, revisados e no staging (`staging` = `6817c22`).
- Plano 3: Tasks 1–6 concluídas e revisadas (último commit revisado `c46dd3b`). **Task 7 (PDF por categoria/autor/adendo) em andamento** — se `git log` não mostrar o commit `feat(impressao): PDF multiprofissional e adendo`, despachar a Task 7 de novo a partir de `.superpowers/sdd/2026-10-25-plano-3-multiprofissional/task-7-brief.md` (há trabalho parcial não commitado possível: conferir `git status` antes; descartar ou aproveitar).
- Depois: Plano 3 Task 8 (seed/docs/suíte) → revisão final do Plano 3 (Opus) → deploy no staging → Plano 4.
- Ação pendente do usuário no próximo deploy: `cd prontuario-medico && npx supabase db push` (migrations 0009–0012) **antes** do push da branch `staging`.

## Regras de execução (acordadas com o usuário)
- Opus (sessão principal) planeja, coordena e revisa visual; implementers sempre `model: haiku`.
- Revisores: `sonnet` para tarefas de banco/segurança/fluxo legal; `haiku` para tarefas pequenas de interface ou documentação; revisão final de cada plano em `opus`.
- **Economia de tokens:** disparar implementer novo por rodada de correção em vez de retomar agentes com histórico longo; ver prints só de telas novas; pacotes de revisão como arquivo (`scripts/review-package`), nunca colar diffs no chat.
- Migrations já aplicadas no staging (0001–0008) são imutáveis; as não aplicadas podem ser editadas até o deploy. Sempre `revoke ... from public, anon` + `grant execute ... to authenticated` explícitos.
- Nunca ler `passDB` nem `.env*`. Commits só em `develop`; push/merge para `staging` com o OK já dado pelo usuário para o fluxo develop→staging; `main` só no go-live.
- Push via HTTPS funciona da sessão (`gh auth` do usuário). Netlify: site `santacasadracena`, staging em `https://staging--santacasadracena.netlify.app` (proteção de visitante desligada; usuários de teste com senha local conhecida — trocar antes de terceiros testarem).
- Usuário não quer testadores externos até os Planos 1–4 estarem prontos.

## Decisões do Plano 4 já tomadas pelo usuário
Push só para pendências (aguardando validação → médicos da equipe; devolvida → autor); MFA obrigatório só para admin; logout por inatividade 30 min; primeiro admin = o usuário (e-mail informado ao rodar o script, nunca no repo); alta bloqueada se houver evolução aguardando validação. Pendências de configuração do usuário no Plano 4: SMTP (Resend), conta Cloudflare R2, logo da Santa Casa (opcional).
