# VotaLivre 1.0 RC1 — Acesso online (ambiente de homologação)

**Não usar com dados reais de eleitores ou em votações vinculantes.** Esta versão ainda não passou por build Next.js integral nem teste de invasão.

## Já provisionado

- Projeto Vercel: `votalivre-homologacao` (conta conectada, proteção de acesso ativada).
- Projeto Neon: `votalivre-homologacao-2026`.
- Banco novo, separado dos ensaios anteriores: `votalivre_web_qa`.
- Arquivos corrigidos: diretiva `use client` em `components/AdminPanel.js` e `APP_ORIGIN` com alternativa segura `VERCEL_URL` para URLs de prévia.

## 1. Preparação no seu Windows 11

Descompacte esta versão corrigida numa pasta fora do OneDrive, por exemplo `C:\Projetos\VotaLivre_Secure_v1_0_Homologacao`.
Abra a pasta que contém `package.json` no VS Code. No terminal integrado do PowerShell:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
```

O build precisa concluir com sucesso antes de qualquer publicação.

## 2. Configurar Neon

Abra [Neon](https://console.neon.tech), projeto `votalivre-homologacao-2026`, banco `votalivre_web_qa`.
No SQL Editor, selecionando ESTE banco, execute **uma única vez** `sql/schema.sql`, em seguida `sql/migrate_0_6_to_0_7.sql`, e `sql/migrate_0_7_to_0_8.sql` nessa ordem. Não execute em banco com dados reais.
Copie sua `DATABASE_URL` de conexão **sem compartilhá-la em mensagens**.

## 3. Configurar segredos locais

Copie `.env.example` para `.env.local`, ajuste `DATABASE_URL`, deixe `APP_ORIGIN=http://localhost:3000` apenas localmente e gere chaves com `npm.cmd run keys`. Configure as sete chaves secretas geradas. Preserve o arquivo `.env.local` fora de qualquer repositório.
Crie o primeiro gestor localmente, usando as mesmas chaves que serão configuradas na Vercel:

```powershell
node --env-file=.env.local scripts/bootstrap-admin.mjs "Organizacao Teste" "seu-email@dominio.com"
```

Salve em segurança o identificador UUID e o segredo MFA. Não exponha esses dados em capturas de tela.

## 4. Enviar o projeto à Vercel (prévia protegida)

Instale/execute o cliente Vercel a partir da pasta do projeto:

```powershell
npx.cmd vercel login
npx.cmd vercel link --scope vinicius-machado-de-carvalho-s-projects --project votalivre-homologacao --yes
```

No painel Vercel, em `votalivre-homologacao` > Settings > Environment Variables, configure os segredos **para Preview**: `DATABASE_URL`, as sete chaves hexadecimais geradas localmente e `ELECTION_TRUST_ANCHORS_JSON={}`. Não configure `APP_ORIGIN` em Preview; a aplicação usa o `VERCEL_URL` de confiança provido pela Vercel para validar a origem de POSTs.

Execute:

```powershell
npx.cmd vercel deploy --yes
```

Abra o URL HTTPS apresentado. A proteção Vercel Authentication exigirá login autorizado para acessar a prévia.

## 5. O que falta antes de votação real

- `ELECTION_TRUST_ANCHORS_JSON={}` deixa a publicação de resultados bloqueada de propósito. O mapa correto deve ser registrado antes de qualquer eleição, por uma comissão que guarde suas cópias externas.
- Revisão externa de segurança, testes HTTP com banco e concorrência, backup/recuperação, política LGPD e proteção contra coação.
- Não há bloqueio absoluto de screenshots na web.
- Nunca migrar esse banco de homologação para uma eleição vinculante sem reavaliação.
