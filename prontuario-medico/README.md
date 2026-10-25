# Prontuário de internação — Santa Casa de Dracena

Sistema de prontuário de internação: lista de internados, admissão, evolução médica com autosave, PDF A4 e impressão com controle de vias.

Projeto Next.js dentro de `prontuario-medico/`. Visão geral do repositório no [README da raiz](../README.md).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (Radix)
- Supabase (Postgres, Auth, RLS) via `@supabase/ssr`
- Zod, date-fns, `@react-pdf/renderer` e `pdf-lib`
- Testes: Vitest + Testing Library (unidade), pgTAP via Supabase CLI (banco), Playwright (e2e)

## Rodar localmente

Pré-requisitos: Node 20+, Docker (o Supabase local roda em containers).

```bash
cd prontuario-medico
npm ci

# 1. Subir o Supabase local (aplica migrations e seed)
npx supabase start
npx supabase db reset   # reaplica migrations + seed do zero, quando necessário

# 2. Criar .env.development.local com a URL e a publishable key locais
#    (valores em: npx supabase status -o env)

# 3. Subir o app
npm run dev             # http://localhost:3000
```

Não commitar `.env*` com chaves reais.

## Usuários de teste

Dados fictícios, criados pelo `supabase/seed.sql`. Senha `Teste@123` vale só para o Supabase local. Em staging, trocar as senhas (ou apagar os usuários) no painel do Supabase antes de compartilhar o link, e não cadastrar paciente real.

| E-mail | Perfil |
|---|---|
| medico1@teste.local | Médico (com CRM) |
| medico2@teste.local | Médico (com CRM) |
| medico.semcrm@teste.local | Médico sem CRM |
| recepcao@teste.local | Recepção |
| inativo@teste.local | Usuário inativo (acesso negado) |

## Testes

```bash
npm run test          # unidade (Vitest)
npm run test:db       # banco: pgTAP em supabase/tests (exige supabase start)
npm run test:e2e      # Playwright (sobe o app com npm run dev, se necessário)
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run build         # build de produção
```

Verificação completa da fatia:

```bash
npx supabase db reset && npm run test:db && npm run test && npm run typecheck && npm run lint && npm run build && npm run test:e2e
```

## Banco de dados

- Migrations em `supabase/migrations`. Nunca editar uma migration já aplicada em algum ambiente; criar uma nova.
- Tipos do banco: `npm run db:types` (gera `src/lib/supabase/database.types.ts` a partir do banco local).

## Branches e deploy

Fluxo: `develop` → `staging` → `main`. Trabalho do dia a dia em `develop`; staging é deployado no Netlify a partir da branch `staging`.

Detalhes de ambientes, migrations em staging e configuração do Netlify em [`docs/deploy.md`](../docs/deploy.md).

## Documentação

- Spec: [`docs/superpowers/specs/2026-10-25-prontuario-design.md`](../docs/superpowers/specs/2026-10-25-prontuario-design.md)
- Plano da fatia 1: [`docs/superpowers/plans/2026-10-25-plano-1-fatia-testavel.md`](../docs/superpowers/plans/2026-10-25-plano-1-fatia-testavel.md)
