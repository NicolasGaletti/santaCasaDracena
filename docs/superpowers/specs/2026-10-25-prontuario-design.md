# Prontuário Santa Casa de Dracena — Design

Data: 2026-10-25
Status: aprovado em 2026-10-25
Protótipo de referência: `~/Downloads/medsystem_pro_v3.html` (MedSystem Pro v3)
Código existente: `prontuario-medico/` (Next.js 16.3, React 19, Tailwind 4, Supabase via `@supabase/ssr`)

## 1. Intenção

Prontuário eletrônico de **internação** para a Santa Casa de Dracena. A equipe multiprofissional registra a evolução diária do paciente internado, principalmente **pelo celular**. O médico da equipe valida o que foi escrito. A evolução finalizada é **impressa e assinada à mão**: na fase 1, o papel assinado é o documento legal, e o sistema é a fonte que gera esse papel e guarda o histórico imutável.

Por que agora: substituir a evolução manuscrita/digitada solta por um registro estruturado, rastreável e que não permite alteração retroativa.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos (v1)**
- Admissão de paciente (cadastro + internação em equipe e leito).
- Lista de internados e de internações anteriores (somente leitura), filtrável por equipe.
- Evolução diária multiprofissional com fluxo de validação médica.
- "Copiar do dia anterior" para a própria categoria profissional.
- Impressão em PDF A4 da evolução finalizada, pelo celular ou pela tela "Imprimir" no computador.
- Alta médica, que encerra a internação e a torna somente leitura.
- Trilha de auditoria de acesso e de alterações.
- Anexos de exames (foto/PDF de laboratório, imagem, ECG) enviados pelo celular e vinculados à evolução.
- Entrega incremental: uma primeira fatia ponta a ponta publicada no Netlify cedo, para teste real por alguns dias.
- Uso confortável em celular (PWA instalável); funcional no desktop.

**Não-objetivos (v1)**
- Assinatura digital ICP-Brasil (fase 2; o modelo de dados já reserva campos).
- Modelos especializados por categoria (balanço hídrico, Braden, Morse, fisio respiratória): fase 2, um por vez.
- Prescrição médica, faturamento/TISS, integração com sistema hospitalar existente, laudos.
- App nativo de loja.
- Uso offline completo (só o rascunho resiste à queda de rede).
- Visualizador DICOM / integração com PACS (tomografia, ressonância em formato original). Anexo de imagem = foto ou PDF do exame/laudo. **Decisão do Claude.**

**Anti-objetivos (falha mesmo que "funcione")**
- Evolução finalizada que possa ser alterada ou apagada por qualquer caminho, incluindo a API direta.
- Impresso com identificação profissional falsa ou padrão (ex.: CRM fictício).
- Evolução meio escrita perdida por queda de Wi-Fi.
- Regra de permissão que exista só na interface.
- Dado clínico persistido no aparelho depois de sincronizado.

## 3. Restrições

- **LGPD (dado sensível de saúde):** base legal de tutela da saúde, registro de acesso, minimização, backups, controle de sessão.
- **Prontuário (CFM 1.638/2002, 1.821/2007; Lei 13.787/2018):** guarda mínima de 20 anos, identificação do profissional com registro em conselho, nenhuma alteração após o registro (correção só por adendo).
- **Hospedagem em nuvem permitida, custo mínimo.** O sistema é independente do hospital (sem TI nem orçamento dele), então o custo precisa ser o menor possível:
  - Desenvolvimento e piloto: **Supabase Free** (`sa-east-1`; staging + produção = os 2 projetos gratuitos) + **Netlify Free** para o Next.js (permite uso comercial, ao contrário do Vercel Hobby). Backup diário próprio: GitHub Action com `pg_dump` criptografado (`age`) enviado ao Cloudflare R2 (camada gratuita). Custo ≈ US$ 0 + domínio (~R$ 40/ano).
  - Produção com dados reais em volume: Supabase **Pro** (~US$ 25/mês): backup gerenciado, sem pausa por inatividade, sem limite de 500 MB. O host do front continua gratuito enquanto couber na camada free.
  - Limites do free a monitorar: 500 MB de banco (evolução em texto ≈ 5 KB → ~100 mil evoluções), 1 GB de Storage e 50 MB por arquivo (fotos comprimidas para ~300 KB → ~3 mil anexos; o Pro dá 100 GB), pausa após 7 dias sem uso, sem SLA. O Netlify Free tem cota mensal de uso; se estourar, o site pausa até o mês seguinte (não cobra).
  - O app não pode depender de nada exclusivo da Vercel (sem região `gru1` fixada, sem Vercel KV/Blob).
- **Celular é o dispositivo principal.** O hospital tem impressora de rede, acessível pelo celular via AirPrint/Mopria.
- Stack já iniciada: Next.js 16 (Middleware agora se chama **Proxy**, `src/proxy.ts`), Supabase Auth com e-mail/senha e SSO Google/Azure já esboçados.

## 4. Abordagens consideradas

| | Abordagem | Trade-off |
|---|---|---|
| **A (escolhida)** | Next.js + Supabase, **regras no banco**: RLS para leitura/escrita e funções Postgres (`security definer`) para as transições de estado. O Next lê com Server Components e muda com Server Actions que chamam essas funções. | Parte da lógica fica em SQL; em troca, nenhum caminho (bug no front, chamada direta à API) contorna as regras legais. Aproveita o que já existe. |
| B | Next.js com backend próprio (Drizzle/Prisma) e Supabase só como Postgres. | Regra toda em TypeScript, mas sem RLS como rede de segurança; um endpoint esquecido vaza dado. Mais código. |
| C | Manter tudo no client falando direto com o Supabase (estado atual). | Travas e validação ficariam só na tela. Inaceitável para prontuário. |

A escolha do A é decisão do Claude, a pedido do usuário ("me sugerir a melhor arquitetura"), sem objeção registrada.

## 5. Decisões tomadas com o usuário

1. **Assinatura:** fase 1 = imprimir e assinar à mão. ICP-Brasil depois, sem retrabalho de schema.
2. **Multiprofissional na v1:** enfermagem, fisioterapia, nutrição, psicologia etc. escrevem evolução.
3. **O médico valida:** evolução de não médico só finaliza após validação de um médico.
4. **Quem valida:** qualquer médico membro da equipe da internação, não só o responsável.
5. **Nuvem permitida; uso principal no celular.**
6. **Impressão:** pelo próprio celular (impressora de rede) e, como alternativa, uma tela "Imprimir" no computador.
7. **Evolução sob demanda:** sem limite nem turno fixo por dia; não há números de volume. Vale para todas as categorias, inclusive enfermagem, sempre com validação médica.
8. **Equipe = especialidade médica** (Cardiologia, Nefrologia…), não ala nem andar. Os profissionais multiprofissionais são membros das equipes.
9. **Quem assina o papel é sempre o médico.** Só o médico dá alta.
10. **Os dados atuais são todos fictícios:** o schema é recriado do zero, sem migração de dados.
11. **Anexos de exames:** laboratório e imagem aceitam arquivos de imagem enviados junto com a evolução, para acompanhamento.
12. **Netlify Free no começo**, com teste real de alguns dias assim que houver uma fatia funcional.
13. **Pedidos do PO (2026-10-25):** equipe responsável no lugar de médico responsável (atendem pacientes de outros médicos); convênio como filtro da lista, junto com a equipe; internos (acadêmicos) atualizam evoluções **sem CRM**, com validação de um médico da equipe e assinatura do médico no papel; botão "Salvar" explícito além do autosave ("Salvar e fechar" = Finalizar). Convênio = filtro da lista e remoção total do médico responsável: confirmados pelo usuário em 2026-10-25.

## 6. Design

### 6.1 Perfis e permissões

Perfil é atributo do usuário (`perfis`), equipe é vínculo (`membros_equipe`, N:N).

| Perfil | Pode |
|---|---|
| `medico` | admitir, evoluir (finaliza direto), validar/devolver evoluções da sua equipe, dar alta, imprimir |
| `residente` | evoluir; a evolução vai para validação |
| `academico` (interno) | evoluir **sem conselho/CRM**; a evolução vai para validação de um médico da equipe |
| `multiprofissional` (com `categoria`: enfermagem, fisioterapia, nutricao, psicologia, fonoaudiologia, servico_social…) | evoluir na própria categoria; vai para validação |
| `recepcao` | cadastrar paciente, admitir e trocar leito; **sem** acesso ao conteúdo das evoluções |
| `auditoria` | leitura de tudo; cada abertura registrada |
| `admin` | gerenciar usuários, perfis, equipes; não edita conteúdo clínico |

Leitura do conteúdo clínico: qualquer perfil clínico lê qualquer internação do hospital (o plantão cobre outras alas). Toda abertura de prontuário gera registro em `acessos`. **Decisão do Claude:** prática comum em hospital pequeno; restringir à equipe é fácil se o hospital exigir.

Escrita de evolução: membros da equipe da internação, mais qualquer `medico` (plantonista). **Decisão do Claude.**

O cadastro do profissional exige `conselho` (CRM, COREN, CREFITO, CRN, CRP…), `numero_conselho` e `uf_conselho`. Sem esses dados, o usuário não consegue enviar nem finalizar evolução. Fim do fallback `'CRM/SP 123456'`.

### 6.2 Modelo de dados (Postgres)

```
profissionais   (id = auth.users.id, nome, perfil, categoria, conselho, numero_conselho, uf_conselho, ativo)
equipes         (id, nome, ativo)
membros_equipe  (profissional_id, equipe_id)
pacientes       (id, nome, data_nascimento, cpf?, cns?, nome_mae?, convenio, criado_em)
internacoes     (id, paciente_id, equipe_id, medico_responsavel_id, leito_ala, diagnostico_inicial,
                 comorbidades, muc, status: INTERNADO|ALTA, admitido_em, alta_em, motivo_alta, alta_por)
evolucoes       (id, internacao_id, categoria, autor_id, status, dados jsonb, texto_livre,
                 criado_em, atualizado_em, enviada_em, validada_por, validada_em,
                 devolvida_motivo, finalizada_em,
                 snapshot_autor jsonb, snapshot_validador jsonb,   -- nome/conselho congelados no momento
                 conteudo_hash text, assinatura_digital bytea?,    -- reservado ICP-Brasil (fase 2)
                 adendo_de uuid? references evolucoes)
impressoes      (id, evolucao_id, impresso_por, impresso_em, via int)
acessos         (id, profissional_id, internacao_id, acao, em, ip, user_agent)
auditoria       (id, tabela, registro_id, operacao, antes jsonb, depois jsonb, por, em)  -- via trigger
leitos_historico(internacao_id, leito_ala, de, ate, por)
anexos         (id, internacao_id, evolucao_id, tipo: LABORATORIO|IMAGEM|ECG|OUTRO, descricao,
                 data_exame, storage_path, mime, tamanho_bytes, sha256, enviado_por, enviado_em)
```

`dados jsonb` guarda os campos estruturados da categoria. O formulário médico do protótipo (diagnósticos, ECG, imagem, laboratório, PA/FC/FR/Temp/SatO2/Dextro/Diurese, exame físico por sistema, conduta) é um modelo; o modelo simples das demais categorias (texto livre + sinais vitais opcionais + plano) é outro. Os modelos são definidos em código (schemas zod versionados, `modelo_versao` dentro de `dados`), não em tabela. **Decisão do Claude:** mais simples que um editor de formulários e suficiente para crescer categoria por categoria.

Idade é calculada na leitura, nunca gravada.

### 6.3 Fluxo da evolução

```
RASCUNHO ──enviar──► AGUARDANDO_VALIDACAO ──validar──► FINALIZADA
   ▲                         │
   └──────devolver(motivo)───┘
RASCUNHO ──finalizar (autor médico)──► FINALIZADA
```

- Só o autor edita o próprio `RASCUNHO`; o rascunho é **atualizado** (upsert), nunca duplicado. Regra: no máximo um rascunho aberto por (autor, internação), por índice único parcial. Finalizadas não têm limite por dia (evolução sob demanda).
- "Status de hoje" na lista = existe evolução médica finalizada hoje / pendente de validação / nenhuma.
- "Copiar a anterior" copia a última evolução finalizada da mesma categoria naquela internação, não necessariamente a de ontem.
- Transições só por funções Postgres: `enviar_evolucao`, `validar_evolucao`, `devolver_evolucao`, `finalizar_evolucao`, `dar_alta`, `admitir_paciente`, `trocar_leito`. Cada uma checa perfil, vínculo de equipe, estado atual e internação `INTERNADO`, exceto o adendo (ver abaixo).
- Ao finalizar: congela `snapshot_autor`/`snapshot_validador`, grava `finalizada_em = now()` (relógio do servidor) e calcula `conteudo_hash` (SHA-256 do conteúdo canônico).
- Um trigger bloqueia `UPDATE`/`DELETE` em evolução `FINALIZADA` e em qualquer evolução de internação com `ALTA` (exceto adendo ainda não finalizado), para todos os papéis, inclusive chamadas com a service key fora de migration. Correção = nova evolução com `adendo_de`, permitida também depois da alta (correção tardia é comum e legal): o adendo passa pelo mesmo fluxo de validação, e a evolução original nunca muda. **Decisão do Claude.**
- Rascunho abandonado continua visível só para o autor. A internação mostra o contador "rascunhos pendentes" na alta. **Decisão do Claude:** a alta é permitida com rascunhos pendentes; eles ficam congelados como rascunho, sem valor de registro.
- Validação: tela "Pendentes de validação" para o médico, filtrada pelas equipes dele, com contador no topo. O médico lê, valida ou devolve com motivo. O validador não edita o texto do autor.

### 6.4 Impressão

- Rota `GET /evolucoes/[id]/pdf` (Route Handler, runtime Node) gera PDF A4 com `@react-pdf/renderer`. Só para `FINALIZADA`.
- Conteúdo: cabeçalho da Santa Casa, paciente (nome, nascimento, idade, leito, convênio), equipe e médico responsável, data/hora da evolução, corpo, "Registrado por: nome – conselho nº/UF" (quando o autor não é médico), "Validado por Dr. X – CRM nº/UF em dd/mm hh:mm", **um único campo de assinatura e carimbo, do médico** (o validador, ou o autor quando ele é médico), código curto da evolução e hash, "Página x de y".
- Cada geração grava em `impressoes`; da segunda em diante o PDF traz "2ª via", "3ª via"…
- Celular: abre o PDF e o sistema operacional imprime (AirPrint/Mopria).
- Tela `/imprimir` (desktop): finalizadas ainda não impressas, filtráveis por equipe, médico validador e dia (o médico imprime as que vai assinar); botão por linha e "imprimir selecionadas" (um PDF com várias evoluções).
- Também imprimível: folha de alta (fase 1, conteúdo simples: diagnóstico, motivo, data).

### 6.4.1 Anexos de exames

- Upload pela câmera ou pela galeria do celular (`<input type="file" accept="image/*,application/pdf" capture>`), dentro do formulário da evolução, aba Exames (Laboratório | Imagem | ECG).
- Imagem comprimida no aparelho antes do envio (lado maior ≤ 2000 px, JPEG ~80%), PDF enviado como está, limite de 20 MB por arquivo.
- Bucket **privado** do Supabase Storage, caminho `internacoes/{internacao_id}/{anexo_id}`. Políticas de Storage espelham o RLS das evoluções. A visualização usa URL assinada de curta duração (~5 min), nunca link público.
- O anexo pertence à evolução: enquanto ela é rascunho, o autor adiciona e remove. Depois de `FINALIZADA`, o anexo fica imutável (sem delete, nem no Storage), e o `sha256` entra no `conteudo_hash` da evolução.
- A linha do tempo da internação ganha a galeria de exames, filtrável por tipo e data, para acompanhar a evolução dos resultados lado a lado.
- No PDF impresso: lista dos anexos (tipo, data, descrição) com miniatura; a imagem em página inteira é opcional, na hora de imprimir.
- A foto tirada pelo app não fica salva na galeria do aparelho (captura direta) e não entra no cache do service worker.

### 6.5 Front-end

- **App Router com Server Components** para listas e prontuário; **Server Actions** chamam as funções Postgres. Formulários com zod + `useActionState`. Tipos gerados por `supabase gen types`.
- Três clientes Supabase: `lib/supabase/server.ts` (cookies), `lib/supabase/client.ts` (browser, só para o autosave), `src/proxy.ts` (renova a sessão e redireciona quem não está logado; a autorização de verdade é RLS).
- **Mobile-first:** lista de internados em cartões (nome, D.N./idade, leito, equipe, status de hoje); prontuário em abas (Evoluções | Nova | Dados); formulário em seções recolhíveis, `inputMode="decimal"` nos sinais vitais, botão de ação fixo no rodapé. Desktop: duas colunas, como no protótipo.
- **Autosave do rascunho:** debounce de ~3 s para o servidor; cópia em IndexedDB enquanto não sincroniza (rede caiu); apagada ao confirmar o salvamento. Indicador "salvo às hh:mm / sem conexão".
- **PWA:** `app/manifest.ts`, ícones, service worker mínimo (Serwist) só para o shell e a página offline. Nada clínico em cache.
- Componentes: Tailwind 4 + shadcn/ui (Radix) para diálogo, abas, select e toast, substituindo `alert()`. Ícones `lucide-react` (já instalado).
- Rotas: `/login`, `/` (internados), `/anteriores`, `/internacoes/[id]`, `/internacoes/[id]/evolucoes/nova`, `/evolucoes/[id]`, `/validacao`, `/imprimir`, `/admin/*`.

### 6.6 Autenticação e sessão

- E-mail/senha via Supabase Auth; SSO Google/Azure só se o hospital usar Google Workspace/Microsoft 365 (o esboço atual fica desligado até confirmar). Cadastro público desligado; usuários são convidados pelo admin.
- MFA (TOTP) obrigatório para `medico`, `admin` e `auditoria`; opcional para os demais. **Decisão do Claude.**
- Sessão expira após 30 min de inatividade no app; o refresh token tem vida limitada. O admin pode revogar as sessões de um usuário (aparelho perdido) e desativar a conta.

### 6.6.1 Administração (perfil `admin`)

- **Equipes:** criar, renomear, desativar (nunca apagar: as internações antigas apontam para elas).
- **Profissionais:** convidar por e-mail (nome, **função escolhida pelo admin numa lista**: médico, residente, enfermagem, fisioterapia, nutrição, psicologia, fonoaudiologia, serviço social, recepção, auditoria, admin; conselho, número, UF — o conselho sugerido muda conforme a função), editar, desativar (bloqueia o login e derruba as sessões), reenviar convite. O profissional define a própria senha pelo link do convite.
- **Vínculos:** adicionar e remover profissionais de cada equipe (N:N), com a tela por equipe e por profissional.
- O convite e a desativação usam a Admin API do Supabase, que exige `service_role`. Essa chave fica só numa **Edge Function do Supabase** (`admin-usuarios`), que confere se quem chamou tem perfil `admin`. A chave nunca vai para o Netlify nem para o navegador.
- Toda ação de admin entra em `auditoria`. O admin não lê nem edita conteúdo clínico.
- Primeiro admin: criado uma vez por script/SQL no painel do Supabase.

### 6.7 Segurança e conformidade

- RLS habilitado em **todas** as tabelas; nenhuma permissão `anon`. `service_role` só em migrations/scripts administrativos, nunca no host do front (Netlify).
- Triggers de auditoria em `pacientes`, `internacoes`, `evolucoes`, `profissionais`, `membros_equipe`.
- Headers: CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- Segredos: `.env*` fora do git (já está). **`passDB` na raiz do repositório precisa sair do diretório e a senha do banco deve ser trocada** se houver risco de ter vazado.
- Backups: diário (Pro) + PITR quando houver dados reais; teste de restauração antes do go-live. Exportação anual da base para guarda de longo prazo.
- Documento simples de LGPD para o hospital: finalidade, quem acessa, retenção, operadores (Supabase, Netlify, Cloudflare R2) e região.

### 6.8 Repositório, qualidade e deploy

- Mantém a estrutura atual: `santaCasaDracena/` (raiz git) com o app em `prontuario-medico/`. Migrations em `prontuario-medico/supabase/migrations` (Supabase CLI), com seed de desenvolvimento.
- Ambientes: local (Supabase CLI em Docker), **staging** (projeto Supabase separado + deploy preview do Netlify) e **produção**.
- Testes: pgTAP para RLS e transições (o núcleo legal: quem pode validar, trava após finalizar, trava após alta); Vitest para schemas e helpers; Playwright para o fluxo principal em viewport de celular (admitir, evoluir, enviar, validar, imprimir, dar alta).
- CI (GitHub Actions): lint, typecheck, testes, `supabase db lint`; a migration é aplicada em staging no merge, e em produção manualmente.
- Observabilidade: Sentry (sem dado clínico no payload), logs do Netlify, alertas de erro.
- Antes de entrar o primeiro paciente real: ativar Supabase Pro (backup gerenciado) e fazer um teste de restauração. **Decisão do Claude**, revisável por custo (alternativa: manter o free com o backup próprio no R2).
- Go-live: piloto com uma equipe (ex.: Clínica Médica) por 2 semanas, com papel em paralelo, antes de ampliar.

### 6.9 Fases

- **Fase 1 (v1):** tudo da seção 2, "Objetivos". Ordem sugerida para testar cedo: (1) fundação + login + deploy no Netlify; (2) admissão e lista de internados; (3) evolução médica com autosave e finalização; (4) PDF; (5) anexos; (6) multiprofissional + validação; (7) alta, auditoria, admin, PWA.
- **Fase 2:** ICP-Brasil (A3/nuvem, ex. BirdID/VIDaaS) usando `conteudo_hash`/`assinatura_digital`; modelos especializados por categoria; notificações push de pendências; relatórios (censo diário, tempo médio de internação).

## 7. O que fica para o implementador

- Layout exato do PDF, além dos campos listados (validar com o hospital usando um impresso de exemplo).
- Nomes finais de componentes e organização interna de pastas.
- Lista definitiva de categorias multiprofissionais e de convênios (seed editável pelo admin).
- Estratégia de migração do `page.tsx` atual: reescrever por rotas; o arquivo atual serve só de referência.
- Esquema atual no Supabase (`equipes`, `pacientes`, `internacoes`, `evolucoes`, `vw_pacientes_internados`): os dados são fictícios; a migration nova substitui tudo (o banco pode ser zerado).
