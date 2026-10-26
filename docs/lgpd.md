# LGPD — Prontuário de internação da Santa Casa de Dracena

Documento simples para o hospital (controlador dos dados). Não substitui parecer jurídico nem o encarregado (DPO) do hospital.

## Finalidade

Registrar a internação e a evolução clínica dos pacientes (médica e multiprofissional), com validação, impressão e alta, para a continuidade do cuidado e para cumprir a obrigação legal de manter o prontuário.

## Base legal

Dado pessoal sensível de saúde, tratado para a **tutela da saúde**, em procedimento realizado por profissionais de saúde (LGPD, art. 11, II, "f") e para **cumprimento de obrigação legal** (art. 11, II, "a"): CFM 1.638/2002, CFM 1.821/2007 e Lei 13.787/2018.

## Dados tratados

- Paciente: nome, nascimento, CPF, CNS, nome da mãe, convênio, internação (equipe, leito/datas, alta).
- Clínicos: evoluções, anexos (fotos/PDF de exames), impressões.
- Profissionais: nome, e-mail, perfil, conselho/número/UF.
- Auditoria: quem fez o quê e quando.

Minimização: só o necessário à internação. Notificações push nunca levam nome de paciente nem conteúdo clínico.

## Quem acessa

| Perfil | Acesso |
|---|---|
| Médico, residente, multiprofissional | Pacientes e evoluções, conforme regras do perfil e da equipe |
| Recepção | Admissão e dados cadastrais |
| Auditoria | Leitura de tudo; cada abertura é registrada |
| Admin | Gestão de usuários e equipes; **não lê nem edita conteúdo clínico**. Exige MFA (TOTP) |

- Cadastro público desligado: só entra quem o admin convidou.
- O controle é feito no banco (RLS), não só na tela.
- Sessão expira após 30 minutos de inatividade; o admin pode desativar a conta e derrubar sessões (aparelho perdido).
- Acesso interno da equipe técnica ao painel do Supabase/Netlify/Cloudflare: restrito ao responsável técnico, com MFA nas contas.

## Registro de acesso e integridade

- Trilha de auditoria em pacientes, internações, evoluções, profissionais e equipes.
- Evolução finalizada não pode ser alterada nem apagada; correção só por adendo.
- Impressão com controle de vias.

## Retenção

- **Guarda mínima de 20 anos** a partir do último registro (Lei 13.787/2018; CFM 1.821/2007). Nada é apagado automaticamente; registros são desativados, não excluídos.
- Backup do banco: 30 dias de dumps diários criptografados (mais PITR do Supabase Pro). Anexos: cópia criptografada sem expiração.
- Exportação anual da base para guarda de longo prazo (a definir pelo hospital).
- Pedido de eliminação do titular: dados do prontuário não podem ser eliminados durante a guarda legal (LGPD, art. 16, I); responder ao titular com essa justificativa.

## Operadores e região

| Operador | Papel | Região / observação |
|---|---|---|
| Supabase | Banco (Postgres), autenticação, arquivos | São Paulo (`sa-east-1`) |
| Netlify | Hospedagem do site (não guarda dado clínico) | Servidores globais; só trafega o conteúdo das páginas |
| Cloudflare R2 | Backups criptografados (`age` / `rclone crypt`) | Região automática; conteúdo ilegível sem a chave |
| GitHub | Executa o backup (sem gravar dados em log/artefato) | — |
| Resend (SMTP) | E-mails de convite e recuperação | Só e-mail e nome do profissional |

Formalizar contratos/aditivos de operador (DPA) com cada fornecedor. Há transferência internacional de dados (fornecedores com sede no exterior); o hospital deve registrar a base legal (LGPD, art. 33) com apoio jurídico.

## Segurança

HTTPS/HSTS, CSP com nonce, `X-Frame-Options: DENY`, `Cache-Control: no-store` nas páginas autenticadas, RLS em todas as tabelas, chave `service_role` apenas em Edge Function, backups criptografados, MFA obrigatório para admin. Detalhes: [deploy](deploy.md) e [backup](backup.md).

### Cópia local de rascunho no aparelho

O app guarda uma cópia local do rascunho de evolução no IndexedDB do navegador, para não perder texto clínico sem rede. No logout (manual ou por inatividade) as cópias **já sincronizadas** são apagadas. Um rascunho **ainda não sincronizado** permanece no aparelho depois do logout, de propósito, para não perder texto clínico. Ele só é apagado quando o mesmo usuário entra de novo e o rascunho sincroniza. Em aparelho compartilhado ou perdido, isso significa que um texto não enviado pode ficar no navegador até esse novo login; o admin pode desativar a conta, mas não apaga a cópia local. A tela de login avisa quando há rascunho pendente.

## Incidentes

1. Conter: desativar o usuário/aparelho envolvido (admin), trocar senhas e chaves afetadas.
2. Avaliar: consultar a trilha de auditoria (quem, o quê, quando) e quantificar titulares afetados.
3. Comunicar: o hospital (controlador) avisa a **ANPD** e os titulares em prazo razoável (a ANPD indica 3 dias úteis) quando houver risco ou dano relevante.
4. Registrar o incidente, a causa e a correção.

Contato do responsável (preencher): ______________________
