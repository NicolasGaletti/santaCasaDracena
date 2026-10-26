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
- Planos 1, 1b, 2 e 3: concluídos, revisados e no staging (`staging` = `53eef06`; migrations 0001–0013 aplicadas no staging, todas imutáveis).
- **Antes do Plano 4 (bug do usuário no staging, 2026-10-25):** o botão Adendo aparece mesmo quando o usuário já tem rascunho/aguardando validação na internação, e o clique falha com `Você já tem um rascunho aberto nesta internação.`; além disso, o erro renderiza dentro da fila de botões do `<footer>` do `cartao-evolucao.tsx` e desalinha o layout. Correção: em `internacoes/[id]/page.tsx`, `podeAdendo` = false quando houver `rascunhoProprio` ou `aguardandoProprio`; em `BotaoAdendo`/cartão, erro numa linha própria (largura total, `role="alert"`) abaixo dos botões. E2E cobrindo os dois casos. Implementer sonnet, revisão pelo controller (UI pequena), print mobile.
- **Próximo: Plano 4, Task 1** (nada iniciado). Ledger já criado com a pré-verificação e rulings: `.superpowers/sdd/2026-10-25-plano-4-alta-admin-seguranca/progress.md` — **ler antes de despachar**. Principais rulings: numeração das migrations deslocada (alta 0014, admin 0015, aal2 0016, notificações 0017); 7b copia as definições MAIS RECENTES (finalizar_core da 0013) e adiciona `devolvida_por`; um único service worker (push + Serwist); CSP compatível com Next (nonce) e com o Supabase local; flakiness do e2e de login sob carga corrigida na Task 12; Task 2 remove print gerado em `validacao.spec.ts:328-331`.
- Plano 3 encerrado: ledger antigo em `.superpowers/sdd/2026-10-25-plano-3-multiprofissional/` pode ser apagado depois de copiar os rulings para cá se precisar.
- Staging: `enfermeira@teste.local` e `academico@teste.local` criados (login conferido em 2026-10-25).
- Configurado pelo usuário: SMTP Resend no Supabase do staging (sem domínio próprio → só envia para o e-mail do usuário; domínio entra no go-live) e buckets R2 + token novo (credenciais só em `gh secret set` na Task 12).
- Plano 4 precisará do usuário no deploy final: `npx supabase db push`, `npx supabase functions deploy`, secrets (SITE_URL, VAPID), webhook de push, e-mail do primeiro admin.

## Regras de execução (acordadas com o usuário)
- Opus (sessão principal) planeja, coordena e revisa visual; implementers sempre `model: sonnet` (trocado de haiku em 2026-10-25).
- Revisores: `sonnet` para tarefas de banco/segurança/fluxo legal; tarefas pequenas de interface/docs o controller confere o diff; revisão final de cada plano em `opus`. E2E instável: o implementer tenta uma vez e reporta, sem repetir a suíte inteira várias vezes; suíte completa uma vez por task.
- **Economia de tokens:** disparar implementer novo por rodada de correção em vez de retomar agentes com histórico longo; ver prints só de telas novas; pacotes de revisão como arquivo (`scripts/review-package`), nunca colar diffs no chat.
- Migrations já aplicadas no staging (0001–0008) são imutáveis; as não aplicadas podem ser editadas até o deploy. Sempre `revoke ... from public, anon` + `grant execute ... to authenticated` explícitos.
- Nunca ler `passDB` nem `.env*`. Commits só em `develop`; push/merge para `staging` com o OK já dado pelo usuário para o fluxo develop→staging; `main` só no go-live.
- Push via HTTPS funciona da sessão (`gh auth` do usuário). Netlify: site `santacasadracena`, staging em `https://staging--santacasadracena.netlify.app` (proteção de visitante desligada; usuários de teste com senha local conhecida — trocar antes de terceiros testarem).
- Usuário não quer testadores externos até os Planos 1–4 estarem prontos.

## Decisões do Plano 4 já tomadas pelo usuário
Push só para pendências (aguardando validação → médicos da equipe; devolvida → autor); MFA obrigatório só para admin; logout por inatividade 30 min; primeiro admin = o usuário (e-mail informado ao rodar o script, nunca no repo); alta bloqueada se houver evolução aguardando validação. Pendências de configuração do usuário no Plano 4: SMTP (Resend), conta Cloudflare R2, logo da Santa Casa (opcional).
