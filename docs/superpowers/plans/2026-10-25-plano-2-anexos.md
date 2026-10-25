# Plano 2 — Anexos de exames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir anexar fotos/PDF de exames (laboratório, imagem, ECG, outro) à evolução pelo celular, com imutabilidade após a finalização, galeria por internação e inclusão no PDF impresso.

**Architecture:** Metadados em `public.anexos` (RLS, escrita só por funções `security definer`); arquivos no bucket privado `anexos` do Supabase Storage com políticas em `storage.objects` espelhando o RLS. Fluxo de envio em 3 passos: `criar_anexo` (reserva linha + caminho) → upload direto do navegador para o Storage → `confirmar_anexo`. Visualização só por URL assinada de 5 min gerada no servidor com o cliente do usuário. O `sha256` dos anexos confirmados entra no `conteudo_hash` (versão 2) na finalização.

**Tech Stack:** igual ao Plano 1 (Next.js 16, Supabase, pgTAP, Vitest, Playwright, `@react-pdf/renderer`, `pdf-lib`) + Web Crypto (`crypto.subtle.digest`) e Canvas API para compressão (sem nova dependência).

**Spec:** `docs/superpowers/specs/2026-10-25-prontuario-design.md` (seção 6.4.1)

## Global Constraints

- Todos os do Plano 1 continuam valendo (RLS em tudo, escrita só por funções, sem `service_role` no app, pt-BR, mobile-first, fuso `America/Sao_Paulo`).
- **Migrations 0001–0005 já estão em staging e a 0006 é do Plano 1b: nunca editar.** Novas: `20261025000007_anexos.sql`, `20261025000008_finalizar_v2.sql`.
- Bucket `anexos`: `public = false`, limite 20 MB por arquivo, MIME permitidos `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Caminho do objeto: `internacoes/{internacao_id}/{anexo_id}` (sem extensão; o MIME fica na linha).
- Imagem comprimida no aparelho: lado maior ≤ 2000 px, JPEG qualidade 0.8. PDF enviado como está. Arquivo > 20 MB (após compressão) é recusado no cliente com `Arquivo maior que 20 MB.`
- Tipos: `LABORATORIO | IMAGEM | ECG | OUTRO` (rótulos: Laboratório, Imagem, ECG, Outro).
- Só o autor de uma evolução `RASCUNHO` adiciona/remove anexos dela. Depois de `FINALIZADA`: sem update/delete na linha nem no objeto.
- Leitura (linha e objeto): `app.eh_clinico()` e (evolução `FINALIZADA` ou autor = `auth.uid()`). Recepção/admin nunca leem anexos.
- URL assinada: 300 s, gerada no servidor. Nunca URL pública. Nada de anexo em cache de service worker ou IndexedDB.
- Sem conexão no envio: mostrar `Sem conexão. Tente enviar o anexo novamente.`; não enfileirar arquivos no aparelho. **Decisão do controller:** imagem clínica não fica guardada no celular.
- `conteudo_hash` v2 = `sha256` hex de `jsonb_build_object('v',2,'dados',dados,'texto',texto_livre,'internacao',internacao_id,'autor',autor_id,'finalizada_em',to_char(v_agora at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'anexos',<array de sha256 dos anexos confirmados ordenado por id>)::text`; coluna nova `evolucoes.hash_versao int` (1 para as existentes, 2 nas novas).
- O `sha256` do anexo é calculado no cliente sobre os bytes enviados. **Decisão do controller:** suficiente na fase 1 (o servidor não relê o arquivo).

## Review Focus

1. **Foto enviada pela metade (rede caiu entre `criar_anexo` e o upload):** a linha fica `confirmado = false`, não aparece em lugar nenhum e é apagada na finalização. Teste: Task 2 `finalizar remove anexos não confirmados`.
2. **Tentativa de apagar/substituir o arquivo de uma evolução finalizada direto no Storage (API):** negada. Teste: Task 1 `autor não apaga objeto após finalizar`.
3. **Recepção abrindo URL de anexo:** nem a linha nem o objeto são legíveis; URL assinada não é gerada. Teste: Task 1 `recepcao não lê anexos` e Task 5 `recepcao não obtém URL assinada`.
4. **Foto gigante de câmera de 50 MP:** comprimida para ≤ 2000 px antes do envio; PDF de 25 MB recusado no cliente. Teste: Task 3 `dimensões alvo` e `recusa acima de 20 MB`.
5. **Dois toques em "Enviar" / mesmo arquivo duas vezes:** cria dois anexos distintos (aceitável) mas nunca um anexo confirmado sem objeto. Teste: Task 4 `confirmar sem objeto falha`.

---

### Task 1: Schema de anexos, bucket e políticas

**Files:**
- Create: `prontuario-medico/supabase/migrations/20261025000007_anexos.sql`, `prontuario-medico/supabase/tests/007_anexos.test.sql`

**Interfaces:**
- Produces (SQL):
  - enum `tipo_anexo ('LABORATORIO','IMAGEM','ECG','OUTRO')`.
  - `anexos (id uuid pk default gen_random_uuid(), evolucao_id uuid not null references evolucoes on delete restrict, internacao_id uuid not null references internacoes on delete restrict, tipo tipo_anexo not null, descricao text not null default '', data_exame date not null, storage_path text not null unique, mime text not null, tamanho_bytes int not null check (tamanho_bytes between 1 and 20971520), sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'), confirmado boolean not null default false, enviado_por uuid not null references profissionais, enviado_em timestamptz not null default now())`. RLS on; SELECT `app.eh_clinico() and confirmado and exists(evolução visível: FINALIZADA ou autor_id = auth.uid())`; nenhuma política de escrita; trigger de auditoria.
  - Trigger `app.bloquear_anexo_finalizado()` BEFORE UPDATE OR DELETE em `anexos`: se a evolução não está `RASCUNHO` → `Anexo de evolução finalizada não pode ser alterado.` (exceção: DELETE de linha `confirmado = false` feito por `finalizar_evolucao` — implementar checando `current_setting('app.finalizando', true) = 'on'`).
  - Bucket: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('anexos','anexos',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict (id) do nothing;`
  - Políticas em `storage.objects` (bucket `anexos`): INSERT para `authenticated` quando existe `anexos` com `storage_path = name`, `enviado_por = auth.uid()`, `confirmado = false` e evolução `RASCUNHO`; SELECT quando a linha correspondente é legível pela regra de leitura acima (inclui `confirmado = false` apenas para `enviado_por = auth.uid()`, para o próprio autor ver a prévia); DELETE quando `enviado_por = auth.uid()` e evolução `RASCUNHO`; sem UPDATE.
  - Funções (`security definer`, `search_path = ''`, grant `authenticated`, revoke `public, anon`, erros P0001 pt-BR):
    - `criar_anexo(p_evolucao_id uuid, p_tipo tipo_anexo, p_descricao text, p_data_exame date, p_mime text, p_tamanho_bytes int, p_sha256 text) returns table(id uuid, storage_path text)` — só o autor, evolução `RASCUNHO`, MIME na lista, tamanho ≤ 20 MB, `data_exame` ≤ hoje (SP). Gera `id` e `storage_path = 'internacoes/' || internacao_id || '/' || id`.
    - `confirmar_anexo(p_anexo_id uuid) returns void` — só `enviado_por`; exige objeto em `storage.objects` (`bucket_id = 'anexos' and name = storage_path`); seta `confirmado = true`. Sem objeto → `Arquivo do anexo não foi recebido.`
    - `remover_anexo(p_anexo_id uuid) returns void` — só `enviado_por`, evolução `RASCUNHO`; apaga a linha (o app apaga o objeto pelo Storage antes).

- [ ] **Step 1: pgTAP que falha** (`007_anexos.test.sql`): `criar_anexo gera caminho por internação`; `não autor não cria anexo`; `criar em evolução finalizada falha`; `mime não permitido falha`; `confirmar sem objeto falha`; `confirmar com objeto marca confirmado` (inserir em `storage.objects` como o autor: `set role authenticated` + claims; `insert into storage.objects(bucket_id, name, owner) values ('anexos', path, uid)`); `recepcao não lê anexos`; `outro médico não vê anexo de rascunho alheio`; `autor não apaga objeto após finalizar` (finalizar via `finalizar_evolucao`, depois `delete from storage.objects` como autor → 0 linhas afetadas, objeto continua); `remover_anexo após finalizar falha`; `upload em caminho sem anexo reservado é negado`.
- [ ] **Step 2:** `npm run test:db` → FAIL.
- [ ] **Step 3:** escrever a migration.
- [ ] **Step 4:** `npx supabase db reset && npm run test:db` → PASS (todos os arquivos); `npm run db:types`.
- [ ] **Step 5:** commit `feat(db): anexos de exames com bucket privado e políticas`.

---

### Task 2: Finalização v2 (hash com anexos, limpeza de não confirmados)

**Files:**
- Create: `prontuario-medico/supabase/migrations/20261025000008_finalizar_v2.sql`, `prontuario-medico/supabase/tests/008_finalizar_v2.test.sql`

**Interfaces:**
- Consumes: Task 1; `finalizar_evolucao` atual (última versão em `20261025000005_endurecimento.sql`).
- Produces:
  - `alter table evolucoes add column hash_versao int not null default 1;` (existentes ficam 1).
  - `create or replace function finalizar_evolucao(p_evolucao_id uuid) returns timestamptz` — mesmas regras da versão em 0005 (ordem das checagens, campos obrigatórios, lock), mais: `set_config('app.finalizando','on',true)`; apaga anexos `confirmado = false` da evolução (e seus objetos em `storage.objects`, se houver); calcula o hash v2 (Global Constraints) e grava `hash_versao = 2`.
  - Recriar `vw_evolucoes_timeline` incluindo `hash_versao` e `qtd_anexos int` (contagem de anexos confirmados) — a view usa `ev.*`, então precisa `drop view` + `create view` com os mesmos grants/`security_invoker`.

- [ ] **Step 1: pgTAP que falha:** `finalizar grava hash_versao 2`; `hash v2 inclui sha256 dos anexos em ordem de id` (recalcular com a expressão canônica e comparar); `finalizar remove anexos não confirmados`; `evoluções antigas mantêm hash_versao 1`; `timeline expõe qtd_anexos`.
- [ ] **Step 2:** `npm run test:db` → FAIL.
- [ ] **Step 3:** migration.
- [ ] **Step 4:** reset + `npm run test:db` → PASS; `npm run db:types`; `npm run typecheck`.
- [ ] **Step 5:** commit `feat(db): finalização v2 com anexos no hash`.

---

### Task 3: Preparação do arquivo no aparelho

**Files:**
- Create: `prontuario-medico/src/features/anexos/processar-arquivo.ts`, `prontuario-medico/src/features/anexos/processar-arquivo.test.ts`, `prontuario-medico/src/features/anexos/rotulos.ts`

**Interfaces:**
- Produces:
  - `TIPOS_ANEXO = ['LABORATORIO','IMAGEM','ECG','OUTRO'] as const`, `type TipoAnexo`, `ROTULO_TIPO_ANEXO: Record<TipoAnexo,string>` em `rotulos.ts`.
  - `dimensoesAlvo(largura: number, altura: number, max = 2000): { largura: number; altura: number }` (mantém proporção; não amplia).
  - `validarArquivo(f: { type: string; size: number }): string | null` (MIME fora da lista → `Formato não suportado. Envie foto ou PDF.`; > 20 MB → `Arquivo maior que 20 MB.`).
  - `sha256Hex(bytes: ArrayBuffer): Promise<string>` via `crypto.subtle.digest`.
  - `prepararArquivo(file: File): Promise<{ blob: Blob; mime: string; tamanho: number; sha256: string; previewUrl: string }>` — imagem: `createImageBitmap` → canvas em `dimensoesAlvo` → `toBlob('image/jpeg', 0.8)`; PDF: como está; valida antes e depois.

- [ ] **Step 1: Vitest que falha:** `dimensões alvo` (4000×3000 → 2000×1500; 1200×800 inalterado; 3000×6000 → 1000×2000); `recusa acima de 20 MB`; `recusa formato não suportado` (`image/gif`); `sha256 de 'abc'` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
- [ ] **Step 2:** `npm run test` → FAIL.
- [ ] **Step 3:** implementar (`prepararArquivo` fica fora do teste unitário — coberto no e2e da Task 4).
- [ ] **Step 4:** `npm run test` → PASS.
- [ ] **Step 5:** commit `feat(anexos): compressão e hash no aparelho`.

---

### Task 4: Anexos no formulário da evolução

**Files:**
- Create: `prontuario-medico/src/features/anexos/anexos-evolucao.tsx`, `prontuario-medico/src/features/anexos/enviar-anexo.ts`, `prontuario-medico/src/features/anexos/actions.ts`, `prontuario-medico/e2e/fixtures/exame.jpg` (JPEG pequeno gerado, sem dado real), `prontuario-medico/e2e/fixtures/laudo.pdf`, `prontuario-medico/e2e/anexos.spec.ts`
- Modify: `prontuario-medico/src/features/evolucao/form-medica.tsx` (seção Exames recebe o bloco de anexos), `prontuario-medico/src/app/(app)/internacoes/[id]/evolucao/page.tsx` (carregar anexos do rascunho)

**Interfaces:**
- Consumes: Tasks 1–3; `createBrowserSupabase()`.
- Produces:
  - `enviarAnexo(params: { evolucaoId: string; tipo: TipoAnexo; descricao: string; dataExame: string; arquivo: File; onProgresso?: (fase: 'preparando'|'enviando'|'confirmando') => void }): Promise<AnexoRascunho>` — `prepararArquivo` → `rpc('criar_anexo')` → `storage.from('anexos').upload(storage_path, blob, { contentType: mime, upsert: false })` → `rpc('confirmar_anexo')`. Se o upload falhar, chama `remover_anexo` (melhor esforço) e lança erro com mensagem pt-BR (rede → mensagem de sem conexão).
  - `type AnexoRascunho = { id: string; tipo: TipoAnexo; descricao: string; dataExame: string; mime: string; previewUrl?: string }`.
  - Server action `removerAnexo(anexoId: string): Promise<{ erro?: string }>` — apaga o objeto (`storage.remove([path])` com o cliente do usuário) e depois `rpc('remover_anexo')`; P0001 → mensagem; outro erro → genérica.
- UI (usar `.claude/skills/frontend-design/SKILL.md` e os tokens existentes): dentro da seção Exames, bloco "Anexos": seletor de tipo (chips), campo descrição (opcional), data do exame (padrão hoje SP), botões `Tirar foto` (`<input type="file" accept="image/*" capture="environment">`) e `Escolher arquivo` (`accept="image/jpeg,image/png,image/webp,application/pdf"`); lista de anexos do rascunho com miniatura (imagem via `previewUrl` local ou URL assinada; PDF com ícone), rótulo do tipo, data, descrição, botão `Remover` com confirmação. Estado de envio por item ("Enviando…"), erro por item com `Tentar novamente`. Só aparece para o autor de rascunho; some quando a evolução é finalizada.

- [ ] **Step 1: E2E que falha** (`anexos.spec.ts`, projeto mobile, `npx supabase db reset` antes): `médico anexa foto e ela aparece na lista` (`setInputFiles` com `exame.jpg`); `anexa PDF de laudo`; `remove anexo antes de finalizar`; `após finalizar não há botão remover`; `sem conexão mostra mensagem e permite tentar de novo` (`page.route('**/storage/v1/object/**', r => r.abort())`).
- [ ] **Step 2:** `npm run test:e2e -- anexos` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm run test && npm run test:e2e && npm run typecheck && npm run lint` → PASS; screenshot mobile do bloco em `.superpowers/sdd/2026-10-25-plano-2-anexos/task-4-anexos.png`.
- [ ] **Step 5:** commit `feat(anexos): envio de fotos e PDF na evolução`.

---

### Task 5: Galeria de exames no prontuário

**Files:**
- Create: `prontuario-medico/src/features/anexos/galeria-exames.tsx`, `prontuario-medico/src/features/anexos/consultas.ts`
- Modify: `prontuario-medico/src/app/(app)/internacoes/[id]/page.tsx` (nova aba "Exames" ao lado de Evoluções | Dados), `prontuario-medico/src/features/anexos/actions.ts`, `prontuario-medico/e2e/anexos.spec.ts`

**Interfaces:**
- Produces:
  - `listarAnexosInternacao(internacaoId: string): Promise<AnexoGaleria[]>` — anexos confirmados de evoluções `FINALIZADA` (RLS garante), ordem `data_exame desc, enviado_em desc`; `AnexoGaleria = { id; tipo; descricao; dataExame; mime; evolucaoId; autorNome }`.
  - Server action `urlAssinada(anexoId: string): Promise<{ url?: string; erro?: string }>` — confere a linha via cliente do usuário (RLS) e chama `storage.from('anexos').createSignedUrl(path, 300)`; linha invisível → `{ erro: 'Anexo não encontrado.' }`.
- UI: aba "Exames" com chips de filtro (Todos | Laboratório | Imagem | ECG | Outro, rolagem horizontal), grade de miniaturas (2 colunas no celular, 4 no desktop) carregadas por URL assinada sob demanda (`loading="lazy"`), legenda com data e tipo; toque abre visualizador em tela cheia (imagem) ou nova aba (PDF). Aba oculta para perfis não clínicos.

- [ ] **Step 1: E2E que falha:** `galeria mostra anexo da evolução finalizada`; `filtro ECG mostra só ECG`; `recepcao não vê a aba Exames e não obtém URL assinada` (chamar a action pela UI não é possível → testar via `page.request` no endpoint da action não é estável; em vez disso, unit test de `urlAssinada` com cliente mockado retornando linha vazia → erro) .
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** testes + typecheck + lint → PASS; screenshot `.superpowers/sdd/2026-10-25-plano-2-anexos/task-5-galeria.png`.
- [ ] **Step 5:** commit `feat(anexos): galeria de exames por internação`.

---

### Task 6: Anexos no PDF

**Files:**
- Modify: `prontuario-medico/src/features/impressao/gerar-pdf.ts`, `prontuario-medico/src/features/impressao/documento-evolucao.tsx`, `prontuario-medico/src/features/impressao/documento-evolucao.test.tsx`, `prontuario-medico/src/features/evolucao/cartao-evolucao.tsx`, `prontuario-medico/e2e/impressao.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2, rotas de PDF do Plano 1 (`gerarPdf(ids, opcoes)`; manter a chave idempotente `k`).
- Produces:
  - `gerarPdf(ids: string[], opcoes?: { chave?: string | null; incluirImagens?: boolean })`; rotas aceitam `?anexos=1` → `incluirImagens: true`.
  - Seção "Anexos" no documento: tabela com Tipo, Data do exame, Descrição, Formato (Imagem/PDF) e miniatura (≤ 120 px) para imagens; omitida se não houver anexos. Com `incluirImagens`, cada imagem ganha uma página própria após a evolução, com legenda (tipo, data, descrição, código da evolução) e o mesmo rodapé (a paginação por evolução conta essas páginas). PDFs anexados são listados, não embutidos.
  - Bytes das imagens obtidos no servidor com `storage.from('anexos').download(path)` usando o cliente do usuário (RLS), não por URL pública.
  - Card: se `qtd_anexos > 0`, além de `Imprimir`, botão `Imprimir com imagens` (mesmo fluxo com `k` + `anexos=1`).
  - O rodapé passa a mostrar `Hash v<hash_versao> <12 primeiros>`.

- [ ] **Step 1: Testes que falham:** Vitest `seção Anexos omitida sem anexos` / `lista anexos com rótulo do tipo`; E2E `PDF lista o anexo` (texto contém `Laboratório` e a descrição) e `com anexos=1 o PDF tem página da imagem` (contagem de páginas maior; texto contém a legenda).
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm run test && npm run test:e2e && npm run typecheck && npm run lint && npm run build` → PASS; salvar exemplo em `.superpowers/sdd/2026-10-25-plano-2-anexos/task-6-exemplo.pdf`.
- [ ] **Step 5:** commit `feat(impressao): anexos no PDF da evolução`.

---

### Task 7: Fechamento e staging

**Files:**
- Modify: `docs/deploy.md`, `prontuario-medico/README.md`

- [ ] **Step 1:** documentar: bucket criado por migration; limite do Storage free (1 GB ≈ 3 mil fotos comprimidas) e quando migrar para Pro; anexos nunca públicos.
- [ ] **Step 2:** suíte completa: `npx supabase db reset && npm run test:db && npm run test && npm run typecheck && npm run lint && npm run build && npm run test:e2e` → tudo 0.
- [ ] **Step 3:** commit `docs: anexos no guia de deploy`.
- [ ] **Step 4 (controller + usuário):** usuário roda `npx supabase db push` (migrations 0006–0008) no staging; controller faz merge `develop` → `staging` e push; smoke no staging: anexar foto pelo celular, finalizar, ver na galeria, imprimir com imagens.
