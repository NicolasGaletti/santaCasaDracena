# Checklist de go-live

Marque cada item. Detalhes em [deploy.md](deploy.md), [backup.md](backup.md) e [lgpd.md](lgpd.md). Comandos `npx supabase` rodam dentro de `prontuario-medico/`.

## 1. Supabase de produção

- [ ] Projeto novo em **São Paulo**, plano **Pro** com **PITR** ligado.
- [ ] SMTP próprio (Resend) com domínio próprio em Authentication → SMTP Settings.
- [ ] Auth: templates **Invite user** e **Reset password** colados (`supabase/templates/`); **Site URL** e Redirect URLs = URL pública de produção; **signups desligados**; **TOTP (MFA)** habilitado.
- [ ] Sessão do Auth (inatividade / time-box) coerente com a regra de 30 min do app.
- [ ] Antes do push: conferir que `equipes` não tem nomes duplicados sem diferenciar maiúsculas/minúsculas (a migration `0015` cria índice único): `select lower(btrim(nome)), count(*) from public.equipes group by 1 having count(*) > 1;`
- [ ] `npx supabase link --project-ref <ref-prod>` e `npx supabase db push`. **NUNCA** `--include-seed`: o seed tem admins de teste com credenciais públicas.
- [ ] `npx supabase functions deploy admin-usuarios enviar-push`
- [ ] Secrets: `SITE_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET` (`npx supabase secrets set ...`).
- [ ] Database Webhook em `notificacoes` (INSERT) → função `enviar-push`, com header `x-webhook-secret`. Passos em [deploy.md](deploy.md#plano-4--notificações-push).

## 2. Netlify

- [ ] Contexto de produção com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (do projeto de produção), `SITE_URL` e `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. `SITE_URL` definido por contexto. Sem `service_role`.
- [ ] Merge `staging` → `main` e deploy concluído.

## 3. Primeiro administrador

1. Painel do Supabase → Authentication → Users → **Invite user** (e-mail do responsável; usa o nosso template).
2. Rodar o script (e-mail e nome informados na hora, nunca no repositório):
   ```bash
   psql "$SUPABASE_DB_URL" -v email='pessoa@exemplo.com' -v nome='Nome Completo' \
     -f supabase/scripts/primeiro-admin.sql
   ```
   Sem `psql`: abrir o script no SQL Editor do Supabase, trocar `:'email'` e `:'nome'` pelos valores entre aspas simples e executar. Deve aparecer `OK: ... agora é administrador`. Pode ser repetido sem efeito colateral.
3. A pessoa abre o convite, define a senha e cadastra o autenticador (MFA).
4. Ela convida os demais profissionais pela tela de administração.

- [ ] Primeiro admin criado e MFA cadastrado.
- [ ] Usuários de teste removidos (Authentication → Users) e nenhum paciente fictício em produção.

## 4. Backup

- [ ] Secrets do GitHub conforme [backup.md](backup.md), por Environment (`prod` com as chaves de Storage do projeto de produção).
- [ ] O agendamento só roda a partir de `main`: testar com `workflow_dispatch` no ambiente `prod`.
- [ ] **Teste de restauração** feito (seção "Restaurar" do backup.md) e chave `age` guardada fora do GitHub/R2.

## 5. Verificação no site publicado

- [ ] `/login`: scripts com `nonce` na CSP.
- [ ] Headers de segurança presentes, inclusive em `/offline` (`curl -sI https://<site>/login`).
- [ ] `Cache-Control: no-store` nas páginas autenticadas.
- [ ] Fluxo completo: convite → senha → MFA → evoluir → validar → imprimir → alta → folha de alta → auditoria.
- [ ] Push chega para `validacao_pendente` sem dado clínico.

## 6. Piloto

- [ ] Começar com **uma equipe**, com **papel em paralelo**, por algumas semanas.
- [ ] Hospital ciente de [lgpd.md](lgpd.md) (responsável preenchido, contratos com operadores).
