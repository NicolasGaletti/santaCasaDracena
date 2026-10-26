# Deploy e ambientes

## Ambientes

| Ambiente | Onde roda | Banco (Supabase) | Como atualiza |
|---|---|---|---|
| Local | `npm run dev` na máquina | Supabase local via CLI | `.env.development.local` |
| Staging | Netlify, deploy da branch `staging` | Projeto `prontuario-staging` (ref `laurqwzzmcaeuqejdmzk`, São Paulo) | Push na branch `staging` |
| Produção | Netlify, deploy da branch `main` | Projeto de produção, a criar no go-live | Push na branch `main` |

Produção só entra no ar com plano Pro do Supabase, antes de atender pacientes reais.

## Fluxo de branches

`develop` → `staging` → `main`.

- Trabalho do dia a dia em `develop`.
- Promover para `staging` com merge de `develop`. Testar a URL de staging.
- Promover para `main` com merge de `staging`.
- Não fazer commit direto em `staging` nem em `main`.

## Banco de dados (migrations)

Migrations ficam em `prontuario-medico/supabase/migrations`.

Vincular o projeto uma vez por máquina (de dentro de `prontuario-medico/`):

```bash
npx supabase link --project-ref <ref>
```

Aplicar migrations:

```bash
npx supabase db push
```

Ordem: 1) `npx supabase db push` no staging (de dentro de `prontuario-medico/`); 2) logo em seguida o push da branch `staging`. Entre os dois passos, a admissão no app antigo pode falhar por alguns minutos.

Migrations pendentes para o próximo deploy (aplicar com `npx supabase db push` antes de dar push em `staging`):

- `20261025000013_snapshot_perfil.sql`: `finalizar_core` grava o perfil do autor em `snapshot_autor`, para a 2ª via não mudar quando o autor é promovido. Não altera o hash.
- `20261025000014_alta.sql`: alta médica (`dar_alta`, resumo clínico em `internacoes_clinico.resumo_alta`).
- `20261025000015_admin.sql`: administração de equipes e profissionais (índice único de nome de equipe; ver a checagem de duplicadas abaixo).
- `20261025000016_aal2.sql`: funções `admin_*` exigem sessão `aal2`.
- `20261025000017_notificacoes.sql`: sino e push (`notificacoes`, preferências, assinaturas).

As migrações 0009–0012 já foram aplicadas no staging em 2026-10-25. Todo o roteiro do Plano 4 está na seção "Plano 4 — deploy no staging" abaixo.

Seed: `prontuario-medico/supabase/seed.sql` é só local/e2e (`npx supabase db reset`). Contém admins de teste com credenciais públicas e um secret TOTP conhecido; **nunca** aplicar em staging ou produção (não usar `--include-seed`). Usuários de teste do staging são criados manualmente (como enfermeira/acadêmico).

Regras:

- Nunca editar uma migration que já foi aplicada em algum ambiente.
- Para mudar o banco, criar uma migration nova.
- Banco e código andam juntos. As migrations até `20261025000012` (anexos, equipe responsável, finalizar v2, perfil acadêmico, validação, adendo, anexos de validação) precisam estar no staging junto com o código. As migrations `0005` e `0006` mudam assinaturas de funções (`registrar_impressoes`, `admitir_paciente`): aplicar o código sem o banco, ou o banco sem o código, quebra o fluxo.

## Anexos e Storage

- O bucket `anexos` é criado pela migration `20261025000007_anexos.sql` (privado, 20 MB por arquivo, JPEG, PNG, WebP e PDF). Não há nada a configurar à mão no painel.
- Anexos nunca são públicos. O acesso é só por URL assinada, com validade de 5 minutos.
- Storage do plano Free do Supabase: 1 GB, cerca de 3 mil fotos comprimidas. Migrar para o plano Pro (100 GB) antes do uso real.
- Os backups do Supabase não incluem os arquivos do Storage. O backup diário (criptografado) do Storage para o R2 roda pelo GitHub Actions: ver [backup.md](backup.md).

## Netlify

Configuração em `netlify.toml` (raiz do repo):

- Base directory: `prontuario-medico`
- Build command: `npm run build`
- Publish directory: `.next`
- Node: 22 (`NODE_VERSION`)
- Production branch: `main`. Branch deploys: `staging`.

Variáveis de ambiente por contexto de deploy (Site configuration → Environment variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Cada contexto (produção e branch `staging`) usa o seu projeto Supabase.

Nunca cadastrar a service_role key no Netlify nem em variável `NEXT_PUBLIC_*`.

## Supabase Auth

Em cada projeto:

- Desligar "Allow new users to sign up". Usuários são criados pelo administrador.
- Site URL e Redirect URLs: URL pública do Netlify daquele ambiente.

## Plano 4 — deploy no staging

Roteiro em ordem (espelha a seção 1 de [go-live.md](go-live.md); em produção troque staging por produção). Comandos `npx supabase` rodam dentro de `prontuario-medico/`.

1. **Equipes duplicadas** (antes da 0015, que cria índice único): `select lower(btrim(nome)), count(*) from public.equipes group by 1 having count(*) > 1;`. Se vier alguma linha, renomear no SQL Editor antes de seguir.
2. `npx supabase db push` no projeto de staging. **NUNCA** `--include-seed`.
3. `npx supabase functions deploy admin-usuarios enviar-push`
4. `npx supabase secrets set SITE_URL=https://staging--santacasadracena.netlify.app VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… PUSH_WEBHOOK_SECRET=…` (chaves VAPID: ver "Plano 4 — Notificações (push)").
5. **Database Webhook**: tabela `public.notificacoes`, evento INSERT, POST em `https://<ref>.supabase.co/functions/v1/enviar-push`, header `x-webhook-secret` igual a `PUSH_WEBHOOK_SECRET`.
6. **Auth**: templates Invite user e Reset password, Site URL e Redirect URLs do staging, signups desligados, TOTP (MFA) habilitado, SMTP próprio (seção "Plano 4 — Auth" abaixo).
7. **Netlify**: variável `SITE_URL` no contexto da branch `staging` e `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
8. Push da branch `staging` (merge de `develop`).
9. **Primeiro admin** (script `primeiro-admin.sql`, seção "Plano 4 — Auth"). Recomendado criar um segundo admin: ver [go-live.md](go-live.md#admin-perdeu-o-autenticador).
10. **Smoke**: logo depois do webhook, enviar e finalizar uma evolução (com validação por um médico) para provar que o gatilho de notificação não quebra o fluxo legal de evolução; conferir o sino. Depois: convite, senha, MFA, alta e folha de alta.

## Plano 4 — Auth (convite e recuperação de senha)

Em staging e produção, fazer manualmente (o `config.toml` só vale para o Supabase local):

- Authentication → Email Templates → **Invite user**: colar o conteúdo de `prontuario-medico/supabase/templates/invite.html` e o assunto `Convite para o Prontuário Santa Casa`.
- Authentication → Email Templates → **Reset password**: colar `prontuario-medico/supabase/templates/recovery.html` e o assunto `Recuperação de senha - Prontuário Santa Casa`.
- Os links usam `{{ .SiteURL }}/auth/callback?token_hash=...&type=invite|recovery&next=/definir-senha` (funciona em outro aparelho). Por isso o **Site URL** deve ser a URL pública do ambiente e entrar também em Redirect URLs.
- Netlify: variável `SITE_URL`, recomendada e definida explicitamente por contexto de deploy (produção e branch `staging`), usada como origem do `redirectTo` em "Esqueci minha senha". Sem ela, usa-se `URL` em produção e `DEPLOY_PRIME_URL` nos demais contextos (o `URL` do Netlify aponta para produção mesmo em branch deploys).
- SMTP próprio (ex.: Resend) em Authentication → SMTP Settings; o SMTP padrão do Supabase tem limite baixo.
- **MFA TOTP (admin)**: em staging e produção, Authentication → Sign In / Providers → Multi-Factor → habilitar **TOTP** (enroll e verify). Localmente já está em `config.toml` (`[auth.mfa.totp]`). Sem isso o admin não consegue cadastrar o autenticador e fica sem acesso à administração.
- **Primeiro admin** (staging e produção): 1) painel → Authentication → Users → **Invite user** com o e-mail do responsável; 2) `psql "$SUPABASE_DB_URL" -v email='pessoa@exemplo.com' -v nome='Nome Completo' -f supabase/scripts/primeiro-admin.sql` (de dentro de `prontuario-medico/`; ou colar o script no SQL Editor trocando `:'email'` e `:'nome'`); 3) a pessoa abre o convite, define a senha e cadastra o MFA. Idempotente; falha com mensagem clara se o usuário não foi convidado. O e-mail nunca vai para o repositório.
- O `seed.sql` (admins de teste com senha pública e TOTP conhecido) nunca é aplicado em staging/produção; admins reais cadastram o próprio autenticador no primeiro acesso.

## Plano 4 — Notificações (push)

Feito pelo usuário no deploy; nada disso entra no repositório.

1. Gerar as chaves VAPID: `npx web-push generate-vapid-keys`.
2. Segredos da Edge Function (Supabase):
   `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:seu@email PUSH_WEBHOOK_SECRET=<string aleatória longa>`
3. Publicar a função: `supabase functions deploy enviar-push` (usa `verify_jwt = false` do `config.toml`; a autenticação é o header `x-webhook-secret`).
4. Netlify: variável `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = a chave pública (só a pública; a privada fica só no Supabase).
5. Dashboard do Supabase, Database, Webhooks, Create: tabela `public.notificacoes`, evento INSERT, tipo HTTP Request, método POST, URL `https://<ref>.supabase.co/functions/v1/enviar-push`, header `x-webhook-secret` com o mesmo valor de `PUSH_WEBHOOK_SECRET`. Repetir em cada projeto (staging e produção).
6. Teste rápido: sem o header a função responde 401; com ele e um destinatário sem assinaturas responde 200 `{"enviados":0}`.

O push só sai para `validacao_pendente` e `evolucao_devolvida` e nunca contém nome de paciente nem conteúdo clínico. Assinaturas que o serviço de push recusa (404/410) são apagadas.

## Usuários de teste (staging)

Dados fictícios, criados manualmente (o seed é só local).

- medico1@teste.local
- medico2@teste.local
- medico.semcrm@teste.local
- residente@teste.local
- enfermeira@teste.local
- academico@teste.local
- recepcao@teste.local
- inativo@teste.local

A senha `Teste@123` é só para o ambiente local. Antes de compartilhar o link de staging:

- trocar a senha de cada usuário acima no painel do Supabase (Authentication → Users), ou apagar os usuários que não forem usados;
- não colocar dado real de paciente em staging: os pacientes são fictícios e assim devem continuar.

## Testes

Dentro de `prontuario-medico/`:

- `npm run test`: testes unitários (Vitest).
- `npm run test:db`: testes de banco (`supabase test db`, exige Supabase local rodando).
- `npm run test:e2e`: testes end-to-end (Playwright, em série).
- `npm run test:e2e:pwa`: testes do PWA (projeto `pwa`).

Checklist de produção: [go-live.md](go-live.md).
