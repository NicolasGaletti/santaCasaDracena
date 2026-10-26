# Plano 5 — Redesign visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todas as telas com a identidade do protótipo aprovado (cabeçalho escuro, barra de ações compacta, ficha visível com histórico em abas embaixo), convênio escolhido de uma lista mantida pelo admin e anexos ligados aos campos ECG/Imagem/Laboratório.

**Architecture:** Primeiro a base visual (tokens, fontes, componentes de layout reutilizáveis); depois cada tela migra usando essas peças. Uma migration nova (`0018_convenios`) para a lista de convênios. Nenhuma outra regra de negócio muda.

**Tech Stack:** Planos 1–4 (Next.js 16, Tailwind 4, shadcn/ui, `lucide-react`, Supabase) + `next/font` com Inter e Poppins.

**Spec:** `docs/superpowers/specs/2026-10-26-redesign-visual-design.md` (aprovado; inclui "Respostas à verificação do builder"). Protótipos: `docs/superpowers/specs/mockups/2026-10-26-prontuario.html`, `docs/superpowers/specs/mockups/2026-10-26-admissao.html`. Protótipo original (local, não versionar): `~/Downloads/medsystem_pro_v3.html`. Spec base: `docs/superpowers/specs/2026-10-25-prontuario-design.md`.

## Global Constraints

- Todos os dos planos anteriores. Migrations 0001–0017 imutáveis (aplicadas no staging); nova: `supabase/migrations/20261026000018_convenios.sql`, teste `supabase/tests/018_convenios.test.sql`.
- Paleta (spec "Base visual"): fundo `slate-50`; texto `slate-900/700/500`; bordas `slate-200/300`; primária `teal-600` (hover `teal-700`, suave `teal-50` + borda `teal-200`); cabeçalho `slate-900`; alta `rose-50`/`rose-700`/borda `rose-200`; rascunho `amber-50/800`; finalizada `emerald-100/800`; ECG `rose-700`, Imagem `sky-700`, Laboratório `emerald-700`; conduta `orange-800`. Valores entram nos tokens CSS de `src/app/globals.css`, não espalhados como classes literais quando houver token equivalente. Contraste AA.
- Fontes: Inter (texto) e Poppins (títulos) via `next/font/google` (self-host; CSP `font-src 'self'` continua). Atkinson Hyperlegible sai.
- Rótulo de campo: 11px, peso 700, caixa alta, `slate-700`. Campo: fundo `slate-50`, borda `slate-300`, raio 8px; **16px abaixo de `sm`**, 14px a partir de `sm`.
- Celular: alvo de toque ≥ 44px em TODOS os botões, pílulas e chips (pequeno = só visual); sem rolagem horizontal da página em 360px; rodapé fixo respeita `env(safe-area-inset-bottom)`.
- Sem script/CDN externo (CSP com nonce); nada novo no cache do service worker.
- Comportamento existente intacto: autosave, envio pendente, confirmação de saída com rascunho não sincronizado, regras de botões por perfil/estado, fluxo legal, PDFs.
- Textos pt-BR. Manter rótulos/textos usados pelos e2e quando fizer sentido; onde a estrutura muda, ajustar os e2e sem enfraquecer o que verificam. **Cada task termina com `npm run test:e2e` verde (serial) e, se tocou PWA/headers, `npm run test:e2e:pwa`.**
- Cada task de tela entrega prints 390×844 e 1280×800 das telas tocadas em `/private/tmp/claude-501/-Users-nicolasgaletti-Dev-santaCasaDracena/088aeac4-e6c9-4c4e-9ab7-1362b46bf0c2/scratchpad/plano5/task-<N>-*.png` (não versionar; sem código de print nos testes).
- Anexos: envio novo só como `ECG`, `IMAGEM` ou `LABORATORIO`, com o tipo vindo do campo; `OUTRO` continua no enum e é exibido (anexos antigos), nunca oferecido.

## Review Focus

1. **Tela de 360px com textos longos** (evolução de 2000 caracteres, nome de paciente longo, leito "Enfermaria Clínica B · 12"): nada vaza nem cria rolagem horizontal; cabeçalho trunca com reticências. Teste: Task 2 e Task 5 (e2e em viewport 360×740 verifica `scrollWidth <= clientWidth` no `document.documentElement`).
2. **Convênio desativado entre abrir a admissão e enviar:** mensagem clara `Escolha um convênio da lista.`, formulário mantém os dados digitados. Teste: Task 3 (pgTAP) + Task 4 (e2e).
3. **Rascunho com anexo antigo tipo `OUTRO`:** aparece no cartão da evolução e pode ser removido enquanto rascunho. Teste: Task 1b.
4. **Teclado e foco:** chips de equipe, abas do histórico e barra de ações operáveis por teclado (setas/Tab + Enter/Espaço) com foco visível; diálogos (alta, anexar) prendem o foco. Teste: Task 2 e Task 4 (e2e com `keyboard.press`).
5. **Notificação/link antigo para `/internacoes/<id>/evolucao?…`:** cai na ficha dentro do prontuário com a query preservada (adendo continua funcionando). Teste: Task 2.

---

### Task 1: Base visual e casca do app

**Files:** Modify `src/app/globals.css` (tokens), `src/app/layout.tsx` (fontes), `src/components/app-shell.tsx`, `src/components/navegacao-ativa.tsx`, `src/components/ui/{button,input,textarea,select,badge,card,tabs}.tsx` (variantes no novo estilo); Create `src/components/layout/{cartao-secao,barra-acoes,abas-coloridas,rodape-acoes,chips-selecao,rotulo-campo}.tsx` + `*.test.tsx`.

**Interfaces (Produces):**
- `CartaoSecao({ titulo, icone?, subtitulo?, acao?, rodape?, tom?: 'padrao'|'teal', children })` — cartão branco, título Poppins com ícone.
- `BarraAcoes({ status?: ReactNode, children })` — linha compacta; no celular rola na horizontal sem barra de rolagem.
- `PilulaStatus({ tipo: 'rascunho'|'aguardando'|'finalizada'|'alta'|'devolvida', children })`.
- `AbasColoridas({ abas: { valor: string; rotulo: string; icone: LucideIcon; cor: 'teal'|'rose'|'sky'|'emerald' }[]; valor; onValorChange; children })` — Radix Tabs por baixo (teclado de graça).
- `RodapeAcoes({ children, info? })` — fixo no celular (abaixo de `sm`), estático no computador; aplica padding inferior ao conteúdo.
- `ChipsSelecao<T extends string>({ nome, opcoes: { valor: T; rotulo: string }[]; valor; onChange; rotulo })` — `role="radiogroup"`, setas movem a seleção.
- `RotuloCampo` — o rótulo 11px caixa alta associado ao campo.
- Botão: variantes `primaria` (teal), `escura` (slate-900), `alta` (rose suave), `suave` (slate-200), `contorno-teal`; tamanho `compacto` (texto 13px, `min-h-11` abaixo de `sm`, `h-9` a partir de `sm`).

- [ ] Steps: Vitest (`ChipsSelecao` move seleção com seta direita e marca `aria-checked`; `AbasColoridas` troca painel ao clicar e com teclado; `RodapeAcoes` renderiza `info` e filhos) → FAIL → implementar (carregar a skill `frontend-design`; seguir os protótipos) → PASS → trocar fontes/tokens e restilizar a casca (cabeçalho do app escuro com nome/perfil, sino, conta, Sair; abas de navegação no estilo pílula teal) → e2e completo verde + `test:e2e:pwa` (CSP/fontes) → prints da lista de internados (só a casca muda aqui) → commit `feat(ui): base visual do protótipo e casca do app`.

---

### Task 1b: Ficha de evolução no novo estilo e anexos por campo

**Files:** Modify `src/features/evolucao/{form-medica,form-simples,campo-textual,campos-sinais,campo-leito,rodape-evolucao}.tsx`, `src/features/anexos/anexos-evolucao.tsx` (vira painel por campo), `src/features/anexos/rotulos.ts` (lista de tipos oferecidos), `e2e/{evolucao,anexos,impressao,sessao}.spec.ts` (ajustes); Create `src/features/anexos/anexos-do-campo.tsx`.

**Interfaces:**
- Consumes: Task 1 (`CartaoSecao`, `RotuloCampo`, `RodapeAcoes`, botões).
- Produces: `TIPOS_ANEXO_OFERECIDOS = ['ECG','IMAGEM','LABORATORIO'] as const` em `rotulos.ts`; `AnexosDoCampo({ tipo: 'ECG'|'IMAGEM'|'LABORATORIO', estado: EstadoAnexos })` — chips dos anexos daquele tipo + "Anexar" (abre o diálogo existente sem escolha de tipo; tipo vem da prop). `useAnexosEvolucao` mantém a API (`enviar(arquivo, { tipo, descricao, dataExame })`). Anexos `OUTRO` (legado) aparecem numa linha "Outros anexos" abaixo dos campos, só com Abrir/Remover. `FormMedica`/`FormSimples` mantêm props e comportamento (autosave, avisos, confirmações).
- Layout da ficha médica (spec "Prontuário"): Diagnóstico(s)/Comorbidades/MUC 3 colunas; Evolução clínica; ECG/Imagem/Laboratório 3 colunas com ícones `heart-pulse`/`scan-line`/`flask-conical` nas cores do token, cada um com `AnexosDoCampo` embaixo; sinais vitais 7 em linha (`sm+`) e grade de 4 (celular); exame físico 2 colunas já com o texto padrão do modelo médico; Conduta. **Sem `Accordion`** (remover o uso; o componente `accordion.tsx` pode ficar se outra tela usar). Ficha simples: mesmos estilos; um "Anexar" com escolha entre ECG/Imagem/Laboratório.

- [ ] Steps: e2e que falha (`ficha médica mostra todos os campos sem abrir seções`; `anexo pelo campo Laboratório sai como LABORATORIO e aparece sob o campo`; `ECG aceita anexo`; `rascunho com anexo OUTRO antigo mostra "Outros anexos" e permite remover` — inserir a linha OUTRO via `sqlLocal` como os specs atuais fazem) → FAIL → implementar → ajustar e2e antigos que abriam seções → e2e completo verde → prints da ficha (celular e computador) → commit `feat(evolucao): ficha no estilo do protótipo e anexos por campo`.

---

### Task 2: Prontuário em uma página (cabeçalho, barra de ações, ficha, histórico em abas)

**Files:** Modify `src/app/(app)/internacoes/[id]/page.tsx`, `src/app/(app)/internacoes/[id]/evolucao/page.tsx` (vira redirect), `src/features/internacoes/cabecalho-paciente.tsx`, `src/features/evolucao/{timeline,cartao-evolucao,botao-adendo,botao-imprimir,original-adendo}.tsx`, `src/features/anexos/galeria-exames.tsx`, `src/features/alta/dialog-alta.tsx` (gatilho compacto); Create `src/features/evolucao/historico-abas.tsx`; e2e: `adendo`, `alta`, `validacao`, `notificacoes`, `evolucao`, `anexos` (ajustes) + novos casos abaixo.

**Interfaces:**
- Consumes: Task 1 (`BarraAcoes`, `PilulaStatus`, `AbasColoridas`, botões), Task 1b (`FormMedica`/`FormSimples`, `AnexosDoCampo`).
- Produces: `CabecalhoPaciente({ linha, diasInternado })` escuro (avatar iniciais, nome Poppins com `truncate`, metadados com ícones; chips no celular). `HistoricoAbas({ evolucoes, anexos })` com abas `Evoluções` / `ECG` / `Imagem` / `Laboratório`: Evoluções = cartões (borda esquerda teal, data/hora, `PilulaStatus`, diagnóstico/comorbidades/lab resumidos, evolução, conduta, autor, ações Imprimir/Adendo no rodapé do cartão, anexos `OUTRO` legados no cartão); ECG/Imagem/Lab = texto do campo por evolução finalizada + anexos daquele tipo (galeria existente).
- Página (ordem): `CabecalhoPaciente` → `BarraAcoes` (status do dia; Imprimir evolução; `Dar alta` compacto rose com a MESMA regra `podeDarAlta`; `Folha de alta (PDF)` e aviso de alta quando `ALTA`) → ficha inline com `id="ficha"` quando o usuário pode evoluir/continuar rascunho/adendo (inclui aviso de devolvida com "Devolvida por") → `HistoricoAbas`. Botões "Nova evolução"/"Continuar rascunho" de largura total deixam de existir: a ficha já está na página (no computador e no celular).
- `/internacoes/[id]/evolucao?<q>` → `redirect('/internacoes/[id]?<q>#ficha')` preservando a query.

- [ ] Steps: e2e que falha (`prontuário mostra cabeçalho, barra de ações, ficha e histórico na mesma página`; `abas do histórico: ECG mostra o ECG do dia e anexos ECG`; `abas operáveis por teclado` (foco na aba, `ArrowRight`, `Enter`); `link antigo /evolucao?adendo=… abre a ficha de adendo no prontuário`; `360px sem rolagem horizontal com nome e evolução longos` (viewport 360×740, `scrollWidth <= clientWidth`); `Dar alta continua só para médico da equipe` (regressão)) → FAIL → implementar → ajustar e2e antigos de navegação → e2e completo verde → prints (internado com rascunho, aguardando, alta; celular e computador) → commit `feat(prontuario): página única no estilo do protótipo`.

---

### Task 3: Convênios no banco

**Files:** Create `supabase/migrations/20261026000018_convenios.sql`, `supabase/tests/018_convenios.test.sql`; Modify `src/lib/supabase/database.types.ts` (gerado).

**Interfaces (Produces):**
- Tabela `public.convenios (id uuid pk default gen_random_uuid(), nome text not null, ativo boolean not null default true, criado_em timestamptz not null default now())`; `create unique index convenios_nome_unico on public.convenios (lower(btrim(nome)))`; trigger `auditar_convenios` como as demais; RLS: SELECT `using (app.profissional_ativo())`; sem INSERT/UPDATE/DELETE para clientes.
- `admin_salvar_convenio(p_id uuid, p_nome text, p_ativo boolean) returns uuid` — `perform app.exige_admin();` primeiro; cria se `p_id` null; nome 1–100 após `btrim`; duplicado (case-insensitive) → P0001 `Já existe um convênio com esse nome.`; security definer, `search_path=''`, revoke public/anon + grant authenticated.
- `vw_convenios_ordenados` (security_invoker): convênios ativos com `usos` = contagem em `pacientes.convenio` (comparação `lower(btrim)`), ordem `usos desc, nome`.
- Seed na migration: `SUS`, `Particular` + valores distintos de `pacientes.convenio` (normalizados por `btrim`, dedup sem caixa).
- `admitir_paciente` recriado copiando a definição de 0017 (inclui notificações) + recusa quando `p_convenio` não corresponde (case-insensitive, `btrim`) a um convênio **ativo**: P0001 `Escolha um convênio da lista.` Grava o nome canônico da lista em `pacientes.convenio`.

- [ ] Steps: pgTAP que falha (`seed contém SUS e Particular`; `valores existentes viraram convênios`; `admin aal2 cria e renomeia`; `admin aal1 não cria`; `médico não cria`; `duplicado com outra caixa falha`; `admitir com convênio inativo falha com a mensagem`; `admitir grava nome canônico`; `recepção lê convênios ativos`; `ação do admin vai para auditoria`) → FAIL → migration → PASS (`npx supabase db reset && npm run test:db`) → `npm run db:types` + `npx oxfmt src/lib/supabase/database.types.ts` → typecheck → commit `feat(db): lista de convênios`.

---

### Task 4: Admissão e tela de convênios do admin

**Files:** Modify `src/features/internacoes/form-admissao.tsx`, `src/app/(app)/internacoes/nova/page.tsx`, `src/features/internacoes/actions.ts`, `src/features/admin/subnav-admin.tsx`; Create `src/app/(app)/admin/convenios/page.tsx`, `src/features/admin/lista-convenios.tsx`, `src/features/internacoes/campo-convenio.tsx`, `e2e/convenios.spec.ts`; Modify `e2e/admissao.spec.ts` (+ helpers que admitem pacientes).

**Interfaces:**
- Consumes: Task 1 (`CartaoSecao`, `ChipsSelecao`, `RodapeAcoes`), Task 3 (`vw_convenios_ordenados`, `admin_salvar_convenio`, mensagem `Escolha um convênio da lista.`).
- Produces: admissão em 3 cartões (Paciente / Internação / Quadro inicial "opcional, visível só para a equipe clínica"), grade com `items-start`; **idade**: sem texto de aviso; com data válida mostra `68 anos` ao lado do rótulo/campo sem empurrar vizinhos; equipe por `ChipsSelecao`; `CampoConvenio` = select nativo estilizado (melhor no celular) com as opções da view na ordem dela; erro do banco aparece no campo e os dados digitados permanecem. Admin `/admin/convenios`: lista (nome, usos, Ativo/Desativado), criar, renomear, ativar/desativar (mesmo padrão de Equipes; ações via `admin_salvar_convenio`); aba "Convênios" na subnav admin.

- [ ] Steps: e2e que falha (`admissão oferece só convênios ativos da lista, mais usados primeiro`; `idade aparece ao preencher a data, sem texto de aviso`; `convênio desativado depois de abrir a tela → "Escolha um convênio da lista." e dados mantidos`; `chips de equipe por teclado`; `admin cria, renomeia e desativa convênio`; `recepção não acessa /admin/convenios`) → FAIL → implementar (skill `frontend-design`; seguir `mockups/2026-10-26-admissao.html`) → e2e completo verde → prints (admissão celular/computador, admin convênios) → commit `feat(admissao): novo visual e convênio da lista`.

---

### Task 5: Internados e Anteriores

**Files:** Modify `src/app/(app)/page.tsx`, `src/app/(app)/anteriores/page.tsx`, `src/features/internacoes/{lista-internacoes,cartao-internacao}.tsx`; e2e ajustes onde necessário.

**Interfaces:** Consumes Task 1. Cartões no estilo do protótipo: leito em destaque, nome Poppins, D.N./idade, equipe · convênio, status do dia em `PilulaStatus`; filtros de equipe/convênio em chips roláveis; botão "Admitir paciente" compacto teal (largura total só no celular se for a ação principal da tela — manter `min-h-11`); Anteriores mostra data e tipo da alta.

- [ ] Steps: e2e que falha (`360px sem rolagem horizontal com leito e nome longos`; filtros continuam funcionando) → FAIL → implementar → e2e completo verde → prints → commit `feat(internados): lista no estilo do protótipo`.

---

### Task 6: Validar, Imprimir e Notificações

**Files:** Modify `src/app/(app)/{validacao,imprimir,notificacoes}/page.tsx`, `src/features/validacao/{lista-pendentes,revisao-evolucao}.tsx`, `src/features/impressao/fila-impressao.tsx`, `src/features/notificacoes/{lista-notificacoes,sino}.tsx`.

**Interfaces:** Consumes Task 1 e o cartão de evolução de Task 2 (reusar o mesmo componente de cartão do histórico para a revisão de validação e a fila de impressão). Nenhuma mudança de comportamento (devolver com motivo, validar, imprimir selecionadas, marcar lidas).

- [ ] Steps: e2e existentes (validação, impressão, notificações) continuam verdes após a troca de visual — ajustar só seletores estruturais → prints → commit `feat(ui): validar, imprimir e notificações no novo visual`.

---

### Task 7: Admin, Auditoria, Conta, MFA, login e páginas públicas

**Files:** Modify `src/app/(app)/admin/{layout,profissionais/page,equipes/page}.tsx`, `src/features/admin/*`, `src/app/(app)/auditoria/page.tsx`, `src/features/auditoria/painel-auditoria.tsx`, `src/app/(app)/conta/*`, `src/features/notificacoes/{preferencias,ativar-push,subnav-conta}.tsx`, `src/app/mfa/*`, `src/features/mfa/*`, `src/app/login/page.tsx`, `src/app/esqueci-senha/page.tsx`, `src/app/definir-senha/*`, `src/app/offline/page.tsx`, `src/app/not-found.tsx`.

**Interfaces:** Consumes Task 1. Login/esqueci/definir/MFA: cartão central com marca do app (nome "Prontuário Santa Casa" em Poppins, ícone), fundo `slate-50`; `/offline` continua estática e sem script inline novo (CSP estática da Task 11 do Plano 4).

- [ ] Steps: e2e existentes verdes + `npm run test:e2e:pwa` verde → prints de cada tela → commit `feat(ui): demais telas no novo visual`.

---

### Task 8: Revisão visual final

**Files:** ajustes pontuais em qualquer tela tocada; `docs/superpowers/HANDOFF.md`.

- [ ] Steps: varrer todas as rotas em 390×844, 360×740 e 1280×800 (script Playwright temporário fora do repo ou no scratchpad) procurando: rolagem horizontal, texto cortado, alvo < 44px no celular, foco invisível, restos do visual antigo (Atkinson, accordion, botões de largura total fora do rodapé) → corrigir → `npm run test:e2e` + `npm run test:e2e:pwa` + vitest + typecheck + lint + build + `test:db` (após reset) → prints finais de todas as telas → atualizar HANDOFF (estado e migration 0018 pendente de `db push`) → commit `chore(ui): revisão visual final`.
