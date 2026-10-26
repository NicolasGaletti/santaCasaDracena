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
- **Planos 1, 1b, 2, 3 e 4 concluídos e revisados** (Plano 4: revisão final em opus + leva de correção, CI verde). `staging` = `fab745e`; migrations 0001–0017 aplicadas no staging (todas imutáveis agora). `db push` feito sem `--include-seed` em 2026-10-26.
- **Plano 5 (redesign visual) concluído e no staging** (`staging` = `d78ee95`, 2026-10-26): Inter + Poppins, paleta teal/slate do protótipo, prontuário em página única (ficha + quadro de admissão + histórico em abas), anexos por campo (ECG/Imagem/Laboratório), convênio de lista (admin → Convênios), logo nos PDFs. Migration 0018 aplicada no staging (0001–0018 imutáveis). Convênios no staging vieram dos dados: `Bradesco` e `Bradesco Saúde` coexistem — o admin pode desativar um. Mudanças de comportamento aceitas: leito só se troca no prontuário (não na validação); "Imprimir evolução" imprime a finalizada mais recente, inclusive adendo. Regra para próximas telas: seguir o protótipo e mostrar mockup antes de construir.
- Smoke de headers no staging OK (CSP com nonce, no-store, `/offline` com CSP, PDF da alta anônimo → 401). O Netlify sobrescreve o HSTS no domínio `netlify.app` (`max-age=31536000; preload`); conferir no domínio próprio no go-live.
- **Pendências do usuário para o staging funcionar 100%** (roteiro ordenado em `docs/deploy.md`, seção "Plano 4 — deploy no staging"): `npx supabase functions deploy admin-usuarios enviar-push`; `supabase secrets set SITE_URL VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT PUSH_WEBHOOK_SECRET`; Database Webhook (notificacoes INSERT → enviar-push, header `x-webhook-secret`) e logo depois enviar+finalizar uma evolução de teste; Auth: colar templates de convite/recuperação, Site URL + redirects, TOTP ligado; Netlify: `SITE_URL` no contexto do branch staging e `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; primeiro admin = e-mail da conta do usuário (convidar pelo painel → `supabase/scripts/primeiro-admin.sql`); secrets do backup no GitHub por Environment (`docs/backup.md`); smoke logado completo (convite → senha → MFA → evoluir → validar → imprimir → alta → folha → auditoria).
- **Desvio deliberado do spec:** ao sair, rascunho NÃO sincronizado fica no IndexedDB do aparelho (só cópias sincronizadas são apagadas) — para não perder texto clínico; divulgado em `docs/lgpd.md`.
- **Para o go-live (adiados com ruling):** interstitial "Continuar" no link de convite/recuperação (scanners de e-mail consomem o token no GET); admin em aal1 ainda lê pacientes/internações (igual à recepção); retentar desativação após falha parcial; timeout de sessão do Supabase Auth (Pro) coerente com 30 min; revisão jurídica da LGPD + contato do DPO; segundo admin; teste de restauração do backup; coluna `internacoes.motivo_alta` sem uso (pode ser removida); HSTS no domínio próprio.
- E2E roda em série (`workers: 1`, ~10 min); PWA à parte com `npm run test:e2e:pwa`. `test:db` só em banco recém-resetado.
- Ledgers dos Planos 3 e 4 em `.superpowers/sdd/` podem ser apagados (rulings registrados aqui e no relatório final da sessão).

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
