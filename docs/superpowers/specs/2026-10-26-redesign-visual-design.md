# Redesign visual do prontuário (Plano 5) — design

Data: 2026-10-26. Spec base: `2026-10-25-prontuario-design.md` (continua valendo; este documento só muda visual/layout e acrescenta a lista de convênios).
Protótipos aprovados pelo usuário (abrir no navegador): `mockups/2026-10-26-prontuario.html`, `mockups/2026-10-26-admissao.html`. Referência original: `~/Downloads/medsystem_pro_v3.html` (MedSystem Pro v3).

## Intenção

O usuário achou o visual atual pior que o protótipo original: campos grandes e escondidos em seções recolhidas, botões de ação de largura total empilhados no celular, histórico separado da ficha, visual neutro sem identidade. O spec base já pedia "Desktop: duas colunas, como no protótipo", e isso não foi feito. Objetivo: o sistema inteiro com a cara do protótipo aprovado, sem perder o uso confortável no celular, que segue sendo o dispositivo principal.

## Objetivos

1. Identidade visual do protótipo em **todas** as telas: login, internados, Anteriores, prontuário, evolução, Validar, Imprimir, notificações, Conta/Segurança/Notificações, MFA, definir/esqueci senha, Admin (profissionais, equipes, convênios), Auditoria, offline.
2. Prontuário como no protótipo: cabeçalho escuro do paciente; barra de ações compacta; ficha de evolução toda visível (2–3 colunas no computador, empilhada no celular); histórico logo abaixo com abas Evoluções / ECG / Imagem / Laboratório.
3. Admissão como no protótipo: seções Paciente / Internação / Quadro inicial; campos alinhados pelo topo; equipe escolhida por botões; convênio escolhido de uma lista.
4. Lista de convênios mantida pelo admin (opção A escolhida pelo usuário): só os convênios que a Santa Casa atende.
5. Idade calculada a partir da data de nascimento sem texto de aviso: aparece ao lado do campo quando a data existe; vazio → nada.

## Não objetivos

- CID-10 e SIGTAP (analisados; adiados — CID-10 será um plano próprio quando o usuário pedir).
- Mudar regras de negócio além das duas pedidas pelo usuário (lista de convênios; anexo só em Imagem e Laboratório), fluxo legal (enviar/validar/devolver/finalizar/adendo/alta), RLS, PDFs (folha de evolução e de alta continuam iguais).
- Modo escuro do sistema (o protótipo é claro; tokens podem ficar prontos, mas não é entregável).

## Antiobjetivos (falharia mesmo "funcionando")

- Celular pior do que hoje: campos com fonte < 16px (iPhone dá zoom), alvos de toque < 44px, Salvar/Finalizar fora do alcance.
- Perder o autosave, o aviso de envio pendente, a confirmação de saída com rascunho não sincronizado ou qualquer comportamento já testado.
- Quebrar a CSP com nonce (nada de script/CDN externo; fontes servidas pelo próprio app) ou o cache do PWA.
- Telas com visual misturado (metade nova, metade antiga) no fim do plano.
- Acessibilidade pior: contraste AA, rótulos associados, `role="alert"/"status"` existentes, navegação por teclado.

## Restrições

- Next.js 16 + Tailwind 4 + shadcn/ui (Radix) + `lucide-react` (já no projeto). Fontes via `next/font` (self-host; CSP `font-src 'self'`). Inter (texto) + Poppins (títulos), como no protótipo; Atkinson Hyperlegible sai.
- Migrations 0001–0017 aplicadas no staging e imutáveis; convênios entram em `20261026000018_convenios.sql`.
- Textos pt-BR. Rótulos e textos visíveis usados pelos e2e devem ser mantidos sempre que fizer sentido; onde a estrutura muda (fim das seções recolhidas), os e2e são ajustados sem enfraquecer o que verificam.
- E2E em série (`workers: 1`), PWA à parte (`npm run test:e2e:pwa`).

## Abordagens consideradas

- **A — Base visual comum, depois tela por tela (escolhida pelo usuário).** Tokens (cores/fontes/raios) + componentes de layout reutilizáveis primeiro; depois cada tela migra usando essas peças. Visual consistente e manutenção num lugar só; a primeira etapa não muda nada visível.
- B — Copiar o protótipo tela por tela, sem peças comuns. Resultado mais cedo, mas telas divergentes (o problema de hoje).
- C — Só trocar cores e fontes. Rápido, mas não resolve layout (campos escondidos, botões gigantes, histórico separado).

## Decisões de design

### Base visual (tokens)
Paleta do protótipo (Tailwind slate/teal): fundo `slate-50`; texto `slate-900/700/500`; bordas `slate-200/300`; primária `teal-600` (hover `teal-700`, suave `teal-50` + borda `teal-200`); cabeçalho `slate-900`; alta/destrutivo suave `rose-50` + `rose-700` + borda `rose-200`; rascunho `amber-50/800`; finalizada `emerald-100/800`. Cores por tipo de exame: ECG `rose-700`, Imagem `sky-700`, Laboratório `emerald-700`; conduta `orange-800`. Atualizar os tokens CSS existentes (`--primary`, `--destructive-soft`, status) para esses valores em vez de espalhar classes literais; manter contraste AA (o laranja `--ring` de foco pode continuar).
Rótulos de campo: 11px, peso 700, caixa alta, `slate-700`. Campos: fundo `slate-50`, borda `slate-300`, raio 8px; 14px no computador e **16px abaixo de `sm`**.

### Componentes de layout (novos, em `src/components/layout/` ou equivalente)
- `CabecalhoPaciente` escuro: avatar com iniciais (teal), nome (Poppins), linha de metadados com ícones (D.N./idade, leito, equipe, convênio, dias internado); compacto no celular (chips).
- `BarraAcoes`: status à esquerda (pílula: rascunho/aguardando/finalizada/alta), botões pequenos à direita; no celular, linha rolável horizontal de pílulas. Substitui todos os botões de largura total da página do prontuário.
- `CartaoSecao`: cartão branco, título com ícone (Poppins, teal-800), subtítulo opcional, rodapé opcional.
- `AbasHistorico`: abas coloridas Evoluções / ECG / Imagem / Laboratório.
- `RodapeAcoes` fixo no celular (Salvar / Finalizar), em linha no rodapé do cartão no computador.
- `Chips` de seleção (equipe, tipo de alta, tipo de anexo) unificados.
- Cabeçalho do app (shell) e navegação no mesmo estilo (fundo escuro ou branco com destaque teal — decisão do builder seguindo o protótipo; manter sino, conta e Sair).

### Prontuário (`/internacoes/[id]`)
Uma página, nesta ordem: cabeçalho do paciente → barra de ações → ficha de evolução (quando o usuário pode evoluir) → histórico com abas.
- A ficha passa a ficar **na própria página do prontuário** (como no protótipo). A rota `/internacoes/[id]/evolucao` continua existindo só para redirecionar à página do prontuário (âncora da ficha), preservando links de notificações e e2e.
- Ficha médica: Diagnóstico(s) / Comorbidades / MUC em 3 colunas; Evolução clínica; ECG / Imagem / Laboratório em 3 colunas com ícones coloridos.
- **Anexos (decisão do usuário):** só os campos **Imagem** e **Laboratório** têm "Anexar" (foto ou PDF), e o tipo do anexo vem do campo (IMAGEM / LABORATORIO) — não há mais escolha de tipo. ECG e Evolução não têm anexo. Os anexos aparecem como chips logo abaixo do seu campo, com o mesmo envio/remoção/retentativa de hoje. Os tipos ECG e OUTRO continuam no enum (anexos antigos seguem aparecendo no histórico), só não são mais oferecidos para envios novos — *decisão do Claude: não mexer no enum do banco evita migration e preserva dados existentes.* Na ficha simples (multiprofissional), o botão de anexo é único e envia como LABORATORIO ou IMAGEM conforme a escolha entre esses dois. sinais vitais numa linha de 7 no computador e grade de 4 no celular; exame físico 2 colunas já preenchido com o texto padrão; Conduta. Nada recolhido. Ficha simples (multiprofissional/acadêmico) segue o mesmo estilo com seus campos.
- Rodapé da ficha: "Médico: <nome> (CRM)", indicador "salvo às hh:mm", Salvar rascunho, Finalizar (ou Enviar para validação, conforme o perfil). Todas as regras atuais de botões/estados continuam.
- Histórico: aba Evoluções = cartões com borda esquerda teal, data/hora, status, diagnóstico/comorbidades/lab resumidos, evolução, conduta, autor; ações existentes (Imprimir, Adendo) no rodapé do cartão. Aba ECG = só o texto do campo ECG por evolução (sem anexos novos; anexos antigos do tipo ECG, se existirem, aparecem ali). Abas Imagem e Laboratório = texto do campo por evolução + anexos daquele tipo (galeria existente reaproveitada).
- Dar alta: botão pequeno rose na barra de ações (mesma regra de visibilidade de hoje); folha de alta e "Internação com alta" também na barra.

### Admissão (`/internacoes/nova`)
Seções em cartões (Paciente / Internação / Quadro inicial "opcional, visível só para a equipe clínica"). Grade com `items-start` (corrige o desalinhamento: hoje a célula do convênio estica por causa do texto de idade). Idade: sem texto de aviso; quando há data, "68 anos" ao lado/abaixo do campo sem empurrar vizinhos. Equipe por chips. Convênio por lista (abaixo). Celular: mesmas seções empilhadas, rodapé fixo Cancelar / Admitir.

### Convênios (novo, decisão A do usuário)
- Tabela `public.convenios (id uuid pk, nome text not null, ativo boolean not null default true, criado_em timestamptz)`, índice único em `lower(btrim(nome))`; auditada (trigger `auditar_` como as demais); RLS: SELECT para `app.profissional_ativo()`; escrita só por funções `admin_salvar_convenio(p_id uuid, p_nome text, p_ativo boolean) returns uuid` (chama `app.exige_admin()`, que já exige aal2).
- Seed da migration: inserir `SUS`, `Particular` e os valores distintos já existentes em `pacientes.convenio` (normalizados por `btrim`, deduplicados sem diferenciar maiúsculas).
- `pacientes.convenio` continua texto (registro histórico do que foi informado); `admitir_paciente` é recriado (copiando a definição mais recente, de 0017) para recusar convênio que não esteja na lista ativa: P0001 `Escolha um convênio da lista.`
- Ordem na lista da admissão: mais usados primeiro (contagem em `pacientes`), depois alfabética; SUS e Particular sempre presentes.
- Tela `/admin/convenios`: listar, criar, renomear, ativar/desativar (mesmo padrão de Equipes).

### Demais telas
Mesma base: internados/Anteriores em cartões no estilo do protótipo (leito em destaque, status do dia em pílula colorida, filtros em chips); Validar e Imprimir com cartões de evolução no estilo do histórico; Admin/Auditoria/Conta/MFA/login com `CartaoSecao`, cabeçalho e botões novos. Nenhuma mudança de comportamento.

## Ordem sugerida
1) Tokens + fontes + componentes de layout + shell. 2) Prontuário + ficha + histórico. 3) Admissão + convênios (migration, admin). 4) Internados/Anteriores. 5) Validar/Imprimir/Notificações. 6) Admin/Auditoria/Conta/MFA/login/offline. 7) Revisão visual de todas as telas em celular e computador (prints), e2e completo.

## Deixado ao builder
Nomes exatos de componentes e arquivos; detalhes de espaçamento; se o shell usa fundo escuro ou claro (seguir o protótipo); como reaproveitar o painel de anexos e a galeria nas abas; texto padrão exato do exame físico (usar o do modelo médico atual, se houver; senão o do protótipo).

## Respostas à verificação do builder (decisões do Claude, salvo indicação)
1. **Convênio histórico:** `pacientes.convenio` é texto histórico; só `admitir_paciente` valida contra a lista ativa. Nada mais é revalidado (cabeçalho, PDFs, Anteriores mostram o texto gravado). Renomear um convênio na lista **não** altera pacientes já admitidos. Sem FK.
2. **Prontuário com a ficha:** a página continua server component carregando os dados; a ficha é o mesmo componente cliente de hoje (`FormMedica`/`FormSimples` com `useRascunhoEvolucao`, `useAnexosEvolucao`, autosave, avisos e confirmação de saída), montado na página quando o usuário pode evoluir. Modo adendo e o aviso de devolvida (com "Devolvida por") também ficam na página. `/internacoes/[id]/evolucao` redireciona para `/internacoes/[id]#ficha` **preservando a query string** (ex.: alvo de adendo).
3. **Abas do histórico:** sem schema novo. Os textos já são campos separados em `dados` da evolução médica (ECG, exames de imagem, laboratório); os anexos têm tipo (LABORATORIO/IMAGEM/ECG/OUTRO). Aba Imagem = IMAGEM; Laboratório = LABORATORIO; ECG = texto + anexos ECG antigos; anexos OUTRO antigos aparecem na aba Evoluções, no cartão da evolução.
4. **Acessibilidade:** sai Atkinson, entram Inter + Poppins. As regras de 16px nos campos (celular) e **44px de alvo de toque valem também para as pílulas e botões pequenos** — "pequeno" é visual (texto 13px, padding horizontal curto), a altura mínima de toque continua 44px no celular. Contraste AA.
5. **E2E:** cada task deixa a suíte verde ao terminar (ajusta os e2e das telas que tocou); sem camada de compatibilidade.
6. **Rodapé fixo:** respeita `env(safe-area-inset-bottom)`; z-index abaixo de diálogos e toasts; o conteúdo ganha padding inferior igual à altura do rodapé. O app não tem barra de navegação inferior.
7. **Telas sem protótipo:** o builder usa os dois protótipos aprovados como guia de estilo e consulta o protótipo original em `~/Downloads/medsystem_pro_v3.html` (máquina local; não versionar). Cada task de tela entrega prints de celular e computador para o controller conferir.
