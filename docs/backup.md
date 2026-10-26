# Backup diário criptografado

O workflow `.github/workflows/backup.yml` roda todo dia às 06:00 UTC (e sob demanda) e copia, para um bucket do Cloudflare R2:

| O quê | Onde no R2 | Retenção |
|---|---|---|
| Banco (`pg_dump` -> gzip -> `age`) | `db/<ambiente>/<AAAA-MM-DDTHHMMSSZ>.sql.gz.age` | 30 dias (regra de lifecycle) |
| Anexos (bucket `anexos` do Supabase Storage, `rclone` crypt) | `anexos/<ambiente>/...` (nomes e conteúdo criptografados) | Sem expiração (retenção legal) |

O backup do Supabase **não** inclui os arquivos do Storage, por isso os anexos são copiados à parte. A cópia usa `rclone copy`, nunca `sync`: o que for apagado na origem continua no destino.

O agendamento (`schedule`) só roda a partir do branch padrão (`main`). Antes do go-live, teste pelo `workflow_dispatch` (Actions -> Backup -> Run workflow, escolhendo o branch e o ambiente).

Nada de dado vai para artefato ou log do GitHub. O dump em texto puro nunca é gravado em disco: sai do `pg_dump` direto para o `gzip` e o `age`.

Se o secret `SUPABASE_DB_URL_PROD` não existir, o job `prod` termina com uma anotação "Ignorado" e o agendamento só faz staging. Se o ambiente está configurado e falta qualquer secret de destino (R2 ou chave age), o job **falha** em vez de pular.

## 1. Bucket no R2

1. Cloudflare -> R2 -> **Create bucket** (ex.: `prontuario-backup`). Região automática.
2. Bucket -> **Settings** -> **Object lifecycle rules** -> **Add rule**:
   - Nome: `expirar-dumps-30-dias`
   - Prefixo: `db/`
   - Ação: excluir objetos 30 dias após a criação.
   - **Não** crie regra para `anexos/`: essa cópia não expira.
3. R2 -> **Manage R2 API Tokens** -> **Create API token** com permissão **Object Read & Write** restrita a esse bucket. Guarde o *Access Key ID* e o *Secret Access Key* (aparecem uma vez).
4. O endpoint S3 aparece na página do bucket: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (sem o nome do bucket no final).

## 2. Chave `age`

Gere no seu computador (não na CI):

```bash
brew install age            # ou: apt install age
age-keygen -o backup-age.key
# Public key: age1xxxxxxxx...   <- vai para o secret BACKUP_AGE_PUBLIC_KEY
```

- A linha `Public key: age1...` (também exibida ao rodar o comando) é o valor de `BACKUP_AGE_PUBLIC_KEY`.
- O arquivo `backup-age.key` é a **chave privada**. Guarde fora do GitHub e fora do R2: gerenciador de senhas e uma cópia offline (pendrive em local seguro). Quem perder essa chave perde a capacidade de restaurar qualquer dump. Quem a obtiver lê todos os dumps.
- Guarde também as senhas do `rclone` crypt (seção 3), pelo mesmo motivo.

## 3. Secrets do GitHub

Repositório -> Settings -> Secrets and variables -> Actions, ou pela CLI (`gh secret set NOME`, que pede o valor sem gravar no histórico do shell).

Gere as senhas do `rclone` crypt com, por exemplo, `openssl rand -base64 32` (uma para a senha, outra para o salt).

```bash
# R2
gh secret set R2_ENDPOINT                         # https://<ACCOUNT_ID>.r2.cloudflarestorage.com
gh secret set R2_ACCESS_KEY_ID                    # token de API do R2 (seção 1)
gh secret set R2_SECRET_ACCESS_KEY                # token de API do R2 (seção 1)
gh secret set R2_BUCKET                           # nome do bucket, ex.: prontuario-backup

# Criptografia
gh secret set BACKUP_AGE_PUBLIC_KEY               # age1... (seção 2)
gh secret set RCLONE_CRYPT_PASSWORD               # senha do crypt dos anexos (guardar fora do GitHub)
gh secret set RCLONE_CRYPT_PASSWORD2              # salt do crypt (opcional, mas recomendado; guardar fora do GitHub)

# Banco
gh secret set SUPABASE_DB_URL_STAGING             # connection string do projeto de staging
gh secret set SUPABASE_DB_URL_PROD                # idem, projeto de produção (só quando existir)

# Storage (API S3 do Supabase), do projeto copiado
gh secret set SUPABASE_STORAGE_S3_ENDPOINT        # https://<ref>.storage.supabase.co/storage/v1/s3
gh secret set SUPABASE_STORAGE_S3_ACCESS_KEY_ID
gh secret set SUPABASE_STORAGE_S3_SECRET_ACCESS_KEY
gh secret set SUPABASE_STORAGE_S3_REGION          # região do projeto, ex.: sa-east-1
```

Onde achar no Supabase (Dashboard do projeto):

- **`SUPABASE_DB_URL_*`**: botão **Connect** -> aba **Session pooler** (porta 5432). Use o pooler, não a conexão direta: a direta é só IPv6 e os runners do GitHub não têm IPv6. Substitua `[YOUR-PASSWORD]` pela senha do banco (Project Settings -> Database -> Reset database password, se não a tiver). Formato: `postgresql://postgres.<ref>:<senha>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`.
- **`SUPABASE_STORAGE_S3_*`**: Project Settings -> **Storage** -> **S3 Connection**: o *Endpoint* e a *Region* aparecem ali; em **S3 access keys** -> **New access key** gera o *Access key ID* e o *Secret access key* (aparecem uma vez).

### Um conjunto de secrets de Storage por ambiente

Os secrets de Storage têm o mesmo nome para staging e produção, mas o valor é de **um projeto**. O job usa o GitHub *Environment* de mesmo nome do ambiente (`staging`, `prod`), então:

- Enquanto só existe staging, os secrets de repositório acima bastam.
- Ao criar a produção, crie os Environments `staging` e `prod` (Settings -> Environments) e cadastre `SUPABASE_STORAGE_S3_*` em cada um com os valores do respectivo projeto (`gh secret set NOME --env prod`). O secret do Environment prevalece sobre o do repositório. **Não** deixe a produção rodar com as chaves de staging: os anexos de staging iriam parar em `anexos/prod/`.
- **Trava automática:** o passo de anexos extrai o *project ref* do `SUPABASE_STORAGE_S3_ENDPOINT` (host `<ref>.storage.supabase.co`) e do usuário do `SUPABASE_DB_URL_<AMBIENTE>` (Session pooler: `postgres.<ref>`). Se forem diferentes, ou se a URL do banco não tiver `postgres.<ref>`, o passo de anexos **falha** com a mensagem "Storage e banco não são do mesmo projeto" (o dump do banco já foi enviado). Nenhum valor secreto vai para o log.
- Os secrets de Storage devem ser cadastrados **por Environment** (`staging` e `prod`) quando houver produção.
- Os logs do `rclone` mostram só erros e o progresso agregado, nunca nomes de arquivos (são dados de pacientes).
- Se os secrets de Storage ou `RCLONE_CRYPT_PASSWORD` estiverem vazios, o banco ainda é copiado e o job emite um aviso `Anexos ... Ignorado`.

## 4. Rodar manualmente

```bash
gh workflow run backup.yml -f ambiente=staging     # staging | prod | ambos
gh run watch
```

Ou pela aba Actions -> Backup -> Run workflow. Confira no R2 que apareceu `db/<ambiente>/<carimbo>.sql.gz.age` e objetos em `anexos/<ambiente>/`.

## 5. Restaurar

**Teste a restauração antes do go-live** e repita de tempos em tempos. Backup nunca restaurado não é backup. Restaure sempre em um banco descartável, nunca por cima da produção sem decisão consciente.

### Banco

Precisa de `aws` cli, `age`, `gunzip` e `psql` 17.

```bash
export AWS_ACCESS_KEY_ID=...        # token do R2
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=auto
ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
BUCKET=prontuario-backup

# 1. escolher o dump
aws s3 ls "s3://$BUCKET/db/staging/" --endpoint-url "$ENDPOINT"

# 2. baixar
aws s3 cp "s3://$BUCKET/db/staging/2026-10-26T060012Z.sql.gz.age" dump.sql.gz.age --endpoint-url "$ENDPOINT"

# 3. descriptografar com a chave privada (guardada offline) e descompactar
age -d -i backup-age.key dump.sql.gz.age | gunzip > dump.sql

# 4. subir um Postgres 17 descartável e carregar
docker run -d --name restore-teste -e POSTGRES_PASSWORD=teste -p 54999:5432 postgres:17
psql "postgresql://postgres:teste@localhost:54999/postgres" -f dump.sql
```

Alternativa: criar um projeto Supabase descartável e usar a connection string dele no `psql`. Nesse caso, mensagens de "already exists" para os schemas gerenciados pelo Supabase (`auth`, `storage`, `extensions`) são esperadas; confira que as tabelas de `public` e os dados chegaram.

Valide: contagem de linhas de `public.internacoes`, `public.evolucoes`, `public.profissionais` e a presença dos registros recentes. Depois apague o dump em texto puro (`shred -u dump.sql` ou `rm`) e o banco descartável (`docker rm -f restore-teste`).

### Anexos

Precisa de `rclone`, do token do R2 e das **mesmas** `RCLONE_CRYPT_PASSWORD` (e `RCLONE_CRYPT_PASSWORD2`, se foi usada) do backup.

```bash
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=...
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=...
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_CRIPTO_TYPE=crypt
export RCLONE_CONFIG_CRIPTO_REMOTE=R2:prontuario-backup/anexos/staging
export RCLONE_CONFIG_CRIPTO_PASSWORD="$(rclone obscure 'SENHA')"
export RCLONE_CONFIG_CRIPTO_PASSWORD2="$(rclone obscure 'SALT')"   # só se foi usado

rclone lsf CRIPTO: --max-depth 1                 # nomes já descriptografados
rclone copy CRIPTO: ./anexos-restaurados -v      # baixa tudo, descriptografado
```

Para devolver os arquivos a um projeto Supabase, configure um remoto S3 com as chaves do Storage dele (como no workflow) e rode `rclone copy ./anexos-restaurados DESTINO:anexos`. O caminho dos objetos (`<internacao>/<arquivo>`) precisa ser o mesmo, pois a tabela de anexos no banco aponta para ele.

Como o `copy` nunca apaga, o destino também guarda arquivos removidos depois na origem. Isso é intencional.
