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

Ordem: 1) `npx supabase db push` no staging; 2) logo em seguida o push da branch `staging`. Entre os dois passos, a admissão no app antigo pode falhar por alguns minutos.

Seed (dados fictícios) só em staging:

```bash
npx supabase db push --include-seed
```

Regras:

- Nunca editar uma migration que já foi aplicada em algum ambiente.
- Para mudar o banco, criar uma migration nova.
- Banco e código andam juntos. As migrations até `20261025000008` (anexos, equipe responsável, finalizar v2) precisam estar no staging junto com o código. As migrations `0005` e `0006` mudam assinaturas de funções (`registrar_impressoes`, `admitir_paciente`): aplicar o código sem o banco, ou o banco sem o código, quebra o fluxo.

## Anexos e Storage

- O bucket `anexos` é criado pela migration `20261025000007_anexos.sql` (privado, 20 MB por arquivo, JPEG, PNG, WebP e PDF). Não há nada a configurar à mão no painel.
- Anexos nunca são públicos. O acesso é só por URL assinada, com validade de 5 minutos.
- Storage do plano Free do Supabase: 1 GB, cerca de 3 mil fotos comprimidas. Migrar para o plano Pro (100 GB) antes do uso real.
- Os backups do Supabase não incluem os arquivos do Storage. O backup diário do Storage para o R2 entra no Plano 4.

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

## Usuários de teste (staging)

Dados fictícios, criados pelo seed.

- medico1@teste.local
- medico2@teste.local
- medico.semcrm@teste.local
- recepcao@teste.local
- inativo@teste.local

A senha `Teste@123` é só para o ambiente local. Antes de compartilhar o link de staging:

- trocar a senha de cada usuário acima no painel do Supabase (Authentication → Users), ou apagar os usuários que não forem usados;
- não colocar dado real de paciente em staging: os pacientes são fictícios e assim devem continuar.

## Testes

Dentro de `prontuario-medico/`:

- `npm run test`: testes unitários (Vitest).
- `npm run test:db`: testes de banco (`supabase test db`, exige Supabase local rodando).
- `npm run test:e2e`: testes end-to-end (Playwright).
